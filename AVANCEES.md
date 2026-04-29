# T1D Tracker — État d'avancement du projet

**Dernière mise à jour** : 2026-04-29

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vite 8 + React 19 + TypeScript 6 + Tailwind v4 |
| UI | shadcn/ui, Lucide React, Framer Motion v12 |
| Base de données locale | Dexie.js v4 (IndexedDB) + dexie-react-hooks |
| State management | Zustand v5 |
| Formulaires | React Hook Form + Zod |
| Graphiques | uPlot |
| Routing | React Router v7 |
| PWA | vite-plugin-pwa + Workbox |
| Animations célébration | canvas-confetti |
| Tests E2E | Playwright 1.56.0 |
| Backend | Hono + Cloudflare Workers + D1 |

---

## Session 2026-04-29 — Étapes 16 & 17-B

### ✅ Étape 16 : Tests E2E Playwright Push Notifications
- [x] `apps/web/e2e/helpers.ts` — helpers Playwright
  - `dismissDisclaimer()`, `waitForSwControl()`, `waitForSwActivated()`
  - `mockPushManager()` — patch `PushManager.prototype` (plain JS, avant page scripts)
  - `spoofStandalone()` — override `matchMedia('(display-mode: standalone)')`
- [x] `apps/web/e2e/push.spec.ts` — 8 tests (6 UI states + 2 SW handler)
- [x] `apps/web/e2e/offline.spec.ts` — 4 tests offline + SPA routing
- [x] `apps/web/e2e/sw.spec.ts` — 4 tests SW lifecycle + precaching
- [x] `apps/web/playwright.config.ts` — config Playwright 1.56.0
- [x] Fix `Settings.tsx` — Dexie `orderBy('time')` → `toArray().sort()` (champ non-indexé)
- [x] Update `sw.ts` — `skipWaiting()` + `clients.claim()` + `NavigationRoute` Workbox
- [x] **14/14 tests Playwright passent ✅**

### ✅ Étape 17-B : Système Mascotte Animée (Dashboard)
- [x] `src/components/GlucoseMascot.tsx`
  - Panda 🐼 (in-range 70–180) — bounce y: 0→-6→0, 1.4s, Framer Motion
  - Tortue 🐢 (low <70) — pulse scale: 1→0.92→1, 2.2s + "Mange quelque chose ! 🍬"
  - Chat 🐱 (high >180) — rotation -6°→6°, 0.6s + "Bois de l'eau ! 💧"
  - Sleeping 😴 (no data) — breathe scale: 1→1.04→1, 3s
  - Couronne 👑 animée si streak ≥ 7 jours
  - Badge "🔥 X jours dans la cible" si streak > 0
- [x] `src/hooks/useStreak.ts` — jours consécutifs TIR ≥ 70% (fenêtre 30j, live Dexie)
- [x] `src/routes/Dashboard.tsx` — mascotte + confetti (canvas-confetti) sur lecture in-range
- [x] TypeScript — 0 erreurs (`npx tsc --noEmit`) ✅

### ✅ Documentation
- [x] `CLAUDE.md` exhaustif — architecture, pièges Dexie/Playwright, SW, backend, déploiement
- [x] `apps/web/.gitignore` — ajout `test-results/`, `playwright-report/`

---

## Fonctionnalités complètes et testées

### PWA & infrastructure
- [x] App installable (manifest PWA, icônes, meta viewport)
- [x] Service Worker Workbox (précache assets, offline-first)
- [x] Push handler SW (reçoit notifications Web Push)
- [x] Notification click handler (focus + navigation)
- [x] pushsubscriptionchange handler (renouvellement auto abonnement)
- [x] Background sync outbox (retry POST /api/sync quand réseau revient)
- [x] Thème clair / sombre / système (CSS custom properties, `data-theme`)
- [x] Safe area iOS (padding bottom nav)
- [x] Disclaimer médical modal premier lancement

### Base de données locale (Dexie)
- [x] `glucoseReadings` — timestamp, value (mg/dL), source, notes
- [x] `insulinDoses` — timestamp, units, type (basal/bolus/correction), notes
- [x] `mealLogs` — timestamp, carbs, description, glycemicIndex
- [x] `noteEntries` — timestamp, content
- [x] `reminders` — type, label, time, days[], enabled, pushSubscriptionId
- [x] `outbox` — sync offline
- [x] `settings` — clé/valeur générique

### Dashboard (`/`)
- [x] Glycémie actuelle (formatée mg/dL ou mmol/L selon réglage)
- [x] Couleur dynamique selon zone (bas / in-range / haut)
- [x] Flèche de tendance (calculée sur les 3 dernières heures)
- [x] Sparkline 3h (uPlot)
- [x] TIR Bar — Temps Dans la Cible aujourd'hui (24h glissantes)
- [x] Cards info rapide : dernier repas, dernière insuline, prochain rappel
- [x] État "aucune mesure" avec call-to-action
- [x] FAB (+) vers Log
- [x] **Mascotte animée + streak counter** 🎉

