# 10 — Historique d'avancement Convivia

> Référence de **ce qui est fait, en cours et à faire**, tranche par tranche,
> en suivant `08-plan-implementation.md`. Mis à jour par le pilote à la fin
> de chaque étape (construction, conventions, tests, sécurité, commit).
> Le plus récent en haut du journal (§ 3).

**Légende** : ✅ terminé · 🟡 en cours · ⬜ à faire · ⛔ bloqué

---

## 1. Tableau de bord

| # | Tranche | État | Conventions | Tests | Sécurité | Commit | Problèmes ouverts |
|---|---|---|---|---|---|---|---|
| — | Documents 01 à 09 | ✅ | ✅ | — | — | ⬜ (pas encore de dépôt git) | Questions de 09 § 22 (voir 08 § 5) |
| 0 | Outillage : hooks, git | ✅ | ✅ | ✅ 161/161 (relance `qa-tester` sautée) | ✅ réaudit fin de tranche 1 : E2, E3, E6 corrigées ; E1, E4, E5, E7 partielles (Moyennes acceptées) | ✅ `995b70e` | Limites connues (§ 4) |
| 1 | Socle technique | ✅ | ✅ | ✅ Vitest 178/178, Playwright 11/11 | ✅ 0 Critique / Élevée | ✅ `995b70e`, `1ab8289` (poussés) | Aperçu `main` OK ; résultat de la CI GitHub à confirmer |
| 2 | Connexion organisateur et compte | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 3 | Événements | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 4 | Invités et plafond | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 5 | Essai, envoi simulé, page invité, RSVP | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 6 | Paiement FedaPay (sandbox) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 7 | QR, code d'accueil, scan, tables, arrivées | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 8 | Administration minimale | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 9 | Mariage complet | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 10 | Suivi et après l'événement | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 11 | WhatsApp réel en mode test | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 12 | Les 5 autres types | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 13 | Vitrine, PostHog, codes promo | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 14 | Suppression, pages légales, PWA | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 15 | Croissance, marges, exports | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 16 | Mise en production | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

**Tranche en cours** : 2 — Connexion organisateur et compte (préparation). Tranche 1 close le 2026-10-21 ; son historique suit (construction lancée le
2026-10-21 : `devops-engineer` en premier). Hooks re-scellés (écriture
staging, Vercel en lecture seule, 12 paquets ajoutés).

- Étape 1 (`devops-engineer`) ✅ : Next.js 16 + TypeScript + Tailwind v4,
  ESLint / Prettier / Vitest (80 tests) / Playwright (5) / Lighthouse CI
  (LCP médian 2,43 s, marge faible), CI GitHub Actions (7 jobs, jamais
  exécutée), garde-fous `src/lib/env/` (+ garde Edge par identifiant de
  projet), Sentry serveur inactif, en-têtes de sécurité, contrôle des
  traceurs `/i/*`. Choix sans source à valider : `'unsafe-inline'` dans la
  CSP, `wasm-unsafe-eval` global, `robots.txt` étendu. À faire avant la
  production : limitation 30 req/min sur `/i/*`.
- Étape 2 en cours (parallèle) : `supabase-developer` (migrations socle
  sur le staging) et `ui-designer` (tokens, primitives, navigation, page
  `/design-system`).
