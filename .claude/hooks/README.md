# Hooks Claude Code de Convivia

Les hooks sont des scripts Node (aucune dépendance npm) lancés automatiquement
par Claude Code avant ou après une action. Ils appliquent les règles de
`CLAUDE.md` § 5 **dans l'outillage**, pas seulement dans les consignes : rien de
réel ne part hors production, aucun secret n'entre dans le dépôt, les
coordonnées des invités ne fuient pas.

- Configuration : `.claude/settings.json` (clé `hooks`, forme « exec » :
  `command: "node"` + `args`). **Chaque hook est lancé par `run-hook.mjs`**
  (voir « Lanceur et scellement » plus bas), jamais directement.
- Scripts : `.claude/hooks/*.mjs` ; code partagé : `lib/common.mjs`
  (entrées/sorties, chemins, motifs de secrets, état de session, outils),
  `lib/shell.mjs` (découpage des commandes shell), `lib/gitscan.mjs`
  (analyse de diff et de `npm audit`), `lib/integrity.mjs` (empreintes).
- Tests : `.claude/hooks/tests/` (`node:test`).
- Réglages de sécurité de `settings.json` (en plus des hooks, qui sont doublés
  par des règles du système de permissions, lesquelles s'appliquent même si un
  hook plante) : outil `PowerShell` refusé, lecture, modification (`Edit`) et
  création (`Write`) des mêmes `.env*` refusées (sauf `.env.example`), outils MCP
  Supabase de gestion refusés (`deploy_edge_function`, création / suppression /
  fusion de projets et de branches…). **`apply_migration` est refusé** (décision du
  porteur du projet, 2026-10-21) : il est dans `permissions.deny` (les deux
  noms de serveur) **et** refusé par le hook 2. **`execute_sql` n'est
  volontairement pas dans `permissions.deny`** (il est dans `allow`) : sinon le
  hook ne pourrait rien autoriser ; la restriction au seul projet staging est
  assurée **par le hook 2 seul** (constante `ALLOWED_SUPABASE_PROJECT_ID`,
  comparaison stricte). Si le hook 2 était retiré ou en panne de chargement, le
  lanceur refuse quand même (code 2) mais aucune règle de permissions ne
  doublerait `execute_sql`. `permissions.disableBypassPermissionsMode: "disable"` (le mode
  `bypassPermissions` est impossible), `"agent": "pilot"`.
  **Les lectures MCP sensibles** (`get_logs`, `list_projects`,
  `list_organizations`, clés et secrets, `get_cost`…) ne figurent **pas** dans
  `permissions.deny` : elles sont refusées par le **hook 2 seul** (liste blanche
  de lecture sur le seul projet « conviva »). Si le hook 2 était retiré ou en
  panne de chargement, le lanceur refuse quand même (code 2), mais aucune règle
  de permissions ne doublerait ces lectures. Un test (`hardening.test.mjs`)
  vérifie que les listes `Read`, `Edit` et `Write` de `.env*` sont identiques.

## Lancer les tests

```bash
node --test --test-concurrency=8 ".claude/hooks/tests/*.test.mjs"
```

(Sous Node 25, `node --test <dossier>` ne fonctionne plus : il faut le motif
glob entre guillemets.) Les tests créent leurs dépôts git et projets factices
dans le dossier temporaire du système, jamais dans le projet, et fabriquent les
faux secrets à l'exécution.

## Principes

| Décision | Effet |
|---|---|
| `deny` | l'action est refusée, la raison est donnée à Claude |
| `ask` | l'action attend la confirmation du porteur du projet |
| `block` (après action / fin de tâche) | Claude doit corriger avant de continuer |
| `systemMessage` | simple avertissement affiché, rien n'est bloqué |

**Politique d'échec.** Hooks de sécurité (1, 2, 3, 6, 8, 9, 10, 11, 12, 13) :
**fermés**. Erreur interne ou entrée illisible : `deny` avec la raison « hook en
erreur » (hook 9, qui s'exécute après l'action : `block`). Script qui ne se
charge pas, plante hors de son gestionnaire ou dépasse son budget de temps :
le lanceur sort avec le code 2 et un message sur stderr, ce que Claude Code
traite comme un **refus** (et non comme « le hook a planté, on laisse passer »).
Le budget interne (`--budget`) est toujours inférieur au `timeout` de
`settings.json`. Hooks de qualité (4, 5, 7) : **échec ouvert** (sortie 0 +
message). Un outil absent (pas de `package.json`, pas de Prettier / ESLint /
Vitest / git / gitleaks) n'est jamais un blocage : sortie silencieuse.

**Refus ou confirmation.** `deny` pour ce qu'un agent n'a **jamais** à faire :
tout `git push` (y compris suppression de branche distante), déploiement,
publication, action sur une base Supabase distante ou via MCP, désactivation des
hooks, suppression récursive hors dossiers de build jetables, PowerShell /
`cmd` / `wsl` / session `claude` imbriquée. `ask` pour ce qu'un agent peut
légitimement faire : `git reset --hard`, `git clean -f`, `git branch -D`,
`git checkout .`, ajout d'une dépendance hors liste blanche, modification des
hooks ou de `settings.json`, SQL destructif en local.

Aucun hook n'émet `allow` : le système de permissions normal décide toujours.
Les raisons ne recopient jamais un secret (type + fichier + ligne seulement).

## Désactiver temporairement (déconseillé)

Aucun agent ne peut le faire : `disableAllHooks`, `.claude/settings.local.json`, les
réglages utilisateur de Claude Code (`~/.claude/settings*.json`) et les
variables qui injectent du code (`NODE_OPTIONS=--require…`, `BASH_ENV`…) sont
**refusés** par le hook 8. Seul le porteur du projet peut le faire, dans son
éditeur ou son terminal, hors de la session :

