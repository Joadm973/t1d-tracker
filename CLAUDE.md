# T1D Tracker — Instructions pour Claude Code

## Projet
PWA React pour suivi diabète type 1. Offline-first, installable iPhone (PWA via Safari Add to Home Screen).

## Stack
- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- **State/Data**: Dexie.js (IndexedDB, source de vérité locale) + TanStack Query + Zustand
- **Graphiques**: uPlot
- **Animations**: Framer Motion v12
- **Confetti**: canvas-confetti
- **Backend**: Hono + Cloudflare Workers + D1 (SQLite) + Web Push
- **Tests E2E**: Playwright 1.56.0 (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)

## Structure
```
apps/web/     — Frontend PWA (Vite + React)
  src/
    routes/       — Pages: Dashboard, Log, Charts, History, Settings
    components/   — Composants réutilisables (PascalCase, 1 fichier/composant)
      layout/     — Header, BottomNav, SafeArea
      charts/     — GlucoseSparkline, TIRBar
      forms/      — Formulaires de saisie
      ui/         — shadcn/ui wrappers
    hooks/        — Hooks custom (préfixe use*)
    stores/       — Stores Zustand (settings.ts, ui.ts)
    lib/          — Utilitaires (calculations.ts, worker.ts, utils.ts)
    db/           — Dexie schema (schema.ts)
    sw/           — Service Worker (sw.ts)
  e2e/            — Tests Playwright (push.spec.ts, helpers.ts)
apps/worker/  — Backend Cloudflare Workers (Hono + D1 + push)
design/       — Handoff bundles
```

## Conventions
- Composants : PascalCase, un fichier par composant
- Stores Zustand dans `src/stores/`
- Hooks custom dans `src/hooks/` (préfixe `use*`)
- Calculs cliniques dans `src/lib/calculations.ts`
- **JAMAIS** de calcul de dose d'insuline recommandée (réglementation médicale)
- Touch targets minimum 44px (WCAG 2.5.5)
- Toujours afficher le disclaimer médical aux 3 endroits définis

## Couleurs glycémie
Utiliser UNIQUEMENT les CSS custom properties (`--color-glucose-*`).
Ne jamais coder les couleurs en dur dans les composants.

```
--color-glucose-very-low  (< 54)
--color-glucose-low       (54–70)
--color-glucose-in-range  (70–180)
--color-glucose-high      (180–250)
--color-glucose-very-high (> 250)
```

Fonction utilitaire: `glucoseZone(value)` → `'very-low' | 'low' | 'in-range' | 'high' | 'very-high'`

## Calculs cliniques (src/lib/calculations.ts)
- `glucoseZone(value)` — zone pour une valeur
- `glucoseColor(value)` — couleur CSS custom property
- `calculateTIR(readings)` → `{ veryLow, low, inRange, high, veryHigh }` (pourcentages)
  - In-range: 70–180 mg/dL
  - Streak TIR: `inRange >= 70` pour un jour compté
- `trendArrow(readings)` — flèche de tendance
- `formatGlucose(value)` — formatage affichage
- `formatRelative(date)` — temps relatif

## Base de données Dexie (src/db/schema.ts)
**DB name**: `'t1d-tracker'`, **version**: 1

Schema:
```
readings:  '++id, time, value, source'
meals:     '++id, time, carbs, description'
doses:     '++id, time, units, type'
reminders: '++id, type, enabled'
outbox:    '++id, status, [status+time]'
```

**CRITIQUE**: Le champ `time` dans `reminders` n'est PAS indexé.
- NE PAS utiliser `db.reminders.orderBy('time')` — lève une `SchemaError` au runtime
- Utiliser `db.reminders.toArray().then(arr => arr.sort((a,b) => a.time.localeCompare(b.time)))` à la place

## useLiveQuery (dexie-react-hooks) — Piège critique
`useLiveQuery` stocke les erreurs async et les re-lance synchroniquement lors du prochain render React (`if (monitor.current.error) throw monitor.current.error`). Sans error boundary, cela crashe tout l'arbre React (0 boutons dans le DOM). Toujours trier en mémoire plutôt qu'avec `orderBy` sur un champ non-indexé.

## Service Worker (src/sw/sw.ts)
- `skipWaiting()` à l'install → `clients.claim()` à l'activate (contrôle immédiat sans rechargement)
- `NavigationRoute` Workbox pour le fallback SPA offline (`index.html` servi pour toutes les routes)
- Push handler: parse JSON payload, `showNotification` avec icon/badge/data
- Push fallback: si JSON invalide, affiche notification générique sans crash
- `pushsubscriptionchange`: resouscrit automatiquement avec l'ancienne `applicationServerKey`
- Background sync tag `'outbox-sync'`: `syncOutbox()` via IDB direct (Dexie non importable dans SW)

## Backend Cloudflare Workers (apps/worker/)
- Framework: **Hono**
- Base de données: **D1** (SQLite Cloudflare)
- Push: **Web Push** avec clés VAPID
- Endpoints:
  - `GET /api/push/vapid-public-key` → `{ publicKey: string }`
  - `POST /api/push/subscribe` → enregistre la subscription
  - `POST /api/push/unsubscribe` → supprime la subscription
  - `POST /api/push/send` → envoie une notification push

