# 08 — Plan d'implémentation Convivia

> Quoi construire, dans quel ordre, sans rien casser. Le MVP est découpé en
> **tranches livrables** : chacune est utilisable et testable seule, et laisse
> l'application dans un état stable. Sources : `01` à `07`, `09`, et la liste
> des agents `.claude/agents/`. L'avancement réel est suivi dans
> `10-progress.md`.

---

## 0. Principes

### 0.1 Ordre de construction
- **Le risque d'abord** : paiement avant l'envoi, envoi WhatsApp, page
  invité et RSVP, QR et scan sont construits **tôt** (tranches 5 à 7), avec
  leurs tests prioritaires, sur des services **simulés** (WhatsApp
  `simulate`, FedaPay sandbox, e-mails locaux).
- **Un seul type de bout en bout** : tout le parcours est d'abord construit
  pour le **mariage** et ses 2 templates (tranche 9). Les 5 autres types
  viennent ensuite (tranche 12) : ils réutilisent la même mécanique, seul le
  rendu change.
- **L'administration minimale tôt** (tranche 8) : connexion admin, support,
  suivi des paiements et remboursements. Les tableaux de croissance attendent
  (tranche 15), mais le journal `analytics_events` est alimenté **dès la
  tranche 1** pour ne perdre aucune donnée.

### 0.2 Ne rien casser
- Une tranche ne commence que si la précédente est **terminée** (critère de
  fin atteint) et qu'**aucun problème grave** n'est ouvert (CLAUDE.md § 7.3).
- **Migrations uniquement additives** ; une migration appliquée n'est jamais
  modifiée (hook `migration-immutable`). Toute table naît avec sa RLS et ses
  tests pgTAP.
- **Toute la suite de tests reste verte** à chaque tranche : les tests des
  tranches précédentes sont relancés (non-régression).
- Les règles critiques vivent dans des fonctions Postgres testées (CLAUDE.md
  § 5) ; l'interface ne fait que les appeler.
- Un **commit par tranche** (sur demande du porteur du projet), puis mise à
  jour de `10-progress.md`.

### 0.3 Déroulé de chaque tranche (CLAUDE.md § 7.3)
1. **Préparation** : le `product-manager` liste les règles et les questions
   ouvertes de la tranche ; le pilote pose les questions au porteur du
   projet **avant** de construire.
2. **Construction** : `supabase-developer` d'abord s'il faut des tables ou
   des fonctions, puis les autres agents (en parallèle s'ils ne touchent pas
   les mêmes fichiers). Le `ux-writer` fournit les textes, l'`ui-designer`
   les écrans.
3. **Conventions** : `conventions-keeper` (`09-conventions.md`).
4. **Tests** : `qa-tester` (automatiques + checklist sur vrai téléphone
   quand la tranche a un écran mobile).
5. **Sécurité** : `security-reviewer`, à la fin de chaque tranche et
   obligatoirement pour connexion, paiement, WhatsApp, QR/scan, liens
   personnels, droits d'accès, téléversements, administration.
6. **Résumé** au porteur du projet, commit sur sa demande, `10-progress.md`
   mis à jour.

Ci-dessous, « Revues » rappelle l'ordre applicable à la tranche.

---

## 1. Vue d'ensemble

| # | Tranche | Risque | Agent responsable | Démo à la fin |
|---|---|---|---|---|
| 0 | Outillage : hooks, git | — | `devops-engineer` | Hooks audités, premier commit |
| 1 | Socle technique | Moyen | `devops-engineer` | L'app démarre, CI verte, mode live refusé hors production |
| 2 | Connexion organisateur et compte | Élevé | `frontend-developer` | Inscription / connexion par code |
| 3 | Événements | Faible | `frontend-developer` | Créer et modifier un mariage |
| 4 | Invités et plafond | **Critique** | `supabase-developer` | Liste d'invités, refus du 11e en essai |
| 5 | Essai, envoi simulé, page invité, RSVP | **Critique** | `whatsapp-specialist` | **Première démo de bout en bout** |
| 6 | Paiement FedaPay (sandbox) | **Critique** | `payments-specialist` | Impossible d'envoyer sans payer |
| 7 | QR, code d'accueil, scan, tables, arrivées | **Critique** | `entry-control-specialist` | Jour J simulé à deux téléphones |
| 8 | Administration minimale | Élevé | `admin-analytics-developer` | Support et finance opérationnels |
| 9 | Mariage complet : templates, enveloppes, contenu, photos | Élevé | `template-designer` | Une vraie invitation de mariage < 1 Mo |
| 10 | Suivi : relances, programmation, messages, clôture, après l'événement | Élevé | `whatsapp-specialist` | Cycle de vie complet d'un événement |
| 11 | WhatsApp réel en mode test (preview) | Élevé | `whatsapp-specialist` | Vrais messages sur les téléphones de l'équipe |
| 12 | Les 5 autres types d'événement | Moyen | `template-designer` | Les 12 templates |
| 13 | Vitrine, PostHog, codes promo, influenceurs | Moyen | `admin-analytics-developer` | Une campagne mesurable |
| 14 | Suppression des données, pages légales, PWA | Moyen | `supabase-developer` | Conformité minimale |
| 15 | Tableaux de croissance, marges, exports | Faible | `admin-analytics-developer` | Pilotage |
| 16 | Mise en production | **Externe** | pilote + `devops-engineer` | Lancement |

