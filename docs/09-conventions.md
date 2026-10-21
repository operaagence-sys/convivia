# 09 — Conventions Convivia (« rien à moitié »)

> Checklists de ce qu'une fonctionnalité **complète** contient, comme dans toute
> application sérieuse du même domaine. Rédigé le 2026-10-20 (passes de
> correction n° 1 à n° 4 le même jour) à partir de `01-prd.md`, `02-app-flow.md`,
> `03-sections-composants.md`, `04-design-system.md`, `05-templates-
> enveloppes.md`, `06-trd.md`, `07-schema-backend.md` et `CLAUDE.md`.

## 0. À quoi sert ce document

- **Usage** : à l'étape 2 de chaque tranche (`CLAUDE.md` § 7.3), l'agent
  `conventions-keeper` compare **le code réel** (pas l'intention) à la section
  correspondante. Chaque case est marquée **présent**, **manquant** ou **non
  applicable** (avec la raison). Les manques sont comblés par l'agent de
  construction concerné, puis revus.
- **Convention ≠ règle métier.** Une convention dit *ce qu'une fonctionnalité
  complète contient* (un renvoi de code, un état d'erreur…). Elle ne remplace
  jamais une décision du porteur du projet. Quand une case suppose une règle
  absente des documents (durée, limite, parcours), elle n'est **pas** fixée
  ici : elle renvoie à une question du § 22 (`Q4`, `Q7`…). Deux cas :
  - question de **VALEUR** (Q7 : quelle longueur) : le comportement existe dans le code et sa valeur est
    paramétrable, sans valeur imposée ;
  - question d'**EXISTENCE** (le comportement est-il prévu ? Q9 reçu, Q15,
    Q16 délai de grâce, Q17 export, Q18 légendes, etc.) : la case est **non
    applicable tant que non décidé**. Le gardien ne la réclame pas et ne
    signale pas son absence comme un manque.
- **Décisions du porteur du projet** : les décisions du 2026-10-20 sont
  centralisées dans `06-trd.md` § 0 (**D23 à D39**) et reportées dans les
  documents sources ; une règle tranchée est citée avec sa source documentaire
  (ex. « PRD § 7.5 ; TRD D26 »). Les numéros « D » du 09 sont ceux du TRD § 0.
- **Valeurs déjà fixées** par les documents : citées avec leur source.
- Les cases sont cochables (`- [ ]`). Source entre parenthèses : « PRD » =
  `01-prd.md`, « 02 » = app-flow, « 03 » = sections-composants, « 05 »,
  « 04 » = design system, « TRD » = `06-trd.md`, « 07 » = schéma backend.
  Quand une case n'a pas de source dans les documents, elle est marquée
  **(convention de confort, sans source)** : elle n'est jamais présentée comme
  une règle des documents et ne peut pas être classée « Élevée ».

---

## 1. Conventions transverses (toutes les fonctionnalités)

### 1.1 Langue, code, formats
- [ ] Tout texte visible (écrans, erreurs, e-mails, messages WhatsApp, pages
      légales) est en **français** (CLAUDE.md § 6 ; TRD § 2.5).
- [ ] Code, noms de variables, de fichiers et de dossiers en **anglais**
      (slugs en kebab-case, 03 « Conventions de lecture »).
- [ ] Montants en **FCFA, entiers** (`integer`, devise `XOF`), sans décimales ;
      (TRD § 1.3). Affichage : séparateur de milliers (ex. `19 000 FCFA`) en
      convention d'interface ; seul le format d'export `# ##0 "FCFA"` est fixé
      par les documents (TRD § 14).
- [ ] Numéros normalisés en **E.164** à la saisie (`libphonenumber-js`) ;
      champ avec indicatif pays (TRD § 1.3 ; 03 § 5).
- [ ] Dates stockées en `timestamptz` (UTC), **affichées dans le fuseau de
      l'événement** (Bénin UTC+1 ; Côte d'Ivoire, Togo, Sénégal UTC+0)
      (TRD § 1.3). Envois programmés et relances calculés dans ce fuseau.
- [ ] Aucune valeur métier en dur (grille de prix, tarifs WhatsApp, pays) :
      elle vient de la base (TRD § 2.1, § 3.2).

### 1.2 États de chaque écran et composant
- [ ] Les quatre états sont prévus et visibles : **vide** (message + action
      suivante), **chargement** (squelette ou spinner, pas d'écran blanc),
      **erreur** (message clair en français + « Réessayer » quand c'est
      possible), **succès** (confirmation visible : toast ou état à jour)
      (03 « Conventions de lecture »).
- [ ] Compte organisateur **suspendu** : bandeau « Compte suspendu, contactez
      le support », lecture seule, toutes les actions de modification et
      d'envoi désactivées, sur **toutes** les sections organisateur
      (PRD § 4 ; 02 § 1.19 ; 03 § 1.16).
- [ ] Mobile : zones tactiles ≥ 44 px (`04-design-system.md`) ; admin : desktop
      (02 « Conventions »).
- [ ] Les erreurs techniques ne montrent jamais de trace, de code interne ni de
      donnée personnelle à l'utilisateur.

### 1.3 Données personnelles et confidentialité
- [ ] **Coordonnées des invités** (nom + numéro, table `guest_contacts`) :
      accessibles **au seul organisateur propriétaire** ; jamais dans un écran,
      une vue ou un export admin (super-admin compris), jamais dans les
      journaux, Sentry ou PostHog (CLAUDE.md § 5 ; PRD § 4 ; TRD § 8.3, § 12.2).
- [ ] Journaux et rapports d'erreur : numéros masqués (`+229 •• •• •• 12`),
      noms supprimés (TRD § 12.2).
- [ ] **Aucun outil d'analyse ni traceur tiers sur `/i/*`** (CLAUDE.md § 5 ;
      TRD D18).
- [ ] Pas d'identifiant séquentiel dans les URL ; token invité de 128 bits
      (TRD § 4).

### 1.4 Règles critiques et sécurité
- [ ] Règles critiques (scan, plafond d'invités, quotas WhatsApp, déblocage
      après paiement) dans des **fonctions Postgres** ; le client ne peut pas
      les contourner (CLAUDE.md § 5 ; TRD § 1.3).
- [ ] **Validation côté serveur** de tout ce que le client envoie ; les montants
      et droits ne viennent jamais du navigateur (TRD § 3.1).
- [ ] RLS actif sur toute nouvelle table ; test d'accès associé (07 § 17).
- [ ] Aucune clé (FedaPay, WhatsApp, Supabase, secrets de signature) dans le
      code ni dans le dépôt ; variables d'environnement seulement ;
      `.env.example` sans valeurs (CLAUDE.md § 5 ; TRD § 15).
- [ ] **Garde-fous d'environnement dans le code** : `WHATSAPP_MODE=live` et clé
      FedaPay live **refusés** si `VERCEL_ENV !== 'production'` ; `simulate` en
      local, `test` (liste blanche `WHATSAPP_TEST_ALLOWLIST`) en preview ;
      FedaPay sandbox hors production (CLAUDE.md § 5 ; TRD § 15).
- [ ] Données de démonstration : numéros fictifs uniquement (TRD § 15).
- [ ] Toute action sensible est écrite dans `audit_log` (07 § 2.5 ; TRD § 8.4).
- [ ] **Événement produit** : chaque fonctionnalité qui correspond à un fait
      marquant (inscription, événement créé, template choisi, paiement commencé
      / confirmé / échoué, essai, invitations envoyées, invitation ouverte,
      RSVP, entrée scannée, remerciement envoyé) l'écrit dans
      `analytics_events`, par le serveur seulement, **sans donnée personnelle**
      (propriétés en liste blanche) (TRD § 13.5 ; 07 § 11.1).
- [ ] **Tâches planifiées** présentes quand la fonctionnalité les suppose
      (**liste non exhaustive**) : purge des lignes `scan_attempts` de plus de
      48 h (07 § 7.2) ; instantané de statistiques `event_stats_snapshots` à
      J+2 pour les statistiques d'après événement (07 § 11.2) ; rattrapage
      `pg_cron` des paiements FedaPay `pending` toutes les 10 min (TRD § 3.1) ;
      dispatcher WhatsApp chaque minute (TRD § 2.8) ; nettoyage des fichiers
      après suppression d'un événement ou d'un compte (07 § 16).

---

## 2. Inscription et connexion de l'organisateur

Source : PRD § 6.1 ; 02 § 1.1 à 1.4, § 1.19 ; 03 § 1.1, § 1.16 ; TRD D10, D11, D23, D24, § 7.

- [ ] **Point d'entrée unique `/login`** (inscription + connexion) ; `/signup`
      redirige vers `/login` en **conservant `?ref=`** (02 § 1.1 à 1.4 ;
      03 § 1.1 ; TRD D23).
- [ ] Deux méthodes puis écran de vérification `/verify` : **WhatsApp**
      et **e-mail**, **sans mot de passe** (TRD D10 ; 03 § 1.1).
- [ ] Code **à 6 chiffres à usage unique**, valable **10 min** (TRD § 7.1).
- [ ] **Renvoi du code** : bouton « Renvoyer le code », limité à **un envoi
      toutes les 60 s** (TRD § 7.1), avec décompte visible et bouton désactivé
      pendant le délai.
- [ ] **Limite de tentatives** de saisie du code : **5 erreurs → blocage de
      15 min**, compteur **côté serveur**, avec message clair et décompte au
      blocage (TRD D24, § 7.1 ; 02 § 1.2 ; 03 § 1.1). Le compteur est tenu dans
      `login_attempts`, indexé par l'**empreinte** HMAC de l'identifiant (le
      compte peut ne pas exister), purge à 48 h ; la **vérification du code
      passe par une route serveur**, jamais par un appel direct du navigateur
      à Supabase Auth (TRD § 7.1 ; 07 § 2.1).
- [ ] **Comptes admin exclus du parcours organisateur** : la route serveur de
      `/login` **n'envoie aucun code** si l'e-mail ou le numéro appartient à
      `admin_users`, et affiche le **même message neutre** (TRD § 7.1, D23,
      D33).
- [ ] **Inscription et connexion fusionnées, message neutre** : le code est
      envoyé dans tous les cas, sans révéler si le compte existe ; **pas
      d'erreur « email déjà utilisé »** (TRD D23, § 7.1 ; 03 § 1.1).
- [ ] États d'erreur nommés : code faux, code expiré, numéro invalide, e-mail
      invalide, trop d'essais, numéro sans WhatsApp (message « Ce numéro
      n'utilise pas WhatsApp, inscrivez-vous par e-mail », TRD § 7.1), échec
      d'envoi de l'e-mail (03 § 1.1).
- [ ] Pas de repli SMS au MVP (TRD § 7.1) : le message d'erreur propose
      l'e-mail.
- [ ] Bouton d'envoi désactivé pendant la requête ; saisie conservée après
      erreur (voir § 3).
- [ ] Après vérification : redirection vers `/dashboard` ; le lien de suivi
      `?ref=` mémorisé 30 jours est rattaché **définitivement** au compte à
      l'inscription (PRD § 7.11 ; TRD § 13.2).
- [ ] Numéro WhatsApp vérifié pour l'essai : un compte e-mail peut ajouter et
      vérifier un numéro (`phone_confirmed_at`), avec renvoi de code et mêmes
      états d'erreur (TRD § 7.3).
- [ ] **Session** : glissante de **30 jours** sur l'appareil (TRD § 7.4) ;
      reconnexion retrouve les événements (PRD § 6.1).
