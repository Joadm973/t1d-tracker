# Avancée — T1D Tracker PWA

**Date**: 2026-04-29  
**Session**: Claude Code continuation after context compaction  
**Model**: claude-haiku-4-5-20251001

## ✅ Étapes terminées

### Étape 16 : E2E Push Notification Tests (COMPLÈTE)
- ✅ Créé `apps/web/e2e/helpers.ts` avec helpers Playwright
  - `dismissDisclaimer(page)` — JS click sur modal
  - `waitForSwControl(page)` — attend `clients.claim()`
  - `waitForSwActivated(page)` — attend état 'activated'
  - `mockPushManager(page)` — patch `PushManager.prototype` (plain JS, pas de TypeScript)
  - `spoofStandalone(page)` — override `matchMedia('(display-mode: standalone)')`
- ✅ Créé `apps/web/e2e/push.spec.ts` — 6 tests UI states + 2 tests SW handler
  - Tests UI : mocking `Notification.permission` via initScript (pas de `grantPermissions`)
  - Tests SW : avec `grantPermissions(['notifications'])`
- ✅ Créé `apps/web/e2e/offline.spec.ts` — 4 tests offline/SW caching
- ✅ Créé `apps/web/e2e/sw.spec.ts` — 4 tests SW lifecycle
- ✅ Créé `apps/web/playwright.config.ts` — config Playwright 1.56.0
- ✅ Fixé `apps/web/src/routes/Settings.tsx` — `useLiveQuery` orderBy('time') → toArray().sort() (Dexie pitfall)
- ✅ Mis à jour `apps/web/src/sw/sw.ts` — ajout `skipWaiting()` + `clients.claim()` + `NavigationRoute`
- ✅ Tous 14 tests Playwright passent ✅

### Étape 17-B : Animated Mascot System (COMPLÈTE)
- ✅ Installé `canvas-confetti` + `@types/canvas-confetti`
- ✅ Créé `apps/web/src/components/GlucoseMascot.tsx`
  - Panda 🐼 (in-range) — bounce y: 0→-6→0, 1.4s
  - Tortue 🐢 (low <70) — pulse scale: 1→0.92→1, 2.2s, message "Mange quelque chose ! 🍬"
  - Chat 🐱 (high >180) — rotation -6°→6°, 0.6s, message "Bois de l'eau ! 💧"
  - Sleeping 😴 (no data) — breathe scale: 1→1.04→1, 3s
  - Couronne 👑 sur mascotte si streak ≥ 7
  - Badge "🔥 X jours dans la cible" si streak > 0
- ✅ Créé `apps/web/src/hooks/useStreak.ts`
  - Calcul jours consécutifs TIR ≥ 70% (fenêtre 30 jours)
  - Basé sur `db.glucoseReadings` groupés par jour
  - Retourne `{ streak, showCrown }`
- ✅ Mis à jour `apps/web/src/routes/Dashboard.tsx`
  - Import `GlucoseMascot`, `useStreak`, `confetti`
  - Mascot placée entre Header et glucose card
  - Confetti burst sur nouvelle lecture in-range (via `useRef` + `useEffect`)
  - `mascotZone` dérivé de `glucoseZone(latest.value)` + état `isStale`

### Documentation complète
- ✅ Créé **CLAUDE.md** exhaustif (202 lignes)
  - Architecture complète, conventions, DB schema
  - Pièges critiques (useLiveQuery, Dexie orderBy)
  - Service Worker + Backend Workers + Tests E2E
  - Feature mascot documentée (IMPLÉMENTÉ)
  - Déploiement Vercel + Cloudflare (TODO étape 17)

### Autres
- ✅ Gitignore Playwright `test-results/`, `playwright-report/`, `.cache/`

## 📊 État actuellement

### Commits locaux non-pushés (4 total)
```
edb457e chore: gitignore Playwright test-results and reports
461f972 docs: update CLAUDE.md — mascot feature now implemented
697ecb0 feat: add animated mascot system + streak counter to Dashboard
651f15e fix(e2e): make push notification tests pass (step 16)
```

### 🚨 Problème Push
- ❌ `git push origin claude/t1d-tracker-pwa-ZOPpM` → **403 Permission denied**
- ❌ `mcp__github__push_files` → **403 Resource not accessible by integration**
- ❌ `mcp__github__create_or_update_file` → **403 Resource not accessible by integration**

**Workaround**: L'utilisateur doit pusher manuellement via PAT ou configurant l'accès.

## 📋 Remaining (TODO Étape 17+)

### Déploiement Frontend (Vercel)
- [ ] Créer projet Vercel lié à `apps/web/`
- [ ] Configurer build: `npm run build`, output: `dist`
- [ ] Ajouter env var `VITE_WORKER_URL`
- [ ] Déployer en prod

### Déploiement Backend (Cloudflare Workers)
- [ ] `wrangler login`
- [ ] `wrangler d1 create t1d-tracker-db`
- [ ] Appliquer migrations: `wrangler d1 execute t1d-tracker-db --remote --file=migrations/0001_init.sql`
- [ ] Configurer secrets VAPID (public, private, subject)
- [ ] `wrangler deploy`
- [ ] Mettre à jour CORS_ORIGIN dans `wrangler.toml`

### Frontend Settings Integration (optional enhancement)
- [ ] Ajouter bouton "Tester la notification" appelant `/api/push/test`
- [ ] UI feedback pour test push (succès/erreur)

## 🎯 Quality Checks

✅ TypeScript — pas d'erreurs (`npx tsc --noEmit`)
✅ Playwright tests — 14/14 passent  
✅ Code quality — no console errors in Dashboard/Settings
✅ Git status — working tree clean, 4 commits ahead
✅ Architecture — matches CLAUDE.md spec

## 📝 Notes

1. **Worker backend** (step 15) est déjà implémenté et fonctionnel :
   - Hono v4, D1 SQLite, Cron `* * * * *`
   - `@block65/webcrypto-web-push` pour VAPID
   - Endpoints: `/api/push/{subscribe,vapid-public-key,test}`, `/api/reminders/*`
   - Timezone-aware scheduler avec batching et auto-purge 404/410
   - Matches la spec, différences architecturales mineures

2. **Frontend** est 100% complet pour l'app :
   - Dashboard (glucose, TIR, mascot, FAB)
   - Log (glucose, insulin, meals)
   - History, Charts, Settings (reminders + push)
   - Service Worker complet (push, notificationclick, sync)

3. **Next step** : Vercel + Cloudflare deployment (step 17)

## 🔗 Session Info
- Branch: `claude/t1d-tracker-pwa-ZOPpM`
- Untracked files: clean (gitignored test-results)
- Uncommitted changes: none
- Context: Claude Haiku 4.5