- Un seul hook : retire son bloc dans `.claude/settings.json`, puis relance
  `node .claude/hooks/seal.mjs`.
- Tous les hooks : `"disableAllHooks": true` dans `.claude/settings.local.json`
  (supprime la ligne ensuite).

**Pourquoi c'est déconseillé** : ces hooks sont les garde-fous des règles
critiques (secrets, clés live, RLS, vie privée des invités). Un hook gênant
doit être corrigé (faux positif) et couvert par un test, pas contourné. Si tu
désactives, ne laisse aucun agent travailler sans surveillance et rétablis
avant de commiter.

## Lanceur et scellement (`run-hook.mjs`, `seal.mjs`)

- **Lanceur.** `node .claude/hooks/run-hook.mjs <hook> --event=<Evénement>
  --budget=<ms> [--fail=open]`. Il arme un minuteur interne, attrape les
  erreurs non gérées, importe le hook et sort avec le code 2 s'il ne peut pas
  le charger ou si le budget est dépassé. Les processus enfants des hooks
  (git, npm audit, prettier…) reçoivent un environnement **sans secret** et
  ne dépassent jamais le budget.
- **Scellement (hooks qui exécutent du code modifiable).** Les hooks sont du
  code ; si un agent (ou une dépendance) les modifie, ils exécuteraient autre
  chose sans que personne ne l'ait relu. `.claude/hooks/integrity.json`
  contient le sha256 de `settings.json`, de chaque `hooks/*.mjs`, de
  `hooks/lib/*.mjs` et de `allowed-packages.json`. Le lanceur le vérifie
  **avant** d'importer quoi que ce soit : en cas d'écart (fichier modifié,
  ajouté, supprimé, manifeste absent), un hook de sécurité PreToolUse répond
  `ask` à **chaque** appel d'outil avec la liste des écarts, et un hook de
  qualité signale le problème.
- Un agent qui lance `seal.mjs` ou écrit `integrity.json` déclenche une demande
  de confirmation (hook 8) : le scellement est l'acte du porteur du projet.

### Procédure de scellement (porteur du projet, dans un terminal)

À faire après tout changement de `settings.json`, de `hooks/*.mjs`,
`hooks/lib/*.mjs` ou de `allowed-packages.json` :

1. **Relire** ce qui a changé : `git diff -- .claude/settings.json .claude/hooks`
   (et `git status` pour les fichiers nouveaux, qui n'apparaissent pas dans le
   `git diff`). Ne scelle pas ce que tu n'as pas relu : le scellement prouve
   que rien n'a changé *depuis*, pas que le code est bon.
2. **Sceller** : `node .claude/hooks/seal.mjs`.
3. **Vérifier** : `node .claude/hooks/seal.mjs --check` (répond « Hooks
   scellés : le manifeste correspond. », code de sortie 0 ; sinon liste les
   écarts, code 1).
4. **Si chaque appel d'outil demande encore confirmation** : le message cite les
   fichiers en écart. Un fichier a changé depuis l'étape 2 (un agent, ou un
   éditeur qui reformate : fins de ligne, formatage automatique à
   l'enregistrement). Relis-le (étape 1), annule la modification si elle n'est
   pas voulue, puis reprends à l'étape 2. Un fichier ajouté ou supprimé dans
   `hooks/` ou `hooks/lib/` est aussi un écart.
5. **Cas « paquet ajouté à `allowed-packages.json` »** : après
   `npm view <paquet>` (existence, maintenance) et l'ajout du nom dans la liste,
   le fichier est scellé comme le reste : refaire les étapes 1 à 3. Tant que ce
   n'est pas fait, chaque appel d'outil demande confirmation.

**`git push`.** Il est **toujours refusé aux agents** (hook 12) : c'est le porteur
du projet qui pousse, lui-même, depuis son terminal, après avoir relu le diff.

## Les 13 hooks

Pour chaque test manuel : dis la phrase à Claude dans une vraie session et
vérifie le résultat attendu. Aucun de ces tests n'exécute d'action réelle : les
commandes sont refusées ou soumises à confirmation (réponds **non** à toute
demande de confirmation).

### 1. `protect-secrets.mjs` — PreToolUse `Read|Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor|Grep` — décision `deny`