- [ ] **Déconnexion** simple, et bouton **« Déconnecter toutes les sessions »**
      dans `/account` (02 § 1.19 ; 03 § 1.16 ; TRD § 7.4).
- [ ] **Modification des informations du compte** (02 § 1.19) : l'organisateur
      ne modifie que `full_name`, `city` et `country_code` ; e-mail et numéro
      ne viennent que du flux d'authentification (07 § 2.1) ; ajout d'un numéro
      vérifié par code pour un compte e-mail (TRD § 7.3). Changement d'e-mail,
      remplacement d'un numéro vérifié et effet sur l'essai : non décidés
      (**Q4**, non applicable tant que non décidé).
- [ ] **Suppression de compte** : voir § 11 (actions destructrices).
- [ ] Compte suspendu : connexion possible, lecture seule (PRD § 4).

### 2.1 Connexion administrateur
Source : 02 § 4.1, § 4.9 ; 03 § 3.1, § 3.9 ; 07 § 2.2 ; TRD D13, D33, § 8.1, § 8.4.
- [ ] E-mail + mot de passe, puis **code TOTP obligatoire** ; aucune
      inscription publique ; comptes créés par le super-admin seulement.
- [ ] **Message d'erreur unique** « Identifiants ou code incorrects », quel que
      soit le champ faux (e-mail, mot de passe ou TOTP) (02 § 4.1 ; 03 § 3.1 ;
      TRD D33).
- [ ] **5 échecs** (mot de passe et TOTP confondus) → **blocage de 15 min**,
      compteur côté serveur (`failed_logins`, `locked_until`, 07 § 2.2),
      **chaque blocage journalisé** dans `audit_log` (02 § 4.1 ; TRD D33,
      § 8.1).
- [ ] **Enrôlement TOTP à la première connexion** : QR d'activation + clé à
      saisir, validé par un premier code ; **10 codes de secours** à usage
      unique, **hachés** en base, **affichés une seule fois** (02 § 4.1 ;
      03 § 3.1 ; 07 § 2.2 ; TRD D33).
- [ ] Les routes `/admin/*` et les politiques RLS admin exigent `aal2`
      (TRD § 8.1) ; un accès sans TOTP est refusé, pas seulement masqué.
- [ ] **Mot de passe oublié** via `/admin/reset` : lien e-mail **à usage
      unique de 30 min**, **même message que le compte existe ou non**, **toutes
      les sessions admin fermées** après changement, TOTP toujours exigé
      (02 § 4.1 ; 03 § 3.1 ; TRD D33).
- [ ] **TOTP perdu** : connexion par un code de secours, ou réinitialisation
      par un super-admin (**motif obligatoire**, journalisée) puis nouvel
      enrôlement ; **dernier super-admin sans facteur ni code de secours** :
      réinitialisation manuelle par le **propriétaire du projet dans la console
      Supabase**, consignée **hors application** (02 § 4.1 ; TRD D33, § 8.1).
- [ ] **Action « Réinitialiser la double authentification »** dans
      `/admin/settings` (super-admin) : motif obligatoire, journalisée,
      confirmation avec effet expliqué (§ 11) (02 § 4.9, § 4.1 ; 03 § 3.9 ;
      TRD D33).
- [ ] **Code de secours utilisé** = le serveur vérifie le code haché,
      **supprime le facteur TOTP** (API admin) et impose un **nouvel
      enrôlement immédiat** avant tout accès à `/admin` (un code de secours ne
      donne pas `aal2`) (TRD § 8.1).
- [ ] **Connexion admin et comptage des échecs par une route serveur**
      (`failed_logins`, `locked_until`), pas d'appel direct du navigateur
      (TRD § 8.1).
- [ ] Journal d'audit étendu (TRD § 8.4) : connexions admin, **blocages de
      compte admin**, **réinitialisations du TOTP**, changements de rôle,
      création et désactivation de comptes admin, suspensions et
      réactivations, modifications de la grille de prix, devis, remboursements,
      exports.
- [ ] **Session admin** : **8 h** au maximum, fermée après **30 min
      d'inactivité**, **appliquée dans l'application** (middleware `/admin/*` :
      horodatage de connexion et de dernière activité, admins seulement) ; les
      réglages de session Supabase ne sont pas utilisés car ils couperaient la
      session de 30 jours des organisateurs (02 § 4.1 ; TRD D33, § 8.1).

---

## 3. Formulaires (tous)

Source : 03 § 5 (primitives) ; TRD § 1.3, § 3.1.

- [ ] **Validation serveur** en plus de la validation client ; le client ne
      fait qu'aider.
- [ ] **Message par champ** (sous le champ, en français, précis : « Numéro
      invalide : ajoutez l'indicatif du pays »), plus un résumé si le
      formulaire est long ; focus placé sur le premier champ en erreur.
- [ ] Bouton d'envoi **désactivé** et en état « chargement » pendant l'envoi ;
      **double soumission impossible** (verrou client + idempotence côté
      serveur pour les actions qui créent ou débitent).
- [ ] **Saisie conservée après erreur** (aucun champ vidé, sauf codes secrets).
- [ ] Succès : confirmation visible et prochaine étape claire ; formulaire
      réinitialisé seulement si c'est une saisie en série (ajout d'invité).
- [ ] Champs obligatoires signalés ; champs facultatifs indiqués comme tels.
- [ ] Formats : numéro **E.164** avec sélecteur d'indicatif ; dates et heures
      dans le **fuseau de l'événement** (sélecteur : date passée = « hors
      plage », 03 § 5) ; montants **FCFA entiers** (aucune virgule).
- [ ] Longueurs maximales annoncées pour les champs libres (nom, message,
      programme) → valeurs à fixer (**Q7**).
- [ ] Perte de connexion pendant l'envoi : message d'erreur, saisie
      conservée, nouvel essai possible sans double effet.
- [ ] Accessibilité de base : libellés associés aux champs, clavier adapté
      (`inputmode="numeric"` pour les codes, `tel` pour les numéros),
      autocomplétion du code OTP quand le navigateur le permet.

---

## 4. Événement : création et édition

Source : PRD § 6.2, § 6.4, § 7.9 ; 02 § 1.5 à 1.9, § 1.17 ; 03 § 1.2 à 1.6.

- [ ] Liste `/dashboard` : cartes d'événement avec badge d'état, états vide /
      chargement / erreur / succès (03 § 1.2). Les **7 états** calculés sont
      ceux de 07 § 4.1 : brouillon (`unpaid`), **essai**, payé, programmé (un
      `bulk_send` en attente), envoyé (`first_sent_at`), clôturé
      (`rsvp_closed_at`), passé (`starts_at` dépassé) ; alignés dans
      02 § 1.5 et 03 § 4.11. Ordre de priorité quand plusieurs états
      coexistent : non décidé (**Q-B**).
- [ ] Création minimale : type, nom, date, lieu, hôtes ; erreurs « champ
      manquant » et « date passée » (03 § 1.3).
- [ ] **Champ « Pays de l'événement » obligatoire** à la création ; le fuseau
      est déduit du pays (`events.timezone` déduit de `country_code`, 07 § 4.1)
      (PRD § 6.2 ; 02 § 1.6 ; 03 § 1.3 ; TRD D25). Le pays est **modifiable
      jusqu'au premier envoi** (fuseau recalculé par `update_event_country()`),
      puis **figé** comme le type : champ verrouillé avec explication, modification
      refusée côté serveur (PRD § 6.2 ; 02 § 1.6 ; 03 § 1.3 ; TRD D39 ; 07 § 4.1).
