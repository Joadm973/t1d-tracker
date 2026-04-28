# T1D Tracker — État d'avancement du projet

Dernière mise à jour : 2026-04-28

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
| Backend (prévu) | Hono + Cloudflare Workers + D1 |

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
- [x] Mascotte animée (voir section dédiée)

### Mascotte animée (`GlucoseMascot`)
- [x] **Panda endormi** — aucune donnée ou mesure > 3h, animation respiration + zzz staggerés
- [x] **Tortue** — glycémie < 70 mg/dL, slow pulse, message "Time to eat something! 🍬"
- [x] **Chat orange** — glycémie > 180 mg/dL, queue animée + corps agité, message "Drink some water! 💧"
- [x] **Panda joyeux** — glycémie in-range (70–180), bounce vertical 1.4s
- [x] **Célébration** — danse 2s (rotate + y + scale) + canvas-confetti au log d'une valeur in-range
- [x] Transitions AnimatePresence entre états (fade + scale)
- [x] Streak counter — jours consécutifs avec TIR ≥ 70% (calcul Dexie live)
- [x] Badge "🔥 N days in range" affiché si streak > 0
- [x] Couronne dorée sur le panda si streak ≥ 7 jours
- [x] Testé visuellement en navigateur (tous les états validés)

### Log (`/log`)
- [x] Tab Glycémie — valeur, timestamp, notes ; conversion mmol/L ↔ mg/dL automatique
- [x] Tab Insuline — unités, type (bolus/correction/basal), timestamp, notes
- [x] Tab Repas — glucides, description, index glycémique, timestamp
- [x] Tab Note — texte libre, timestamp
- [x] Validation Zod + React Hook Form
- [x] Confirmation visuelle (badge vert "Enregistré !") + retour auto Dashboard après 1.2s
- [x] Déclenchement célébration mascotte si glycémie in-range

### Courbes (`/charts`)
- [x] Graphique uPlot interactif glycémie
- [x] Sélecteur de période : 24h / 7j / 14j / 30j
- [x] Bandes cible (targetLow, targetHigh) sur le graphique
- [x] TIR Bar pour la période sélectionnée
- [x] GMI (Glucose Management Indicator) calculé
- [x] Statistiques : moyenne, écart-type, min, max

### Historique (`/history`)
- [x] Liste unifiée de tous les événements (glycémie, insuline, repas, notes)
- [x] Tri chronologique inverse (plus récent en premier)
- [x] Filtres par type (boutons pill)
- [x] Suppression par swipe / bouton poubelle avec confirmation
- [x] Limite 200 entrées par type pour les performances

### Réglages (`/settings`)
- [x] Unité glycémie : mg/dL / mmol/L (persisté Zustand)
- [x] Thème : Auto / Clair / Sombre
- [x] Cibles glycémiques (targetLow, targetHigh) — stepper +/−
- [x] Rappels CRUD complet — ajout, toggle on/off, suppression
- [x] Formulaire ajout rappel : libellé, heure, type, jours de la semaine
- [x] Export CSV (toutes les données avec disclaimer en en-tête)
- [x] Disclaimer médical affiché en pied de page Settings

### Calculs cliniques (`lib/calculations.ts`)
- [x] TIR (Time In Range) — veryLow / low / inRange / high / veryHigh
- [x] GMI — estimation HbA1c depuis glycémie moyenne
- [x] Flèche de tendance — régression linéaire sur série temporelle
- [x] glucoseColor — couleur CSS selon zone
- [x] glucoseZone — classification texte
- [x] mmolToMg / mgToMmol

---

## En cours / Prochaine étape

### Web Push via Cloudflare Worker
**Statut** : non démarré — décision prise le 2026-04-28

Architecture prévue :
- `apps/worker/` — Hono + Wrangler + D1
- Endpoints : `POST /api/push/subscribe`, `POST /api/push/schedule`, `DELETE /api/push/subscribe`
- Cron Trigger Cloudflare (toutes les minutes) — envoie les pushs à l'heure des rappels actifs
- Clés VAPID à générer
- Frontend : bouton "Activer les notifications" dans Settings, sync rappels vers worker au toggle

**Prérequis** :
- Compte Cloudflare avec Workers + D1 activés
- Décision sur déploiement immédiat ou implémentation code first

---

## Ce qui reste à faire (backlog)

| Fonctionnalité | Priorité | Notes |
|---|---|---|
| Web Push backend (Cloudflare Worker) | Haute | Voir section En cours |
| Notifications locales (fallback SW) | Moyenne | Alternative sans backend |
| Sync cloud (D1 via Worker) | Moyenne | Outbox déjà en place côté SW |
| Page profil utilisateur | Basse | Ratio insuline/carbs, poids, type insuline |
| Import données (CSV, Nightscout) | Basse | |
| Tests Playwright PWA | Basse | Service Worker, offline, push |
| Déploiement Vercel (frontend) | — | Aucun changement backend requis |
| Déploiement Cloudflare (worker) | — | Requis pour Web Push |

---

## Structure des fichiers

```
t1d-tracker/
  apps/
    web/
      src/
        routes/
          Dashboard.tsx      — Accueil + mascotte + TIR
          Log.tsx            — Formulaires de saisie (4 tabs)
          Charts.tsx         — Graphiques uPlot + stats
          History.tsx        — Historique filtrable
          Settings.tsx       — Réglages + rappels + export
        components/
          GlucoseMascot.tsx  — Système mascotte animé complet
          DisclaimerModal.tsx
          charts/
            GlucoseSparkline.tsx
            TIRBar.tsx
          layout/
            BottomNav.tsx
            Header.tsx
            SafeArea.tsx
        db/
          schema.ts          — Dexie DB + interfaces TypeScript
        stores/
          settings.ts        — Zustand persisté (unité, thème, cibles)
          ui.ts              — Zustand éphémère (disclaimer, tab actif, célébration)
        lib/
          calculations.ts    — Calculs cliniques
          utils.ts           — Formatage dates/valeurs
        sw/
          sw.ts              — Service Worker (push, sync, précache)
    worker/                  — À créer (Cloudflare Worker Hono)
  CLAUDE.md                  — Instructions projet pour Claude Code
  AVANCEES.md                — Ce fichier
```