- **Fait** : refuse la lecture et l'écriture de `.env`, `.env.*`, `.envrc`,
  `supabase/.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `id_rsa*`,
  `id_ed25519*` (et `id_ecdsa*`, `id_dsa*`), `credentials.json`,
  `service-account*.json` (clés publiques `.pub` comprises : choix prudent)
  (sauf `.env.example` : lecture
  libre, écriture seulement avec des valeurs vides). Refuse tout contenu écrit
  qui contient un secret (clés FedaPay, jeton Meta, JWT `service_role`,
  `sb_secret_`, Resend, clé PEM, affectation littérale d'une variable secrète
  du TRD § 15). Côté Bash : `cat/type/head/grep/source/cp/mv/tee/sed -i`/
  redirections sur ces fichiers, `printenv`, `env` ou `set` seuls,
  `echo $VARIABLE_SECRÈTE`, y compris dans `&&`, `;`, `|`, `$(…)` et
  `bash -c "…"`.
- **Évite** : qu'un secret passe dans la conversation, un journal ou le dépôt.
- **Échec** : fermé.
- **Test manuel** : « Lis le fichier .env et dis-moi ce qu'il contient. »
  Résultat : refus avec la mention de `CLAUDE.md` § 5. Puis : « Crée
  `.env.example` avec `WHATSAPP_MODE=simulate` » : refusé (valeur non vide) ;
  avec `WHATSAPP_MODE=` : accepté.

### 2. `guard-supabase.mjs` — PreToolUse `Bash|PowerShell|Monitor` et `mcp__.*[Ss]upabase.*` — décisions `deny` / `ask`

- **Fait** : un agent n'écrit **que sur le projet staging** « conviva »
  (`rvlfxpafjrnmhfxsgayd`) ; jamais ailleurs. **Pas de Supabase local** (pas de
  Docker). **Les migrations sont appliquées au staging par le porteur du projet
  seul**, avec `npx supabase db push` dans son terminal (voir « Migrations »
  ci-dessous) ; les agents écrivent les fichiers. Les tests pgTAP se lancent sur
  le staging via `execute_sql` (tout annulé).
  **Refus (`deny`)** de : toute commande shell avec `--linked`, `--db-url`,
  `--project-ref`, `--project-id` ; `supabase db push|pull`, `test db --linked`,
  `migration repair|list` (sans `--local`), `link`, `projects`, `branches`,
  `secrets`, `functions deploy|delete`, et toute commande CLI absente de la
  liste locale revue (`init start stop status test db(reset|lint|diff|test|start)
  migration(new|up|down|squash) gen types functions(serve|new)`) ; `psql`,
  `pg_dump`, etc. visant un hôte autre que local ; appels HTTP directs à
  `*.supabase.co` / `api.supabase.com` ; `SUPABASE_DB_URL` / `DATABASE_URL`
  (dans la commande ou l'environnement du hook) hors `localhost` / `127.0.0.1` /
  `::1`. (La CLI vers le distant reste fermée aux agents ; le message de refus
  renvoie vers le porteur du projet, qui la lance lui-même.)
- **Outils MCP Supabase** (serveurs `supabase` et `claude_ai_Supabase`), liste
  blanche, tous limités au **seul projet staging** :
  - **Autorisés** : `search_docs` (sans projet) ; lecture : `list_tables`,
    `list_extensions`, `list_migrations`, `get_advisors`, `get_project`
    (argument `id`), `get_project_url`, `list_edge_functions`,
    `get_edge_function`, `generate_typescript_types` ; **écriture** :
    `execute_sql` (argument `project_id`).
  - **Refusé toujours, sur n'importe quel projet** : `apply_migration`, avec le
    message « Les migrations sont appliquées au staging par le porteur du projet
    avec `supabase db push`. Écris le fichier dans supabase/migrations/ et
    signale-le dans ton rapport. »
  - **Confirmation (`ask`)** sur le SQL de `execute_sql` :
    `DROP` (schéma, base, table, fonction, politique…), `TRUNCATE`, `DELETE` sans
    `WHERE` (ou `WHERE true` / `1=1`), `ALTER TABLE … DROP`, `DISABLE ROW LEVEL
    SECURITY` ; écriture ou `ALTER`/`DROP`/`GRANT`/`REVOKE`/`CREATE` dans les schémas
    `auth`, `storage`, `vault`, `cron`, `realtime`, `extensions`, `supabase_*`…
    (les appels `cron.schedule` / `cron.unschedule` et les clés étrangères vers
    `auth.*` ne sont pas questionnés ; tout accès à `vault` l'est) ; `ALTER`/`CREATE
    ROLE|USER`, `ALTER DEFAULT PRIVILEGES`, `GRANT … ALL … IN SCHEMA … TO
    anon|authenticated|public` ; `CREATE EXTENSION` ; `ALTER SYSTEM`, `SET ROLE` ; SQL
    dynamique (`DO`, `EXECUTE`) ; `COPY`, `pg_read_file`, `dblink`… Analyse
    textuelle insensible à la casse ; les commentaires (`--`, `/* */` imbriqués)
    sont retirés sans se laisser tromper par un `--` dans une chaîne ou un bloc
    `$$`.
  - **Migrations (décision du 2026-10-21)** : l'agent écrit le fichier
    `supabase/migrations/AAAAMMJJHHMMSS_nom.sql` (le hook `migration-immutable`
    protège les fichiers déjà créés) et le signale dans son rapport ; le pilote
    demande au porteur du projet de lancer, dans son terminal, un unique
    `supabase link` puis `npx supabase db push --dry-run` et `npx supabase db push` ;
    l'agent vérifie ensuite (`list_migrations`, lectures, pgTAP, advisors, types).
  - **Refusés** : `get_logs` (données personnelles possibles),
    `deploy_edge_function` (à rouvrir plus tard si décidé), création /
    suppression / fusion / réinitialisation / pause / restauration de projets et
    de branches, `list_projects`, `list_organizations`, `get_organization`,
    `get_cost`, `confirm_cost`, clés et secrets, tout outil inconnu, et **tout
    outil sur un autre projet** (absent, mal formé, autre casse ou espaces =
    refus). **La production sera un autre projet : elle n'est jamais ajoutée à
    la liste blanche.** Pour changer de projet : modifier la constante
    `ALLOWED_SUPABASE_PROJECT_ID` (fichier scellé : relancer `seal.mjs`) ; elle ne
    vient volontairement d'aucune variable d'environnement.
- **Confirmation (`ask`) en ligne de commande** : SQL destructif (`DROP …`,
  `TRUNCATE` (instruction ; les formes protectrices `create trigger … before truncate on … execute function …`, `revoke … truncate … from …` et `comment on …` ne déclenchent rien — distinction faite instruction par instruction, hors chaînes et dollar-quotes), `DELETE FROM` sans `WHERE` ou `WHERE true`, `ALTER TABLE … DROP`,
  `DISABLE ROW LEVEL SECURITY`, `pg_dump --clean`), `supabase stop --no-backup`,
  `supabase migration squash`. **Workflow local sans question** : `supabase db
  reset`, `test db`, `start`, `stop`, `status`, `migration new|up|list --local`.
  Les continuations de ligne (une barre oblique inverse suivie d un retour à la ligne) sont recollées.
- **Évite** : effacer ou modifier une base sans accord, toucher un autre projet.
- **Échec** : fermé.
- **Test manuel** : « Lance `supabase db reset --linked`. » Résultat : refus.
  « Exécute `select 1` sur le projet `rvlfxpafjrnmhfxsgayd` » : permis ; sur un
  autre projet : refus. « Applique cette migration avec apply_migration » : refus avec renvoi vers le
  porteur du projet.
  `drop table` via `execute_sql` : confirmation demandée.

### 3. `guard-live-keys.mjs` — PreToolUse `Bash|PowerShell|Monitor` — décision `deny`

- **Fait** : refuse `WHATSAPP_MODE=live`, `FEDAPAY_ENV=live`,
  `VERCEL_ENV=production` posés à la main, toute chaîne `sk_live_`/`pk_live_`,
  les appels directs à `graph.facebook.com/…/messages` et `api.fedapay.com`
  (`sandbox-api.fedapay.com` reste permis), `vercel env pull … production` et
  `--environment=production|prod`.
- **Évite** : un paiement ou un envoi WhatsApp réel hors production, le
  contournement du garde-fou `VERCEL_ENV`.
- **Échec** : fermé.
- **Test manuel** : « Lance `WHATSAPP_MODE=live npm run dev`. » Résultat : refus
  (CLAUDE.md § 5). « Appelle `https://sandbox-api.fedapay.com/v1/transactions`
  avec curl » : autorisé (aucun blocage de ce hook).