- [ ] **Changement de pays : l'heure locale est conservée** (15 h reste 15 h
      dans le nouveau pays) ; `starts_at`, **envois programmés** et **relances**
      sont recalculés dans le nouveau fuseau par `update_event_country()` ;
      l'organisateur est prévenu avant validation que les heures seront
      recalculées (avertissement : convention d'interface, sans source)
      (PRD § 6.2 ; TRD D41 ; 07 § 4.1).
- [ ] **Champs spécifiques par type d'événement** (`type_fields`) proposés selon
      le type choisi, avec les mêmes états d'erreur que les autres champs
      (PRD § 6.2 : « champs spécifiques au type » ; 07 § 4.2 `type_fields`).
      La liste des champs de chaque type est dans le bloc « Champs
      spécifiques » de 05 § 3.1 (mariage), § 3.2 (dot), § 3.3 (baptême),
      § 3.4 (anniversaire), § 3.5 (sortie d'enfant) et § 3.6 (autre).
- [ ] Le **type** n'est plus modifiable après le premier envoi : le champ est
      verrouillé avec explication (PRD § 6.2 ; 02 § 1.6).
- [ ] Sections éditables dans n'importe quel ordre ; chaque section signale
      « à compléter » tant qu'elle est vide (03 § 1.4).
- [ ] Choix de template (2 par type) puis d'enveloppe (3) avec aperçu fidèle ;
      couleurs de l'enveloppe adaptées à la palette ; pas d'édition libre du
      design (PRD § 6.3 ; 02 § 1.8).
- [ ] Contenu : message, programme (liste d'étapes horaires), infos pratiques,
      dress code, noms, photos ; bouton « Aperçu » = ce que verra l'invité
      (02 § 1.9).
- [ ] **Modification de date ou de lieu** après envoi : mini-site mis à jour
      pour tous, **notification WhatsApp de changement** (tous sauf ceux qui
      ont décliné ; regroupement des modifications dans l'heure ; hors
      quota), QR codes inchangés (PRD § 7.9 ; TRD § 2.8 D16). Convention
      d'interface (sans source) : l'organisateur est **prévenu avant
      validation** qu'une notification partira.
- [ ] Modification impossible en lecture seule (compte suspendu).
- [ ] Suppression d'un événement : voir § 11.

---

## 5. Gestion des invités

Source : PRD § 5.1, § 6.5, § 7.2, § 7.5, § 7.12, § 7.14 ; 02 § 1.10 ; 03 § 1.7, § 1.10, § 4.1, § 4.2 ; 04 « Gestion des invités » ; TRD § 2.6, § 3.2, D26, D27, D36, D37 ; 07 § 1.3.

- [ ] Ajout un par un (pas d'import, PRD § 8) : nom, numéro E.164, type
      **individuelle / avec accompagnant** (nom de l'accompagnant optionnel),
      groupe facultatif (créable à la volée).
- [ ] **Case d'attestation obligatoire** « Cet invité accepte de recevoir son
      invitation par WhatsApp » ; horodatée et rattachée au compte (preuve) ;
      ajout refusé si non cochée (PRD § 7.14 ; TRD § 2.6).
- [ ] Un **numéro déjà présent n'est pas une erreur** (PRD § 6.5) ; aucune
      alerte bloquante pour doublon.
- [ ] Compteur « décompté / plafond du forfait » ; « Nom + 1 » compte pour 2
      (PRD § 7.2).
- [ ] **Plafond** : avant le premier paiement, l'ajout est libre (TRD § 3.2).
      **Pendant l'essai gratuit** (plafond 10), l'ajout d'un 11e invité est
      **refusé** : il faut payer un forfait (02 § 1.10 ; TRD § 3.2, D27).
      **Après paiement**, l'ajout
      reste **libre** au-delà du plafond ; parmi les invités **pas encore
      envoyés**, seuls ceux **en excédent** (les derniers ajoutés au-delà du
      plafond, dans l'ordre d'ajout) sont marqués **« en attente de
      paiement »** et ne reçoivent **rien** (invitation, relances, messages)
      tant que le complément n'est pas payé, avec message clair et lien vers
      `/package` ; tous les autres invités, dans le plafond, continuent de
      recevoir normalement (PRD § 7.5 ; 02 § 1.10 ; 03 § 1.7, § 4.1 ; 04
      « Gestion des invités » ; TRD § 3.2, D26 ; 07 § 5.2).
- [ ] **Un invité déjà envoyé n'est jamais en excédent** (il garde son QR, ses
      relances et ses notifications) ; calcul : places disponibles = plafond −
      places des invitations déjà envoyées, les invitations non envoyées étant
      prises dans l'ordre d'ajout (`private.is_over_cap`, fonction Postgres,
      pas de calcul côté navigateur) (PRD § 7.5 ; TRD § 3.2, D37 ; 07 § 1.3 ;
      02 § 1.10).
- [ ] **Remboursement partiel** : mêmes règles du dépassement (D36) : seuls les
      invités en excédent non envoyés passent « en attente de paiement » ; les
      invités déjà servis ne sont pas touchés (voir § 6.4). L'ancienne règle
      « aucun nouvel envoi tant que le décompte dépasse le plafond » est
      **abandonnée**.
- [ ] Le compteur (barre de progression `warning` plein si dépassé après
      paiement), la liste (puce « en attente de paiement » sur les cartes
      concernées) et l'écran d'envoi (**nombre d'invités exclus** avec lien vers
      le forfait, 03 § 1.10) signalent les invités en attente de paiement, qui
      ne recevront pas leur invitation tant que le complément n'est pas payé
      (04 « Gestion des invités » ; 03 § 1.10).
- [ ] **Plafond avec l'essai** : plafond = **places payées + 10**, toujours (10
      invitations offertes = bonus fixe ; ex. 50 → 60 ; passage 50 → 100 →
      110) ; le prix, le choix entre les deux options (PRD § 7.1) et les
      remboursements se calculent sur les places **payées** seulement ; après
      un remboursement total, les 10 offertes sont **gardées mais ne resservent
      qu'avec un nouveau paiement** (brouillon, plafond 0, aucun envoi) (PRD
      § 7.4, § 7.12 ; TRD § 3.2, D27, D35 ; 07 § 4.1 `trial_bonus_seats`).
- [ ] Liste : recherche, filtre par groupe, états vide (« aucun invité,
      ajoutez le premier ») / chargement / erreur / succès (voir § 14).
- [ ] Carte d'invité : type, groupe, puce RSVP, table, **statut de livraison
      WhatsApp** (envoyé / échec / a refusé les messages), messages restants
      dans le quota, actions modifier / supprimer / relancer / copier le lien
      / **afficher son QR** (03 § 4.2).
- [ ] Invité dans la liste d'exclusion : signalé « a refusé les messages
      WhatsApp », action « Copier son lien » ; l'organisateur en est informé
      (PRD § 7.14).
- [ ] **« Copier son lien » (D42)** : bouton **actif seulement si l'événement
      est payé ou en essai ET l'invité est dans le plafond** (sinon désactivé
      avec explication : paiement/essai requis, ou « en attente de paiement »).
      La **1re copie compte comme un envoi** : place occupée, type
      d'invitation figé, jetons et QR créés (`get_invitation_link()`), **sans
      coût WhatsApp ni quota** ; recopier ensuite est libre (PRD § 7.14 ;
      02 § 1.10 ; 03 § 4.2 ; TRD § 2.6, D42 ; 07 § 5.4).
- [ ] Gestion des groupes : créer, renommer, supprimer (les invités restent,
      sans groupe) ; un invité dans **un groupe au plus** ; groupes jamais
      visibles des invités (PRD § 5.1).
- [ ] Ajout après premier envoi : libre ; jusqu'au plafond, sans surcoût ;
      au-delà → passage au palier supérieur ou ajout au prix unitaire, payé
      avant l'envoi aux invités en excédent (« en attente de paiement »)
      (PRD § 7.5 ; TRD D26).
- [ ] **Type d'invitation figé à l'envoi** : le passage individuelle ↔ avec
      accompagnant est **refusé** dès que l'invitation de cet invité est
      envoyée (champ verrouillé avec explication ; `update_guest()` refuse
      `kind`) ; modifiable avant (PRD § 6.5 ; 02 § 1.10 ; 07 § 5.2 ;
      TRD D32).
- [ ] Le lien et le QR sont liés à l'**invitation**, pas au numéro (07 § 5.4).
      Supprimer un invité envoyé : lien invalidé immédiatement (TRD § 4) ;
      confirmation (§ 11).
- [ ] **Renvoi d'invitation** : **un seul renvoi gratuit par invité**, hors
      quota, **seulement après un échec de livraison ou un changement de
      numéro** ; au-delà, chaque renvoi compte dans le quota de 3 messages
      manuels (PRD § 7.10 ; 02 § 1.10 ; TRD D28).
- [ ] « Afficher son QR » : plein écran, URL signée de courte durée, jamais
      d'URL publique permanente (TRD § 5.1 ; PRD § 7.8).

---

## 6. Paiement, forfaits, essai, devis, remboursements

Source : PRD § 6.6, § 7.1, § 7.3, § 7.4, § 7.12 ; 02 § 1.11, § 4.6 ; 03 § 1.8, § 1.9, § 3.6 ; TRD § 3, D8, D27, D34 à D38.

### 6.1 Avant le paiement
- [ ] Grille affichée (10 offerts, 50/100/200/300/500/1 000) avec total FCFA
      calculé **par le serveur** à partir de `pricing_tiers` ; le navigateur
      ne transmet jamais le montant (TRD § 3.1).
- [ ] Entre deux paliers : les **deux options** (forfait supérieur / ajout
      d'invités au prix unitaire du palier) sont calculées, la moins chère
      mise en avant (PRD § 7.1).
- [ ] **Code promo** : champ, état chargement, erreur « invalide / expiré /
      limite atteinte », succès avec remise visible ; appliqué au **premier
      paiement seulement** (PRD § 7.1) ; verrouillé à la
      confirmation, pas à la saisie (TRD § 3.2).
- [ ] **Remise plafonnée à 15 %** du montant, sur tous les paliers et sur
      devis ; un code à montant fixe est plafonné à 15 % du total ; contrôle
      **côté serveur** au calcul du prix (`preview_price()`, `confirm_payment()`)
      et à la création d'un code (message d'erreur si > 15 %) (PRD § 7.1 ;
      02 § 1.11, § 4.5 ; 03 § 3.5 ; TRD D34, § 3.2 ; 07 `promo_codes`).
- [ ] **Récapitulatif avant paiement** (forfait, nombre d'invités, remise,
      total FCFA) sur `/package/checkout` avant la redirection FedaPay
      (03 § 1.9).
- [ ] Au-delà de 1 000 invités : **demande de devis** (formulaire, confirmation
      de réception, suivi de l'état) ; prix unitaire ≥ 150 FCFA contrôlé côté
      serveur (PRD § 7.1 ; TRD § 3.2).
- [ ] **Devis côté admin** : le prix est fixé par `price_quote()` seulement,
      réservé aux rôles finance et super-admin, prix unitaire ≥ 150 FCFA,
      action journalisée (`quote.priced`) ; le support voit seulement le
      statut, sans le prix (07 § 8.2, § 2.5).
- [ ] Passage au forfait supérieur : montant = différence de prix catalogue,
      expliquée à l'écran avec l'exemple chiffré du cas (PRD § 7.1).
- [ ] **Après un remboursement (D40)** : passage de palier = prix catalogue du
      nouveau palier − **valeur déjà acquise** (prix catalogue du palier payé ×
      places payées restantes ÷ places du palier, `paid_seats`) ; exemple
      chiffré à l'écran (TRD § 3.2 : 100 remboursé à 50 → passage au 200 =
      25 500 FCFA). Après un **remboursement total** : forfait complet au prix
      catalogue, **sans code promo**. L'ajout au prix unitaire reste proposé, la
      moins chère des deux options est mise en avant ; calcul côté serveur
      (PRD § 7.1 ; 02 § 1.11 ; TRD § 3.2, D40 ; 07 § 4.1 `paid_seats`).

### 6.2 Pendant et après le paiement
- [ ] Attente de confirmation : état « paiement en cours de confirmation »,
      interrogation du serveur toutes les 3 s pendant 2 min (TRD § 3.1 pt 5) ;
      au-delà, convention d'interface (sans source) : message rassurant +
      moyen de revenir plus tard sans repayer.
- [ ] **Échec et annulation** : 02 § 1.11 prévoit seulement un « retour avec
      message ». Conventions d'interface (sans source) : message distinct
      (échoué / annulé), envoi toujours bloqué, bouton « Réessayer le
      paiement ».
- [ ] **Aucun déblocage par la page de retour** : seul le webhook signé
      (`X-FEDAPAY-SIGNATURE`) **et** la relecture de la transaction par l'API
      (statut, montant, devise) confirment ; idempotent ; rattrapage
      `pg_cron` des paiements `pending` (CLAUDE.md § 5 ; TRD § 3.1).
- [ ] `confirm_payment()` met à jour plafond et état `paid` dans une seule
      transaction (TRD § 3.1 pt 6).
- [ ] **Reçu / historique** des paiements de l'événement (montant, statut,
      date, moyen) incluant les remboursements (montant, statut, date ; **sans
      motif interne**) (PRD § 7.12 ; 02 § 1.11 ; 03 § 1.8). Reçu téléchargeable ou
      envoyé par e-mail : non applicable tant que non décidé (**Q9**).
- [ ] Double clic sur « Payer » ne crée pas deux transactions.

### 6.3 Essai gratuit
- [ ] Offre 10 invités ; **un essai par numéro WhatsApp vérifié** (empreinte
      HMAC, conservée après suppression du compte) (PRD § 7.4 ; TRD § 3.2).
- [ ] Compte e-mail : parcours de vérification d'un numéro **avant** d'afficher
      l'essai ; message d'erreur « essai déjà utilisé » (03 § 1.8).
- [ ] Plafond de 10 respecté par la base (l'essai donne `guest_cap = 10`, état
      « essai », TRD § 3.2) : l'ajout d'un **11e invité est refusé** pendant
      l'essai, avec message et renvoi vers `/package` (02 § 1.10 ; TRD D27).
- [ ] **Essai refusé sur un événement déjà payé** : l'essai n'est proposé
      qu'**avant tout paiement** de l'événement (offre masquée ou désactivée avec
      explication) ; `claim_trial()` refuse côté serveur un événement ayant déjà
      un paiement approuvé (PRD § 7.4 ; TRD § 3.2, D38 ; 07 `trial_claims`).
- [ ] **Essai puis forfait** : les 10 invitations de l'essai sont un **bonus
      fixe** : plafond = **places payées + 10**, toujours (ex. forfait 50 → 60 ;
      passage 50 → 100 → 110) ; prix, choix entre les deux options (PRD § 7.1)
      et remboursements calculés sur les places **payées** seulement ; après un
      remboursement total, les 10 offertes sont gardées mais ne resservent
      qu'avec un nouveau paiement (D35, voir § 6.4) (PRD § 7.4 ; TRD § 3.2,
      D27). Annonce de ce bonus à l'écran de paiement : convention
      d'interface (sans source).

### 6.4 Remboursements (admin finance)
- [ ] Réservé aux rôles finance et super-admin ; support : refus (PRD § 4 ;
      07 § 17).
- [ ] Saisie : montant, motif interne, mode d'exécution (tableau de bord
      FedaPay pour MTN / transfert manuel), puis **référence** de l'opération
      → statut « remboursé » (TRD § 3.3).
