# Déploiement — Cloudflare Workers

## Prérequis
- `wrangler` installé et authentifié (`wrangler login`)
- Un compte Cloudflare avec Workers + D1 activés

---

## 1. Créer la base D1

```bash
cd apps/worker
wrangler d1 create t1d-tracker-db
```

Copier l'`database_id` retourné dans `wrangler.toml` :

```toml
[[d1_databases]]
binding        = "DB"
database_name  = "t1d-tracker-db"
database_id    = "<COLLER ICI>"
```

## 2. Appliquer les migrations

```bash
# Environnement local (dev)
wrangler d1 execute t1d-tracker-db --local --file=migrations/0001_init.sql

# Production
wrangler d1 execute t1d-tracker-db --remote --file=migrations/0001_init.sql
```

## 3. Générer les clés VAPID

```bash
# Via Node (une seule fois — stocker les clés en lieu sûr)
node -e "
const { webcrypto } = require('crypto');
webcrypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey']
).then(async ({ publicKey, privateKey }) => {
  const pub = Buffer.from(await webcrypto.subtle.exportKey('raw', publicKey)).toString('base64url');
  const priv = JSON.stringify(await webcrypto.subtle.exportKey('jwk', privateKey));
  console.log('PUBLIC:', pub);
  console.log('PRIVATE:', priv);
});
"
```

## 4. Configurer les secrets Workers

```bash
wrangler secret put VAPID_PUBLIC_KEY    # coller la clé publique base64url
wrangler secret put VAPID_PRIVATE_KEY   # coller le JWK privé (JSON string)
wrangler secret put VAPID_SUBJECT       # ex: mailto:contact@example.com
```

Mettre à jour `CORS_ORIGIN` dans `wrangler.toml` avec l'URL Vercel de production.

## 5. Déployer

```bash
wrangler deploy
```

## 6. Connecter le frontend

Dans `apps/web`, créer `.env.local` :

```
VITE_WORKER_URL=https://t1d-tracker-worker.<your-subdomain>.workers.dev
```

Le frontend appelle :
- `GET  /api/push/vapid-public-key` — pour récupérer la clé VAPID publique
- `POST /api/push/subscribe`        — à l'activation des notifications
- `POST /api/reminders`             — à chaque reminder activé avec push
- `PUT  /api/reminders/:id`         — toggle enabled
- `DELETE /api/reminders/:id`       — suppression

## Notes iOS
- `Notification.requestPermission()` **uniquement** dans un handler `onClick`
- Vérifier `window.matchMedia('(display-mode: standalone)').matches` avant de proposer
- Chaque push déclenche `showNotification()` dans le SW (déjà câblé dans `sw.ts`)