---

## 2. Tranches

### Tranche 0 — Outillage : hooks et dépôt git
- **Objectif** : un environnement de travail sûr avant la première ligne de
  code.
- **À relire** : CLAUDE.md § 5 et § 7 ; `.claude/hooks/README.md`.
- **Périmètre** :
  - corriger les 3 conflits des hooks avec le travail normal :
    `rls-check` bloque les vues `admin_*_v` voulues par 07 § 14 (ajouter une
    justification explicite pour les vues admin) ; `guard-supabase` demande
    une confirmation à chaque `supabase db reset` **local** (le permettre en
    local seulement) ; `irreversible-actions` demande une confirmation pour
    chaque dépendance du socle (liste blanche des paquets du TRD § 1) ;
  - combler les trous relevés par le `qa-tester` (`git push origin :main`,
    `del /f /q`, composants partagés de `/i/*`, tests de chemins Windows) ;
  - **audit sécurité des hooks** (interrompu le 2026-10-21, à refaire) ;
  - `git init`, `.gitignore` (dont `.env*` sauf `.env.example`), branche
    principale.
- **Agents** : `devops-engineer` (responsable) ; `security-reviewer`.
- **Revues** : tests (`qa-tester`) → sécurité (`security-reviewer`).
- **Tests** : `node --test ".claude/hooks/tests/*.test.mjs"` vert ; tests en
  direct avec le porteur du projet (README des hooks).
- **Critère de fin** : audit sans problème Critique ni Élevé ; tests en
  direct validés ; premier commit fait.

### Tranche 1 — Socle technique
- **Objectif** : une application vide mais déployable, avec tous les
  garde-fous en place.
- **À relire** : TRD § 1, § 10, § 11.1, § 12, § 15 ; 07 § 1, § 2.5, § 3.1,
  § 3.2, § 11.1 ; 04 en entier ; 09 § 1.
- **Périmètre** :
  - Next.js (App Router), Supabase CLI local, structure du projet ;
  - variables d'environnement et `.env.example` (TRD § 15) ; **garde-fous
    dans le code** : WhatsApp `live` et clé FedaPay live refusés si
    `VERCEL_ENV !== 'production'` ;
  - intégration continue : lint, types, Vitest, pgTAP, Playwright, budget de
    poids Lighthouse ; Sentry avec données masquées ; en-têtes de sécurité ;
  - migrations socle : types énumérés, schéma `private`, `countries`,
    `platform_settings`, `audit_log`, `analytics_events`, `pricing_tiers`
    (grille PRD § 7.1), `whatsapp_templates`, `whatsapp_rates`, `fx_rates`
    (données initiales) ;
  - design system : tokens (04), primitives UI (03 § 5), navigation ;
  - projet Vercel (région Paris) et projet Supabase **staging** ;
    **sous-domaine de staging stable** (nécessaire aux webhooks des tranches
    6 et 11).
- **Agents** : `devops-engineer` (responsable) ; `supabase-developer`
  (migrations) ; `ui-designer` (design system) ; `frontend-developer`.