- [ ] Confirmation avant validation avec **effet expliqué** :
  - **total** → événement **en brouillon**, places payées à 0, **aucun envoi**
    (même si l'essai avait été utilisé : **il ne repasse pas à l'état
    « essai »**) ; les 10 offertes sont **gardées pour plus tard** et ne
    resservent qu'avec un nouveau paiement (plafond = places payées + 10) ;
    liens et QR déjà envoyés restent valides ; le paiement suivant est un
    forfait complet au prix catalogue, sans code promo (D40) (PRD § 7.12 ;
    TRD § 3.3, D8, D35, D40 ; 07 § 8.4) ;
  - **partiel** → places payées réduites en proportion, arrondi à l'inférieur,
    bonus d'essai inchangé, puis **règle du dépassement** : seuls les invités en
    excédent **pas encore envoyés** sont « en attente de paiement » ; les
    invités déjà servis gardent QR, relances et notifications (PRD § 7.12 ;
    TRD § 3.3, D36, D37 ; 07 § 8.4). Le calcul se fait sur les places payées.
    Un futur passage de palier part de la valeur déjà acquise (D40, voir § 6.1).
- [ ] Tracé dans `audit_log` et les exports comptables ; l'organisateur voit
      montant / statut / date, pas le motif.
- [ ] Pas de promesse de remboursement dans l'interface organisateur : aucun
      remboursement une fois payé (PRD § 7.12) ; message d'aide vers le
      support → texte à valider (**Q10**).

---

## 7. Messages WhatsApp

Source : PRD § 6.7, § 6.10, § 6.11, § 7.5, § 7.9, § 7.10, § 7.12, § 7.14 ; 02 § 1.12, § 1.14 ; 03 § 1.10, § 1.12 ; TRD § 2, D29, D35 à D37.

### 7.1 Consentement et identification
- [ ] Consentement **attesté** à l'ajout de chaque invité (voir § 5).
- [ ] Chaque message commence par **« De la part de [organisateur], via
      Convivia »** (TRD § 2.6 pt 2).
- [ ] Les messages marketing (`invitation_v1`, `reminder_v1`, `thank_you_v1`,
      `host_message_*_v1`) portent le bouton **« Ne plus recevoir »**
      (PRD § 7.14 ; TRD § 2.5).
- [ ] Clic sur le bouton, réponse STOP ou blocage détecté → numéro (empreinte
      HMAC) ajouté à `whatsapp_optouts`, effet **immédiat et global** (tous
      organisateurs) (TRD § 2.6).
- [ ] Avant tout envoi en file, le dispatcher **revérifie au dernier moment** :
      la liste d'exclusion, le quota, le paiement, la clôture (TRD § 2.8) et le
      **statut de l'organisateur** (`status = 'active'`, 07 § 1.2 règle 6) ;
      un organisateur suspendu n'envoie rien. Les invités **en excédent** du
      plafond (« en attente de paiement ») ne reçoivent rien : ni invitation,
      ni relances, ni messages (voir § 5 ; TRD § 2.8, D26 ; 07 § 9.4). Les
      invités **déjà envoyés** ne sont jamais exclus à ce titre (y compris après
      un remboursement partiel) : ils gardent QR, relances et
      notifications (TRD D36, D37 ; 07 § 1.3 `private.is_over_cap`).
- [ ] L'organisateur est informé qu'un invité a refusé les messages, et peut
      copier le lien, aux conditions de D42 (voir § 5 ; la copie ne coûte ni
      message WhatsApp ni quota) (PRD § 7.14 ; TRD D42).
- [ ] Aucun envoi réel hors production (voir § 1.4).

### 7.2 Envoi, programmation, relances
- [ ] Envoi **bloqué** tant que le paiement n'est pas confirmé (ou essai) :
      bouton désactivé + renvoi vers `/package` (PRD § 7.3 ; 03 § 1.10 « Vide »).
      Après un **remboursement total** : brouillon, aucun envoi, même si l'essai
      avait été utilisé (TRD D35).
- [ ] **Écran d'envoi** : le récapitulatif affiche le **nombre d'invités
      exclus car « en attente de paiement »**, avec lien vers le forfait ;
      `schedule_bulk_send()` et le dispatcher les excluent (03 § 1.10 ; PRD
      § 7.5 ; TRD § 3.2, D26).
- [ ] **Aperçu avant envoi** de l'invitation vue par l'invité ; récapitulatif
      du nombre de messages (PRD § 6.7 ne prévoit que l'aperçu).
      Convention d'interface (sans source) : confirmation avant « Envoyer
      maintenant ».
- [ ] **Envoi programmé** : date-heure dans le fuseau de l'événement,
      **annulable** tant que l'envoi n'a pas démarré (TRD § 2.8 ; 07 § 9.4
      `schedule_bulk_send` / `cancel_bulk_send`).
      Plage horaire interdite la nuit → non appliquée (**Q11**). Si le pays de
      l'événement change avant le premier envoi, l'heure locale est conservée
      et envois programmés et relances sont recalculés (TRD D41 ; voir § 4).
- [ ] Envoi en cours : compteur de progression ; si la limite de destinataires
      Meta est atteinte, l'envoi est **étalé** et l'organisateur voit « envoi
      en cours, terminé vers HH:MM » (TRD § 2.8).
- [ ] **Relances automatiques** : 2 au maximum, J+3 puis J-7 ; **interrupteur
      pour les désactiver** ; annulées si l'invité a répondu, RSVP clôturés,
      invité exclu ou relances désactivées (PRD § 7.10 ; TRD § 2.8). Si
      l'événement a lieu **10 jours ou moins après l'envoi** : **une seule**
      relance à J+3, et seulement si elle tombe **avant le jour de
      l'événement** ; pas de 2e relance (PRD § 7.10 ; 02 § 1.14 ; 03 § 1.12 ;
      TRD D3, D29).
- [ ] **Historique des relances** visible par l'organisateur (relances faites
      et à venir, 07 § 9.4 `scheduled_sends` ; 03 § 1.12).
- [ ] **Messages manuels** : modèles fixes uniquement (pas de texte libre),
      groupés ou individuels, avec aperçu du texte final ; **quota de 3 par
      invité visible** (compteur par carte d'invité et sur l'écran de
      relance) ; bouton désactivé au-delà avec « Quota de messages atteint
      pour cet invité » (PRD § 7.10 ; TRD § 2.8).
- [ ] Le quota est vérifié **dans la même transaction** que la mise en file
      (fonction Postgres).
- [ ] **Renvoi d'invitation** : un renvoi gratuit par invité, hors quota,
      seulement après un échec de livraison ou un changement de numéro ; au-delà,
      chaque renvoi compte dans le quota de 3 (PRD § 7.10 ; TRD § 2.8, D28).
      Le code distingue un renvoi gratuit d'un renvoi décompté (`purpose`,
      `free_resend_used`, `counts_in_quota`, 07 § 9.5).
- [ ] Notification de changement et QR renvoyé après confirmation : hors quota
      (PRD § 7.9).
- [ ] Le **QR** est créé à l'envoi, visible sur la page invité dès l'ouverture,
      renvoyé en image (`ticket_confirmed_v1`) après confirmation (PRD § 6.10).
- [ ] Réponse libre d'un invité au numéro Convivia : **une seule** réponse
      automatique qui le renvoie vers son lien (TRD § 2.8).

### 7.3 Suivi et erreurs
- [ ] **Statut de livraison** par message (`queued` → `sent` → `delivered`
      → `read`, ou `failed`) visible par invité ; « lu » non présenté comme
      fiable (TRD § 2.7).
- [ ] **Motif d'échec lisible** (« numéro non WhatsApp », « a refusé les
      messages »…) et liste des invités en erreur sur l'écran d'envoi
      (03 § 1.10 « Erreur »). Action « Renvoyer » sur les échecs : un renvoi
      gratuit par invité, puis comptage dans le quota (TRD D28, voir § 7.2).
- [ ] Webhook Meta : signature `X-Hub-Signature-256` vérifiée avant tout
      traitement (TRD § 2.7).
- [ ] Reprise sur erreur (3 essais, backoff exponentiel) ; aucun message envoyé
      deux fois (idempotence) (TRD § 2.8).
- [ ] Modèle **mis en pause** par Meta : alerte équipe et file d'envoi
      **suspendue** pour ce modèle (TRD § 2.5, § 2.6 pt 5). Modèle
      **reclassé** (changement de catégorie) : alerte et mise à jour de la
      table des coûts, sans suspension (TRD § 2.5).
- [ ] Coût réel enregistré par message « facturé » pour la marge (TRD § 13.4).
- [ ] Remerciement après l'événement : modèle fixe, groupé, soumis au quota,
      désactivé pour les invités exclus (PRD § 6.15), envoyé aux **présents
      scannés uniquement** (PRD § 6.15 ; 03 § 1.15 ; TRD D30).
- [ ] **Code de connexion WhatsApp** : modèle `login_code_v1`, voir § 2.

---

## 8. E-mails

Source : TRD § 1.2, § 7.2, § 15 ; CLAUDE.md § 2.

- [ ] **Expéditeur identifié** : nom « Convivia » et adresse du domaine
      `convivia.app`, avec SPF / DKIM / DMARC configurés (via Resend) → adresse
      d'expéditeur à confirmer (**Q12**).
- [ ] Objet clair en français ; texte précisant pourquoi l'e-mail est reçu.
- [ ] **Version texte** en plus du HTML (obligatoire pour les codes).
- [ ] Code à 6 chiffres affiché en clair (pas de lien magique) avec sa **durée
      de validité (10 min)** et une phrase « si vous n'êtes pas à l'origine
      de cette demande, ignorez ce message » (TRD § 7.2, § 7.1).
- [ ] Tout lien est à **durée limitée / usage unique** (admin : lien de réinitialisation de 30 min à usage unique, TRD D33).
- [ ] Aucune donnée personnelle d'invité dans un e-mail.
- [ ] Hors production : envoi vers les adresses de l'équipe seulement
      (preview) ; fichier journal local (local) (TRD § 15).
- [ ] E-mails transactionnels autres que le code (reçu de paiement, devis,
      suspension…) : non applicable tant que non décidé (**Q9**).
- [ ] Aucun e-mail non transactionnel n'est prévu dans les documents : on n'en
      construit pas. Si le porteur en décide un, ajouter ici sa règle de
      consentement et de désinscription.

---

## 9. Page invité `/i/<token>` et RSVP

Source : PRD § 6.8 à 6.10, § 7.6, § 7.7 ; 02 § 2 ; `05-templates-enveloppes.md` ; TRD § 4, § 6.5, § 11.

- [ ] Token inconnu ou supprimé → **404 identique** (pas de distinction)
      (TRD § 4) ; limitation à **30 requêtes/min/IP** ; `X-Robots-Tag:
      noindex, nofollow` et `robots.txt` interdisant `/i/` (TRD § 4).
- [ ] Rendu serveur : l'**enveloppe fermée avec le nom** est dans le HTML
      initial ; budget critique **< 1 Mo** vérifié en intégration continue
      (05 § 1.4 ; TRD § 11.1).
