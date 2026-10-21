# Convivia

Plateforme d'invitations digitales pour les événements en Afrique. Référence produit et
technique : `CLAUDE.md` et le dossier `docs/`.

## Démarrer

Prérequis : Node 22.13 ou plus (la CI utilise Node 24, voir `.nvmrc`).

```bash
npm ci
cp .env.example .env.local   # puis remplir en local (fichier jamais versionné)
npm run dev
```

Sans aucune variable, l'application démarre : WhatsApp en `simulate`, FedaPay en sandbox.

## Commandes

| Commande                          | Rôle                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js                                                       |
| `npm run lint` / `format:check`   | ESLint, Prettier                                              |
| `npm run typecheck`               | TypeScript strict                                             |
| `npm test` / `npm run test:quick` | Vitest (`test:quick` = types + Vitest, utilisé par le hook 7) |
| `npm run test:e2e`                | Playwright, profil mobile (Pixel 7)                           |
| `npm run check:trackers`          | Aucun traceur dans le bundle de `/i/*` (nécessite un `build`) |
| `npm run lhci`                    | Lighthouse CI sur `/i/*`, « 4G lente » (nécessite un `build`) |
| `npm run ci`                      | lint + types + tests + build + traceurs                       |

Première utilisation de Playwright : `npx playwright install chromium`.

## Structure

```
src/app/                 pages (App Router). /i/[token] = page invité
src/components/ui/       primitives UI (ui-designer)
src/lib/env/             variables d'environnement : schéma zod + garde-fous de mode
src/lib/observability/   Sentry serveur et nettoyage des données personnelles
src/styles/tokens.css    tokens du design system (ui-designer)
src/types/database.ts    types Supabase GÉNÉRÉS (supabase-developer, ne pas éditer à la main)
supabase/                config.toml, migrations/, tests/database/ (pgTAP), functions/
scripts/                 contrôles CI (traceurs)
tests/unit, tests/e2e    tests hors `src/`
```

## Environnements et garde-fous

|          | Local                        | Preview (branche `main`)           | Production (branche `production`) |
| -------- | ---------------------------- | ---------------------------------- | --------------------------------- |
| Base     | staging Supabase « conviva » | staging Supabase                   | projet Supabase de production     |
| WhatsApp | `simulate`                   | `test` + `WHATSAPP_TEST_ALLOWLIST` | `live`                            |
| FedaPay  | sandbox                      | sandbox                            | live                              |

Le code refuse le mode WhatsApp `live`, l'environnement FedaPay `live` et toute clé FedaPay
live si `VERCEL_ENV` n'est pas `production` (`src/lib/env/guards.ts`, testé). Pour les
Edge Functions : comparaison de l'identifiant du projet Supabase à
`PRODUCTION_SUPABASE_PROJECT_ID` (`supabase/functions/_shared/mode-guard.ts`, vide jusqu'à la
tranche 16, donc `live` est refusé partout).

Les variables sont lues uniquement via `src/lib/env` (règle ESLint : pas de `process.env`
ailleurs). Aucune variable secrète ne commence par `NEXT_PUBLIC_` (vérifié au démarrage et par
un test sur `.env.example`).

## Étapes réservées au porteur du projet

À faire dans cet ordre, depuis ton terminal (les agents ne poussent pas, ne créent aucun projet
distant et ne touchent à aucun secret distant).

1. **Relire puis pousser** : `git status`, `git diff`, premier commit, `git push -u origin main`.
2. **GitHub** :
   - Settings > Secrets and variables > Actions : le dépôt appartient à une organisation, donc
     l'action gitleaks exige un secret `GITLEAKS_LICENSE` (clé gratuite sur gitleaks.io). Sans
     lui, le job `secrets` échoue.
   - Protéger `main` et `production` (CI verte obligatoire avant fusion).
3. **Vercel** (projet créé après le premier push) :
   - Importer le dépôt GitHub, framework Next.js (détecté), région des fonctions `cdg1`
     (déjà dans `vercel.json`).
   - Settings > Git > **Production Branch = `production`** ; `main` ne produit que des aperçus.
   - Variables d'environnement par environnement (Preview et Production séparés, jamais de clé
     live en Preview) : voir `.env.example`. `VERCEL_ENV` est fournie par Vercel.
   - Preview : `WHATSAPP_MODE=test`, `FEDAPAY_ENV=sandbox`. Production : à la tranche 16.
   - Désactiver « Vercel Analytics » et « Speed Insights » pour le projet (aucun traceur sur
     `/i/*`).
   - Plan : Hobby est réservé à l'usage non commercial ; Pro avant la production.
4. **Supabase** : les migrations vont sur le staging via le `supabase-developer`. Les secrets
   des Edge Functions (`supabase secrets set`) et leur déploiement sont à ta charge.
5. **Sentry** (avant la tranche 6) : projet en région UE, puis renseigner `SENTRY_DSN` dans
   Vercel. Pour les source maps : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
   Tant que `SENTRY_DSN` est vide, Sentry est inactif.

## Sentry : ce qui est envoyé

Serveur seulement, aucun SDK navigateur, pas de Session Replay, pas de traces de performance.
Toute la collecte automatique (utilisateur, cookies, en-têtes, corps, paramètres d'URL,
variables locales, requêtes SQL) est coupée, et `src/lib/observability/scrub.ts` masque les
numéros (`+229 •• •• •• 12`), supprime noms et e-mails et remplace `/i/<jeton>` par
`/i/[token]`. Un futur SDK navigateur devra être monté dans les layouts organisateur, accueil
et admin uniquement, jamais dans le layout racine ni sous `/i/*`.