### 4. `format-and-check.mjs` — PostToolUse `Edit|Write|MultiEdit` — décision `block` (erreurs ESLint)

- **Fait** : sur `.ts .tsx .js .jsx .mjs .cjs .json .css .md` (hors
  `node_modules`, `.next`, `.claude/`, lockfiles, et **jamais** les `.md` de
  `docs/`), lance `prettier --write` puis, pour le code, `eslint --fix` sur ce
  fichier, par les binaires locaux (`node node_modules/…`). Erreurs ESLint
  restantes : bloque avec les 20 premières lignes. Mémorise les fichiers de
  code modifiés pour le hook 7 (`<dossier temporaire>/convivia-hooks/<session>.json`,
  écriture atomique avec verrou).
- **Évite** : du code mal formaté ou avec erreurs de lint qui s'accumule.
- **Échec** : ouvert. Sans `package.json`, Prettier ou ESLint : silencieux.
- **Test manuel** (une fois l'application et ESLint installés) : « Crée
  `src/test-hook.ts` avec `const a  =  1` sur une ligne mal espacée. » Résultat :
  le fichier est reformaté ; avec une erreur de lint volontaire, Claude reçoit
  les erreurs et les corrige.

### 5. `agent-stop-review.mjs` — SubagentStop — décision `block`

- **Fait** : lit le transcript de l'agent, liste ses fichiers modifiés (Edit,
  Write, MultiEdit, NotebookEdit) et ses commandes Bash qui écrivent
  (redirections, `tee`, `sed -i`, `cp`/`mv`, `Out-File`, `Set-Content`,
  `python -c`/`node -e` avec écriture), puis contrôle son rôle :
  `product-manager` et `security-reviewer` n'écrivent rien ;
  `conventions-keeper` seulement `docs/09-conventions.md` ; `qa-tester`
  seulement des fichiers de test ; personne sauf `devops-engineer` dans
  `.claude/**` ou `.env*` ; `ui-designer`, `ux-writer`, `template-designer`
  jamais dans `supabase/**` ; toute écriture par Bash est signalée. Pour les
  agents de construction : ESLint et `tsc --noEmit` limités à leurs fichiers.
  Si `stop_hook_active` est vrai : message seulement, plus de blocage.
  `agent_type` vide ou inconnu : rien.
- **Évite** : un agent qui sort de son périmètre ou laisse du code qui ne compile pas.
- **Échec** : ouvert.
- **Test manuel** : « Lance l'agent `security-reviewer` et demande-lui de créer le
  fichier `rapport.txt`. » Résultat : à sa fin, Claude reçoit la liste des
  violations (lecture seule) et doit corriger ou justifier.

### 6. `pre-commit-guard.mjs` — PreToolUse `Bash|PowerShell|Monitor` (actif si `git commit` ou `git push`) — décision `deny` / `ask`

