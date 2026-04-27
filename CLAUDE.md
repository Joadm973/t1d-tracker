# T1D Tracker — Instructions pour Claude Code

## Projet
PWA React pour suivi diabète type 1. Offline-first, installable iPhone.

## Stack
Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
Dexie.js (source de vérité) + TanStack Query + Zustand
uPlot (graphiques) + Hono + Cloudflare Workers (push backend)

## Conventions
- Composants : PascalCase, un fichier par composant
- Stores Zustand dans src/stores/
- Hooks custom dans src/hooks/ (préfixe use*)
- Calculs cliniques dans src/lib/calculations.ts
- Jamais de calcul de dose d'insuline recommandée (réglementation médicale)
- Touch targets minimum 44px (WCAG 2.5.5)
- Toujours afficher le disclaimer médical aux 3 endroits définis

## Couleurs glycémie
Utiliser UNIQUEMENT les CSS custom properties (--color-glucose-*)
Ne jamais coder les couleurs en dur dans les composants

## Tests
Playwright pour les tests PWA (service worker, offline, push)

## Structure
```
apps/web/     — Frontend PWA (Vite + React)
apps/worker/  — Backend Cloudflare Workers (Hono + D1 + push)
design/       — Handoff bundles
```

## Branches
- Développement : claude/t1d-tracker-pwa-ZOPpM
- Ne jamais pousser sur main sans validation

## Disclaimer médical
Afficher à 3 endroits : premier lancement (modale), pied de page Settings, export CSV.
Texte exact :
"Cette application est un outil de suivi personnel uniquement. Elle n'est pas un dispositif médical
et ne remplace pas les conseils de votre équipe soignante. Ne l'utilisez pas pour prendre des
décisions de traitement en cas d'hypoglycémie sévère ou d'urgence médicale."
