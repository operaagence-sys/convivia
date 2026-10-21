# CLAUDE.md — Convivia

## 1. Ce qu'est Convivia

Convivia est une plateforme SaaS de création d'invitations digitales pour les
événements courants en Afrique (mariage, dot, baptême, anniversaire, sortie
d'enfant, autre). L'organisateur choisit un template, renseigne son contenu et
ses photos, ajoute ses invités un par un, puis envoie à chacun une invitation
personnalisée par WhatsApp avec un QR code unique. Le jour J, l'équipe d'accueil
scanne les QR codes pour contrôler l'entrée. Le paiement se fait par événement,
avant l'envoi, selon le nombre d'invités.

## 2. Stack

- **Application** : web mobile-first, installable (PWA).
- **Framework** : Next.js (App Router), hébergé sur **Vercel** (région Paris).
- **Backend / base de données / auth** : Supabase (région Paris) — Postgres +
  RLS, Auth, Realtime, Storage, pg_cron + Queues, Edge Functions.
- **Paiements** : FedaPay.
- **WhatsApp** : **API Cloud de Meta en direct** (pas d'intermédiaire).
- **E-mails** : Resend (SMTP de Supabase Auth). **Analyse** : PostHog (UE).
- Détails et justifications : `docs/06-trd.md`.

## 3. Documents du dossier `docs/` (ordre et rôle)

À lire dans l'ordre ; les documents 00 à 10 existent. `10-progress.md` est la
référence de l'avancement (fait / en cours / à faire) : le pilote le met à
jour à la fin de chaque étape d'une tranche. Les règles métier du `01-prd.md` font foi (la grille de prix
de la synthèse 00 est dépassée).

| #   | Fichier                      | Rôle                                                                    |
| --- | ---------------------------- | ----------------------------------------------------------------------- |
| 00  | `00-synthese-convivia.pdf`   | Synthèse du projet (source de référence)                                |
| 01  | `01-prd.md`                  | Produit, utilisateurs, rôles d'administration, règles métier, hors MVP  |
| 02  | `02-app-flow.md`             | Toutes les pages et parcours (organisateur, invité, accueil, admin)     |
| 03  | `03-sections-composants.md`  | Catalogue des sections et composants de l'application                   |
| 04  | `04-design-system.md`        | Couleurs, polices, style de l'application                               |
| 05  | `05-templates-enveloppes.md` | Les 12 templates et les 3 styles d'enveloppe                            |
| 06  | `06-trd.md`                  | Technique : architecture, FedaPay, fournisseur WhatsApp, QR codes, scan |
| 07  | `07-schema-backend.md`       | Tables Supabase et droits d'accès                                       |
| 08  | `08-plan-implementation.md`  | Tranches de construction dans l'ordre                                   |
| 09  | `09-conventions.md`          | Checklists de fonctionnalités complètes (« rien à moitié »)             |
| 10  | `10-progress.md`             | Historique d'avancement : fait, en cours, à faire, problèmes ouverts    |

**Inspiration** : `docs/inspiration/app/` (un sous-dossier par section),
`docs/inspiration/templates/<type>/` (`mariage`, `dot`, `bapteme`,
`anniversaire`, `sortie-enfant`, `autre`) et `docs/inspiration/enveloppes/`.

## 4. Règles de travail

- Relire le document concerné **avant** de coder.
- Ne jamais inventer une règle métier absente des documents : me poser la
  question.
- Avant de créer une **section de l'application** : lire
  `docs/03-sections-composants.md` et le dossier `docs/inspiration/app/`
  correspondant.
- Avant de créer un **template** : lire `docs/05-templates-enveloppes.md` et
  `docs/inspiration/templates/<type>/`.

## 5. Règles de sécurité

- Jamais de clé FedaPay, WhatsApp ou Supabase dans le code (toujours via
  variables d'environnement, non versionnées).
- Aucun envoi WhatsApp ni paiement réel en dehors de la production : en
  dev/preview, FedaPay en **sandbox** et WhatsApp en **mode test/simulé** ; les
  clés _live_ et l'envoi réel ne sont actifs qu'en production.
  - `WHATSAPP_MODE` : `simulate` en local, `test` en preview (envoi uniquement
    vers `WHATSAPP_TEST_ALLOWLIST`), `live` en production.
  - Le code **refuse** le mode `live` WhatsApp et la clé FedaPay live si
    `VERCEL_ENV !== 'production'` (garde-fou dans le code, pas seulement dans
    la configuration).
- Les **coordonnées des invités** (nom + numéro, table `guest_contacts`) ne sont
  accessibles qu'à l'organisateur propriétaire : jamais dans un écran, une vue
  ou un export admin, jamais dans les journaux ni dans PostHog.
- Aucun outil d'analyse ni traceur tiers sur les pages invités (`/i/*`).
- Les règles critiques (scan, plafond d'invités, quotas WhatsApp, déblocage
  après paiement) vivent dans des fonctions Postgres ; un paiement n'est
  confirmé que par le webhook FedaPay signé **et** la relecture de la
  transaction par l'API, jamais par la page de retour.

## 6. Langue et conventions

- Je réponds en **français**.
- Le **code et les noms de fichiers** sont en **anglais**.
- Les montants sont en **FCFA**.

## 7. Équipe d'agents (`.claude/agents/`)

### 7.1 Chef d'équipe

- La session principale tourne avec l'agent **`pilot`** (Opus), réglé par
  défaut dans `.claude/settings.json` (`"agent": "pilot"`). Le porteur du
  projet dit ce qui doit être fait ; le pilote choisit et lance lui-même les
  agents adaptés — le modèle est celui fixé dans chaque agent — sans qu'on
  ait à les nommer. Si une session démarre sans le pilote, la session
  principale applique quand même ce même routage (§ 7.2) et cet ordre
  (§ 7.3), automatiquement.
- La **session principale est le chef d'équipe** : elle découpe chaque tranche
  du plan (`docs/08-plan-implementation.md`), sollicite les agents, enchaîne
  les étapes ci-dessous et me fait le résumé final.
- Les agents **ne lancent pas d'autres agents** (l'outil `Agent` ne leur est
  pas donné). Quand un agent a besoin d'un autre, il l'écrit dans son rapport
  et la session principale le sollicite.
- Aucun agent ne tranche une question métier : il la remonte, et la session
  principale me la pose (§ 4).

### 7.2 Les agents et quand les solliciter automatiquement

| Agent                       | Modèle | Rôle                                                                                    | À solliciter automatiquement                                                                                                                                                                                                      |
| --------------------------- | ------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product-manager`           | Opus   | Cohérence du PRD avec les autres documents et le code (lecture seule)                   | Avant de lancer une tranche ; quand un document de `docs/` change ; quand une question métier ou une contradiction apparaît                                                                                                       |
| `ui-designer`               | Sonnet | Design de l'application (04, `inspiration/app/`)                                        | Avant de créer ou modifier un écran, une section ou un composant de l'application ; revue visuelle d'un écran terminé                                                                                                             |
| `template-designer`         | Opus   | 12 templates, 3 enveloppes, page invité visuelle (05)                                   | Toute création ou modification d'un template, d'une enveloppe, du rendu visuel de `/i/*` ou du fond d'aperçu WhatsApp                                                                                                             |
| `frontend-developer`        | Sonnet | Pages Next.js, PWA, route `/i/[token]`, téléversement des photos                        | Toute page, Server Action ou route côté organisateur, invité ou accueil (hors administration)                                                                                                                                     |
| `supabase-developer`        | Opus   | Schéma, RLS, vues, stockage, Realtime, migrations, tests pgTAP (07)                     | Toute table, politique RLS, vue, fonction Postgres, bucket ou canal Realtime ; relecture des fonctions écrites par les spécialistes                                                                                               |
| `whatsapp-specialist`       | Opus   | Envois, programmation, relances, statuts, exclusions, coûts, code de connexion WhatsApp | Tout ce qui envoie, programme ou suit un message WhatsApp, et la connexion par code WhatsApp                                                                                                                                      |
| `payments-specialist`       | Opus   | Forfaits, prix, FedaPay, essai, devis, codes promo au paiement, remboursements          | Tout ce qui calcule un prix, encaisse, confirme un paiement, débloque l'envoi ou enregistre un remboursement                                                                                                                      |
| `entry-control-specialist`  | Opus   | Liens personnels, QR codes, code d'accueil, scan, arrivées en direct, table après scan  | Tout ce qui touche aux jetons, aux QR, à l'accès de l'équipe d'accueil, au scan ou aux arrivées                                                                                                                                   |
| `admin-analytics-developer` | Sonnet | `/admin`, tableaux de bord, entonnoir, codes promo, influenceurs, exports, PostHog      | Tout écran ou export d'administration, statistique, attribution ou mesure de la vitrine                                                                                                                                           |
| `devops-engineer`           | Sonnet | Environnements, variables, intégration continue, Sentry, Resend                         | Configuration Vercel/Supabase, variables d'environnement, intégration continue, budget de poids, mise en place d'un nouvel environnement                                                                                          |
| `ux-writer`                 | Sonnet | Textes en français, modèles WhatsApp, pages légales (brouillons)                        | Tout nouveau texte visible (écran, erreur, message WhatsApp, e-mail, page légale)                                                                                                                                                 |
| `conventions-keeper`        | Sonnet | `docs/09-conventions.md` et vérification « rien à moitié »                              | Dès qu'une fonctionnalité est terminée (étape 2)                                                                                                                                                                                  |
| `qa-tester`                 | Sonnet | Tests automatiques et checklist sur vrai téléphone                                      | Après la revue conventions de chaque fonctionnalité (étape 3)                                                                                                                                                                     |
| `security-reviewer`         | Opus   | Audit offensif en lecture seule                                                         | Fin de chaque tranche (étape 4) et obligatoirement dès qu'on touche à la connexion, au paiement, aux envois WhatsApp, aux QR codes et au scan, aux liens personnels, aux droits d'accès, aux téléversements ou à l'administration |

### 7.3 Ordre d'intervention pour chaque tranche du plan

1. **Construction** par les agents concernés (en parallèle quand leurs
   tâches sont indépendantes ; le `supabase-developer` d'abord quand des
   tables ou des fonctions sont nécessaires).
2. **Revue `conventions-keeper`** dès qu'une fonctionnalité est terminée. Les
   manques sont comblés par l'agent de construction concerné, puis revus.
3. **Tests `qa-tester`** : tests automatiques écrits et lancés ; les échecs
   sont corrigés par l'agent de construction concerné, puis relancés.
4. **Revue `security-reviewer`** à la fin de chaque tranche, et
   **obligatoirement** dès qu'une modification touche : connexion, paiement,
   envois WhatsApp, QR codes et scan, liens personnels, droits d'accès (RLS,
   rôles, vues admin), téléversements, administration.
5. **Résumé pour moi** : ce qui a été construit, résultat des étapes 2 à 4,
   problèmes encore ouverts avec leur gravité, questions en attente.

**Aucun commit tant qu'un problème grave reste ouvert.** Gravités utilisées
par les agents de contrôle : **Critique**, **Élevée**, **Moyenne**, **Faible**.
Un problème est **grave** s'il est Critique ou Élevé, ou si un test échoue sur
une règle critique (entrée, plafond d'invités, paiement avant l'envoi, essai
gratuit, table cachée avant le scan, droits d'administration).

Les agents de contrôle (`conventions-keeper`, `qa-tester`,
`security-reviewer`, `product-manager`) **ne corrigent jamais le code de
l'application** : ils signalent, l'agent de construction concerné corrige.