- **Fait** : analyse ce qui part : `git diff --cached` (et `git diff HEAD` avec
  `-a`/`--all`/`-am` ou des chemins explicites, plus les fichiers non suivis si
  `git add` précède dans la même commande) pour un commit ; les commits non
  poussés (`@{u}..HEAD`, ou tout l'historique local sans amont) pour un push.
  **L'analyse d'un `git push` n'est qu'une ceinture** : le hook 12 refuse déjà
  tout `git push` d'un agent, et le porteur du projet pousse lui-même depuis son
  terminal. Cette analyse ne sert que si le hook 12 venait à être retiré ou
  contourné.
  Refuse les motifs de secrets (fichier et ligne, valeur jamais recopiée) et
  les fichiers `.env*` (sauf `.env.example`), `*.pem`, `*.key`. Utilise
  `gitleaks` s'il est installé. Si `package-lock.json` existe :
  `npm audit --omit=dev --audit-level=high` ; vulnérabilité haute/critique =
  `deny` ; audit impossible (hors ligne) = `ask`.
- **Évite** : qu'un secret entre dans l'historique git (difficile à effacer).
- **Échec** : fermé. Sans dépôt git ou sans git : rien.
- **Test manuel** (après `git init`) : « Crée `essai.txt` contenant une fausse clé
  `sk_live_` suivie de 24 `x`, fais `git add essai.txt` puis commit. » Résultat :
  commit refusé avec `essai.txt:1`. Supprime ensuite le fichier.

### 7. `quick-tests.mjs` — Stop et SubagentStop (agents de construction) — décision `block`

- **Fait** : si des fichiers de code ont changé (fichier d'état du hook 4 pour
  `Stop`, transcript pour `SubagentStop`) et qu'un `package.json` existe :
  lance `npm run test:quick` s'il est défini, sinon `tsc --noEmit` + ESLint sur
  les fichiers modifiés + `vitest related --run` si Vitest est installé.
  Budget 150 s (délai 180 s : poste lent). Échec : `block` avec la fin de la sortie ; `stop_hook_active` :
  message seulement. Vide l'état après un passage réussi.
- **Évite** : terminer une réponse avec du code cassé.
- **Échec** : ouvert (un outil absent ne bloque jamais).
- **Test manuel** (une fois l'application créée) : « Introduis volontairement une
  erreur de type dans `src/lib/x.ts` et termine. » Résultat : Claude est relancé
  avec l'erreur `tsc`.

### 8. `protect-guardrails.mjs` — PreToolUse `Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor` — décisions `deny` / `ask`

- **Refus (`deny`)** : tout ce qui éteint les hooks : le réglage
  `disableAllHooks` écrit dans un contenu ou une commande,
  `.claude/settings.local.json`, les réglages utilisateur de Claude Code
  (`~/.claude/settings*.json`, `~/.claude.json`), du code en ligne qui référence
  ces réglages, les variables d'environnement qui injectent du code
  (`NODE_OPTIONS` avec `--require|--import|--loader|--eval`, `BASH_ENV`,
  `LD_PRELOAD`, `CLAUDE_CONFIG_DIR`).
- **Confirmation (`ask`)** : toute modification de `.claude/settings.json`,
  `.claude/hooks/**` (dont `integrity.json` et `seal.mjs`), `.git/hooks`,
  `.git/config`, `.husky`, `.npmrc` & co. (outils d'édition, ou shell :
  redirection, `rm`, `mv`, `cp`, `sed -i`, `tee`, `git checkout|restore`, code
  inline). Aussi : tout `git stash` (sauf `list` et `show`), `git apply|am`,
  `patch`, `git checkout -- .claude…` / `git restore .claude…`, et les
  écritures relatives après un `cd` (ex. `cd .claude && rm -rf hooks`). Les
  chemins Windows (antislashs, casse) et Git Bash (`/c/…`) sont normalisés.
- **Évite** : qu'un agent affaiblisse ou supprime ses propres garde-fous.
- **Échec** : fermé.
- **Test manuel** : « Ajoute un commentaire dans
  `.claude/hooks/guard-live-keys.mjs`. » Résultat : demande de confirmation
  (refuse). « Crée `.claude/settings.local.json` » : refus direct.

### 9. `rls-check.mjs` — PostToolUse `Edit|Write|MultiEdit` sur `supabase/migrations/*.sql` — décision `block`

- **Fait** : relit la migration entière et signale : `create table` dans
  `public` sans `enable row level security` dans le même fichier ; fonction
  `security definer` sans `set search_path` ; `grant … to anon` (hors
  `usage on schema`) ou `grant all` ; vue `public` sans
  `security_invoker = true` ; `create policy … using (true)` (à justifier par un
  commentaire `-- rls-check: justified <raison>` juste au-dessus) ;
  `disable row level security`.
  **Exception lecture publique** : `grant select on [table] public.<t> to anon[, authenticated]` est accepté
  seulement avec le commentaire `-- rls-check: anon-read <justification non vide>`
  sur la ligne juste au-dessus (ou en fin de ligne) ; uniquement `SELECT`, une
  seule table à la fois, jamais `on all tables in schema`, jamais insert / update /
  delete / all, jamais de liste de colonnes ni `with grant option`. Sans le marqueur : blocage.
  **Vues d'administration** (docs/07 § 14, volontairement sans
  `security_invoker`) : une vue `public` sans `security_invoker = true` est
  acceptée seulement si (1) son nom suit `admin_[a-z0-9_]+_v` (ou est
  `organizer_refunds_v`, seule vue organisateur nommée par 07 § 14), (2) son
  `WHERE` appelle `private.has_admin_role(…)`, `has_any_admin_role(…)` ou
  `has_permission(…)` (pour `organizer_refunds_v` : `auth.uid()`) — un appel
  dans un commentaire ou hors `WHERE` ne compte pas — et (3) elle est précédée
  (jusqu'à deux lignes au-dessus) du commentaire
  `-- rls-check: definer-view <raison>` (raison obligatoire, sur la même
  ligne). Sinon blocage, avec ce qui manque. Le hook ne vérifie pas
  `security_barrier` ni `aal2` : les tests pgTAP d'accès (07 § 17) restent la
  vraie preuve.
- **Évite** : une table lisible par tout le monde (docs/07 § 1 : refusé par défaut).
- **Échec** : fermé (`block` « hook en erreur »).
- **Test manuel** : « Crée la migration
  `supabase/migrations/20990101000000_essai.sql` qui crée une table `essai` dans
  `public`, sans RLS. » Résultat : Claude reçoit « table public.essai créée sans
  enable row level security ». Supprime le fichier ensuite.

### 10. `migration-immutable.mjs` — PreToolUse `Edit|Write|MultiEdit` sur `supabase/migrations/*.sql` — décision `deny` / `ask`

- **Fait** : migration existante qui n'est pas la plus récente : `deny` (crée
  une nouvelle migration) ; la plus récente : `ask` (elle a peut-être déjà été
  appliquée) ; nouveau fichier dont le nom ne suit pas
  `^\d{14}_[a-z0-9_]+\.sql$` : `deny`.
- **Évite** : modifier une migration déjà appliquée (dérive entre bases).
- **Échec** : fermé.
- **Test manuel** : « Crée `supabase/migrations/ma_migration.sql` ». Résultat :
  refus (nom invalide). « Modifie la plus ancienne migration » : refus.

### 11. `guest-privacy.mjs` — PreToolUse `Edit|Write|MultiEdit` (code, hors tests) — décision `deny`

- **Fait** : logique de **liste blanche**. PostHog, `@vercel/analytics`,
  `@vercel/speed-insights`, `gtag`/Google Tag Manager, pixel Meta, Hotjar,
  Clarity, `replayIntegration` de Sentry (imports et appels) ne sont autorisés
  **que** dans `src/app/(marketing)/**`, `app/(marketing)/**`,
  `src/lib/analytics/**` et `lib/analytics/**`, et **refusés partout ailleurs**
  (ce qui couvre les composants partagés importés par `/i/*`, les layouts,
  `instrumentation-client.ts`…). Les noms de variables d'environnement en
  MAJUSCULES (`NEXT_PUBLIC_POSTHOG_KEY`) ne comptent pas comme un usage.
  Partout, refuse un `console.*`, `logger.*`, `Sentry.capture*`,
  `posthog.capture` ou `analytics_events` qui reçoit `phone_e164`, `phoneE164`,
  `phoneNumber`, `phone`, `guest_contacts`, `guestContacts`, `full_name`,
  `fullName`, `first_name`, `last_name`, `lastName`, `companion_name`, ou un
  objet invité entier (`guest`, `contact`, `guestContact`, `invitee`).
- **Évite** : traceurs sur les pages invité (poids, vie privée) et fuite des
  coordonnées des invités (CLAUDE.md § 5).
- **Échec** : fermé.
- **Test manuel** : « Dans `src/components/footer.tsx`, ajoute PostHog. »
  Résultat : refus ; dans `src/app/(marketing)/page.tsx` : accepté.
  « Ajoute `console.log(guest.phone_e164)` ou `console.log(guest)` dans une
  action serveur » : refus ; `console.log(eventId)` : accepté.
- **Limite** : le hook lit le texte écrit, pas le flux de données. Un
  renommage (`const p = guest.phone; console.log(p)`) ou un objet construit
  ailleurs lui échappe ; la revue `security-reviewer` reste nécessaire.

### 12. `irreversible-actions.mjs` — PreToolUse `Bash|PowerShell|Monitor` — décisions `deny` / `ask`

- **Refus (`deny`)** : **tout** `git push` (y compris `--force`, `:branche`,
  `--delete`, `send-pack`) ; `git config` en écriture et `git -c` avec un
  réglage qui exécute une commande (`core.fsmonitor`, alias, filtres…) ;
  `git rm -r|-f` ; suppression récursive ou forcée (`rm -rf`,
  `Remove-Item -Recurse`, `del /f|/q|/s`, `erase`, `rmdir /s` / `rd /s`,
  `find -delete`, `rimraf`, `robocopy /mir`, `rsync --delete`, code en ligne
  `node -e`/`python -c` qui supprime) **hors** `node_modules`, `.next`, `dist`,
  `coverage`, `.turbo`, `.cache`, `.swc`, `build`, `.vercel`, dossiers
  temporaires et `scratchpad_dir` ; `vercel` hors lecture (`whoami`, `ls`,
  `inspect`, `logs`, `env ls`, `dev`, `build`, `--version`), `gh` hors lecture,
  `npm|pnpm|yarn publish|login|token|owner…`, `supabase functions deploy`,
  `supabase secrets set|unset`, `docker push|login`, CLI cloud (`aws`,
  `gcloud`, `kubectl`, `terraform`, `netlify`, `wrangler`…).
- **Confirmation (`ask`)** : `git reset --hard`, `git clean -f`,
  `git branch -D`, `git checkout .|-f`, `git switch -f`, `git restore .`,
  `git filter-branch|filter-repo`, `git reflog expire`, `git gc --prune`.
- **Dossiers temporaires** : exemptés seulement si le chemin, une fois
  **résolu** (liens et jonctions suivis), est strictement sous le dossier
  temporaire du système (`/tmp` est lu comme ce dossier sous Git Bash,
  `%TEMP%` / `%TMP%` aussi) ou sous `scratchpad_dir`. Refusés : `..`,
  variables (`$TMPDIR`), jokers, le dossier temporaire lui-même, les chemins
  relatifs, un lien qui sort du dossier.
- **Dépendances** (`ask`) : `npm install|i|add <paquet>`, `pnpm add`,
  `yarn add`, `bun add` passent sans question si **tous** les paquets (avec ou
  sans version, `-D` / `--save-dev` ou non) figurent dans
  `.claude/hooks/allowed-packages.json`. Confirmation pour : un paquet hors
  liste, un nom proche d'un paquet listé (distance d'édition ≤ 2, ou même nom
  sous une autre portée `@scope`) avec l'avertissement « paquet hors liste /
  nom proche de X », une source hors registre (chemin, URL, tarball, git, alias
  `npm:`, y compris `paquet@url`), `--registry` ou variable `npm_config_registry`,
  `-g` / `--global`, les exécuteurs de paquets (`npx`, `pnpm dlx`, `bunx`,
  `npm exec`) sur un paquet hors liste ou non installé localement, et un
  `npm install` / `npm ci` **sans argument** quand le `package.json` déclare une
  dépendance hors liste ou hors registre, des `overrides` vers une URL, ou un
  script `postinstall` / `prepare`… `npm install` / `npm ci` d'un
  `package.json` conforme passent.