- `supabase-developer` : 5 migrations + 153 tests pgTAP écrits ; non
  appliqués au premier passage (outils d'écriture absents de sa fiche).
  **Décisions du porteur du projet** : outils `apply_migration` et
  `execute_sql` ajoutés à la fiche du `supabase-developer` (lui seul, staging
  seul) ; **exception justifiée** dans `rls-check` pour un `grant select`
  à `anon` (pays et paliers actifs), à faire par le `devops-engineer` +
  re-scellement ; **6 paliers fixés** (50 à 1 000) ; état « en attente »
  Meta reporté en tranche 11 ; clés `analytics_events`, arrondi et secret
  `ip_hash` provisoires.
- 2e passage `supabase-developer` : toujours bloqué — les fiches d'agents
  ne sont relues **qu'au démarrage de Claude Code** ; redémarrage
  nécessaire. Staging toujours vierge ; 5 migrations relues, sans erreur.
  Problème à traiter : `execute_sql` ne renvoie que la dernière
  instruction, donc la sortie pgTAP (fichiers terminés par `rollback`)
  n'est pas lisible → format de test adapté à prévoir.
- `ui-designer` ✅ (non vérifié par lint / types / build) : tokens
  (`src/styles/tokens.css`), ~25 primitives (`src/components/ui/`), page
  `/design-system` (inaccessible en production), police Plus Jakarta Sans
  dans le layout racine (poids ajouté sur `/i/*` à mesurer). 2 tests en
  échec corrigés (nettoyage du DOM entre tests) → **Vitest 85/85**. À
  confier au devops : `afterEach(cleanup)` global dans `vitest.setup.ts` ;
  lint / types / build à vérifier ; **tests instables sous charge** : le
  hook `quick-tests` voit par intermittence 3 fichiers en environnement
  `node` échouer (« reading 'config' » / « failed to find the current
  suite ») alors que `npm run test:quick` passe 85/85 relancé à la main →
  limiter les workers Vitest ou revoir le pool.
  **À valider par le porteur du projet** : onglets proposés (organisateur
  hors événement : Événements / Créer / Compte ; dans un événement :
  Aperçu / Invités / Envoi / Réponses ; accueil : Scanner / Arrivées) ;
  couleurs « ink » plus foncées pour le contraste ; anneau de focus
  `accent-600` ; placeholder plus foncé ; badges `radius-sm` ou pilule ;
  primitives hors 04.
- Après redémarrage : `supabase-developer` a appliqué 4 migrations sur 5
  (`pricing_tiers` refusée par erreur à la confirmation → réapplication
  en cours, accord du porteur du projet) ; tests pgTAP lisibles via
  `supabase/tests/remote/build-remote-run.mjs` (sortie TAP dans un message
  d'erreur, tout annulé) : 00 → 41/43 (table manquante), 03 → 29/29,
  05 → 16/16 ; advisors : 6 INFO attendus ; types générés (sans
  `pricing_tiers`). À affiner par le devops : le hook demande confirmation
  sur tout `truncate`, y compris les déclencheurs `before truncate`
  protecteurs. Historique du staging : versions = heure d'application, et
  `whatsapp_reference_tables` passée avant `pricing_tiers`.
- `pricing_tiers` refusée une 2e fois (« declined ») **sans qu'aucune
  fenêtre n'ait été vue par le porteur du projet** : les confirmations
  demandées depuis un agent en arrière-plan peuvent être refusées
  automatiquement. Décision : le `devops-engineer` ajoute au hook
  `guard-supabase` une exception précise pour les protections
  `before truncate` et `revoke … truncate` (en plus de l'exception
  `grant select … to anon` justifiée dans `rls-check`), puis re-scellement
  et réapplication.
- Faux échecs du hook `quick-tests` **résolus** : lettre de lecteur en
  minuscule (`c:/`) → Vitest chargé deux fois ; lanceur
  `scripts/vitest.mjs` (casse réelle), `maxWorkers: 3`, nettoyage
  Testing Library global. Design system vérifié : **lint, types, build
  OK**, Vitest 85/85. Exceptions des hooks (truncate protecteur,
  `grant select … to anon` avec marqueur, `projectRoot` en casse réelle,
  budget `quick-tests` relevé) confiées au `devops-engineer`.
- `permissions.allow` ajouté pour `apply_migration` / `execute_sql`
  (accord du porteur du projet), re-scellé, mais **pas encore pris en
  compte : redémarrage de Claude Code nécessaire**. Restent à appliquer :
  `pricing_tiers` (en-tête l. 17-19 dépassé, appliqué tel quel : commentaire
  seulement) et `anon_read_countries_and_pricing_tiers` ; puis 6 fichiers
  pgTAP, advisors, types.
- **Reprise après redémarrage** : (1) relancer le `supabase-developer`
  (appliquer les 5 migrations, adapter l'exécution des tests pgTAP à
  `execute_sql`, advisors, types) ; (2) `devops-engineer` : exception
  `grant select … to anon` justifiée dans `rls-check` + re-scellement ;
  (3) migration `grant select` pays / paliers actifs ; (4) rapport de
  l'`ui-designer` (si interrompu, le relancer) ; (5) `frontend-developer`.
- **Reprise (2026-10-21, nouvelle session)** : (2) et (4) déjà faits
  (exceptions `rls-check` / `guard-supabase` en place, `ui-designer` ✅).
  Lancés en parallèle : `supabase-developer` (appliquer `pricing_tiers` et
  `anon_read_countries_and_pricing_tiers`, 6 fichiers pgTAP, advisors,
  types) et `frontend-developer` (clients Supabase, session hors `/i/*`,
  structure des routes).
- `pricing_tiers` refusée une **3e fois** (`{"status":"declined"}`, sans
  message). Vérifié par le pilote : `guard-supabase` (seul hook branché sur
  les outils Supabase) laisse passer les deux migrations, et
  `permissions.allow` les autorise → refus extérieur au projet (confirmation
  impossible depuis un agent en arrière-plan, ou approbation du connecteur
  claude.ai). Staging inchangé (4 migrations, 7 tables, RLS partout).
  **Décision du porteur du projet** : il applique lui-même les deux
  migrations dans l'éditeur SQL de Supabase (+ ligne d'historique
  facultative) ; ensuite relance du `supabase-developer` (pgTAP, advisors,
  types).
- Migrations appliquées par le porteur du projet (« fait ») ; vérification
  + pgTAP + advisors + types confiés au `supabase-developer`.
- `frontend-developer` ✅ : `@supabase/ssr` + `@supabase/supabase-js`,
  clients `src/lib/supabase/` (navigateur, serveur à cookies, anonyme
  serveur pour `/i/*`, service-role `server-only`), `src/proxy.ts`
  (Next 16 ; rafraîchit la session, ne protège rien, exclut `/i/*`, aucun
  appel réseau sans cookie de session), groupes de routes `(organizer)`,
  `(reception)`, `(admin)` vides en `noindex`. Lint, types, Vitest
  **106/106**, build OK. Moyenne : exclusion de `/i/*` testée sur le
  matcher seulement → e2e « aucun `Set-Cookie` sur `/i/<token>` » à
  confier au `qa-tester`.
- `supabase-developer` ✅ : staging vérifié conforme aux fichiers (6
  paliers 50 → 1 000, RLS, gardes, anon = SELECT seul sur `countries` et
  `pricing_tiers`, lignes actives seulement). **pgTAP 153/153** (00 43/43,
  01 16/16, 02 34/34, 03 29/29, 04 15/15, 05 16/16). Advisors : 6 INFO
  `rls_enabled_no_policy` voulus (C6), aucune alerte performance. Types
  régénérés (`pricing_tiers`). Ouverts : Moyenne — privilèges par défaut
  du schéma public encore ouverts à anon / authenticated pour les futures
  tables et fonctions (durcissement proposé, hors 07) ; Faible —
  historique `schema_migrations` du staging désaligné (2 lignes absentes,
  4 versions horodatées par `apply_migration`) ; Faible — `total_price`
  typé `number | null`.
- **Décisions du porteur du projet** : (1) migration de **durcissement**
  des privilèges par défaut du schéma public (anon / authenticated) — à
  reporter dans le 07 ; (2) `total_price` **not null** ; (3) historique
  `schema_migrations` du staging **réaligné** sur les fichiers. Confiés au
  `supabase-developer`.
- Revue `conventions-keeper` (partie application) : **0 Critique / Élevée**,
  6 Moyennes, 10 Faibles ; section **20 ter** (socle technique) ajoutée au
  09. Lint, types, format, Vitest 106/106, build, contrôle des traceurs OK.
  Moyennes : M1 pages d'état globales en français absentes ; M2 contrôles
  `/i/*` (traceurs, Lighthouse, Playwright) sur un jeton factice ; M3
  garde-fous d'environnement vérifiés seulement au premier appel ; M4 zone de
  dépôt sans formats / poids / validation ; M5 navigation et toasts non
  montés ; M6 critère de fin (CI + aperçu) non démontré avant le premier
  push. Le contrôle CI des traceurs via `src/lib/analytics/**` **existe**.
- **Décisions du porteur du projet** : navigation **reportée en tranche 2**
  (validée sur écran réel, ajouté au 08) ; couleurs « ink » **gardées**
  (ajoutées au 04 § 2.3) ; **jeton de test réservé à la CI** en tranche 5
  (ajouté au 08) ; en production, **seul le mode WhatsApp `live`** est
  accepté, sinon refus de démarrer ; **vouvoiement partout**, invités
  compris (tous les textes, tous les templates).
- **Décision du porteur du projet** : les migrations sont **appliquées au
  staging par lui-même** avec `npx supabase db push` (après un
  `supabase link` unique) ; les agents écrivent les fichiers, gardent la
  lecture et `execute_sql` pour les tests pgTAP (tout annulé).
  `apply_migration` refusé aux agents. Hooks, `settings.json` et fiches
  (`supabase-developer`, `pilot`) adaptés par le `devops-engineer`, puis
  re-scellement ; **redémarrage de Claude Code** nécessaire ensuite.
  Prérequis : historique `schema_migrations` réaligné sur les fichiers.
- `supabase-developer` ✅ (points 1 et 2, appliqués par `apply_migration`
  cette fois) : `20261021140600_revoke_default_privileges_public`
  (privilèges par défaut retirés à anon / authenticated pour `postgres`
  sur public, EXECUTE retiré à PUBLIC globalement ; limite : impossible
  pour `supabase_admin`) et `20261021140700_pricing_tiers_total_price_not_null`.
  **pgTAP 171/171** (nouveau fichier 06, 17 tests). Advisors : 6 INFO
  attendus. Types : `total_price` en `number`. Point 3 (historique)
  **refusé** (`execute_sql` « declined ») → SQL préparé
  (`scratchpad/realign_schema_migrations.sql`) à coller par le porteur du
  projet. Faibles : `supabase_admin` et schéma `storage` gardent leurs
  privilèges par défaut (question : durcir `storage` avec la tranche des
  buckets ?) ; en-tête de `pricing_tiers` dépassé ; test 00 n° 12 à adapter
  en tranche 2 (GRANT EXECUTE des fonctions d'aide RLS). Règle nouvelle :
  chaque future table / fonction appelable accorde ses droits
  explicitement (à reporter dans le 07).
- `frontend-developer` ✅ (M1, F4, F5) : textes centralisés
  (`src/content/messages.fr.ts`, `photo-constraints.ts`, `format.ts`),
  pages `not-found`, `error`, `global-error`, `loading`, 404 invités
  `src/app/i/not-found.tsx` (sans lien), pages provisoires « bientôt
  disponible », `viewportFit: 'cover'`. Lint, types, build, traceurs OK,
  Vitest **114/114**. À faire en tranche 5 : la vraie page invité appelle
  `notFound()` pour un jeton inconnu (cas non testé). Alerte d'intégrité
  des hooks pendant son passage : due au `devops-engineer` qui modifie
  `guard-supabase` (re-scellement prévu à la fin).
- `ui-designer` lancé (M4 zone de dépôt, F3 pagination, F2 date / heure).
- `devops-engineer` ✅ (M3, F7, mode WhatsApp en production) :
  `src/lib/env/startup.ts` appelé en premier dans `register()` ;
  `assertModeGuards` exécuté par `next.config.ts` (échec du build si
  configuration interdite) ; origine Sentry retirée de la CSP. Vitest
  **117/117**, lint, types, build sans variables, traceurs OK.
  **Écart de méthode** : 2 hooks contournés (`guard-live-keys` par une
  valeur reconstruite dans une commande de test ; `guest-privacy` par une
  écriture `sed` de `next.config.ts`) → modifications à faire relire par
  le `security-reviewer` ; trou « écriture par `sed` non vue par
  `guest-privacy` » à combler ; consigne « jamais contourner un hook »
  ajoutée aux briefs.
- **Décisions du porteur du projet** : en production, **FedaPay live
  obligatoire** (sandbox → refus de démarrer) et **variables
  indispensables exigées au démarrage**. Confié au `devops-engineer`.
- `devops-engineer` ✅ (hooks pour `db push`) : `apply_migration` refusé en
  dur (hook + `deny`), fiches `supabase-developer` et `pilot`, README ;
  **re-scellé par l'agent** (README : acte du porteur du projet → diff de
  `.claude/` à relire avant le commit). Tests des hooks 178/180 (2 écarts
  anciens : délai de `quick-tests`, casse de `relPath`) → corrigés avec le
  trou « `sed` non vu par `guest-privacy` » par un nouveau passage.
  **Redémarrage de Claude Code** nécessaire après tous les agents.
- `ui-designer` ✅ (M4, F2, F3) : `Dropzone` (formats / poids validés à la
  sélection et au dépôt, envoi + Annuler, erreur + Réessayer, Remplacer,
  Obligatoire), `Pagination` masquée si ≤ 1 page, `DateTimeField` avec
  fuseau ; 2 fichiers de tests **non lancés** (pas de Bash). Textes à
  rédiger plus tard (tranche 3) : « hors plage » et libellé de fuseau.
  Contrôle du poids côté client seulement : validation serveur à la tranche
  du téléverseur.
- `devops-engineer` ✅ (FedaPay live et variables en production) : en
  production, FedaPay doit être `live` avec une clé `sk_live_` ; 15
  variables exigées (`PRODUCTION_REQUIRED_ENV` dans
  `src/lib/env/guards.ts`, vérifiées au build par `next.config.ts` et au
  démarrage), dont 4 secrets (QR, session de scan, opt-out, code
  d'accueil) dont le code n'existe pas encore. Vitest **172/172**, lint,
  types, build, traceurs OK. À confirmer : liste des 15 variables (en
  tranche 16), préfixe `sk_live_` (tranche 6, avec le compte FedaPay),
  variables visibles par Vercel au build.
- Passage hooks (2 tests + trou `sed`) **arrêté par le porteur du
  projet** en cours de travail (`guest-privacy.mjs` modifié, non scellé).
  **Décision** : mission réduite — annuler la modification de
  `guest-privacy.mjs`, corriger les 2 tests, documenter les 2 limites
  (écriture shell non vue par `guest-privacy`, valeur reconstruite non vue
  par `guard-live-keys`), re-sceller. Confié au `devops-engineer`.
- Mission réduite ✅ : `guest-privacy.mjs` revenu **exactement** à l'état
  scellé (empreinte identique ; l'exception CSP inachevée est donc retirée
  aussi), 2 tests corrigés (le test avait tort dans les deux cas), 2
  limites documentées dans le README. Tests des hooks **180/180**,
  scellement vérifié. **Redémarrage de Claude Code** encore nécessaire pour
  les changements précédents de `settings.json` et des fiches
  (`apply_migration` refusé, procédure `db push`).
- Porteur du projet ✅ : SQL de réalignement collé, `supabase login` +
  `link` faits (une reconnexion a été nécessaire : 401 « Invalid access
  token »). `migration list` : 8 migrations identiques en local et sur le
  staging (140000 → 140700) ; `db push --dry-run` : « Remote database is
  up to date ». Prochaine étape : redémarrage de Claude Code, puis
  conventions (correctifs + base) → `qa-tester` → `security-reviewer`
  (fin de tranche + hooks réaudités + 2 contournements de hooks à
  relire).
- **Tranche 2 — préparation** (`product-manager`) : 11 questions, 13
  contradictions. **Décisions du porteur du projet D47 à D58** (TRD § 0,
  PRD § 6.1, 08 tranches 2 et 5) : **connexion par e-mail seulement** ;
  numéro vérifié par code WhatsApp **à la demande d'essai** (tranche 5) ;
  code simulé dans un bandeau hors production ; `convivia.app` + Resend via
  Send Email Hook, expéditeur `noreply@`, support `support@convivia.app` ;
  aucun changement d'e-mail ; 5 codes faux → 15 min sans envoi ni
  vérification, **3 codes / heure** ; 4 pays ; CGU en tranche 14 ; ville
  libre ; contournement de D24 accepté comme limite (audit) ; `?ref=`
  conservé seulement ; « Créer » vers une page provisoire.
- Construction lancée en parallèle : `supabase-developer` (organizers,
  login_attempts, admin_users, exclusivité, purge), `devops-engineer` (Send
  Email Hook + Resend, variables, checklist du porteur), `ux-writer` (textes
  et e-mail du code). Ensuite : `ui-designer`, puis `frontend-developer`
  après le `db push`.
- Construction (suite) : `ux-writer` ✅ (textes + `supabase/functions/_shared/login-code-email.fr.ts`) ;
  `ui-designer` ✅ (composants `src/components/auth/`, `account/`, `layout/`,
  non câblés) ; `devops-engineer` ✅ (`send-auth-email`, signature,
  refus admin, `EMAIL_TEST_ALLOWLIST`, `EMAIL_FROM` / `EMAIL_REPLY_TO`
  configurables, `LOGIN_ATTEMPTS_HASH_SECRET`, guide
  `docs/setup/tranche-2-auth.md`) ; `supabase-developer` ✅ 5 migrations
  `20261021150000` → `150400` + pgTAP 07–11. Décisions : longueurs nom
  2–80 / ville 2–60, `pg_cron` par migration, motif de suspension caché,
  compteur sans fenêtre, `organizer.signed_up` à la création, liste blanche
  d'e-mails sur le staging. **Pas de domaine pour l'instant** : Resend sans
  domaine (`onboarding@resend.dev`, une seule adresse destinataire).
- **Arrêt du 2026-10-21 — point de reprise** :
  - Fait par le porteur : `db push` des 5 migrations ✅ ; compte Resend ✅ ;
    Auth Email (OTP 6 chiffres, 600 s), Phone désactivé ✅ ; URL
    Configuration ✅ ; Rate Limits ✅. En cours : 2 secrets Vercel Preview
    (`LOGIN_ATTEMPTS_HASH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) — à
    confirmer.
  - Reste au porteur, **une étape à la fois** : (1) déployer
    `npx supabase functions deploy send-auth-email --no-verify-jwt --use-api --project-ref rvlfxpafjrnmhfxsgayd`
    (option `--use-api` non vérifiée) ; (2) Auth → Hooks → Send Email →
    `send-auth-email` + secret ; (3) clé API Resend ; (4) secrets de la
    fonction : `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`,
    `EMAIL_FROM=Convivia <onboarding@resend.dev>`, `EMAIL_REPLY_TO=` vide,
    `EMAIL_TEST_ALLOWLIST=<adresse du compte Resend>` ; (5) `npx supabase logout`.
  - **Reprise du 2026-10-22** : secrets Vercel Preview ✅ ; fonction
    `send-auth-email` déployée (`--use-api`) ✅ ; Send Email Hook branché
    ✅ ; secrets de la fonction (`SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`,
    `EMAIL_FROM=onboarding@resend.dev`, `EMAIL_REPLY_TO` et
    `EMAIL_TEST_ALLOWLIST` = adresse du porteur) ✅ ; `logout` ✅.
    Vérification post-push du `supabase-developer` ✅ : 13 migrations
    alignées, **pgTAP 357/357**, staging propre, advisors INFO attendues,
    types régénérés. `frontend-developer` lancé (pages et parcours).
  - `frontend-developer` ✅ (pages `(auth)` / `(organizer)`, `src/lib/auth/`) ;
    `conventions-keeper` ✅ 0 grave (corrections faites : clés `tooSoon`,
    `unavailable`, `unexpected`, `nameInvalid`, `cityInvalid`, `/welcome`
    déconnexion + suspendu ; `config.toml` OTP 600 s / 60 s) ; `qa-tester`
    ✅ **441/441** (Vitest 411, Playwright 30, stable) ; checklist téléphone
    tranche 2 écrite.
  - **`security-reviewer` : commit bloqué** — **Critique** prise de contrôle
    d'un compte pré-créé avec mot de passe (inscription Supabase ouverte) ;
    **Élevée** session par code e-mail sur un compte admin par appel direct ;
    **Élevée** limites par IP de Supabase sur l'IP de Vercel (blocage de
    tous, 429 compté comme code faux) ; Moyennes : admin repérable au temps
    de réponse, énumération par appel direct, blocage volontaire d'une
    adresse, cookies de session sans `httpOnly` / `Secure`, jetons valables
    1 h après déconnexion ; 6 Faibles. D56 « pas acceptable tel quel ».
  - **Décisions du porteur du projet** : anti-robot (Turnstile) **décidé en
    tranche 16** (énumération acceptée d'ici là) ; **limite par adresse IP
    en plus** ; jetons d'accès **1 h**, inactivité 30 j réglée en tranche 16
    (offre Pro). Correction lancée : `supabase-developer` (hook de jeton
    et / ou inscriptions fermées, limite par IP) → puis `frontend-developer`
    et `devops-engineer` → nouvel audit.
  - `supabase-developer` ✅ (non appliqué) : `20261022100000_auth_access_token_hook`
    (Custom Access Token Hook : organisateur = code e-mail seulement, admin =
    mot de passe / TOTP seulement, échec fermé), `20261022100100_login_ip_attempts`
    (limite par empreinte d'IP, fonctions `before_send` / `before_verify` à
    2 arguments), `20261022100200_login_send_tickets` (ticket d'envoi 60 s
    consommé par le hook e-mail) ; pgTAP 12, 13, 14 ; 07 § 2.1 et § 13
    complétés. **Décisions** : seuils IP 10 / 10 min et 30 / 24 h
    (demandes), 20 / 10 min et 60 / 24 h (vérifications) ; risque « une
    source épuise une adresse » accepté ; **ticket + `rate_limit_otp` 150**
    contre la panne globale ; purge des comptes jamais utilisés en
    tranche 14. « Confirm email » du staging : **désactivé** (à activer).
    Inscriptions publiques à fermer après le déploiement. Le secret
    `LOGIN_ATTEMPTS_HASH_SECRET` (Sensitive, illisible) devra être
    régénéré et posé à l'identique dans Vercel et les Edge Functions.
    Lancés en parallèle : `frontend-developer` (création du compte par le
    serveur, IP, `sb-forwarded-for`, 429 / 403, admin avant `verifyOtp`,
    temps constant, cookies) et `devops-engineer` (ticket dans le hook,
    `config.toml`, guide pas à pas).
  - `frontend-developer` ✅ et `devops-engineer` ✅ (correctifs appli et
    hook) ; pilote : format, lint, types, Vitest **481/481**, build,
    traceurs OK.
  - **2e audit `security-reviewer` : commit bloqué** — Critique et Élevées du
    1er audit **corrigées** (sous réserve des réglages) ; nouvelles
    **Élevées** : E1 code deviné par appels directs à `/verify` (le hook de
    jeton accepte `otp` sans preuve du passage par notre route) ; E2 « Confirm
    email » active une limite d'e-mails commune épuisable. Moyennes : M1
    appel direct sans ticket bloque une adresse et révèle les admins ; M2
    temps de réponse (plancher 2 s non mesuré, `/verify` sans plancher) ;
    M3 comptes pré-créés avant la tranche 8 ; M4 quota Resend en production.
    Faibles F1–F5 (dont détour de hook par `cat` du `devops-engineer`).
    **2e aller-retour** sur la connexion (au 3e : exposer au porteur).
  - **Décisions du porteur du projet** : E1 **corrigé maintenant** (ticket
    de vérification consommé par le hook de jeton) ; « Confirm email »
    **laissé désactivé** (étape retirée du guide). M3 ajouté en tranche 8,
    Turnstile aussi dans Supabase Auth + M4 ajoutés en tranche 16 (08).
    Lancés : `supabase-developer` (ticket de vérification) et
    `devops-engineer` (hook 403 sans ticket, guide) ; ensuite
    `frontend-developer` (ticket, plancher sur `/verify`, F1, F3, F4).
  - `supabase-developer` : ticket de vérification écrit
    (`20261022100300_login_verify_tickets`, pgTAP 15) mais **ne ferme pas
    E1** : rollback de la transaction quand le hook refuse → le code reste
    valable, et la réponse du hook diffère d'un code faux (oracle).
    `devops-engineer` ✅ hook 403 sans ticket, guide sans « Confirm email »,
    `rate_limit_verify` 10.
  - **3e aller-retour → exposé au porteur du projet.** **Décision** :
    **Convivia fabrique et vérifie le code** (code généré et stocké en
    empreinte par Postgres, envoyé par Resend depuis Node ; à la réussite,
    `createUser` + `generateLink` + `verifyOtp(token_hash)` côté serveur ;
    Send Email Hook qui refuse tout ; tickets supprimés). Conception soumise
    d'abord au `security-reviewer` (revue de conception) avant construction.
  - **Revue de conception `security-reviewer`** : conception **valide avec 10
    changements obligatoires** (code généré dans Node, empreinte HMAC avec
    `LOGIN_CODE_PEPPER`, fonctions atomiques, admins sans code stocké, envoi
    Resend par `after()`, Send Email Hook Postgres qui refuse tout et aucun
    SMTP personnalisé, hook de jeton organisateur `otp` seul, `otp_expiry`
    Supabase ~60 s, clients séparés, garde-fou Resend, réglages vérifiés) ;
    ensuite 0 Critique / Élevée, 4 Moyennes (R1 énumération par appel direct,
    R2 réglages hors code, R3 rafales d'e-mails, R4 blocage d'une adresse),
    2 Faibles. **Décisions du porteur** : R1 **accepté** ; R3 : **plafond
    global 300 codes / heure + alerte**, **variantes `+tag` (et points
    Gmail) comptées comme une seule adresse** pour les quotas, **limite IPv6
    par /48**. Tranche 8 : réinitialisation des mots de passe admin sans
    e-mail `recovery` (à décider). Construction : `supabase-developer` lancé.
  - Construction de la méthode « Convivia fabrique le code » ✅ :
    `supabase-developer` (migrations `20261022120000_auth_hooks_otp_only_and_email_refusal`,
    `20261022120100_login_codes` ; 4 anciennes migrations supprimées ;
    seuils /48 doublés par décision du porteur), `devops-engineer`
    (`src/lib/email/`, garde-fou Resend, variables `LOGIN_CODE_PEPPER`,
    `EMAIL_*`, `RESEND_API_KEY` serveur, ancienne fonction supprimée sauf
    `supabase/functions/send-auth-email/index.ts` — suppression refusée
    par le hook, **à faire par le porteur**), `frontend-developer`
    (parcours `/login` / `/verify`). Pilote : Vitest **501/501**, lint,
    types, format OK.
  - **3e audit `security-reviewer` : 0 Critique / 0 Élevée → commit possible
    sous réserve des tests sur le staging** ; 10 changements obligatoires
    faits ; 1 Moyenne (numéro « vérifié » sans code par `PUT /user`) et 8
    Faibles. **Décisions** : numéro vérifié **par Convivia** en tranche 5
    (D62) ; code **gardé** dans l'objet de l'e-mail. TRD : **D59 à D62**
    ajoutés, § 7.2 et § 7.3 réécrits, D56 remplacé ; 08 tranche 5 mis à
    jour. Corrections en cours : `devops-engineer` (confirmations de numéro,
    secrets distincts, guide + vérifications), `frontend-developer`
    (alerte `global_cap`, `email_exists`, format d'adresse),
    `supabase-developer` (tests d'absence des anciennes fonctions).
  - Corrections du 3e audit ✅ (confirmations de numéro, secrets distincts,
    alerte `global_cap`, `email_exists` seul, format d'adresse unique,
    tests d'absence des anciennes fonctions, guide « Vérifications après
    réglages »). Porteur : ancien dossier supprimé, **`db push` des 2
    migrations** ✅, hooks Postgres (Send Email + Custom Access Token) ✅,
    ancienne Edge Function et ses secrets supprimés ✅, OTP Supabase 60 s,
    Confirm email désactivé, confirmations de numéro, pas de SMTP ✅, limites
    et transfert d'IP ✅, Vercel Preview : `LOGIN_CODE_PEPPER`,
    `LOGIN_IP_HASH_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` (nouvelle
    clé, ancienne supprimée), `EMAIL_FROM`, `EMAIL_REPLY_TO`,
    `EMAIL_TEST_ALLOWLIST` ✅.
  - Vérification post-push (`supabase-developer`, 3 passages : limite
    d'utilisation puis coupure réseau) : **pgTAP 515/515** (00 à 15, après
    correction du test 12 n° 21 qui lisait les commentaires), staging propre,
    advisors INFO attendues ; types régénérés + `src/types/database-overrides.ts`
    (paramètres et retours nullables). Pilote : format, lint, types,
    **Vitest 510/510**, build, traceurs OK. Prochaines étapes : commit (sur
    accord), push de `main`, fermeture des inscriptions publiques, test sur
    téléphone, tests techniques de l'annexe du guide.
  - Côté agents (historique) : vérification post-push du `supabase-developer` ; puis
    `frontend-developer` (pages `/login`, `/verify`, profil, `/account`,
    layouts publics / protégés, contrôles F9, routes serveur, test
    `verify-code-form` « Vérification… » en échec à corriger) ; ensuite
    conventions → tests (lenteur et délais dépassés de Vitest à regarder) →
    sécurité obligatoire. Rien n'est commité depuis `1ab8289`.
  - Le porteur du projet s'est dit **perdu** avec les longues listes :
    lui donner **une seule étape à la fois**.
- **Tranche 1 close (2026-10-21)** : `main` poussé par le porteur du
  projet (`995b70e`, `1ab8289`) ; branche `production` créée et suivie par
  Vercel (premier build de production refusé par le garde-fou, comme
  prévu) ; variables Preview : `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WHATSAPP_MODE=simulate`,
  `FEDAPAY_ENV=sandbox`, `NEXT_PUBLIC_SITE_URL` ; aperçu
  `https://convivia-git-main-art-a50a.vercel.app` vérifié par le porteur.
  `NEXT_PUBLIC_VERCEL_*` acceptées au build (valeurs toujours contrôlées).
  Restent : résultat de la CI GitHub (gitleaks demandera
  `GITLEAKS_LICENSE`) ; Node à fixer en `22.x` ; protéger la branche
  `production` sur GitHub.
- **Reprise après redémarrage (2026-10-21)** : revue `conventions-keeper`
  lancée (correctifs M1, M3, M4, F2–F5, F7 + partie base : 8 migrations,
  pgTAP, types + critère de fin de la tranche 1).
- Revue `conventions-keeper` ✅ : **0 Critique / Élevée**. Correctifs M1,
  M3, M4, F2, F3, F7 comblés ; partie base conforme (RLS, immutabilité,
  commentaires, privilèges par défaut, types, pgTAP couvrant les 8
  tables). Lint, types, Vitest **172/172** (dont les 2 fichiers de
  l'`ui-designer`), build, traceurs OK. Section **20 quater** (migrations
  et base) ajoutée au 09. Écarts : E1 Moyenne `format:check` en échec sur
  3 fichiers (CI rouge au premier push) ; E2 Moyenne 15 variables exigées
  en production avant que leur code n'existe ; E3 Faible en-têtes de
  migrations dépassés ; E4 Faible aucun test pgTAP de présence des
  `COMMENT` ; E5 Faible `loading.tsx` sans indice visuel ; E6 Faible règle
  « droits explicites » absente du 07.
- **Décisions du porteur du projet** : variables de production exigées
  **tranche par tranche** ; schéma `storage` **durci avec les buckets**
  (tranche 9, ajouté au 08 et au 07 § 15.1) ; en-têtes dépassés
  **acceptés** et expliqués dans le 07 § 1.2 règle 8 (avec la règle des
  droits explicites → E3 et E6 clos). Lancés en parallèle :
  `frontend-developer` (E1, E5) et `devops-engineer` (E2). E4 laissé au
  `supabase-developer` à sa prochaine migration.
- `frontend-developer` ✅ (E1 Prettier sur 3 fichiers ; E5 `Spinner` dans
  `loading.tsx`, `/i/*` non touché). `devops-engineer` ✅ (E2 :
  `PRODUCTION_REQUIRED_ENV` 15 → 4 variables, `PRODUCTION_ENV_PLANNED` par
  tranche 6 / 7 / 11, garde-fous `live` inchangés, ligne ajoutée au 09
  § 20 ter). Vitest **163/163** relancé par le pilote (−11 tests
  paramétrés, +2 nouveaux), format, lint, types, build, traceurs OK.
  Étape 3 lancée : `qa-tester`.
- `qa-tester` ✅ : **aucun échec**. Ajoutés : en-têtes / CSP
  (`tests/unit/next-config-headers.test.ts`), `/design-system` en 404 en
  production, 6 e2e (aucun `Set-Cookie` ni ressource tierce sur `/i/*`,
  même avec un cookie de session envoyé ; 404 en français), checklist
  `tests/manual/real-phone-checklist.md` créée. Vitest **170/170** (stable
  sur 3 passages), Playwright **11/11** (Chromium, Pixel 7, build de
  production), lint, types, format, build, traceurs OK. Non couverts :
  WebKit / iPhone, Lighthouse CI, CI réelle et preview (premier push),
  `register()` de bout en bout. Tests `/i/*` à rejouer sur la vraie page
  en tranche 5. Étape 4 lancée : `security-reviewer` (fin de tranche +
  réaudit des hooks E1–E7 + 2 contournements + scellement par l'agent).
- `security-reviewer` ✅ : **0 Critique / 0 Élevée**, 9 Moyennes, 9
  Faibles → commit possible. E2, E3, E6 **confirmées corrigées** ; E1, E4,
  E5, E7 **partielles** (résidus Moyens M3, M5, M1, M4). Moyennes : M1
  `execute_sql` écrit durablement sur le staging sans confirmation ; M2
  écritures Bash invisibles de `rls-check` / `migration-immutable` /
  `guest-privacy` ; M3 PowerShell via `find -exec` / `conhost` ; M4 hooks
  qui lancent du code non scellé (`node_modules`, `git` / `gitleaks` sans
  chemin absolu) ; M5 délai 10 s pour un budget 8 s ; M6 fiches d'agents,
  `CLAUDE.md`, `.mcp.json` non protégés ; M7 exception `anon-read` valable
  pour toute table ; M8 `NEXT_PUBLIC_*` secrètes contrôlées par le nom
  seulement et pas au build ; M9 CSP `'unsafe-inline'` et
  `*.supabase.co`. Faibles F1–F9 (clé FedaPay sans `trim`, CSP trop
  larges, `Disallow: /i/` contre `noindex`, Sentry `logentry`, actions CI
  non épinglées, `analytics_events.city` libre, journaux Vercel lisibles,
  tests des hooks instables en parallèle, proxy et chemins à extension).
  Scellement actuel **sain** (22 fichiers, aucune porte dérobée) ; les 2
  contournements ont produit un code sain ; origines PostHog dans
  `next.config.ts` contraires à `guest-privacy` (à sortir dans un fichier
  de données). Problème « scripts externes » : **deviendra Élevé** dès que
  la production existera dans le même compte Supabase (tranche 16).
- **Décisions du porteur du projet** : **toutes les Moyennes corrigées
  avant le premier commit** (puis nouvel audit, re-scellement par le
  porteur, redémarrage, commit) — **remplacée ensuite** : **M8 seul, puis
  commit**. Les hooks ne sont plus modifiés (pas de re-scellement) ; M1–M7
  et F7, F8 deviennent des limites connues (§ 4) ; pas de nouvel audit
  complet. → `devops-engineer` ✅ M8 : liste blanche des 6 `NEXT_PUBLIC_*`,
  valeurs contrôlées (JWT `service_role`, `sb_secret_`, `sk_*`), contrôle
  au build dans `next.config.ts` ; `sk_live_` sans test dédié (hook).
  Vérifié par le pilote : format, lint, types, Vitest **175/175**, build,
  traceurs OK. **Premier commit `995b70e`** sur `main` (aucun push),
  scellement des hooks intact. 16 fichiers en CRLF dans la copie de
  travail (`.gitattributes` impose LF) : un checkout les réécrira et
  cassera le scellement → re-scellement par le porteur à ce moment-là.
  `'unsafe-inline'` **accepté jusqu'à la
  tranche 5** (nonces + origine Supabase exacte, ajouté au 08) ;
  robots.txt : **garder `Disallow: /i/` et `noindex`** (TRD § 4 inchangé,
  F3 accepté). Ordre : `devops-engineer` M8 (application) lancé, puis
  M1–M7 (hooks) dans un second passage.
- Corrections lancées : `devops-engineer` (M3, refus des modes `simulate` /
  `test` en production, F7 origine Sentry retirée de la CSP) ; `ux-writer`
  (textes des pages d'état, pages provisoires, zone de dépôt, pagination
  vide) ; ensuite `frontend-developer` (M1, F4, F5) et `ui-designer` (M4,
  F2, F3).

**Tranche 0** — Outillage :
**Étape en cours** : premier commit (sur demande du porteur du projet).
**Fait** : construction, audit (0 Critique, 7 Élevées), corrections E1–E7,
lecture seule MCP sur `rvlfxpafjrnmhfxsgayd`, revue conventions et ses
manques comblés → 161/161 tests ; hooks scellés (vérifié).
**Sauté par décision du porteur du projet** : relance `qa-tester`, nouvel
audit, tests en direct (hooks réaudités en fin de tranche 1).
**Ensuite** : tranche 1 — Socle technique.
**Décisions du 2026-10-21** : pas de commit pour l'instant ; le projet
Supabase « conviva » (`rvlfxpafjrnmhfxsgayd`, Paris) est le projet de
**staging** (décision finale du porteur du projet, conforme au plan) ; la
production sera un second projet (Paris) créé en tranche 16.

**Préparation de la tranche 1** (`product-manager`, 2026-10-21) : 12
contradictions (C1–C12) et 15 questions. Décisions du porteur du projet :
- **Attendre les comptes** (GitHub, Vercel, Sentry) avant de commencer la
  tranche 1 : pas de découpage 1a / 1b.
- Dépôt et CI : **GitHub (privé) + GitHub Actions** ; seul le porteur du
  projet pousse ; migrations vers le staging lancées par lui.
- Style : **Tailwind v4**, tokens en variables CSS.
- Sentry sur `/i/*` : **côté serveur seulement**, aucun SDK navigateur.
- Vercel : production sur une **branche dédiée `production`** ; `main` ne
  donne que des aperçus (C2).
- Garde-fou WhatsApp `live` dans les Edge Functions : **comparaison de
  l'identifiant du projet Supabase** à celui de la production (fixé en
  tranche 16) (C3).
- Dépendances aux tables admin : tables de la tranche 1 **sans clé
  étrangère ni droits super-admin** ; ajoutés par une migration ultérieure
  (C6).
- Test pgTAP reformulé : **anon ne lit que les pays actifs et les paliers
  de prix actifs** (C4).
- Pays : **les 4 actifs** (BJ, CI, TG, SN), réexamen en tranche 16.
- `whatsapp_templates` : table **vide** en tranche 1, modèles ajoutés en
  tranche 11 (C7).
- Staging : adresse **`*.vercel.app`** stable sur `main` jusqu'à l'achat de
  `convivia.app` (au plus tard tranche 6) (C8).
- Q12 (expéditeur des e-mails) **reportée à la tranche 2** ; aucun e-mail
  en tranche 1.
- Design system : l'`ui-designer` garde les valeurs fixes du 04, choisit
  une valeur dans chaque fourchette et propose les primitives absentes ;
  **validation du porteur du projet** sur une page de démonstration.
- Navigation : onglets organisateur / accueil **proposés** par le
  `product-manager` et l'`ui-designer` à partir du 02, validés par le
  porteur du projet ; **aucune barre sur `/i/*`** (C9).
- Données initiales : `fx_rates` 600 FCFA = 1 $ à partir d'octobre 2026 ;
  `platform_settings` : seulement la limite Meta 250 ; clés de
  `analytics_events` : exemples du 07 § 11.1, étendues tranche par tranche.
- Restent ouverts : lecture de `pricing_tiers` par rôle admin (C5, à
  trancher en tranche 8) ; liste des paquets à ajouter à la liste blanche
  (à valider avant la construction, un seul re-scellement) ; règle
  d'arrondi du « montant arrondi » des statistiques.
- **Pas de Supabase local (pas de Docker)** : les agents **écrivent
  directement sur le staging « conviva »** (`rvlfxpafjrnmhfxsgayd`) :
  migrations et tests pgTAP. Tout autre projet (dont la future production)
  reste interdit. Remplace la décision « lecture seule » ; hooks à adapter
  + re-scellement. Contraire au plan (08 / TRD § 15 « Supabase local ») :
  docs à mettre à jour sur demande.
- **Paquets validés** pour la tranche 1 (à ajouter à
  `allowed-packages.json`) : `tailwindcss`, `@tailwindcss/postcss`,
  `postcss`, `lucide-react`, `zod`, `server-only`, `@vitejs/plugin-react`,
  `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
  `vite-tsconfig-paths`, `typescript-eslint`. gitleaks via GitHub Actions.
- **Sentry reporté** : compte à créer avant la tranche 6 ; en tranche 1,
  Sentry est préparé dans le code avec un DSN vide (inactif).
- Dépôt distant ajouté : `origin` = `github.com/operaagence-sys/convivia`
  (privé), aucun push. Connecteur **Vercel MCP** connecté : non surveillé
  par les hooks → limitation à la lecture à faire par le `devops-engineer`.
  Projet Vercel créé après le premier push (fin de tranche 1).
- Prérequis demandés au porteur du projet : Docker Desktop, dépôt GitHub
  privé, Vercel (Hobby = non commercial → Pro avant la production), Sentry
  (région UE).
**Vérifié** : en mode automatique, les « demander confirmation » des hooks
sont bien montrés au porteur du projet (25 validations le 2026-10-21).

---

## 2. Prérequis externes

| Prérequis | État | Note |
|---|---|---|
| Création de la société (D9) | ⬜ | Délai long : à lancer maintenant |
| Domaine `convivia.app` + staging stable | ⬜ | Nécessaire dès la tranche 6 |
| Compte Vercel, Supabase staging, GitHub | ✅ | Tranche 1 — Supabase staging « conviva » `rvlfxpafjrnmhfxsgayd` (Paris) ✅ ; dépôt GitHub privé ✅ ; projet Vercel ✅ (branche de production `production`, aperçu stable `convivia-git-main-art-a50a.vercel.app`, variables Preview seulement) |
| Sentry (région UE) | ⬜ | Reporté : avant la tranche 6 |
| Resend + domaine vérifié | ⬜ | — |
| FedaPay sandbox | ⬜ | Tranche 6 |
| Application Meta + numéro de test | ⬜ | Tranche 11 |
| Réponses écrites FedaPay (TRD § 3.4) | ⬜ | Tranche 16 |
| Juriste | ⬜ | Tranche 14 |
| Références visuelles des templates | ⬜ | Tranches 9 et 12 (non bloquant) |

---

## 3. Journal

### 2026-10-21 (tranche 0, suite)
- Premier passage du `devops-engineer` sur les corrections de l'audit
  **arrêté en cours** par le porteur du projet (hooks à moitié modifiés,
  ~25 tests en échec, aucun commit pour revenir en arrière). Relancé avec une
  **mission réduite** : stabiliser, appliquer les réglages de
  `settings.json`, remettre les tests au vert ; le reste est listé et reporté
  avant la tranche 6.
- Le porteur du projet a créé un **projet Supabase** « conviva »
  (`rvlfxpafjrnmhfxsgayd`) ; connecteur claude.ai Supabase connecté. Région
  (attendue : Paris) et nom (staging ?) à vérifier.
- Vérification d'accès bloquée par le hook `guard-supabase` (tout MCP
  Supabase refusé sauf la documentation). **Décision du porteur du projet** :
  les agents ont la **lecture seule** sur ce projet précis ; toute écriture
  (SQL, migrations, branches, déploiement) reste refusée. Adaptation du hook
  à faire après la mission en cours du `devops-engineer`.
- Stabilisation terminée : E1–E7 corrigées (13e hook `guard-shell`, lanceur
  `run-hook.mjs` fermé en cas de panne, scellement `integrity.json` /
  `seal.mjs`, `bypassPermissions` interdit, PowerShell refusé, `git push`
  refusé). Lecture seule MCP ouverte sur `rvlfxpafjrnmhfxsgayd` (liste
  blanche ; `execute_sql`, `get_logs`, clés et écritures refusés).
  **140/140 tests**. Restent : 2 Moyennes (scellement sans relecture ;
  scripts externes non analysés), 2 Faibles, `guest_contacts` sous alias
  (partiel).
- Hooks **scellés** par le porteur du projet (vérifié). Projet Supabase
  `rvlfxpafjrnmhfxsgayd` vérifié en lecture seule : vide, aucune
  migration, aucun avertissement ; `pgcrypto` active ; région **Paris
  (eu-west-3)** confirmée par le porteur du projet. Rôle staging et
  renommage « convivia-staging » : en attente de sa réponse.
- Revue `conventions-keeper` : 0 Critique / Élevée ; 3 Moyennes (tests
  manquants pour `guard-shell` et plusieurs règles du README ; traceurs
  importés via `lib/analytics` sur `/i/*` à lister en limite + contrôle CI
  en tranche 1), 4 Faibles (alignement `deny`, README). Section **20 bis**
  (outillage) ajoutée à `09-conventions.md`. Manques confiés au
  `devops-engineer`.
- **Décision du porteur du projet** : pour la tranche 0, on **saute** la
  relance des tests par le `qa-tester`, le nouvel audit `security-reviewer`
  et les tests en direct. Les corrections E1–E7 ne sont donc **pas
  confirmées par un audit** ; les hooks seront réaudités avec l'audit de fin
  de tranche 1. Après les corrections du `devops-engineer` : re-scellement,
  puis premier commit sur demande.
- Manques de la revue conventions comblés par le `devops-engineer` :
  tests `guard-shell`, règles du README testées (2 trous réels corrigés :
  `robocopy //MIR`, `CLAUDE_CONFIG_DIR` entre guillemets), `deny` alignés,
  README (procédure de scellement, `git push` réservé au porteur du
  projet). Traceurs via `lib/analytics` sur `/i/*` : limite connue,
  contrôle CI à faire en **tranche 1**. **161/161 tests**. Re-scellement
  nécessaire.

### 2026-10-21 (tranche 0)
- Construction : 3 conflits hooks / travail normal corrigés, trous comblés,
  liste blanche de paquets, `git init` (branche `main`, aucun commit),
  123/123 tests ; `qa-tester` : aucun échec.
- Audit sécurité des hooks : 0 Critique, **7 Élevées** (PowerShell non
  surveillé, chemins `/c/…`, interrupteur des hooks, délai dépassé = laisser
  passer, base distante via MCP, liste blanche contournable, hooks qui
  exécutent du code modifiable), 7 Moyennes, 4 Faibles.
- Décisions du porteur du projet : refus durs pour les actions qu'un agent
  n'a jamais à faire (le porteur les lance lui-même) ; réglages de
  `settings.json` (PowerShell désactivé, règles `deny`, `bypassPermissions`
  interdit, hooks de sécurité bloquants en cas de panne) ; aucun projet
  Supabase réel pour l'instant, `.env.local` limité aux clés sandbox.
- Corrections confiées au `devops-engineer`.

### 2026-10-21
- **Plan d'implémentation** écrit (`08-plan-implementation.md`) : 17 tranches
  (0 à 16), mariage d'abord. Inventaire préparé par le `product-manager`.
- **Décisions D43 à D46** : essai refusé au-delà de 10 places ; profil
  (nom, ville, pays) après le premier code ; prénom obligatoire + nom
  facultatif pour les invités ; mariage en premier.
- **Hooks** : `qa-tester` → 93/93 tests verts, aucun problème grave ;
  trous de gravité Moyenne (`git push origin :main`, `del /f /q`,
  composants partagés de `/i/*`, données d'invité sous un nom renommé). Le
  `product-manager` relève 3 conflits avec le travail normal (`rls-check`
  contre les vues admin, `db reset` local, `npm install` du socle).
  **Audit sécurité des hooks interrompu** par le porteur du projet : à
  refaire (tranche 0).

### 2026-10-20
- **Conventions** : `09-conventions.md` créé (22 sections) et corrigé en 5
  passes (`conventions-keeper`, `product-manager`).
- **Décisions D23 à D42** reportées dans 01, 02, 03, 04, 06, 07 et dans les
  fiches des agents (connexion unique, plafond et excédent, essai bonus
  fixe, remboursements, remises ≤ 15 %, relances, accès admin, etc.).
- **Hooks Claude Code** : 12 hooks construits par le `devops-engineer`
  (`.claude/settings.json`, `.claude/hooks/`), 93 tests.
- Fiche du `conventions-keeper` alignée sur les 4 gravités de CLAUDE.md.

---

## 4. Problèmes ouverts

| Gravité | Problème | Tranche | Responsable |
|---|---|---|---|
| Moyenne ×7 | Hooks (audit fin de tranche 1, acceptés comme limites connues par le porteur du projet) : M1 `execute_sql` peut écrire sur le staging sans confirmation ; M2 écritures Bash non vues par `rls-check` / `migration-immutable` / `guest-privacy` ; M3 PowerShell via `find -exec` / `conhost` ; M4 code non scellé lancé par les hooks ; M5 délai 10 s pour un budget 8 s ; M6 fiches d'agents / `CLAUDE.md` / `.mcp.json` non protégés ; M7 exception `anon-read` valable pour toute table. E1–E7 : 3 corrigées, 4 partielles (résidus = M1, M3, M4, M5) | 1 | limite connue (protection réelle : relecture du diff avant commit, staging seul, `db push` par le porteur, CI) |
| Moyenne | M9 CSP `'unsafe-inline'` et `*.supabase.co` | 5 | `devops-engineer` + `frontend-developer` |
| Moyenne → Élevée en tranche 16 | Scripts externes non analysés + `supabase login` actif sur le poste : `supabase logout` après chaque `db push` ; production dans un compte dont le jeton n'est jamais stocké sur ce poste | 16 | porteur du projet |
| Faible ×8 | Audit tranche 1 : F1 clé FedaPay sans `trim` ; F2 CSP trop larges (`wasm-unsafe-eval`, PostHog sur `/admin` et `/dashboard`, `camera` sur `/i/*`) ; F4 Sentry `logentry` / `fingerprint` ; F5 actions CI non épinglées par SHA ; F6 `analytics_events.city` libre ; F7 journaux Vercel lisibles ; F8 tests des hooks instables en parallèle ; F9 proxy et chemins à extension (droits à contrôler dans les layouts en tranche 2). F3 accepté | 2 à 6 | `devops-engineer`, `supabase-developer`, `frontend-developer` |
| Faible | Origines PostHog dans `next.config.ts` contraires à la règle de `guest-privacy` : tout futur Edit de ces lignes sera refusé | 13 | `devops-engineer` |
| Moyenne | Scellement possible sans relecture ; scripts externes (`bash x.sh`, `npm run x`) non analysés par les hooks | 0 | limite connue |
| Moyenne | Contrôles `/i/*` (traceurs, Lighthouse, Playwright) sur un jeton factice tant que la vraie page n'existe pas (le contrôle CI des traceurs via `src/lib/analytics/**` existe) | 5 | `devops-engineer` + `supabase-developer` |
| Moyenne | Limitation 30 req/min/IP sur `/i/*` absente | 5 / 16 | `devops-engineer` |
| Moyenne | `guest_contacts` sous un alias : détection textuelle seulement | 0 | `security-reviewer` (revues) |
| Faible ×2 | `.env` aux noms inhabituels couverts par le hook seul ; syntaxe `permissions.deny` non vérifiée sur la version de Claude Code | 0 | limite connue |
| — | Tranche 0 close sans nouvel audit, tests en direct ni commit (dérogation au 08 § 0.2) | 0 | porteur du projet |