- [ ] **Ouverture enregistrée à la fin de l'animation**, jamais au chargement
      (robot d'aperçu WhatsApp) (02 § 2.2 ; TRD § 11.2).
- [ ] `prefers-reduced-motion` : le **canvas de particules** est désactivé
      (TRD § 11.3, seule règle fixée). Animation réduite ou sautée, bouton
      pour la passer, et moment où l'ouverture est comptée dans ces cas : non
      décidés (**Q-I**), non applicables tant que non décidés.
- [ ] Balises Open Graph dans le HTML serveur ; image par événement
      (1 200 × 630, **< 300 Ko**), **jamais le nom de l'invité** (TRD § 11.4).
- [ ] Page : prénom et nom de l'invité, **jamais son numéro** (TRD § 12.2) ;
      aucun traceur (voir § 1.3) ; **pas de manifeste PWA** sur `/i/*`
      (TRD § 10).
- [ ] RSVP : « Je serai présent » / « Je ne pourrai pas venir » ; **pas
      d'accompagnant ni de changement du nombre de places** (PRD § 7.6).
      Seul le passage **décliné → présent** est possible (« Finalement
      présent ») tant que les réponses ne sont pas clôturées ; à l'état
      Confirmé, « Présence confirmée » remplace le choix (PRD § 7.6 ; 02 § 2.4 ;
      05 § 1.3). Après clôture : boutons désactivés + « Réponses clôturées ».
- [ ] RSVP : états chargement (bouton), erreur (échec réseau, réessayer),
      succès (confirmation visible) ; double clic sans double effet.
- [ ] QR visible dès l'ouverture, quelle que soit la réponse, avec URL signée
      de courte durée ; **un seul QR** par invitation, « +1 » inclus ; QR
      enregistrable / affichable en plein écran et à luminosité lisible
      (PRD § 6.10 ; TRD § 5.1).
- [ ] **Table cachée avant le scan** : jamais envoyée au navigateur sans
      `check_ins` ; `get_guest_view(token)` ne renvoie `table_label` que
      scanné ; aucune politique RLS ne l'expose ; test dédié (PRD § 7.7 ;
      TRD § 6.5). Apparition après scan : interrogation toutes les 20 s et au
      retour au premier plan.
- [ ] Événement modifié (date / lieu) : page à jour pour tous (invalidation du
      cache `event:<id>`) (TRD § 11.1).
- [ ] Événement **supprimé** : 404 uniforme, lien invalide immédiatement
      (TRD § 4 ; 07 § 5.4). Après **remboursement total** : liens et QR déjà
      envoyés restent valides (PRD § 7.12). Événement passé ou organisateur
      suspendu : comportement non décidé (**Q14**).
- [ ] Lien non hébergé comme page d'invité sur un appareil lent : squelette
      avant contenu ; photos en `lazy` (TRD § 11.1).

---

## 10. Templates et enveloppes

Source : PRD § 6.3 ; `05-templates-enveloppes.md` ; TRD § 11.3 ; 03 § 3.8.

- [ ] 12 templates (2 par type) et 3 styles d'enveloppe ; couleurs d'enveloppe
      pilotées par variables CSS issues de la palette du template (TRD D21).
- [ ] Emplacements photos définis par template avec format de recadrage annoncé
      (portrait 4:5, carré 1:1, paysage 3:2 pour « Autre ») (TRD § 9).
- [ ] **Budget de poids < 1 Mo** pour la première vue (≈ 200 Ko HTML/CSS/JS,
      ≈ 60 Ko police, ≈ 600 Ko animation, ≈ 140 Ko marge) vérifié par
      Lighthouse CI en « 4G lente » (enveloppe visible < 2 s, LCP < 2,5 s)
      (05 § 1.4 ; TRD § 11.1).
- [ ] Polices auto-hébergées (`next/font`), sous-ensemble latin, graisses
      utilisées seulement.
- [ ] Contenu par défaut/vide d'un emplacement : rendu propre si l'organisateur
      n'a pas fourni de photo (pas de zone cassée).
- [ ] Texte long ou nom très long : rendu sans débordement (noms africains
      composés, caractères accentués).
- [ ] Aperçu côté organisateur identique au rendu invité.
- [ ] Admin contenu : création / modification d'un template avec aperçu,
      enregistrement, états vide / chargement / erreur / succès (03 § 3.8).

---

## 11. Actions destructrices

Source : PRD § 7.13, § 7.12 ; 02 § 1.13, § 1.19 ; 03 § 5 (modale) ; TRD § 12.2 ; 07 § 16.

S'applique à : suppression d'invité, de groupe, de table, d'événement, de
compte ; régénération / révocation du code d'accueil ; clôture des RSVP ;
annulation d'un envoi programmé ; suspension d'un compte ; remboursement ;
changement de rôle admin.

- [ ] **Confirmation** explicite par une modale, avec le **nom de l'objet**
      concerné et un bouton danger libellé par l'action (« Supprimer
      l'événement »), pas « OK ».
- [ ] **Effet expliqué** avant validation :
  - suppression d'événement ou de compte (même payé) : efface invités,
    coordonnées, photos, QR, tables, réponses, contenus (et nom, e-mail,
    numéro pour un compte) ; conservés sans donnée personnelle : paiements,
    remboursements, coûts WhatsApp, statistiques agrégées, empreinte d'essai,
    liste d'exclusion ; sauvegardes gardées pendant leur durée de rétention
    (PRD § 7.13 ; TRD § 12.2) ;
  - clôture des RSVP : réponses figées, **irréversible** et horodatée par la
    base (`close_rsvp`, 07 § 4.1 ; PRD § 7.6) ;
  - régénération du code d'accueil : anciens accès invalidés (02 § 1.16) ;
  - suppression d'un groupe : invités conservés sans groupe (02 § 1.10) ;
  - suppression d'un invité : son lien et son QR deviennent invalides
    immédiatement (TRD § 4).
- [ ] Confirmation renforcée pour les actions irréversibles lourdes
      (suppression de compte ou d'événement payé) : saisie du nom ou d'un
      code : non applicable tant que non décidé (**Q15**) ; la confirmation
      simple par modale reste obligatoire.
- [ ] État de chargement dans la modale ; en cas d'erreur, la modale reste
      ouverte avec le message.
- [ ] Succès : confirmation visible et redirection cohérente.
- [ ] **Journal** : l'action est écrite dans `audit_log` quand elle est
      administrative ou sensible (suspension avec **motif obligatoire**,
      remboursement, changement de rôle) (02 § 4.7 ; 03 § 3.7 ; TRD § 8.4).
- [ ] Suppression effectuée par fonction Postgres transactionnelle
      (`delete_event`, `delete_organizer_account`) + tâche de fond pour les
      fichiers (07 § 16).
- [ ] **Suppression sur demande** d'un invité : parcours (l'organisateur
      supprime ; le support relaie sans voir les coordonnées) (TRD § 12.2).
- [ ] Délai de grâce / annulation possible après suppression de compte, et
      message aux invités en cas d'annulation : non applicable tant que non
      décidé (**Q16**).
- [ ] Notes internes du support : **non modifiables** (une correction = une
      nouvelle note), jamais visibles par l'organisateur (PRD § 4).

---

## 12. Code d'accueil, scan et arrivées en direct

Source : PRD § 6.14, § 7.8 ; 02 § 1.16, § 3 ; 03 § 1.14, § 2 ; TRD § 6.

### 12.1 Préparation (organisateur) `/events/<id>/hosting`
- [ ] Code de 8 caractères sans caractères ambigus, **réaffichable** à tout
      moment, copiable ; actif **de J-1 à J+1** (fuseau de l'événement) ;
      régénérer / révoquer invalide immédiatement les sessions existantes
      (TRD D12, § 6.1).
- [ ] Liste des appareils connectés (« Appareil 1 », « Appareil 2 »…).
- [ ] Interrupteur **mode strict** avec explication de l'effet.
- [ ] Lien vers les arrivées en direct, qui s'affichent sur le **tableau de bord
      de l'événement** côté organisateur ; la page Statistiques
      (`/events/<id>/stats`) reste réservée à l'après-événement (02 § 1.16 ;
      03 § 1.14, § 1.15 ; TRD § 6.4, D31) ; états vide (aucun code généré) /
      chargement / erreur / succès.
- [ ] Moyen de **partager le code** facilement (copier ; partage système)
      (confort).

### 12.2 Accès `/scan`
- [ ] Messages distincts : code invalide ou révoqué, « Ce code n'est pas encore
      actif », « Ce code a expiré », appareil bloqué (TRD § 6.1).
- [ ] **5 codes faux → blocage de 15 min** avec décompte visible ; **session
      de 24 h** (cookie `httpOnly`, `Secure`, `SameSite=Strict`) ; la session
      n'ouvre que `/scan/<event>` (D12).

### 12.3 Écran de scan `/scan/<event>`
- [ ] **Autorisation caméra refusée** : explication + marche à suivre pour
      réautoriser (iOS : peut être redemandée à chaque ouverture en PWA)
      (TRD § 6.6, § 10).
- [ ] **Hors connexion** : bandeau « Pas de connexion — scan impossible » ;
      aucun mode hors ligne (PRD § 8 ; TRD § 6.6).
- [ ] **QR illisible**, QR invalide, QR d'un autre événement : messages
      distincts (TRD § 6.2) ; caméra qui se rallume sans recharger la page.
- [ ] Résultats : « Entrée validée » + table, « 1/2 arrivé », « Déjà entré à
      HH:MM », « Refusé : invité principal absent », refus mode strict, mention
      « n'avait pas confirmé » / « avait décliné » (PRD § 7.8 ; 03 § 4.10).
- [ ] « Nom + 1 » : noms affichés et trois boutons « Les deux » / « Invité
      principal seul » / « Accompagnant seul » (seul « Les deux » au premier
      passage en mode strict) (PRD § 7.8).