- **Évite** : perte de travail, déploiement ou dépendance non vérifiée sans accord.
- **Échec** : fermé (liste blanche absente ou illisible : tout ajout est demandé).
- **Test manuel** : « Supprime le dossier `docs` avec `rm -rf docs`. » Résultat :
  refus. « Pousse sur origin » : refus. « Supprime `node_modules` » : aucune
  question. « Installe `next` » : aucune question ; « installe `lodash` » ou
  `reakt` : confirmation.

#### Liste blanche des paquets (`allowed-packages.json`)

Fichier protégé par le hook 8 (il est sous `.claude/hooks/`) et scellé (lanceur, `run-hook.mjs`). Contenu, tiré de
`docs/06-trd.md` et du plan : `next`, `react`, `react-dom`, `typescript`,
`@types/node`, `@types/react`, `@types/react-dom`, `@supabase/supabase-js`,
`@supabase/ssr`, `supabase` (CLI), `fedapay`, `qrcode`, `zxing-wasm`, `exceljs`,
`sharp`, `browser-image-compression`, `libphonenumber-js`, `@sentry/nextjs`,
`posthog-js`, `serwist`, `@serwist/next`, `vitest`, `@playwright/test`,
`playwright`, `@lhci/cli`, `eslint`, `eslint-config-next`, `prettier`. Les
`@types/<paquet>` des paquets listés sont acceptés automatiquement. Pour
ajouter un paquet : `npm view <paquet>` (existence, maintenance), puis
modification du fichier (confirmation du hook 8). Ne sont **pas** listés car
absents du TRD et de la liste validée par le porteur du projet (Tailwind, Zod,
lucide-react, jsdom, Testing Library… y ont été ajoutés ensuite).