- **Revues** : conventions → tests → sécurité (secrets, droits d'accès).
- **Tests** : CI verte ; tests unitaires des garde-fous (`live` refusé hors
  production) ; pgTAP « RLS activée sur chaque table », « anon ne lit rien » ;
  un preview Vercel s'ouvre.
- **Critère de fin** : un commit sur la branche principale déclenche la CI et
  un preview fonctionnel.
- **Décisions à trancher avant** : Q12 (expéditeur des e-mails, si Resend est
  branché ici).

### Tranche 2 — Connexion organisateur et compte
- **Objectif** : un organisateur crée son compte et se reconnecte.
- **À relire** : PRD § 3.1, § 6.1 ; 02 § 1.1-1.4, § 1.19 ; 03 § 1.1, § 1.16 ;
  TRD § 7, D10, D23, D24 ; 07 § 2.1, § 2.2 ; 09 § 2, § 3.
- **Périmètre** :
  - `/login` unique (inscription + connexion), `/verify`, `/signup` →
    `/login` avec `?ref=` conservé ;
  - code e-mail (Inbucket en local) et code WhatsApp (mode `simulate`) via le
    Send SMS Hook et l'Edge Function `send-login-code` ;
  - compteur `login_attempts` (5 codes faux → 15 min) ; identifiants admin
    refusés par `/login` avec le même message ;
  - **écran de profil après le premier code** : nom, ville, pays (D44) ;
  - `/account` : modifier nom, ville, pays ; se déconnecter ; déconnecter
    toutes les sessions ; ajouter un numéro WhatsApp vérifié (TRD § 7.3) ;
    bandeau « compte suspendu ».
  - **navigation** (reportée de la tranche 1, décision du 2026-10-21) :
    `BottomNav` / `SidebarNav` et `ToastProvider` montés dans les mises en
    page des faces ; onglets et libellés proposés (`nav-items.ts`) **validés
    par le porteur du projet sur un écran réel**.
- **Tables** : `organizers`, `login_attempts`, `admin_users` (déclencheur
  d'exclusivité organisateur / admin).
- **Agents** : `frontend-developer` (responsable) ; `supabase-developer` ;
  `whatsapp-specialist` (hook et code WhatsApp) ; `devops-engineer` (e-mails
  locaux) ; `ux-writer` ; `ui-designer`.
- **Revues** : conventions → tests → **sécurité obligatoire** (connexion).
- **Tests** : même message que le compte existe ou non ; code expiré (10
  min) ; renvoi après 60 s ; 6e code faux refusé 15 min, même sans compte ;
  identifiant admin → aucun code envoyé ; un organisateur ne lit pas le
  profil d'un autre (pgTAP) ; session de 30 jours ; déconnexion de toutes les
  sessions.
- **Critère de fin** : parcours complet sur vrai téléphone (iPhone et
  Android), audit sécurité sans problème grave.
- **Décisions à trancher avant** : Q4 (changement d'e-mail ou de numéro
  vérifié) ; Q20 (acceptation des CGU à l'inscription ?) ; comment lire le
  code simulé en local sans l'écrire dans les journaux.

### Tranche 3 — Événements
- **Objectif** : créer, lister et modifier un événement (mariage d'abord ;
  les 6 types sont sélectionnables mais seul le mariage aura ses templates en
  tranche 9).
- **À relire** : PRD § 5, § 6.2, § 7.9 ; 02 § 1.5-1.7, § 1.17 ; 03 § 1.2-1.4,
  § 4.3, § 4.11 ; 07 § 4.1, § 4.2 ; TRD D25, D39, D41 ; 09 § 4.
- **Périmètre** : `/dashboard` (liste, badge d'état), `/events/new` (type,
  nom, date, lieu, **pays obligatoire**, hôtes), `/events/<id>` (tableau de
  bord, tuiles), édition date / lieu (sans notification WhatsApp, qui vient
  en tranche 10), changement de pays avant le premier envoi avec heure
  locale conservée, état calculé (7 états).
- **Tables** : `events`, `event_contents`.
- **Agents** : `frontend-developer` (responsable) ; `supabase-developer` ;
  `ui-designer` ; `ux-writer`.
- **Revues** : conventions → tests → sécurité (droits d'accès).
- **Tests** : un organisateur ne voit que ses événements ; organisateur
  suspendu → lecture seule ; colonnes de facturation non modifiables depuis
  le navigateur ; changement de pays recalcule `starts_at` (heure locale
  conservée) ; pays figé après le premier envoi (à rejouer en tranche 5).
- **Critère de fin** : créer, lister, modifier un mariage sur téléphone ;
  états vide / chargement / erreur / succès présents.
- **Décisions à trancher avant** : Q-B (priorité des états du badge) ; Q7
  (longueurs maximales) ; Q21 (hors connexion pendant la saisie).

### Tranche 4 — Invités et plafond
- **Objectif** : constituer la liste d'invités avec toutes les règles de
  décompte.
- **À relire** : PRD § 6.5, § 7.2, § 7.4, § 7.5, § 7.14 ; 02 § 1.10 ; 03
  § 1.7, § 4.1, § 4.2 ; 07 § 1.3 (`is_over_cap`), § 5.1-5.3, § 17 ; TRD § 3.2,
  D26, D27, D32, D37 ; 09 § 5.
- **Périmètre** : ajout un par un (**prénom obligatoire, nom facultatif**,
  numéro E.164, individuelle / « +1 », nom de l'accompagnant, groupe,
  **attestation de consentement**) ; modification, suppression ; groupes ;
  compteur décompté / plafond ; numéro partagé accepté.
- **Tables** : `guest_groups`, `invitations`, `guest_contacts`,
  `rsvp_history` ; fonctions `add_guest`, `update_guest`, `delete_guest`,
  `private.is_over_cap`.
- **Agents** : `supabase-developer` (responsable) ; `payments-specialist`
  (relecture des règles de plafond) ; `frontend-developer` ; `ui-designer` ;
  `ux-writer`.
- **Revues** : conventions → tests → sécurité (droits d'accès, coordonnées
  des invités).
- **Tests** (règle critique « plafond ») : « +1 » compte pour 2 ; ajout
  libre en brouillon ; en essai, 11e place refusée (y compris par
  `update_guest` qui passe un invité en « +1 ») ; ajouts simultanés sous
  verrou ; attestation obligatoire ; **aucun rôle admin ne lit
  `guest_contacts`** ; aucun numéro dans les journaux.
- **Critère de fin** : liste de 10 invités avec groupes sur téléphone ;
  tests pgTAP du plafond verts.

### Tranche 5 — Essai, envoi simulé, page invité, RSVP 🔴
- **Objectif** : **première démo de bout en bout**, sans paiement : essai
  gratuit → envoi WhatsApp simulé → l'invité ouvre son lien → répond →
  l'organisateur voit la réponse en temps réel.
- **À relire** : PRD § 6.7-6.10, § 7.3, § 7.4, § 7.6, § 7.14 ; 02 § 1.11
  (essai), § 1.12, § 1.13, § 2 ; 03 § 1.10, § 1.11, § 4.5, § 4.6 ; 05 § 1 ;
  TRD § 2 (modes, dispatcher, exclusion, webhooks), § 4, § 11.2, D2, D14,
  D38, D42, D43 ; 07 § 5.4, § 8.6, § 9 ; 09 § 6.3, § 7, § 9.
- **Périmètre** :
  - essai : `claim_trial` (numéro vérifié, un essai par numéro, **refusé si
    la liste compte plus de 10 places**, D43 ; refusé après un paiement) ;
  - envoi immédiat en mode `simulate` : dispatcher (`pg_cron` + pgmq),
    revérifications au dernier moment, liste d'exclusion, statuts simulés,
    webhook de statuts (charges signées de test), jetons créés à l'envoi ;
  - modèles `invitation_v1` et `ticket_confirmed_v1` rédigés par le
    `ux-writer` (« De la part de [organisateur], via Convivia », « Ne plus
    recevoir ») ;
  - page `/i/<token>` avec un **rendu provisoire sobre** (le vrai template
    arrive en tranche 9) : enveloppe simple, invitation, RSVP, ouverture
    comptée après l'animation, 404 uniforme, 30 requêtes/min/IP, aucun
    traceur ;
  - **jeton de test réservé à la CI** (décision du 2026-10-21) : un jeton
    fixe dans un jeu de données de test, **jamais présent en production**,
    pour que Lighthouse, Playwright et le contrôle des traceurs visent une
    vraie page `/i/<token>` et non la page provisoire ou la 404
    (`devops-engineer` + `supabase-developer`) ;
  - **CSP par nonce** (décision du 2026-10-21, audit tranche 1 M9) :
    `'unsafe-inline'` est retiré de `script-src` et remplacé par un nonce et
    `'strict-dynamic'` sur `/i/*` et `/admin`. Le joker `*.supabase.co` est
    remplacé par l'origine exacte tirée de `NEXT_PUBLIC_SUPABASE_URL`. À
    faire **avant** qu'un texte d'organisateur ne soit affiché aux invités
    (`devops-engineer` + `frontend-developer`) ;
  - `/events/<id>/rsvp` en temps réel ; « Copier son lien » (D42) ;
  - aperçu organisateur de l'invitation sans jeton (fonction à prévoir).
- **Tables** : `trial_claims`, `invitation_secrets`, `whatsapp_messages`,
  `scheduled_sends`, `whatsapp_optouts`.
- **Agents** : `whatsapp-specialist` (responsable) ; `entry-control-specialist`
  (jetons, liens) ; `payments-specialist` (essai) ; `supabase-developer` ;
  `frontend-developer` (route `/i/*`, tableau RSVP) ; `ux-writer`.
- **Revues** : conventions → tests → **sécurité obligatoire** (WhatsApp,
  liens personnels, droits d'accès).
- **Tests** : envoi refusé sans essai ni paiement ; essai refusé à 11 places
  et sur numéro non vérifié ; second essai avec le même numéro refusé ;
  invité exclu jamais contacté ; aucun appel à Meta en `simulate` ; jeton
  aléatoire, 404 identique pour un jeton faux ou supprimé ; ouverture non
  comptée au simple chargement (robot d'aperçu) ; RSVP présent / décliné /
  « Finalement présent » ; aucun traceur sur `/i/*` ; le numéro de l'invité
  n'apparaît jamais dans la page.
- **Critère de fin** : la démo complète tourne en local et en preview avec
  un téléphone invité réel (lien copié) ; audit sécurité sans problème grave.
- **Décisions à trancher avant** : Q-I (animation passée ou réduite) ; Q14
  (page d'un événement passé ou d'un organisateur suspendu).

### Tranche 6 — Paiement FedaPay (sandbox) 🔴
- **Objectif** : le paiement débloque l'envoi, et rien d'autre ne le fait.
- **À relire** : PRD § 6.6, § 7.1-7.5, § 7.12 ; 02 § 1.11 ; 03 § 1.8, § 1.9,
  § 4.4 ; TRD § 3, D5, D6, D22, D26, D34, D40 ; 07 § 8.1-8.3, § 10.2 ; 09
  § 6.
- **Périmètre** : `/events/<id>/package` (grille, total calculé côté
  serveur, option la moins chère, devis au-delà de 1 000), `/checkout`,
  page de retour qui **lit l'état en base** ; webhook signé + relecture par
  l'API + idempotence ; `confirm_payment` ; rattrapage toutes les 10 min ;
  passage de palier et ajout au prix unitaire ; invités **en excédent**
  « en attente de paiement » ; historique des paiements. Codes promo : le
  calcul et le plafond de 15 % sont prêts, mais leur création arrive en
  tranche 13.
- **Tables** : `payments`, `quote_requests`, `payment_fee_rates`.
- **Agents** : `payments-specialist` (responsable) ; `supabase-developer`
  (relecture des fonctions) ; `frontend-developer` ; `ux-writer`.
- **Revues** : conventions → tests → **sécurité obligatoire** (paiement).
- **Tests** (règle critique « paiement avant l'envoi ») : la page de retour
  seule ne débloque rien ; webhook non signé, mal signé ou rejoué refusé ;
  montant modifié refusé ; deux webhooks → un seul déblocage ; montant jamais
  pris du navigateur ; passage 50 → 100 = 9 000 FCFA ; essai puis forfait 50
  → plafond 60 ; excédent : les derniers ajoutés non envoyés sont bloqués, un
  invité déjà envoyé jamais ; paiement en attente rattrapé.
- **Critère de fin** : paiement sandbox de bout en bout sur preview (URL de
  webhook stable) ; audit sécurité sans problème grave.
- **Décisions à trancher avant** : Q9 (reçu de paiement, e-mails) ; Q10 (où
  dire « aucun remboursement ») ; compte FedaPay sandbox ouvert.

### Tranche 7 — QR, code d'accueil, scan, tables, arrivées 🔴
- **Objectif** : contrôler les entrées le jour J, à plusieurs téléphones.
- **À relire** : PRD § 6.12, § 6.14, § 7.7, § 7.8 ; 02 § 1.15, § 1.16, § 2.5,
  § 2.6, § 3 ; 03 § 1.13, § 1.14, § 2, § 4.7, § 4.10 ; TRD § 5, § 6, D12,
  D15, D20, D31 ; 07 § 6, § 7, § 15.2 ; 09 § 12, § 13.
- **Périmètre** : QR signé par invitation (« +1 » compris), « Afficher son
  QR », renvoi du QR par WhatsApp après confirmation ; tables nommées ou
  numérotées, affectation ; code d'accueil (8 caractères, J-1 à J+1,
  anti-essais, régénération) ; `/scan`, écran caméra (`BarcodeDetector` /
  `zxing-wasm`), choix « Les deux / principal seul / accompagnant seul »,
  mode strict ; `check_in` sous verrou ; table révélée après le scan ;
  arrivées en direct sur `/scan/<event>/live` **et** sur le tableau de bord
  de l'événement.
- **Tables** : `seating_tables`, `table_assignments`, `scan_access`,
  `scan_attempts`, `scan_sessions`, `check_ins` ; rôle `scanner`.
- **Agents** : `entry-control-specialist` (responsable) ;
  `supabase-developer` ; `frontend-developer` ; `ui-designer` ; `ux-writer`.
- **Revues** : conventions → tests → **sécurité obligatoire** (QR, scan,
  liens).
- **Tests** (règles critiques « entrée » et « table cachée ») : tous les cas
  de 02 § 3.2 ; **deux scanners simultanés → une seule entrée** ; double
  appui ; QR d'un autre événement ou modifié refusé ; code hors fenêtre ;
  5 codes faux → 15 min ; régénération → anciennes sessions refusées ;
  **table absente du HTML, de la charge utile et du réseau avant le scan** ;
  checklist sur iPhone et Android (caméra, faible lumière, PWA).
- **Critère de fin** : jour J simulé avec 2 téléphones scanners et 3
  invités ; audit sécurité sans problème grave.

### Tranche 8 — Administration minimale
- **Objectif** : pouvoir assister les organisateurs et suivre l'argent avant
  toute ouverture réelle.
- **À relire** : PRD § 4, § 7.12 ; 02 § 4.1, § 4.6, § 4.7, § 4.9 ; 03 § 3.1,
  § 3.6, § 3.7, § 3.9 ; TRD § 8, D33, D35, D36, D40 ; 07 § 2.2-2.6, § 8.4,
  § 13, § 14 ; 09 § 2.1, § 11, § 18.
- **Périmètre** :
  - création du **premier super-admin** (procédure à définir) ;
  - `/admin/login` complet (mot de passe, TOTP, 10 codes de secours,
    blocage, `/admin/reset`, session 8 h / 30 min) ;
  - `/admin/settings` : comptes admin, rôles, réinitialisation du TOTP ;
  - **support** : recherche organisateur / événement, état (RSVP, envoi,
    paiement), notes internes, **suspension** (super-admin) ;
  - **finance** : transactions, remboursements (saisie, exécution, effets
    D35 / D36), prix des devis.
- **Tables** : `admin_roles`, `admin_role_permissions`,
  `admin_recovery_codes`, `support_notes`, `refunds` ; vues `admin_*_v`.
- **Agents** : `admin-analytics-developer` (responsable) ;
  `supabase-developer` (vues) ; `payments-specialist` (logique des
  remboursements) ; `ui-designer`.
- **Revues** : conventions → tests → **sécurité obligatoire**
  (administration, droits d'accès).
- **Tests** : sans `aal2`, aucune ligne ; chaque rôle ne voit que sa partie
  (07 § 13) ; **zéro coordonnée d'invité** dans toute vue admin ; dernier
  super-admin non retirable ; pas d'auto-attribution de rôle ; 5 échecs →
  15 min ; remboursement total → brouillon, aucun envoi ; partiel → règle de
  l'excédent ; tout est journalisé.
- **Critère de fin** : un support retrouve un événement et son paiement ; la
  finance enregistre un remboursement ; audit sécurité sans problème grave.

### Tranche 9 — Mariage complet : templates, enveloppes, contenu, photos
- **Objectif** : une vraie invitation de mariage, belle et légère, à la
  place du rendu provisoire de la tranche 5.
- **À relire** : PRD § 6.3, § 6.4, § 6.8 ; 02 § 1.8, § 1.9, § 2.2, § 2.3 ; 03
  § 1.5, § 1.6, § 4.9 ; **05 en entier** (§ 1, § 2, § 3.1, § 4) ; 04 ; TRD
  § 9, § 11, D21 ; 07 § 3.3-3.5, § 4.3, § 15.1 ; 09 § 10, § 16.
- **Périmètre** : les **2 templates mariage** et les **3 styles
  d'enveloppe** (CSS + SVG, < 1 Mo avant l'ouverture) ; `/events/<id>/design`
  (choix et aperçu) ; `/events/<id>/content` (message, programme, infos
  pratiques, dress code, noms) ; téléversement des photos (compression,
  variantes, recadrage, EXIF supprimé) ; image d'aperçu WhatsApp ; accroche
  RSVP propre au template.
- **Tables** : `templates`, `template_photo_slots`, `envelope_styles`,
  `event_photos` ; buckets `template-assets`, `event-photos` ; durcissement
  des privilèges par défaut du schéma `storage` (décision du 2026-10-21,
  07 § 15.1).
- **Agents** : `template-designer` (responsable) ; `frontend-developer`
  (photos, route) ; `ui-designer` (écrans organisateur) ; `ux-writer`.
- **Revues** : conventions → tests → **sécurité obligatoire**
  (téléversements).
- **Tests** : budget Lighthouse en 4G lente (< 1 Mo avant ouverture) ;
  fichier trop lourd ou faux type refusé ; photos de l'événement d'un autre
  inaccessibles ; aperçu WhatsApp correct (preview) ; non-régression de la
  tranche 5.
- **Critère de fin** : invitation de mariage complète validée visuellement
  par le porteur du projet sur iPhone et Android.
- **Décisions à trancher avant** : noms, polices (licences) et palettes des
  2 templates (05 § 4) ; champs spécifiques du mariage et noms des mariés en
  police script (`type_fields`) ; « côté marié / mariée » = groupes libres
  (PRD § 5.1) et non champ du template ; Q-F (photo obligatoire vide) ; Q18
  (texte alternatif) ; sort des photos si l'on change de template ; images
  d'inspiration éventuelles dans `docs/inspiration/templates/mariage/`.

### Tranche 10 — Suivi : relances, programmation, messages, clôture, après l'événement
- **Objectif** : le cycle de vie complet d'un événement.
- **À relire** : PRD § 6.11, § 6.13, § 6.15, § 7.9, § 7.10 ; 02 § 1.12-1.14,
  § 1.17, § 1.18 ; 03 § 1.12, § 1.15 ; TRD § 2.4-2.8, D3, D4, D16, D28-D30 ;
  07 § 9, § 11.2 ; 09 § 7, § 13.
- **Périmètre** : envoi programmé et annulation ; relances automatiques
  (J+3 / J-7, une seule si ≤ 10 jours) ; messages manuels (modèles fixes,
  quota de 3) ; renvoi d'invitation ; notification de changement de date ou
  de lieu (+60 min, regroupée) ; clôture des RSVP ; statistiques après
  l'événement et remerciement aux présents ; instantané à J+2.
- **Agents** : `whatsapp-specialist` (responsable) ; `supabase-developer` ;
  `frontend-developer` ; `ux-writer` (modèles `reminder_v1`,
  `event_update_v1`, `thank_you_v1`, `host_message_*_v1`).
- **Revues** : conventions → tests → **sécurité obligatoire** (WhatsApp).
- **Tests** : quota de 3 sous clics simultanés ; relances annulées
  (réponse, clôture, désactivation, exclusion) ; pas de relance le jour J ou
  après ; renvoi gratuit unique ; notification non envoyée à ceux qui ont
  décliné ; remerciement aux seuls présents ; aucune réponse modifiable après
  clôture.
- **Critère de fin** : cycle complet rejoué en accéléré (horloge simulée).
- **Décisions à trancher avant** : Q11 (plages horaires la nuit) ; plafond
  du nombre de notifications de changement (TRD § 17.1 pt 3).

### Tranche 11 — WhatsApp réel en mode test (preview)
- **Objectif** : vérifier le vrai comportement de Meta avant la production.
- **À relire** : TRD § 2 (dont § 2.5 modèles, § 2.7 webhooks, § 2.8 limites,
  § 2.9 prérequis), § 15 ; 09 § 7.
- **Périmètre** : application Meta, numéro de test, modèles soumis à
  validation, mode `test` limité à `WHATSAPP_TEST_ALLOWLIST`, webhook signé
  réel sur l'URL de staging stable, statuts et facturation réels, alertes
  « modèle en pause » et « qualité basse » ; code de connexion WhatsApp réel.
- **Agents** : `whatsapp-specialist` (responsable) ; `devops-engineer`.
- **Revues** : tests (vrais téléphones) → **sécurité obligatoire**.
- **Tests** : un numéro hors liste blanche n'est jamais contacté ; mode
  `live` refusé en preview ; « Ne plus recevoir » réel ; échec « numéro non
  WhatsApp » remonté proprement.
- **Critère de fin** : invitation, QR, relance et code de connexion reçus
  sur les téléphones de l'équipe.
- **Décisions à trancher avant** : canal des alertes Meta (e-mail, Sentry,
  écran) ; invités hors Afrique (coût et livrabilité).

### Tranche 12 — Les 5 autres types d'événement
- **Objectif** : décliner la mécanique éprouvée sur les 10 templates
  restants.
- **À relire** : 05 § 3.2-3.6 ; PRD § 5.2 ; 09 § 10.
- **Périmètre** : un sous-lot par type, dans cet ordre conseillé : baptême
  (simple), sortie d'enfant, anniversaire, autre, dot (le plus lourd en
  motifs). Chaque type : 2 templates, emplacements photos, champs
  spécifiques, fond d'aperçu WhatsApp, accroche RSVP.
- **Agents** : `template-designer` (responsable) ; `ux-writer`.
- **Revues** : conventions → tests (budget de poids, non-régression).
- **Tests** : < 1 Mo par template ; aperçu WhatsApp ; parcours de la
  tranche 5 rejoué pour chaque type.
- **Critère de fin** : 12 templates validés par le porteur du projet.
- **Décisions à trancher avant** : anniversaire, accent « au choix » contre
  « pas d'édition libre » ; autre, photo 4:5 ou 3:2 « au choix » ; noms,
  polices et palettes de chaque type.

### Tranche 13 — Vitrine, PostHog, codes promo, influenceurs
- **Objectif** : acquérir et mesurer.
- **À relire** : PRD § 6.17, § 7.11 ; 02 § 1.1, § 4.5 ; 03 § 3.5, § 4.13 ;
  TRD § 13.1, § 13.2, D18, D19, D34 ; 07 § 10 ; 09 § 17, § 18 bis, § 19.
- **Périmètre** : vitrine `/` ; bandeau de cookies et PostHog UE (jamais sur
  `/i/*`) ; liens de suivi (`cv_ref` 30 jours, attribution définitive à
  l'inscription) ; codes promo (création, 15 % max, stats) ; influenceurs.
  **À livrer avant toute campagne** : les inscrits arrivés avant ne pourront
  jamais être attribués.
- **Agents** : `admin-analytics-developer` (responsable) ;
  `frontend-developer` (vitrine) ; `payments-specialist` (code au paiement) ;
  `ux-writer`.
- **Revues** : conventions → tests → **sécurité obligatoire**
  (administration).
- **Tests** : code saisi prioritaire sur le lien ; `max_uses` sous paiements
  simultanés ; remise > 15 % impossible ; aucun cookie de mesure sans
  accord ; aucune donnée personnelle dans PostHog.
- **Critère de fin** : un lien de suivi produit une inscription attribuée,
  puis un paiement avec code visible dans les stats.

### Tranche 14 — Suppression des données, pages légales, PWA
- **Objectif** : conformité minimale avant le lancement.
- **À relire** : PRD § 7.13 ; 02 § 1.19 ; TRD § 10, § 12 ; 07 § 16 ; 09
  § 11, § 19, § 20.
- **Périmètre** : `delete_event`, `delete_organizer_account` (comptabilité
  conservée sans donnée personnelle) ; nettoyage des fichiers ; pages
  légales (brouillons du `ux-writer`, validés par un juriste) ; PWA
  (installation guidée sur iPhone, aucun manifeste sur `/i/*`).
- **Agents** : `supabase-developer` (responsable) ; `frontend-developer` ;
  `ux-writer` ; `devops-engineer`.
- **Revues** : conventions → tests → **sécurité obligatoire** (droits
  d'accès).
- **Tests** : après suppression, aucune donnée personnelle ne subsiste ;
  paiements et coûts conservés ; empreinte d'essai et exclusion conservées.
- **Critère de fin** : suppression vérifiée table par table.
- **Décisions à trancher avant** : Q15, Q16, Q17, Q20 ; validation juridique.

### Tranche 15 — Tableaux de croissance, marges, exports
- **Objectif** : piloter la croissance et la rentabilité.
- **À relire** : PRD § 6.16 ; 02 § 4.2-4.4, § 4.6 ; 03 § 3.2-3.4, § 4.8,
  § 4.12 ; TRD § 8.2, § 13.3, § 13.4, § 14 ; 07 § 11, § 14 ; 09 § 14, § 15,
  § 18.
- **Périmètre** : tableau de bord principal, entonnoir, qualité d'usage et
  fidélisation, marges (coûts WhatsApp réels, frais FedaPay, stockage),
  exports Excel journalisés ; écrans grille de prix et pays.
- **Agents** : `admin-analytics-developer` (responsable) ;
  `supabase-developer` (vues).
- **Revues** : conventions → tests → **sécurité obligatoire**
  (administration).
- **Tests** : revenus masqués au rôle marketing ; exports sans coordonnée
  d'invité, formules neutralisées ; gros export en tâche de fond.
- **Critère de fin** : le porteur du projet lit ses indicateurs du mois.

### Tranche 16 — Mise en production
- **Objectif** : ouvrir au public.
- **À relire** : TRD § 2.9, § 3.4, § 12, § 15, § 17.1 ; PRD § 9.
- **Périmètre** : société créée ; vérification d'entreprise Meta ; numéro
  dédié et nom affiché ; modèles validés en production ; FedaPay live (et
  réponses sur CI / TG / SN) ; domaine `convivia.app` ; projet Supabase
  production (accès restreint, sauvegardes) ; pages légales validées ;
  checklist finale de sécurité ; plan de retour arrière.
- **Agents** : pilote et `devops-engineer` ; `security-reviewer` (audit
  final complet).
- **Revues** : audit sécurité complet → répétition générale avec de vrais
  utilisateurs (essai réel).
- **Critère de fin** : premier événement réel payé et contrôlé à l'entrée.

---

## 3. Prérequis externes à lancer dès maintenant

Délais longs, hors du code : à démarrer en parallèle des tranches 0 à 5.

| Prérequis | Bloquant à partir de |
|---|---|
| Création de la société (D9) | Tranche 16 (FedaPay live, vérification Meta) |
| Domaine `convivia.app` + sous-domaine de staging | Tranche 6 (webhooks stables) ; le domaine de production est figé dans les modèles Meta |
| Compte Vercel, projet Supabase staging, Sentry | Tranche 1 |
| Resend + domaine vérifié | Premier envoi d'e-mail en preview |
| Compte FedaPay sandbox | Tranche 6 |
| Application Meta, numéro de test | Tranche 11 (et code WhatsApp réel) |
| Réponses écrites de FedaPay (5 questions, TRD § 3.4) | Tranche 16 |
| Juriste (confidentialité, CGU, mentions) | Tranche 14 ; la politique de confidentialité est exigée par Meta |
| Références visuelles (templates, enveloppes, écrans prioritaires) | Tranches 9 et 12 (non bloquant) |

---

## 4. Décisions prises pendant la rédaction du plan (2026-10-21)

Reportées dans les documents sources (TRD § 0, D43 à D46).

| # | Décision |
|---|---|
| D43 | **Essai refusé** si la liste compte déjà plus de 10 places ; message « retirez des invités ou choisissez un forfait » |
| D44 | **Profil après le premier code** : nom, ville, pays demandés à la première connexion, avant le tableau de bord ; modifiables dans le compte ; le nom signe « De la part de [organisateur] » |
| D45 | Invité : **prénom obligatoire** (variable des messages) et **nom facultatif** |
| D46 | **Premier type construit de bout en bout : mariage** ; les 5 autres types en tranche 12 |

---

## 5. Décisions encore ouvertes

Chaque question est posée au porteur du projet à la **préparation** de la
tranche indiquée, avant toute construction.

| Question | Source | Avant la tranche |
|---|---|---|
| Lecture du code de connexion simulé en local | — | 2 |
| Q4 — Changer d'e-mail, remplacer un numéro vérifié, effet sur l'essai | 09 § 22 | 2 |
| Q20 — CGU : acceptation à l'inscription ? qui fournit les textes ? | 09 § 22 | 2 (acceptation) / 14 (textes) |
| Q12 — Expéditeur des e-mails, contact support | 09 § 22 | 1 ou 2 |
| Q-B — Priorité des états du badge | 09 § 22 | 3 |
| Q7 — Longueurs maximales des champs | 09 § 22 | 3 |
| Q21 — Hors connexion pendant une saisie | 09 § 22 | 3 |
| Q-I — Animation d'ouverture passée ou réduite | 09 § 22 | 5 |
| Q14 — Page invité : événement passé, organisateur suspendu | 09 § 22 | 5 |
| Aperçu organisateur de l'invitation sans jeton | Inventaire PM | 5 |
| Q9 — Reçu de paiement, e-mails transactionnels | 09 § 22 | 6 |
| Q10 — Où annoncer « aucun remboursement » | 09 § 22 | 6 |
| Retour de paiement : `/package/return` (TRD § 3.1) ou `/package` (02 § 1.11) | Inventaire PM | 6 |
| Création du premier super-admin | Inventaire PM | 8 |
| Noms, polices, palettes des templates | 05 § 4 | 9 puis 12 |
| Champs spécifiques par type (`type_fields`), noms des mariés | 05 § 3 | 9 |
| Image d'aperçu WhatsApp : par template ou par événement | 05 § 1.5 / TRD § 11.4 | 9 |
| Changement de template après dépôt des photos | Inventaire PM | 9 |
| Q-F — Photo obligatoire vide | 09 § 22 | 9 |
| Q18 — Texte alternatif des photos | 09 § 22 | 9 |
| Q11 — Plages horaires d'envoi la nuit | 09 § 22 ; TRD § 17.1 pt 4 | 10 |
| Nombre maximal de notifications de changement | TRD § 17.1 pt 3 | 10 |
| Canal des alertes Meta (modèle en pause, qualité basse) | TRD § 2.5 | 11 |
| Invités hors Afrique : coût et livrabilité | PRD § 2 / TRD § 2.4 | 11 |
| Anniversaire : accent « au choix » ; Autre : photo 4:5 ou 3:2 | 05 § 3.4, § 3.6 | 12 |
| Portée de `/admin/templates` au MVP | 02 § 4.8 | 15 |
| Q15, Q16 — Confirmation et délai de grâce à la suppression | 09 § 22 | 14 |
| Q17 — Portabilité des données | 09 § 22 | 14 |
| Société, FedaPay CI / TG / SN, juridique, nom Convivia (OAPI) | TRD § 17.1 ; PRD § 9 | 16 |