- [ ] **Retour automatique au scan suivant** (2,5 s) et bouton « Scanner le
      suivant » ; **bip et vibration** quand possible (la vibration n'existe
      pas sur iOS : pas d'erreur) (TRD § 6.6).
- [ ] Résultats distingués autrement que par la couleur seule (icône + texte).
- [ ] **Idempotence** : double appui = même résultat sans nouvelle écriture ;
      deux scanners sur le même QR = une seule entrée (`check_in()` avec
      verrou de ligne) (TRD § 6.3).
- [ ] Pas de recherche par nom, **aucune liste d'invités** pour l'équipe
      (PRD § 7.8) ; message d'aide « renvoyez l'invité vers l'organisateur ».
- [ ] Texte affiché à l'équipe : prénom et table seulement, jamais le numéro
      (TRD § 6.2, § 6.4).
- [ ] Décodage : `BarcodeDetector` si présent, sinon `zxing-wasm` ; HTTPS
      (TRD § 6.6).

### 12.4 Arrivées en direct
- [ ] Compteurs (entrés, 1/2 arrivés, restants) + derniers scans chronologiques,
      sans coordonnées ; canal Realtime privé `event:<id>:arrivals`.
- [ ] **Reprise après coupure** : indicateur de connexion perdue puis
      **rechargement des compteurs depuis la base** à la reconnexion
      (TRD § 6.4).
- [ ] États vide (aucune arrivée) / chargement / erreur / succès (03 § 2.3).
- [ ] **Côté organisateur** : le **tableau de bord de l'événement**
      (`/events/<id>`) est abonné au même canal `event:<id>:arrivals`
      (compteurs, prénom et table, jamais le numéro) avec la même reprise après
      coupure (TRD § 6.4, D31 ; 03 § 1.4).
- [ ] **Bloc « Arrivées en direct »** du tableau de bord : affiché **le jour J**,
      inséré entre l'en-tête de l'événement et la grille de tuiles ; compteurs
      entrés / 1-2 arrivés / restants avec les mêmes tuiles KPI que les
      statistiques ; mêmes états vide / chargement / erreur / succès (04
      « Tableau de bord d'un événement » ; 03 § 1.4 ; TRD D31).

---

## 13. Suivi RSVP, tables, après l'événement

Source : PRD § 6.9, § 6.12, § 6.13, § 6.15 ; 02 § 1.13, § 1.15, § 1.18 ; 03 § 1.11, § 1.13, § 1.15.

- [ ] Tuiles ouvertes / confirmées / refusées / sans réponse, **temps réel**
      avec reprise après coupure (voir § 14) ; état vide « envoyez d'abord vos
      invitations ».
- [ ] **Clôture des RSVP** : bouton dédié, modale (§ 11), état « clôturé »
      visible partout, relances automatiques annulées.
- [ ] Tables : nommées **ou** numérotées (au choix) ; création, renommage,
      suppression (confirmation), affectation (glisser-déposer **et** une
      alternative sans glisser, pour le mobile), capacité, filtre / regroupement
      par groupe ; erreur d'affectation explicite.
- [ ] Rappel visible : la table n'est montrée à l'invité qu'après le scan.
- [ ] Statistiques d'après événement : scannés, 1/2 arrivés, absents ; état
      « disponible après l'événement » avant la date ; graphe d'arrivées. Les
      arrivées du jour J ne sont pas ici mais sur le tableau de bord de
      l'événement (voir § 12.4, TRD D31).
- [ ] Remerciement : voir § 7 (modèle fixe, quota, présents scannés
      uniquement, TRD D30 ; confirmation du nombre de destinataires).

---

## 14. Listes, tableaux de bord et temps réel

Source : 03 § 5 (table de données, pagination, recherche) ; TRD § 6.4.

- [ ] **Recherche** avec état « aucun résultat » et bouton pour effacer.
- [ ] **Filtres** visibles, cumulables, état actif lisible, réinitialisation
      (RSVP : ouvertes / confirmées / refusées / sans réponse ; groupe ; statut
      de livraison).
- [ ] **Pagination** (ou défilement progressif) pour toute liste pouvant
      dépasser une page ; tri sur les tableaux admin ; compteur total.
- [ ] États vide / chargement (squelettes) / erreur (+ réessayer) / succès sur
      chaque liste et chaque tuile KPI (« — » si vide, « indisponible » si
      erreur) (03 § 4.8).
- [ ] **Temps réel** (RSVP, arrivées) : abonnement via canal privé autorisé,
      **indicateur de connexion**, **reprise après coupure** = recharge
      depuis la base à chaque reconnexion et au retour au premier plan ; jamais
      de numéro dans les messages diffusés.
- [ ] Liste de 500 à 1 000 invités fluide sur téléphone d'entrée de gamme
      (pagination / virtualisation).
- [ ] Admin : tableaux denses (lignes 36–44 px), navigation latérale limitée
      aux sections autorisées par le rôle, accès direct par URL refusé si le
      rôle manque (404 ou 403 cohérent).

---

## 15. Exports

Source : PRD § 6.16 ; 02 § 4.6 ; TRD § 14, § 8.2, § 8.4.

- [ ] **Droits vérifiés côté serveur** selon la matrice (TRD § 8.2) : exports
      comptables = finance et super-admin seulement.
- [ ] **Chaque export journalisé** dans `audit_log` (qui, quand, quoi,
      filtres).
- [ ] Format `.xlsx` généré côté serveur ; montants en entiers au format
      `# ##0 "FCFA"` ; dates **dans le fuseau de l'événement** ; en-têtes en
      français ; nom de fichier explicite et daté (anglais pour le code, français
      acceptable pour le nom téléchargé).
- [ ] **Jamais de coordonnées d'invités** ; organisateur supprimé affiché
      « organisateur supprimé » ; numéro d'organisateur masqué pour la finance
      (PRD § 4).
- [ ] **Gros volumes** (> 50 000 lignes) : génération en tâche de fond, état
      « export en préparation », lien de téléchargement valable **24 h**
      (TRD § 14).
- [ ] États : chargement (génération), erreur (échec, réessayer), succès
      (téléchargement), vide (« rien à exporter sur la période »).
- [ ] Filtre de période et aperçu du périmètre avant export (confort).
- [ ] Export des données de l'organisateur pour lui-même (portabilité) :
      non prévu dans les documents : non applicable tant que non décidé
      (**Q17**).

---

## 16. Téléversements de photos

Source : 02 § 1.9 ; 03 § 1.6, § 4.9 ; TRD § 9.

- [ ] **Formats et poids annoncés** près de la zone : JPEG, PNG, WebP, HEIC ;
      **10 Mo** maximum en entrée (TRD § 9).
- [ ] Zone de dépôt (repos / survol / upload / erreur) ; sélection depuis la
      galerie ou l'appareil photo sur mobile.
- [ ] **Compression navigateur** (2 000 px, JPEG 85) puis variantes serveur
      WebP/AVIF 480 / 960 / 1 440 px, générées une fois.
- [ ] **Progression** visible (barre déterminée), annulation possible ;
      reprise propre après perte de connexion.
- [ ] **Recadrage** simple au format de l'emplacement, coordonnées enregistrées.
- [ ] **Remplacement** et **suppression** d'une photo ; l'ancienne est effacée
      (tâche de fond) ; cache CDN invalidé par nouveau chemin aléatoire.
- [ ] Erreurs distinctes : format refusé, trop lourd (avec taille réelle), HEIC
      non convertible (« message clair »), échec réseau (TRD § 9).
- [ ] Contrôle côté serveur du type réel du fichier (pas seulement
      l'extension) et de la taille ; chemin impossible à deviner
      (`<event_id>/<uuid>/<variante>`) ; photos d'un événement non lisibles en
      écriture par un autre organisateur.
- [ ] Texte alternatif / légende facultative : non applicable tant que non
      décidé (**Q18**).
- [ ] Emplacement marqué obligatoire (`is_required`, 07 § 3.4) : signalé comme
      tel à l'organisateur ; effet sur l'envoi non décidé (**Q-F**).
- [ ] Nombre maximal de photos par emplacement et par événement → défini par
      les emplacements du template (05) ; pas d'autre limite inventée.

---

## 17. Codes promo, liens de suivi et influenceurs (admin marketing)

Source : PRD § 6.17, § 7.1, § 7.11 ; 02 § 1.1, § 4.5 ; 03 § 3.5, § 4.13 ; TRD § 13.2, D34.

- [ ] Création d'un code : remise % **ou** montant fixe **ou** suivi sans remise ;
      durée, limite d'utilisation, canal / influenceur rattaché ; validation
      serveur (remise ≤ prix, dates cohérentes, code unique). **Remise
      plafonnée à 15 %** : un code % de 1 à 15 ; un code à montant fixe est
      plafonné à 15 % du total au calcul ; message d'erreur « remise au-delà de
      15 % » à la création (PRD § 7.1, § 7.11 ; 02 § 4.5 ; 03 § 3.5 ; TRD D34 ;
      07 `promo_codes`).
- [ ] Lien de suivi associé (`/signup?ref=<slug>`, redirigé vers `/login?ref=<slug>`, TRD D23, § 13.2),
      copiable.
- [ ] Désactivation / expiration d'un code ; message côté organisateur
      « code invalide / expiré / limite atteinte » (03 § 1.8).
- [ ] Stats : utilisations, inscriptions, paiements, revenu généré, remise
      accordée, revenu net, conversion, panier moyen ; états vide (« code
      jamais utilisé »), chargement, erreur (03 § 4.13).
- [ ] Attribution : lien mémorisé **30 jours** (cookie propriétaire `cv_ref`),
      rattaché définitivement à l'inscription ; **code saisi au paiement
      l'emporte** ; compléments attribués au même code (PRD § 7.11).
- [ ] Le cookie `cv_ref` est un cookie propriétaire de mesure : traité dans la
      gestion des cookies de la vitrine (§ 19).
- [ ] Influenceur = fiche (nom, réseau, contact) ; **aucun versement** enregistré
      dans Convivia ; comparaison à type de code identique.
- [ ] Marketing : jamais de coordonnées individuelles d'organisateurs, seulement
      des agrégats (PRD § 4).
- [ ] Finance : voit l'impact agrégé, pas la configuration (PRD § 4).

---

## 18. Administration (rôles, droits, journal)

Source : PRD § 4, § 6.16 ; 02 § 4 ; 03 § 3 ; TRD § 8 ; 07 § 13, § 14, § 17.

- [ ] Chaque écran et chaque requête respecte la **matrice des droits**
      (TRD § 8.2) ; les droits sont appliqués par RLS et vues, pas seulement
      par le masquage de menus.
- [ ] **Aucun écran, vue ni export admin n'affiche les coordonnées des
      invités** ; les vues `admin_*_v` ne joignent jamais `guest_contacts`,
      `invitation_secrets`, `guest_groups`, `table_assignments`.
- [ ] `aal2` (TOTP) exigé partout (voir § 2.1).
- [ ] Coordonnées d'organisateur selon le rôle : complètes (super-admin,
      support), nom + e-mail et numéro masqué (finance), agrégats (marketing),
      rien (contenu).
- [ ] Gestion des comptes admin (super-admin) : création, attribution et
      retrait de rôles (cumul possible) par `grant_admin_role()` /
      `revoke_admin_role()` ; un admin **ne modifie pas ses propres rôles** ;
      le **dernier super-admin actif ne peut pas être retiré** (07 § 2.3).
      Désactivation d'un compte admin par `deactivate_admin()` :
      `is_active = false`, accès coupé immédiatement, journalisée
      (`admin.deactivated`) (07 § 2.2, § 2.5) ; confirmation (§ 11).
- [ ] Suspension / réactivation d'un organisateur : super-admin seulement, motif
      obligatoire (02 § 4.7 ; 03 § 3.7), journalisée (PRD § 4) ; l'organisateur
      voit le bandeau de suspension (PRD § 4).
- [ ] Notes internes : historique, ajout, non modifiable, invisible de
      l'organisateur.
- [ ] Réglages plateforme (`/admin/settings`, super-admin) : gestion des comptes
      admin et de leurs rôles, action « Réinitialiser la double
      authentification » (voir § 2.1) (02 § 4.9 ; 03 § 3.9).
- [ ] Réglages plateforme : grille de prix, pays ; **un événement mémorise le
      prix payé** (changer la grille ne touche pas les événements payés) ;
      valeurs invalides refusées (03 § 3.9 ; TRD § 3.2).
- [ ] Tarifs WhatsApp et taux de change éditables par le super-admin
      (TRD § 2.1, § 13.4).
- [ ] Journal d'audit consultable par le super-admin, en ajout seul (`UPDATE` /
      `DELETE` refusés).
- [ ] Tableaux de bord : définitions des indicateurs affichées (taux
      d'ouverture = ouverture du lien, pas « lu ») (TRD § 2.7, § 13.3) ; période
      sélectionnable (filtres de l'entonnoir, 03 § 3.3) ; état « pas encore de
      données » (03 § 3.2) / « aucune donnée sur la période » (03 § 3.3).
- [ ] **Entonnoir** : visiteur (PostHog), inscrit, événement créé, invitations
      envoyées, paiement ; étapes 2 à 5 issues de la base, source de vérité
      (TRD § 13.1).
- [ ] **Qualité d'usage et fidélisation** : taux d'ouverture, taux de RSVP,
      présence scannée, organisateurs avec au moins 2 événements payés
      (TRD § 13.3).
- [ ] **Marge par événement** : revenu encaissé − remboursements − frais
      FedaPay − coût WhatsApp réel − coût de stockage ; coûts fixes hors marge
      (TRD § 13.4) ; visible de la finance et du super-admin seulement.
- [ ] **Revenus masqués pour le rôle marketing** : tableau de croissance sans
      revenu détaillé ni marges (TRD § 8.2 ; vue `admin_growth_v`).
- [ ] Tests d'accès pgTAP de 07 § 17 écrits pour tout nouveau rôle ou vue.

---

## 18 bis. Vitrine publique `/`

Source : 02 § 1.1 ; PRD § 7.11 ; TRD § 13.1, § 13.2.

- [ ] Actions : « Créer mon événement » et « Se connecter » mènent tous deux à
      `/login`, **même écran, même message neutre** ; il n'y a pas de parcours
      de connexion distinct de l'inscription (02 § 1.1 ; 03 § 1.1 ; TRD D23).
- [ ] Ouverture d'un **lien de suivi** (`/signup?ref=<code>`, redirigé vers
      `/login?ref=<code>`, ou `/?ref=<slug>`) :
      le code est mémorisé (cookie propriétaire `cv_ref`, 30 jours) pour
      l'inscription et le paiement ; un code inconnu ou expiré ne bloque pas
      l'inscription (convention d'interface, sans source).
- [ ] États : page rapide et lisible sur mobile, pas d'écran blanc au
      chargement (convention de confort, sans source) ; textes en français
      (CLAUDE.md § 6).
- [ ] Mesure : PostHog après acceptation des cookies de mesure seulement
      (voir § 19, TRD § 13.1) ; liens vers les pages légales dans le pied de
      page (convention de confort, sans source).

---

## 19. Pages légales et cookies

Source : TRD § 12, § 13.1, § 2.6 ; PRD § 7.13, § 7.14.

- [ ] **Politique de confidentialité** publiée et liée depuis la vitrine, le
      pied de page, l'inscription et les messages si besoin (exigée par Meta,
      TRD § 12.2) ; mentionne au minimum : rôles (sous-traitant pour les
      invités, responsable pour les organisateurs), données collectées,
      conservation (PRD § 7.13), hébergement en région Paris, sauvegardes
      conservant les données supprimées pendant leur rétention (7 jours en
      offre Pro), droits d'accès et de suppression. Texte à valider par un
      juriste (TRD § 12.1) ; Convivia ne rédige aucun engagement juridique.