### Mascotte animée (`GlucoseMascot`)
- [x] Panda 🐼 — in-range, bounce vertical 1.4s
- [x] Tortue 🐢 — low, slow pulse, message "Mange quelque chose ! 🍬"
- [x] Chat 🐱 — high, rotation agitée, message "Bois de l'eau ! 💧"
- [x] Sleeping 😴 — no data, animation respiration
- [x] Confetti 🎊 — canvas-confetti sur nouvelle lecture in-range
- [x] Streak counter — jours consécutifs TIR ≥ 70% (Dexie live)
- [x] Badge "🔥 N jours dans la cible" si streak > 0
- [x] Couronne 👑 si streak ≥ 7 jours

### Log (`/log`)
- [x] Tab Glycémie — valeur, timestamp, notes ; conversion mmol/L ↔ mg/dL automatique
- [x] Tab Insuline — unités, type (bolus/correction/basal), timestamp, notes
- [x] Tab Repas — glucides, description, index glycémique, timestamp
- [x] Tab Note — texte libre, timestamp
- [x] Validation Zod + React Hook Form
- [x] Confirmation visuelle + retour auto Dashboard après 1.2s

### Courbes (`/charts`)
- [x] Graphique uPlot interactif glycémie
- [x] Sélecteur de période : 24h / 7j / 14j / 30j
- [x] Bandes cible (targetLow, targetHigh) sur le graphique
- [x] TIR Bar pour la période sélectionnée
- [x] GMI (Glucose Management Indicator) calculé
- [x] Statistiques : moyenne, écart-type, min, max

### Historique (`/history`)
- [x] Liste unifiée de tous les événements
- [x] Tri chronologique inverse
- [x] Filtres par type (boutons pill)
- [x] Suppression avec confirmation
- [x] Limite 200 entrées par type

### Réglages (`/settings`)
- [x] Unité glycémie : mg/dL / mmol/L
- [x] Thème : Auto / Clair / Sombre
- [x] Cibles glycémiques — stepper +/−
- [x] Rappels CRUD complet — ajout, toggle, suppression
- [x] Export CSV avec disclaimer
- [x] Disclaimer médical pied de page

### Tests E2E Playwright
- [x] 8 tests push notifications (UI states + SW handler)
- [x] 4 tests offline mode
- [x] 4 tests Service Worker lifecycle
- [x] **16 tests — tous passent ✅**

---

## Backend Cloudflare Worker (Étape 15 — implémenté)

- [x] Hono v4 + Wrangler + D1 SQLite
- [x] `@block65/webcrypto-web-push` — VAPID compatible Workers runtime
- [x] `push_subscriptions` + `scheduled_reminders` tables
- [x] Cron Trigger `* * * * *` — timezone-aware, batching, auto-purge 404/410
- [x] Endpoints : `GET /api/push/vapid-public-key`, `POST/DELETE /api/push/subscribe`, `POST /api/push/test`, `POST/PUT/DELETE /api/reminders`

---

## Ce qui reste à faire

| Fonctionnalité | Priorité | Statut |
|---|---|---|
| **Déploiement Vercel (frontend)** | Haute | 🔜 Étape 17 |
| **Déploiement Cloudflare Workers** | Haute | 🔜 Étape 17 |
| Bouton "Tester la notification" dans Settings | Moyenne | — |
| Sync cloud (D1 via Worker) | Moyenne | — |
| Import données (CSV, Nightscout) | Basse | — |

---

## Prochaines étapes — Étape 17 : Déploiement

### Frontend (Vercel)
1. Créer projet Vercel lié à `apps/web/`
2. Build: `npm run build` → output: `dist`
3. Env var: `VITE_WORKER_URL=https://[worker].workers.dev`
4. Deploy

### Backend (Cloudflare Workers)
1. `wrangler login`
2. `wrangler d1 create t1d-tracker-db` → copier database_id dans `wrangler.toml`
3. `wrangler d1 execute t1d-tracker-db --remote --file=migrations/0001_init.sql`
4. `wrangler secret put VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`
5. `wrangler deploy`
6. Mettre à jour `CORS_ORIGIN` dans `wrangler.toml`

---

## Notes techniques

### ⚠️ Dexie pitfall
`db.reminders.orderBy('time')` lève `SchemaError` au runtime car `time` n'est pas indexé.
→ Utiliser `db.reminders.toArray().then(arr => arr.sort((a,b) => a.time.localeCompare(b.time)))`

### ⚠️ Playwright + grantPermissions
`context.grantPermissions(['notifications'])` dans les tests UI déclenche l'infra push native Chrome (crash headless).
→ Mocker `Notification.permission` via `page.addInitScript()` à la place.

### ⚠️ addInitScript — plain JS obligatoire
Les callbacks sont sérialisés en JS brut — pas d'annotations TypeScript, utiliser `var` et `function() {}`.

---

## Structure des fichiers

```
t1d-tracker/
  apps/
    web/
      src/
        routes/        Dashboard, Log, Charts, History, Settings
        components/    GlucoseMascot ✨, DisclaimerModal, charts/, layout/
        hooks/         useStreak ✨, usePushSubscription
        db/            schema.ts
        stores/        settings.ts, ui.ts
        lib/           calculations.ts, utils.ts, worker.ts
        sw/            sw.ts
      e2e/             helpers.ts ✨, push.spec.ts ✨, offline.spec.ts ✨, sw.spec.ts ✨
      playwright.config.ts ✨
    worker/
      src/             index.ts, push.ts, scheduler.ts
      migrations/      0001_init.sql
  CLAUDE.md            ✨ guide projet complet
  AVANCEES.md          ce fichier
```
