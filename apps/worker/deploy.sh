#!/bin/bash
set -e

echo "=== T1D Tracker — Déploiement Cloudflare Workers ==="

# 1. Login
wrangler login

# 2. Créer la D1 database (idempotent — skip si déjà créée)
echo "Création D1..."
wrangler d1 create t1d-tracker-db || echo "DB déjà existante, skip."

echo "⚠️  Copie le database_id affiché ci-dessus dans wrangler.toml si c'est la première fois."
read -p "Appuie sur Entrée une fois wrangler.toml mis à jour..."

# 3. Migrations
echo "Migrations remote..."
wrangler d1 execute t1d-tracker-db --remote \
  --file=migrations/0001_init.sql

# 4. Clés VAPID
echo "Génération clés VAPID..."
VAPID=$(npx web-push generate-vapid-keys --json)
VAPID_PUB=$(echo $VAPID | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).publicKey))")
VAPID_PRIV=$(echo $VAPID | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).privateKey))")

echo "VAPID Public Key: $VAPID_PUB"
echo "→ Copie cette clé dans .env.production comme VITE_VAPID_PUBLIC_KEY"

wrangler secret put VAPID_PUBLIC_KEY <<< "$VAPID_PUB"
wrangler secret put VAPID_PRIVATE_KEY <<< "$VAPID_PRIV"
wrangler secret put VAPID_SUBJECT <<< "mailto:contact@t1dtracker.app"

# 5. Deploy
echo "Deploy..."
wrangler deploy

echo "=== ✅ Worker déployé ! Récupère l'URL ci-dessus et configure Vercel. ==="