- [ ] **CGU** : non décrites dans les documents → page manquante à signaler
      (**Q20**).
- [ ] **Mentions légales** : dépendent de la société, non créée (TRD D9) →
      (**Q20**).
- [ ] **Gestion des cookies de mesure sur la vitrine** : bandeau ; PostHog avec
      cookies seulement après acceptation, mode sans cookie sinon (TRD § 13.1).
      Conventions de confort (sans source) : « Accepter » et « Refuser »
      également visibles ; choix modifiable plus tard (lien « Gérer les
      cookies »).
- [ ] **Aucun bandeau ni traceur sur `/i/*`** (aucune mesure à consentir)
      (CLAUDE.md § 5).
- [ ] Case ou mention d'acceptation des CGU à l'inscription → dépend de **Q20**.
- [ ] Information sur le consentement WhatsApp rappelée à l'organisateur à
      l'ajout d'invités (attestation, PRD § 7.14).
- [ ] Pages légales en français, accessibles sans compte, lisibles sur mobile.

---

## 20. PWA et performances

Source : CLAUDE.md § 2 ; TRD § 10, § 11.1.

- [ ] Manifeste, icônes, nom « Convivia », couleurs de thème pour l'espace
      organisateur et l'écran de scan ; **pas de manifeste sur `/i/*`**.
- [ ] **Installation guidée sur iPhone** : petit guide « Partager → Sur
      l'écran d'accueil » (iOS n'invite pas) ; invitation d'installation
      sur Android (TRD § 10). Convention de confort (sans source) : le guide
      peut être masqué et ne revient pas à chaque visite.
- [ ] **Ouverture rapide** : service worker (Serwist) qui met en cache
      l'interface organisateur et l'écran de scan, **jamais les données ni les
      réponses d'API** (TRD § 10).
- [ ] Comportement hors connexion de l'espace organisateur : message clair
      (« connexion requise »), pas de page blanche ; le scan reste en ligne
      uniquement.
- [ ] Mise à jour de l'application : nouvelle version appliquée sans bloquer
      l'utilisateur (message « Mise à jour disponible » si nécessaire).
- [ ] Pas de notifications push au MVP (TRD § 10) : ne pas les demander.
- [ ] Budgets de poids vérifiés en intégration continue (voir § 10).

---

## 20 bis. Outillage de développement (hooks Claude Code)

Sources : `CLAUDE.md` § 5 et § 7 ; TRD § 15 ; plan, tranche 0 ;
`.claude/hooks/README.md`. Ce n'est pas une fonctionnalité de l'application :
c'est le garde-fou des règles de sécurité dans l'outillage.

- [ ] **Un hook par règle de `CLAUDE.md` § 5** : secrets hors dépôt, clés live
      et envoi réel hors production, coordonnées d'invités hors journaux et
      hors traceurs, aucun traceur sur `/i/*`, base distante inaccessible,
      migrations existantes immuables, RLS sur toute table.
- [ ] **README** : pour chaque hook, rôle, ce qui est refusé (`deny`) ou demandé
      (`ask`), politique d'échec, test manuel, limites connues. Aucune règle
      documentée sans code, aucun comportement du code sans documentation.
- [ ] **Chaque règle a au moins un test « bloqué » et un test « légitime »** (le
      travail normal des tranches reste possible : installation des paquets de
      la liste blanche, `supabase db reset` local, vues `admin_*_v`, nouvelles
      migrations, suppression dans les dossiers de build et le scratchpad).
- [ ] **Échec fermé** pour les hooks de sécurité (refus si le hook plante, ne se
      charge pas ou dépasse son budget), **ouvert** pour les hooks de qualité ;
      budget interne inférieur au `timeout` de `settings.json`.
- [ ] **Doublon dans les permissions** pour ce qui est vital (`deny` de
      PowerShell, des `.env*`, des outils MCP qui écrivent) ; `bypassPermissions`
      désactivé.
- [ ] **Scellement** : `integrity.json` à jour (`node .claude/hooks/seal.mjs
      --check` réussit) ; procédure de (re)scellement écrite pour le porteur du
      projet ; seul le porteur scelle ; tout changement de `settings.json`, d'un
      hook ou de la liste blanche est suivi d'un nouveau scellement.
- [ ] **Liste blanche des paquets** alignée sur le TRD ; toute addition est
      justifiée (`npm view`) et confirmée.
- [ ] **Tests** : `node --test ".claude/hooks/tests/*.test.mjs"` vert ; les
      tests n'écrivent jamais dans le projet et fabriquent leurs faux secrets
      à l'exécution.
- [ ] **Tests en direct** avec le porteur du projet (tests manuels du README)
      avant le premier commit.
- [ ] Les hooks complètent la revue `security-reviewer`, ils ne la remplacent pas
      (limites connues listées).

---

## 20 ter. Socle technique de l'application (CI, garde-fous, en-têtes, pages d'état)

Sources : `CLAUDE.md` § 5 ; plan, tranche 1 ; TRD § 1, § 4, § 10, § 11.1, § 12.2,
§ 15 ; 04 ; 03 § 5. Ajouté par le `conventions-keeper` à la revue de la
tranche 1 (nouveau type : socle, sans écran métier).

- [ ] **Intégration continue** : lint, format, types, tests unitaires, build,
      Playwright (profil mobile), Lighthouse CI (budget < 1 Mo, LCP < 2,5 s,
      zéro ressource tierce), pgTAP, `npm audit`, détection de secrets ; la CI
      a réellement tourné au moins une fois sur le dépôt distant.
- [ ] **Contrôle des traceurs sur `/i/*`** sur le bundle réel (HTML, fichiers
      chargés, manifeste client) en plus de la règle ESLint d'import ; le
      contrôle vise une vraie page invité quand elle existe (pas un jeton
      factice qui renverrait 404).
- [ ] **Garde-fous d'environnement** dans le code, testés : `live` refusé hors
      `VERCEL_ENV=production` (WhatsApp, FedaPay, y compris par la forme de la
      clé), variables `NEXT_PUBLIC_*` sans secret, `.env.example` sans valeur et
      aligné sur le schéma ; échec net et message sans valeur de variable.
- [ ] **Variables indispensables en production, tranche par tranche** : toute
      nouvelle variable indispensable en production est ajoutée à
      `PRODUCTION_REQUIRED_ENV` (`src/lib/env/guards.ts`) dans la tranche qui
      l'introduit, et retirée de `PRODUCTION_ENV_PLANNED` ; `.env.example` reste
      cohérent (décision du porteur, 2026-10-21).
- [ ] **Rapports d'erreur** : Sentry inactif sans DSN ; côté serveur seulement ;
      aucune donnée personnelle (numéros masqués, noms supprimés, jeton `/i/`
      remplacé) ; test du nettoyage.
- [ ] **En-têtes de sécurité** : HSTS, `nosniff`, anti-cadre, `Permissions-Policy`,
      CSP ; sur `/i/*` : aucune origine tierce, `Referrer-Policy: no-referrer`,
      `X-Robots-Tag: noindex, nofollow` ; testés par Playwright.
- [ ] **Pages d'état globales en français** (`not-found`, `error`,
      `global-error`, état de chargement) : jamais le texte anglais par défaut
      de Next.js, jamais de trace (§ 1.2).