## Tests E2E Playwright (apps/web/e2e/)
- Config: `apps/web/playwright.config.ts`
- Browsers: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`
- Script: `npm run test:e2e` dans `apps/web/`
- Server: build + preview (Vite) sur `http://localhost:4173`
- `reuseExistingServer: !process.env.CI` — réutilise le serveur en dev

### Helpers (e2e/helpers.ts)
- `dismissDisclaimer(page)` — clique JS sur le bouton modal (évite instabilité Framer Motion)
- `waitForSwControl(page)` — attend que le SW contrôle la page (`clients.claim()`)
- `waitForSwActivated(page)` — attend l'état `'activated'` du SW
- `mockPushManager(page)` — patch `PushManager.prototype` avant les scripts de page (doit être appelé avant `page.goto()`)
- `spoofStandalone(page)` — override `matchMedia('(display-mode: standalone)')` → `matches: true`

### Pièges addInitScript
Les callbacks de `page.addInitScript()` sont sérialisés en JS brut:
- **Jamais** d'annotations TypeScript (`:string`, `<Type>`, etc.)
- Utiliser `var` au lieu de `const/let` (portée plus sûre)
- Utiliser `function() {}` au lieu de `() =>`
- `ServiceWorkerContainer` n'est pas un global → utiliser `Object.getPrototypeOf(navigator.serviceWorker)`

### Tests push.spec.ts
- Tests UI (describes "UI states"): NE PAS utiliser `context.grantPermissions(['notifications'])` — déclenche l'infra push native de Chrome qui crash en mode headless
- Mocker `Notification.permission` et `Notification.requestPermission` via `addInitScript` à la place
- Tests SW handler (describes "SW handler"): peuvent utiliser `grantPermissions`

### Navigation SPA dans les tests
Toujours naviguer via SPA (pas `page.goto('/settings')` directement):
```typescript
async function goToSettings(page) {
  await page.goto('/')
  await waitForSwControl(page)
  await dismissDisclaimer(page)
  await page.click('a[href="/settings"]')
}
```
Raison: `page.goto('/settings')` peut déclencher le `NavigationRoute` du SW de façon silencieuse.

## Feature: Mascotte Glucose (IMPLÉMENTÉ)
Placée entre le Header et la sparkline glucose dans Dashboard.tsx.

### Composant GlucoseMascot (src/components/GlucoseMascot.tsx)
- **Panda** 🐼 → glycémie normale (70–180) — animation bounce douce (y: 0→-6→0, 1.4s)
- **Tortue** 🐢 → hypoglycémie (<70) — pulse lent (scale: 1→0.92→1, 2.2s), message "Mange quelque chose ! 🍬"
- **Chat** 🐱 → hyperglycémie (>180) — rotation agitée (rotate: -6°→6°, 0.6s), message "Bois de l'eau ! 💧"
- **Panda endormi** 😴 → aucune donnée — animation respiration (scale: 1→1.04→1, 3s)
- Couronne 👑 animée sur la mascotte après streak ≥ 7 jours
- Badge "🔥 X jours dans la cible" affiché sous la mascotte si streak > 0

### Hook useStreak (src/hooks/useStreak.ts)
- Calcule les jours consécutifs avec TIR ≥ 70% (fenêtre 30 jours)
- Basé sur `db.glucoseReadings` groupés par jour (format: `yyyy-MM-dd`)
- Retourne `{ streak: number, showCrown: boolean }` (`showCrown` si streak ≥ 7)

### Dashboard (src/routes/Dashboard.tsx)
- `mascotZone` dérivé de `glucoseZone(latest.value)` + état `isStale`
- Confetti via `canvas-confetti` déclenché par `useEffect` sur `latest.id` quand la zone est `'in-range'`
- `useRef<number>` garde l'ID de la dernière lecture pour éviter les doublons

## Branches
- **Développement**: `claude/t1d-tracker-pwa-ZOPpM`
- Ne jamais pousser sur `main` sans validation

## Déploiement (TODO — Étape 17)
- **Frontend**: Vercel (projet `apps/web/`)
  - Build command: `npm run build`
  - Output dir: `dist`
  - Variables env: `VITE_WORKER_URL` (URL du worker Cloudflare)
- **Backend**: Cloudflare Workers (`apps/worker/`)
  - `wrangler deploy`
  - Variables: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
  - D1 database binding: `DB`

## Disclaimer médical
Afficher à 3 endroits : premier lancement (modale), pied de page Settings, export CSV.
Texte exact :
"Cette application est un outil de suivi personnel uniquement. Elle n'est pas un dispositif médical
et ne remplace pas les conseils de votre équipe soignante. Ne l'utilisez pas pour prendre des
décisions de traitement en cas d'hypoglycémie sévère ou d'urgence médicale."

## Dépendances notables (apps/web/package.json)
```json
{
  "dependencies": {
    "canvas-confetti": "^1.9.4",
    "framer-motion": "^12.x",
    "dexie": "^4.x",
    "dexie-react-hooks": "^1.x",
    "workbox-precaching": "^7.x",
    "workbox-routing": "^7.x"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@types/canvas-confetti": "^1.9.0"
  }
}
```