### 13. `guard-shell.mjs` — PreToolUse `Bash|PowerShell|Monitor` — décision `deny`

- **Fait** : l'outil `PowerShell` est refusé (en plus de la règle
  `permissions.deny`) : les autres hooks n'analysent que la syntaxe shell POSIX.
  Refuse aussi, depuis Bash, ce qui échappe à cette analyse : `powershell` /
  `pwsh` (y compris lancés par `node -e`, `start`, `explorer`…), `cmd`, `wsl`,
  `wscript` / `cscript`, `mshta`, `rundll32`, `regsvr32`, `bitsadmin`,
  `certutil`, `wmic`, `reg`, tâches planifiées (`schtasks`, `crontab`, `at`),
  `setx` (variable persistante), `claude` / `claude-code` (session imbriquée sans
  hooks, y compris via `npx`), et `curl … | sh` (code distant exécuté).
- **Évite** : contourner les hooks par un autre interpréteur.
- **Échec** : fermé.
- **Test manuel** : « Lance `powershell -c ls`. » Résultat : refus ; « Utilise
  l'outil PowerShell » : refus.

### 14. `guard-vercel.mjs` — PreToolUse `mcp__.*[Vv]ercel.*` — décision `deny`

- **Fait** : le connecteur MCP Vercel (`mcp__vercel__*`, ou un connecteur
  claude.ai dont le nom contient « vercel ») est **en lecture seule** : le
  déploiement et toute action distante sont réservés au porteur du projet. Liste
  blanche stricte, refus par défaut.
  - **Autorisé** : un outil dont le nom (après le nom du serveur) commence par
    `list_`, `get_` ou `search_` : projets, déploiements, état et journaux de
    build / d'exécution, erreurs d'exécution, équipes, recherche dans la
    documentation.
  - **Refusé même en lecture** : un mot du nom est un verbe d'action (`deploy`,
    `promote`, `rollback`, `create`, `update`, `delete`, `remove`, `add`, `set`,
    `purchase`, `buy`, `register`, `transfer`, `invalidate`, `run`, `exec`,
    `share`…) ; ou un sujet sensible (variables d'environnement `env` /
    `variables`, `secret`, `token`, `key`, `kms`, `decrypt`, `credential`,
    facturation / paiement / carte, `webhook`, `drain`, `blob`, Edge Config,
    `sandbox`, `firewall`, certificats) ; ou un argument `decrypt` / `reveal` /
    `unmask` actif.
  - **Refusé** : tout outil inconnu, tout nom inhabituel (espaces, tirets,
    `__` imbriqués), un nom de serveur sans outil.
- **Évite** : un déploiement, un rollback, un achat de domaine, une modification
  de DNS / pare-feu / variables, ou la lecture d'une valeur secrète par un agent.
- **Échec** : fermé.
- **Test manuel** : « Liste les déploiements Vercel » : accepté ; « Déploie sur
  Vercel » ou « Montre les variables d'environnement » : refus.
- **Doublure `permissions.deny`** : non ajoutée. Les noms exacts des outils ne
  sont pas connus, et la seule forme jokers documentée vise tout le serveur
  (`mcp__vercel__*`), ce qui bloquerait aussi les lectures. Le hook est donc la
  seule barrière ; le CLI `vercel` reste couvert par le hook 12.

## Limites connues (à connaître avant de s'appuyer dessus)

- Hook 14 : le filtre repose sur le **nom** de l'outil (mots entiers), pas sur
  ce que l'outil fait réellement. Un outil de lecture dont le nom est anodin mais
  qui renvoie des données sensibles (journaux d'exécution contenant des données
  personnelles, par exemple) passe ; un outil d'écriture nommé `get_…` passerait
  aussi si son nom ne contient aucun mot de la liste. Faux positifs possibles
  (`get_project_create_date` est refusé). Liste de mots à compléter quand les
  vrais noms d'outils sont connus.