- [ ] **Primitives UI** : chaque primitive de 03 § 5 existe avec ses états
      (vide, chargement, erreur, succès quand ils s'appliquent), zones
      tactiles ≥ 44 px, libellés associés, focus visible, `prefers-reduced-motion`
      respecté ; couleurs lues dans les tokens (04), pas en dur.
- [ ] **Clients Supabase** : navigateur et serveur avec clé anonyme seulement ;
      `service_role` marqué `server-only` et jamais importé côté client (test) ;
      `/i/*` sans cookie d'authentification ni appel de session.
- [ ] **Page de démonstration** interne (`/design-system`) : introuvable en
      production, non indexée.

---

## 20 quater. Migrations et base de données (toute table, vue ou fonction)

Sources : `CLAUDE.md` § 5 ; 07 § 1.1 à 1.5 ; migrations
`20261021140500` et `20261021140600`. Ajouté par le `conventions-keeper` à la
revue de la partie base de la tranche 1 (règle posée par le `supabase-developer`,
pas encore reportée dans le 07).

- [ ] **Droits explicites** : depuis `20261021140600`, `postgres` ne donne plus
      rien à `anon` / `authenticated` par défaut. Chaque table, vue ou séquence
      accorde ses droits au strict nécessaire (`GRANT SELECT / INSERT / UPDATE
      (colonnes)`), en plus de ses politiques RLS ; chaque fonction appelable par
      un client (RPC, aide RLS de `private`) reçoit un `GRANT EXECUTE` au rôle
      voulu. Une fonction de déclencheur n'a besoin d'aucun `GRANT`.
- [ ] **RLS activée, refus par défaut** sur chaque table ; une table sans politique
      est voulue et commentée (serveur seulement).
- [ ] **Commentaire** (`COMMENT ON`) sur chaque table, colonne non évidente,
      politique et fonction, avec la référence au 07.
- [ ] **Immutabilité** : tables en ajout seul ou à lignes figées protégées par
      déclencheur (`UPDATE`, `DELETE` et `TRUNCATE`) ; `service_role` n'a que les
      droits utiles (pas de `UPDATE` sur une table d'historique).
- [ ] **Contraintes de format** sur les colonnes sensibles (E.164, empreintes,
      codes, montants entiers FCFA, fuseaux IANA) et `NOT NULL` explicite.
- [ ] **pgTAP par table** : RLS active, `anon` / `authenticated` (lecture,
      écriture refusée), `service_role`, immutabilité, valeurs initiales ; un
      test « objet sonde » pour les droits par défaut.
- [ ] **Types TypeScript régénérés** (`src/types/database.ts`) après chaque
      migration, sans diff résiduel.
- [ ] **En-tête de migration à jour** : une migration appliquée est immuable
      (hook) ; une affirmation devenue fausse se corrige par un commentaire
      dans la migration suivante, pas par réécriture.
- [ ] **Schéma `private`** fermé ; extensions dans `extensions`, jamais dans
      `public` ; schéma `storage` à durcir avec les buckets.

---

## 21. Gravités et format de rapport de revue

**Gravités** (fiche `conventions-keeper`, alignée sur `CLAUDE.md` § 7.3) :
- **Critique** : le manque viole une règle critique (entrée, plafond
  d'invités, paiement avant l'envoi, essai gratuit, table cachée avant le scan,
  droits d'administration).
- **Élevée** : le manque touche la sécurité, l'argent, le consentement, ou
  bloque l'utilisateur (pas de renvoi de code, pas de « Ne plus recevoir »,
  déblocage par la page de retour, coordonnées d'invités exposées).
- **Moyenne** : un état manquant (vide, chargement, erreur, succès), un
  message d'erreur absent.
- **Faible** : confort.

Ce sont les gravités de `CLAUDE.md` § 7.3, communes à tous les agents de
contrôle : **Critique**, **Élevée**, **Moyenne**, **Faible**. Un
problème est **grave** s'il est Critique ou Élevé, ou si un test échoue sur une
règle critique (entrée, plafond d'invités, paiement avant l'envoi, essai
gratuit, table cachée avant le scan, droits d'administration) ; aucun commit
tant qu'un problème grave reste ouvert (`CLAUDE.md` § 7.3). Le gardien ne
définit pas lui-même ce qui est « Critique » : il applique ces définitions et,
en cas de doute, remonte la question.

**Format de rapport** :

```
Fonctionnalité : …   Verdict : complète / incomplète
### Manquant
- [Gravité] Élément manquant — où il devrait être — à compléter par : agent
### Questions pour le porteur du projet
- …
### Présent / non applicable
- …
```

Règles : chaque case de la section concernée est « présent », « manquant » ou
« non applicable » (avec la raison) ; comparaison avec le **code réel** ;
lint et vérification des types lancés pour confirmer ; aucune correction du
code par le gardien.

---

## 22. Questions ouvertes pour le porteur du projet

Éléments de convention qui supposent une règle absente des documents. Aucune
valeur n'est inventée.

| # | Question | § concerné |
|---|---|---|
| Q4 | **Changer l'e-mail**, **remplacer un numéro déjà vérifié**, et effet de ce remplacement sur l'essai gratuit (déjà fixé : l'organisateur modifie seulement nom, ville, pays, 07 § 2.1 ; ajout d'un numéro par code, TRD § 7.3). | 2 ; 07 § 2.1 ; TRD § 7.3 |
| Q7 | **Longueurs maximales** des champs libres (nom d'événement, message d'invitation, programme, infos pratiques, nom d'invité, champs courts des modèles `host_message_*`). Déjà fixé : notes internes ≤ 2 000 caractères (07 § 2.6) ; variables « courtes » (TRD § 2.5) sans valeur. | 3 |
| Q9 | **Reçu de paiement** (document téléchargeable ou e-mail) et liste des **e-mails transactionnels** (paiement confirmé, devis, suspension, suppression de compte). Les documents ne prévoient qu'un historique à l'écran. | 6.2, 8 ; PRD § 7.12 ; 02 § 1.11 ; 03 § 1.8 |
| Q10 | **Texte et politique d'information** sur l'absence de remboursement une fois payé (PRD § 7.12) : où l'afficher à l'organisateur avant le paiement ? Dépend des CGU. | 6.4 ; Q20 |
| Q11 | **Plages horaires d'envoi** (interdire les envois automatiques la nuit, par exemple 21 h – 8 h) : déjà listé en point ouvert, non appliqué. | 7.2 ; TRD § 17.1 pt 4 |
| Q12 | **Adresse et nom d'expéditeur** des e-mails (domaine `convivia.app`) et adresse de réponse / contact support. | 8 |
| Q14 | **Page invité** quand l'événement est **passé** ou l'organisateur **suspendu** : quoi afficher ? Le lien reste-t-il consultable après l'événement, combien de temps ? (Déjà fixé : supprimé → 404 uniforme, TRD § 4 ; 07 § 5.4 ; remboursement total → liens valides, PRD § 7.12.) | 9 |
| Q15 | **Niveau de confirmation** pour supprimer un événement payé ou un compte (simple confirmation, saisie du nom, code envoyé ?). | 11 |
| Q16 | **Délai de grâce** ou annulation après suppression de compte, et **suppression d'un événement déjà envoyé** : les invités reçoivent-ils un message ? (Un tel message demanderait un nouveau modèle Meta : `event_update_v1` ne couvre que date et lieu, TRD § 2.5.) | 11 ; PRD § 7.13 |
| Q17 | **Export des données de l'organisateur** (portabilité) : prévu ? (non mentionné ; la protection des données le demanderait peut-être, à valider par un juriste, TRD § 12.1). | 15 |
| Q18 | **Légendes / texte alternatif** des photos : prévu ? | 16 |
| Q20 | **CGU et mentions légales** non décrites ; la politique de confidentialité est exigée (TRD § 12.2) mais son contenu dépend de la validation juridique (TRD § 12.1) et de la société non créée (TRD D9). Qui fournit les textes ? Acceptation des CGU à l'inscription ? | 19 |
| Q21 | **Hors-ligne de l'espace organisateur** : comportement attendu si la connexion est coupée en cours de saisie (brouillon local ou perte) ? | 3, 20 |
| Q-B | **Badge d'état** : ordre de priorité quand plusieurs états coexistent (payé + envoyé + clôturé + passé, essai + envoyé…). | 4 ; 07 § 4.1 |
| Q-F | **Photo `is_required`** (07 § 3.4) : un emplacement obligatoire vide bloque-t-il l'envoi ou seulement un avertissement ? | 16 |
| Q-I | **Animation d'ouverture** : l'ouverture est comptée à la fin de l'animation (02 § 2.2 ; TRD § 11.2) ; que faire si l'animation est passée ou réduite (`prefers-reduced-motion`), et faut-il un bouton pour la passer ? | 9 |

### Questions tranchées (retirées de la liste)

- **Q1** (limite de tentatives du code de connexion) : tranchée par TRD D24
  (5 erreurs → blocage de 15 min, compteur côté serveur) et D33 (admin).
- **Q2** (existence du compte) : tranchée par TRD D23 (message neutre,
  inscription et connexion fusionnées).
- **Q3** (« Déconnecter toutes les sessions ») : tranchée, bouton dans
  `/account` (02 § 1.19 ; 03 § 1.16 ; TRD § 7.4).
- **Q5** (admin : mot de passe oublié, enrôlement TOTP, TOTP perdu, codes de
  secours) et **Q6** (durées de session admin) : tranchées par TRD D33 (02 § 4.1 ;
  03 § 3.1 ; TRD § 8.1 ; 07 § 2.2).
- **Q8** (renvoi d'invitation) : tranchée par TRD D28.
- **Q-C** (relances, événement proche) : tranchée par TRD D29.
- **Q-D** (destinataires du remerciement) : tranchée par TRD D30.
- **Q-E** (gravités de la fiche d'agent) : tranchée, fiche alignée sur les 4
  gravités de `CLAUDE.md` § 7.3 (§ 21).
- **Q-G** (arrivées en direct côté organisateur) : tranchée par TRD D31.
- **Q-H** (type d'invitation après l'envoi) : tranchée par TRD D32 (figé dès
  l'envoi de l'invitation de l'invité).
- **Q-J** (message d'erreur admin) : tranchée par TRD D33 (message unique).
- Règles tranchées en passe n° 4 (D34 à D39) : remise maximale, remboursement
  total / partiel, invités déjà envoyés, essai refusé après paiement, pays
  modifiable jusqu'au premier envoi : aucune question ouverte associée.
- **Q-K** (point d'entrée de connexion) : tranchée par TRD D23 (`/login`,
  `/signup` redirige en conservant `?ref=`).
- **Q13** (e-mails non transactionnels) : retirée, aucun e-mail non
  transactionnel n'est prévu ; on n'en construit pas.
- **Q19** (protections des comptes admin) : tranchée par 07 § 2.2 et § 2.3
  (voir § 18).

### Décisions du porteur du projet (2026-10-20) : où les retrouver

Les décisions sont centralisées dans `06-trd.md` § 0 (**D23 à D42**) et
reportées dans les documents sources ; le 09 les cite par leur source
documentaire.

| TRD | Sujet | Sections du 09 |
|---|---|---|
| D23 | Point d'entrée unique `/login`, message neutre | § 2, § 17, § 18 bis |
| D24 | Code de connexion : 5 erreurs → blocage 15 min | § 2 |
| D25 | Pays de l'événement obligatoire | § 4 |
| D26 | Dépassement du plafond : invités « en attente de paiement » | § 5, § 7.1 |
| D8 | Remboursement total : brouillon, envois bloqués ; liens déjà envoyés valides | § 6.4, § 9 |
| D27 | Essai : 11e invité refusé ; bonus fixe de 10 (places payées + 10) | § 5, § 6.3 |
| D28 | Renvoi d'invitation : 1 gratuit, puis quota | § 5, § 7.2, § 7.3 |
| D29 | Relances d'un événement proche | § 7.2 |
| D30 | Remerciement aux présents scannés | § 7.3, § 13 |
| D31 | Arrivées en direct sur le tableau de bord de l'événement | § 12.1, § 12.4, § 13 |
| D32 | Type d'invitation figé à l'envoi | § 5 |
| D33 | Accès admin (message unique, blocage, TOTP, secours, reset, réinitialisation manuelle du dernier super-admin, session 8 h / 30 min) | § 2.1, § 18 |
| D34 | Remise maximale 15 % (codes % et fixes), contrôle serveur | § 6.1, § 17 |
| D35 | Remboursement total : brouillon, aucun envoi ; 10 offertes gardées, ne resservent qu'avec un nouveau paiement | § 5, § 6.3, § 6.4, § 7.2 |
| D36 | Remboursement partiel : places payées réduites, puis règle du dépassement | § 5, § 6.4, § 7.1 |
| D37 | Invité déjà envoyé : jamais en excédent | § 5, § 7.1 |
| D38 | Essai refusé sur un événement déjà payé | § 6.3 |
| D39 | Pays de l'événement modifiable jusqu'au premier envoi, figé ensuite | § 4 |
| D40 | Nouveau paiement après remboursement : valeur déjà acquise (`paid_seats`) ; total → forfait complet sans code promo | § 6.1, § 6.4 |
| D41 | Changement de pays : heure locale conservée, `starts_at`, envois programmés et relances recalculés | § 4, § 7.2 |
| D42 | « Copier son lien » : payé/essai et dans le plafond ; 1re copie = envoi sans coût ni quota ; recopie libre | § 5, § 7.1 |

### Reports dans les documents sources

Reportées le 2026-10-20 dans les documents sources (voir TRD § 0 D23–D42 et
§ 17.2). Relevé fait en relisant les documents : aucun report en attente
constaté.