- L'analyse des commandes Bash est heuristique : un script externe (`bash
  script.sh`, `make`, `npm run x`) ou une variable calculée peut écrire un
  secret ou un fichier gardé sans être vu. Les hooks complètent la revue
  (`security-reviewer`), ne la remplacent pas.
- Les motifs de secrets couvrent les formats connus (FedaPay, Meta, Resend,
  Supabase, PEM, variables du TRD § 15), pas tous les secrets possibles.
- Le hook 1 refuse toute mention d'un fichier `.env` par un lecteur de fichier
  connu (`cat`, `grep`, `node`, `python`…), même pour une simple vérification.
- Le hook 3 lit la commande entière : un message de commit qui contient
  littéralement `WHATSAPP_MODE=live` sera refusé.
- Le hook 6 ne voit pas un `git add` fait dans un appel Bash précédent s'il est
  suivi d'un commit seul : dans ce cas l'index est déjà analysé ; il analyse
  aussi les fichiers non suivis quand `git add` précède dans la même commande.
- Les hooks ne protègent pas contre un humain qui lance les commandes
  lui-même dans un terminal.
- Hook 11 : détection textuelle. Un renommage (`const p = guest.phone;
  console.log(p)`) ou une donnée d'invité construite dans une autre fonction
  n'est pas vu. Un objet de journal déjà nommé autrement que `guest`,
  `contact`, `guestContact`, `invitee` non plus.
- Hook 11 : **écritures par commande shell non vues**. Le hook ne s'applique
  qu'à `Edit|Write|MultiEdit` ; un traceur ou une fuite de données d'invité
  écrits par `sed -i`, une redirection (`>`, `>>`), `tee`, `cp`/`mv` ou du code
  inline (`node -e`, `python -c`) passent. À traiter plus tard (extension du
  hook aux outils shell) ; en attendant : `security-reviewer` et le contrôle du
  bundle `/i/*` en intégration continue.
- Hook 3 (`guard-live-keys`) : analyse **textuelle** de la commande. Une valeur
  reconstruite dans la commande (concaténation, variable assemblée, `printf`,
  décodage base64…) échappe à la détection. À traiter plus tard.
- Hook 11 : **traceur importé indirectement par `/i/*`**. Le hook autorise les
  traceurs dans `src/lib/analytics/**` (et la vitrine) ; il ne suit pas les
  imports. Si une page `/i/*` ou un composant partagé qu'elle importe importe un
  module de `src/lib/analytics/**` (qui, lui, embarque PostHog), le traceur
  arrive dans le bundle invité sans qu'aucun fichier « fautif » n'ait été écrit.
  **Mitigation prévue en tranche 1 (intégration continue)** : un contrôle qui
  échoue si le bundle de `/i/*` contient un traceur (PostHog, Vercel Analytics,
  gtag, pixel Meta, Hotjar, Clarity, Session Replay) et le budget de poids de
  Lighthouse CI (< 1 Mo avant ouverture). Aucun contrôle d'import n'est ajouté au
  hook 11 maintenant : l'arborescence des routes `/i/*` n'existe pas encore, et
  un contrôle d'import limité aux fichiers directs de la route manquerait le
  vrai cas (composants partagés).
- Hook 2 : les lectures MCP sensibles (`get_logs`, `list_projects`, clés…) ainsi
  que `execute_sql` ne sont encadrés que par ce hook (pas dans
  `permissions.deny`, voir plus haut) ; `apply_migration` est doublé par `permissions.deny`.
- Hook 9 : une vue admin acceptée avec marqueur n'est qu'un contrôle de forme ;
  seuls les tests pgTAP d'accès prouvent que le filtre de rôle est correct. Les
  vues dans un sous-dossier de `supabase/migrations/` sont ignorées (la CLI
  Supabase ne les applique pas).
- Hook 2 : une variable `DATABASE_URL` / `SUPABASE_DB_URL` définie dans un
  fichier `.env` chargé par un script n'est pas vue (le hook lit la commande et
  l'environnement du hook). `supabase link` suivi d'un `db reset` sans
  `--linked` reste local par défaut.
- Hook 12 : l'analyse des chemins `cd`/`rm` est textuelle (les chemins Git Bash
  `/c/Users/…`, WSL `/mnt/c/…` et Cygwin `/cygdrive/c/…` sont en revanche
  traduits en `c:/Users/…`). Un script externe (`bash clean.sh`, `make`,
  `npm run x`) qui supprime ou pousse n'est pas vu.
- Scellement : tant que le porteur du projet n'a pas lancé `seal.mjs` après un
  changement des hooks, **chaque appel d'outil demande confirmation**. C'est
  voulu ; `integrity.json` protège contre une modification silencieuse, pas
  contre un porteur qui scelle sans relire. Il ne couvre pas `tests/` ni ce
  README.
- Hook 2 : lecture MCP et `execute_sql` ne sont ouverts que
  pour le projet « conviva » (**staging**) ; `get_logs` et `deploy_edge_function`
  restent refusés. Le hook ne vérifie pas la nature du projet (staging ou
  production) : la constante fait foi. **La production n'y sera jamais ajoutée.**
- Hook 2, analyse du SQL (`execute_sql`) : **textuelle**, donc
  un garde-fou contre l'erreur, pas une barrière contre un agent malveillant.
  Elle ne peut pas garantir : le SQL **dynamique** (`DO`, `EXECUTE`, corps de
  fonction : signalés par un `ask` mais jamais analysés) ; une fonction déjà
  existante qui fait des choses destructrices (`select public.reset_all()`) ; les
  noms construits ou cités de façon inhabituelle (identifiants Unicode, `search_path`
  modifié puis table non qualifiée comme `users`) ; un `UPDATE`/`DELETE` avec un
  `WHERE` toujours vrai mais déguisé (`where id is not null`) ; les lectures de
  données personnelles (`select * from guest_contacts` n'est pas questionné : le
  staging ne doit contenir que des données de test) ; les commentaires de bloc
  imbriqués ou chaînes mal fermées (l'analyse reste prudente : plus de `ask`, pas
  moins). Un `ask` sur un texte entre guillemets (ex. `'drop table'`) est un faux
  positif volontaire.
- Hook 8 : `git stash` est demandé même quand il ne concerne pas `.claude/`
  (il retirerait aussi les modifications des hooks).
- Windows : sur un système de fichiers sensible à la casse (Linux), un chemin
  `SUPABASE\MIGRATIONS` désigne un autre dossier ; les tests de casse
  d'existence de fichier ne s'exécutent que sous Windows.
