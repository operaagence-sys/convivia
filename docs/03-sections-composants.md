# 03 — Sections & composants Convivia

> Catalogue des sections et composants de l'application pour les trois faces
> **organisateur**, **équipe d'accueil**, **administration**. La face **invité**
> et les **templates d'invitation** sont traités à l'étape 6 (`05-templates-
> enveloppes.md`) et **exclus** de ce document. Source amont : `02-app-flow.md`.

## Conventions de lecture

- Chaque entrée donne : **nom · rôle · pages · contenu · états · Inspiration**.
- **États** systématiques : **Vide** / **Chargement** / **Erreur** / **Succès**.
- Noms affichés en français ; **slugs de dossier en anglais kebab-case**.
- **Frontière avec `04-design-system.md`** : ici on décrit le *rôle, le contenu,
  les pages et les états* ; les *specs visuelles* (couleurs, tailles, typo,
  espacements) relèvent du design-system.
- **Dossiers d'inspiration** : créés pour les **sections** et les **composants
  réutilisables métier** uniquement. Les **primitives UI** (§ 5) sont cataloguées
  sans dossier — leur visuel vit dans le design-system.

---

## 1. Face organisateur — sections

### 1.1 Écrans d'authentification
- **Rôle** : inscription et connexion en **un seul parcours** (décision du
  2026-10-20), vérification du code.
- **Pages** : `/login` (point d'entrée unique), `/verify` ; `/signup` redirige
  vers `/login` en conservant `?ref=`.
- **Contenu** : bascule WhatsApp / email, champ numéro (indicatif pays) ou email,
  champ code à usage unique à 6 chiffres (même écran pour les deux méthodes,
  pas de mot de passe), lien « renvoyer le code » (après 60 s).
- **États** : *Vide* champs à remplir ; *Chargement* envoi/validation du code ;
  *Erreur* code faux, code expiré, numéro ou email invalide, blocage de 15 min
  après 5 codes faux (jamais « email déjà utilisé » : le message est le même
  que le compte existe ou non) ; *Succès* redirection vers `/dashboard`,
  précédée à la première connexion de l'écran « Votre profil » (nom, ville,
  pays ; TRD D44).
- **Inspiration** : `docs/inspiration/app/auth-screens/`

### 1.2 Liste des événements (tableau de bord)
- **Rôle** : lister les événements de l'organisateur et leur état.
- **Pages** : `/dashboard`.
- **Contenu** : grille de **cartes d'événement** (§ 4.3), bouton « Nouvel
  événement », accès au compte.
- **États** : *Vide* « aucun événement, créez le premier » + CTA ; *Chargement*
  squelettes de cartes ; *Erreur* « impossible de charger vos événements » +
  réessayer ; *Succès* liste affichée.
- **Inspiration** : `docs/inspiration/app/events-list/`

### 1.3 Création d'événement (minimale)
- **Rôle** : cadrer un nouvel événement.
- **Pages** : `/events/new`.
- **Contenu** : sélecteur de **type** (mariage, dot, baptême, anniversaire,
  sortie d'enfant, autre), champs nom, date, lieu, **pays de l'événement**
  (obligatoire, fixe le fuseau horaire ; modifiable jusqu'au premier envoi ;
  décisions du 2026-10-20), hôtes.
- **États** : *Vide* formulaire ; *Chargement* création ; *Erreur* champ manquant
  (dont pays), date passée ; *Succès* → `/events/<id>`.
- **Inspiration** : `docs/inspiration/app/event-dashboard/` *(partagé — création +
  pilotage du même événement)*

### 1.4 Tableau de bord d'un événement
- **Rôle** : pilotage central ; accès à toutes les sections ; rappel d'état
  (payé ? envoyé ? RSVP ouverts/clôturés ?).
- **Pages** : `/events/<id>`.
- **Contenu** : en-tête événement (nom, date, lieu, **badge d'état** § 4.11),
  tuiles de navigation vers design / contenu / invités / forfait / envoi / RSVP /
  tables / accueil / stats, édition inline date-lieu ; **le jour J**, bloc
  **« Arrivées en direct »** (entrés, 1/2 arrivés, restants) en temps réel
  (décision du 2026-10-20).
- **États** : *Vide* sections non encore remplies signalées « à compléter » ;
  *Chargement* squelette ; *Erreur* chargement impossible ; *Succès* tableau
  complet avec progression.
- **Inspiration** : `docs/inspiration/app/event-dashboard/`

### 1.5 Sélecteur de design (template + enveloppe)
- **Rôle** : choisir 1 template parmi 2, puis 1 style d'enveloppe parmi 3.
- **Pages** : `/events/<id>/design`.
- **Contenu** : 2 vignettes de template (aperçu — rendu détaillé à l'étape 6),
  3 vignettes d'enveloppe, zone d'aperçu, bouton enregistrer.
- **États** : *Vide* aucun choix encore ; *Chargement* aperçu en génération ;
  *Erreur* aperçu indisponible ; *Succès* choix enregistré → `/events/<id>`.
- **Inspiration** : `docs/inspiration/app/design-picker/`

### 1.6 Éditeur de contenu & photos
- **Rôle** : saisir message, programme, infos pratiques, dress code, noms ; déposer
  les photos dans les emplacements prévus.
- **Pages** : `/events/<id>/content`.
- **Contenu** : champs texte, éditeur de programme (liste d'étapes horaires),
  **téléverseur de photos** (§ 4.9), bouton « Aperçu », enregistrer.
- **États** : *Vide* emplacements photo et champs vides ; *Chargement* upload en
  cours (barre de progression) ; *Erreur* fichier trop lourd / format refusé /
  champ requis ; *Succès* contenu enregistré, aperçu à jour.
- **Inspiration** : `docs/inspiration/app/content-editor/`

### 1.7 Gestion des invités
- **Rôle** : constituer la liste un par un (pas d'import).
- **Pages** : `/events/<id>/guests`.
- **Contenu** : **formulaire d'ajout d'invité** (§ 4.1), liste de **cartes
  d'invité** (§ 4.2), compteur « décompté / plafond » (le « +1 » compte
  pour 2 ; état **dépassé** avec le nombre d'invités « en attente de
  paiement » et lien vers le forfait), recherche/filtre (dont **filtre par
  groupe**), **gestion des groupes d'invités** (créer, renommer, supprimer).
- **États** : *Vide* « aucun invité, ajoutez le premier » ; *Chargement* liste ;
  *Erreur* ajout refusé (numéro invalide ; 11e invité pendant l'essai seul) ;
  *Succès* invité ajouté, compteur mis à jour ; *Dépassé* (après paiement)
  invités en excédent marqués « en attente de paiement » (PRD § 7.5).
- **Inspiration** : `docs/inspiration/app/guest-manager/`

### 1.8 Sélecteur de forfait
- **Rôle** : choisir le forfait selon le nombre d'invités et préparer le paiement.
- **Pages** : `/events/<id>/package`.
- **Contenu** : grille de **cartes de forfait** (§ 4.4 : 10 offerts, 50/100/200/
  300/500/1000), total calculé, champ **code promo**, encart « > 1000 = devis »,
  bouton « Payer avec FedaPay », option essai gratuit, **historique des
  paiements** de l'événement avec remboursements éventuels (montant, statut,
  date ; sans motif interne).
- **États** : *Vide* aucun forfait sélectionné ; *Chargement* recalcul du total /
  application du code ; *Erreur* code promo invalide/expiré, essai déjà utilisé ;
  essai refusé car la liste dépasse 10 places (TRD D43) ; *Succès* forfait
  prêt → paiement.
- **Inspiration** : `docs/inspiration/app/package-selector/`

### 1.9 Écran de paiement
- **Rôle** : encaisser via FedaPay avant l'envoi.
- **Pages** : `/events/<id>/package/checkout` (+ retour sur `/events/<id>/package`).
- **Contenu** : récapitulatif (forfait, remise, total FCFA), redirection vers la
  page FedaPay, page de retour avec statut.
- **États** : *Vide* récap affiché avant redirection ; *Chargement* attente de la
  confirmation FedaPay ; *Erreur* paiement échoué/annulé (envoi reste bloqué) ;
  *Succès* paiement confirmé → envoi débloqué.
- **Inspiration** : `docs/inspiration/app/payment-screen/`

### 1.10 Aperçu avant envoi & envoi
- **Rôle** : vérifier puis envoyer les invitations (immédiat ou programmé).
- **Pages** : `/events/<id>/send`.
- **Contenu** : aperçu d'une invitation (enveloppe + mini-site), récap du nombre
  d'envois, nombre d'invités exclus car **« en attente de paiement »** (avec
  lien vers le forfait, PRD § 7.5), bascule « Envoyer maintenant » /
  « Programmer » (date-heure).
- **États** : *Vide* (paiement non fait) bouton désactivé + renvoi vers forfait ;
  *Chargement* envoi en cours (compteur d'envois) ; *Erreur* échec d'envoi partiel
  (invités en erreur listés) ; *Succès* « invitations envoyées » / « envoi
  programmé » → `/events/<id>/rsvp`.
- **Inspiration** : `docs/inspiration/app/send-preview/`

### 1.11 Tableau de bord des RSVP
- **Rôle** : suivre les réponses en temps réel.
- **Pages** : `/events/<id>/rsvp`.
- **Contenu** : **tuiles de stats RSVP** (§ 4.5 : ouvertes / confirmées / refusées
  / sans réponse), liste filtrable d'invités avec **puce d'état RSVP** (§ 4.6),
  bouton « Relancer », **bouton « Clôturer les RSVP »** (avec confirmation).
- **États** : *Vide* aucun envoi encore → « envoyez d'abord vos invitations » ;
  *Chargement* chiffres en cours ; *Erreur* synchro impossible ; *Succès* chiffres
  à jour, mise à jour temps réel ; état **clôturé** = réponses figées.
- **Inspiration** : `docs/inspiration/app/rsvp-dashboard/`

### 1.12 Relances
- **Rôle** : récupérer les invités sans réponse.
- **Pages** : `/events/<id>/reminders`.
- **Contenu** : interrupteur « relances automatiques » (2 au maximum : J+3 et
  J-7 ; une seule à J+3 si l'événement a lieu 10 jours ou moins après
  l'envoi, PRD § 7.10), sélection d'invités, choix d'un **modèle de message** groupé /
  individuel (pas de texte libre), **compteur de quota** par invité (3 messages
  manuels, remerciement compris), historique des relances.
- **États** : *Vide* personne à relancer (tous ont répondu) ; *Chargement* envoi ;
  *Erreur* échec d'envoi, quota atteint, invité ayant refusé les messages ;
  *Succès* « relances envoyées ».
- **Inspiration** : `docs/inspiration/app/reminders/`

### 1.13 Gestion des tables
- **Rôle** : créer les tables et affecter les invités.
- **Pages** : `/events/<id>/tables`.
- **Contenu** : création de tables **nommées ou numérotées**, **cartes de table**
  (§ 4.7) avec invités affectés, glisser-déposer d'affectation, filtre et
  regroupement par **groupe d'invités** (ex. côté marié / côté mariée), pour
  tous les types.
- **États** : *Vide* aucune table créée ; *Chargement* plan en cours ; *Erreur*
  affectation impossible ; *Succès* plan enregistré. *(La table n'est visible par
  l'invité qu'après le scan.)*
- **Inspiration** : `docs/inspiration/app/tables-manager/`

### 1.14 Équipe d'accueil (préparation)
- **Rôle** : générer le code d'événement et régler le mode strict.
- **Pages** : `/events/<id>/hosting`.
- **Contenu** : **code d'événement** affiché/copiable (réaffichable à tout
  moment), bouton régénérer/révoquer, liste des **appareils connectés**
  (« Appareil 1 », « Appareil 2 »…), interrupteur **mode strict**, lien vers les
  arrivées en direct (tableau de bord de l'événement, § 1.4).
- **États** : *Vide* aucun code encore généré ; *Chargement* génération ; *Erreur*
  génération impossible ; *Succès* code actif (anciens invalidés si régénéré).
- **Inspiration** : `docs/inspiration/app/hosting-setup/`

### 1.15 Après l'événement (statistiques & remerciement)
- **Rôle** : clore l'événement.
- **Pages** : `/events/<id>/stats`.
- **Contenu** : **tuiles KPI** (§ 4.8) présence/scannés/1-sur-2/absents, graphe
  d'arrivées, composeur de **message de remerciement** (groupé, envoyé aux
  **présents scannés** uniquement, PRD § 6.15).
- **États** : *Vide* événement pas encore passé → « disponible après l'événement » ;
  *Chargement* calcul ; *Erreur* stats indisponibles ; *Succès* stats affichées,
  remerciement envoyé.
- **Inspiration** : `docs/inspiration/app/post-event-stats/`

### 1.16 Paramètres du compte
- **Rôle** : gérer le compte organisateur.
- **Pages** : `/account`.
- **Contenu** : infos du compte, déconnexion, **« Déconnecter toutes les
  sessions »** (TRD § 7.4), **suppression d'un événement / du
  compte** (supprime les données des invités associées ; paiements et
  statistiques agrégées conservés sans donnée personnelle).
- **États** : *Vide* n/a ; *Chargement* enregistrement ; *Erreur* action refusée ;
  *Succès* modifications prises en compte / compte supprimé ; **Suspendu**
  bandeau « Compte suspendu, contactez le support », consultation seule (valable
  sur toutes les sections organisateur).
- **Inspiration** : `docs/inspiration/app/account-settings/`

---

## 2. Face équipe d'accueil — sections

### 2.1 Rejoindre un événement (code)
- **Rôle** : donner accès à l'écran de scan via le code d'événement.
- **Pages** : `/scan`.
- **Contenu** : champ **code d'événement** (8 caractères), bouton « Rejoindre ».
- **États** : *Vide* champ à remplir ; *Chargement* vérification du code ;
  *Erreur* code invalide/révoqué, pas encore actif (avant J-1), expiré (après
  J+1), appareil bloqué 15 min après 5 essais ; *Succès* → `/scan/<event>`.
- **Inspiration** : `docs/inspiration/app/scan-join/`

### 2.2 Écran de scan
- **Rôle** : contrôler les entrées (connexion requise, pas de mode hors ligne).
- **Pages** : `/scan/<event>`.
- **Contenu** : viseur caméra, **badge de résultat de scan** (§ 4.10) affichant
  l'état et la table, compteur rapide, bouton « scanner le suivant ». Pour une
  invitation avec accompagnant : noms affichés et 3 gros boutons « Les deux » /
  « Invité principal seul » / « Accompagnant seul » (seul « Les deux » en mode
  strict au premier passage).
- **États** : *Vide* prêt à scanner ; *Chargement* lecture/validation du QR ;
  *Erreur* QR illisible, hors connexion, événement inconnu ; *Succès* résultat
  affiché — « entrée validée », « 1/2 arrivé », « déjà entré », « refusé : invité
  principal absent », ou refus mode strict.
- **Inspiration** : `docs/inspiration/app/scan-screen/`

### 2.3 Suivi des arrivées en direct
- **Rôle** : suivre le flux d'arrivées en temps réel.
- **Pages** : `/scan/<event>/live`.
- **Contenu** : compteurs (entrés, 1/2 arrivés, restants), liste chronologique des
  derniers scans (sans coordonnées).
- **États** : *Vide* aucune arrivée encore ; *Chargement* synchro ; *Erreur*
  perte de connexion ; *Succès* flux à jour en temps réel.
- **Inspiration** : `docs/inspiration/app/arrivals-live/`

---

## 3. Face administration — sections (desktop)

> Règle transverse : **aucun écran admin n'affiche les coordonnées des invités**.
> Accès selon le rôle (§ 4 du PRD).

### 3.1 Connexion admin
- **Rôle** : accès à l'espace d'administration.
- **Pages** : `/admin/login`, `/admin/reset` (mot de passe oublié).
- **Contenu** : email + mot de passe, puis champ du code de double
  authentification (TOTP, obligatoire) ou d'un code de secours ; lien « mot de
  passe oublié » ; à la première connexion, enrôlement TOTP (QR + clé) et
  affichage unique des 10 codes de secours (02 § 4.1).
- **États** : *Vide* champs ; *Chargement* authentification ; *Erreur* message
  unique « Identifiants ou code incorrects », blocage de 15 min après 5 échecs ;
  *Succès* → `/admin`.
- **Inspiration** : `docs/inspiration/app/admin-login/`

### 3.2 Tableau de bord principal
- **Rôle** : vue de croissance (selon rôles).
- **Pages** : `/admin`.
- **Contenu** : **tuiles KPI** (§ 4.8) — utilisateurs, revenu total/évolution,
  revenu par type/forfait, panier moyen, événements créés/payés ; navigation
  latérale vers les sections autorisées.
- **États** : *Vide* pas encore de données ; *Chargement* squelettes ; *Erreur*
  données indisponibles ; *Succès* tableau complet.
- **Inspiration** : `docs/inspiration/app/admin-dashboard/`

### 3.3 Entonnoir de conversion
- **Rôle** : visiteur → inscrit → événement créé → invitations envoyées → paiement.
- **Pages** : `/admin/funnel`.
- **Contenu** : **graphe d'entonnoir** (§ 4.12) avec taux de passage par étape,
  filtres (période, canal, pays).
- **États** : *Vide* aucune donnée sur la période ; *Chargement* calcul ; *Erreur*
  indisponible ; *Succès* entonnoir affiché.
- **Inspiration** : `docs/inspiration/app/conversion-funnel/`

### 3.4 Qualité d'usage & répartition
- **Rôle** : taux d'ouverture / RSVP / présence scannée, fidélisation, répartition
  ville/pays/type, saisonnalité.
- **Pages** : `/admin/usage`.
- **Contenu** : **tuiles KPI** (§ 4.8), graphiques de répartition, carte/tableau
  géographique.
- **États** : *Vide* ; *Chargement* ; *Erreur* ; *Succès* indicateurs affichés.
- **Inspiration** : `docs/inspiration/app/usage-quality/`

### 3.5 Codes promo & influenceurs
- **Rôle** : créer/paramétrer les codes et liens de suivi, suivre leurs stats.
- **Pages** : `/admin/promos`, `/admin/promos/<id>`.
- **Contenu** : liste des codes, formulaire de création (remise % / montant fixe,
  15 % au maximum / suivi sans remise ; durée ; limite ; canal/influenceur), **table de stats de
  code** (§ 4.13), création de lien de suivi, comparaison d'influenceurs.
- **États** : *Vide* aucun code ; *Chargement* ; *Erreur* paramètre invalide
  (dont remise > 15 %) ;
  *Succès* code créé / stats affichées.
- **Inspiration** : `docs/inspiration/app/promo-codes/`

### 3.6 Finances
- **Rôle** : paiements FedaPay, marges, remboursements, exports.
- **Pages** : `/admin/finance`.
- **Contenu** : table des transactions, marges par événement, panier moyen,
  revenu, **action de remboursement** (exceptionnelle, tracée), **export Excel**.
- **États** : *Vide* aucune transaction ; *Chargement* ; *Erreur* ; *Succès*
  données/export prêts.
- **Inspiration** : `docs/inspiration/app/finance-dashboard/`

### 3.7 Gestion événements & utilisateurs (support)
- **Rôle** : recherche et assistance (sans coordonnées des invités ; sans
  remboursement ni modification de prix pour le support).
- **Pages** : `/admin/events`, `/admin/users`.
- **Contenu** : recherche, table d'événements/utilisateurs, fiche d'état (RSVP,
  envoi, paiement payé/échoué), coordonnées de l'organisateur, bloc **« Notes
  internes »** (historique + ajout d'une note, non modifiable), action
  **« Suspendre / réactiver le compte »** avec motif obligatoire (*super-admin
  seulement*, masquée pour le support).
- **États** : *Vide* aucun résultat ; *Chargement* ; *Erreur* ; *Succès* résultats
  affichés, note ajoutée, compte suspendu / réactivé.
- **Inspiration** : `docs/inspiration/app/admin-events-users/`

### 3.8 Contenu (templates & enveloppes)
- **Rôle** : gérer les 12 templates et 3 styles d'enveloppe (définition, aperçus,
  emplacements photos). *(Détail visuel : étape 6.)*
- **Pages** : `/admin/templates`.
- **Contenu** : liste des templates par type, éditeur d'emplacements, aperçus.
- **États** : *Vide* ; *Chargement* ; *Erreur* ; *Succès* template enregistré.
- **Inspiration** : `docs/inspiration/app/content-admin/`

### 3.9 Réglages plateforme
- **Rôle** : forfaits, prix, pays ; gestion des comptes admin et de leurs rôles
  (cumul possible).
- **Pages** : `/admin/settings`.
- **Contenu** : édition de la grille de prix et des pays, liste des admins avec
  attribution de rôles, action « Réinitialiser la double authentification »
  (motif obligatoire, journalisée ; 02 § 4.9).
- **États** : *Vide* ; *Chargement* enregistrement ; *Erreur* valeur invalide ;
  *Succès* réglages appliqués.
- **Inspiration** : `docs/inspiration/app/platform-settings/`

---

## 4. Composants réutilisables métier

### 4.1 Formulaire d'ajout d'invité
- **Rôle** : saisir un invité (prénom, nom, numéro WhatsApp, type
  d'invitation).
- **Pages** : `/events/<id>/guests`.
- **Contenu** : champ **prénom** (obligatoire), champ **nom** (facultatif ;
  TRD D45), champ numéro (indicatif), bascule **individuelle /
  avec accompagnant** (« Nom + 1 », nom de l'accompagnant optionnel ; bascule
  verrouillée une fois l'invitation envoyée),
  **sélecteur de groupe** facultatif (avec « Nouveau groupe »), **case
  obligatoire d'attestation du consentement** WhatsApp.
- **États** : *Vide* champs ; *Chargement* ajout ; *Erreur* numéro invalide /
  plafond de l'essai atteint / attestation non cochée (un numéro déjà présent n'est **pas**
  une erreur) ; *Succès* invité ajouté, formulaire réinitialisé.
- **Inspiration** : `docs/inspiration/app/guest-form/`

### 4.2 Carte d'invité
- **Rôle** : représenter un invité dans la liste.
- **Pages** : `/events/<id>/guests`, `/events/<id>/rsvp`, `/events/<id>/tables`.
- **Contenu** : nom, type (individuelle / +1), groupe, **puce d'état RSVP**
  (§ 4.6), table affectée, statut de livraison WhatsApp (envoyé / échec / a
  refusé les messages / **en attente de paiement**), messages restants dans le
  quota, actions (modifier, supprimer, relancer, **renvoyer l'invitation**
  après un échec ou un changement de numéro, copier le lien — invité ayant
  refusé WhatsApp, événement payé ou en essai, invité dans le plafond ; la
  1re copie compte comme un envoi (TRD D42) —, **afficher son
  QR**).
- **États** : *Vide* n/a (apparaît si l'invité existe) ; *Chargement* skeleton ;
  *Erreur* action échouée ; *Succès* carte à jour.
- **Inspiration** : `docs/inspiration/app/guest-card/`

### 4.3 Carte d'événement
- **Rôle** : représenter un événement dans la liste.
- **Pages** : `/dashboard`.
- **Contenu** : nom, type, date, lieu, **badge d'état** (§ 4.11), raccourci.
- **États** : *Chargement* skeleton ; *Erreur* n/a ; *Succès* carte cliquable.
- **Inspiration** : `docs/inspiration/app/event-card/`

### 4.4 Carte de forfait
- **Rôle** : présenter un palier de forfait et son prix.
- **Pages** : `/events/<id>/package`.
- **Contenu** : nombre d'invités, prix unitaire, total FCFA, mention « essai
  gratuit » / « devis » selon le palier, état sélectionné.
- **États** : *Vide* n/a ; *Succès* sélectionné / non sélectionné ; *Erreur*
  indisponible.
- **Inspiration** : `docs/inspiration/app/package-card/`

### 4.5 Tuiles de stats RSVP
- **Rôle** : chiffres clés des réponses.
- **Pages** : `/events/<id>/rsvp`.
- **Contenu** : 4 tuiles — ouvertes, confirmées, refusées, sans réponse.
- **États** : *Vide* 0 partout ; *Chargement* ; *Erreur* ; *Succès* temps réel.
- **Inspiration** : `docs/inspiration/app/kpi-tile/` *(variante RSVP)*

### 4.6 Puce d'état RSVP
- **Rôle** : étiquette d'état d'un invité.
- **Pages** : `/events/<id>/rsvp`, carte d'invité.
- **Contenu** : ouverte / confirmée / refusée / sans réponse (code couleur).
- **États** : *Succès* état courant ; autres états n/a.
- **Inspiration** : `docs/inspiration/app/rsvp-status-chip/`

### 4.7 Carte de table
- **Rôle** : une table et ses invités affectés.
- **Pages** : `/events/<id>/tables`.
- **Contenu** : nom/numéro, liste d'invités, regroupement par groupe d'invités,
  capacité.
- **États** : *Vide* table sans invité ; *Chargement* ; *Erreur* affectation
  refusée ; *Succès* à jour.
- **Inspiration** : `docs/inspiration/app/table-card/`

### 4.8 Tuile KPI
- **Rôle** : indicateur chiffré réutilisable.
- **Pages** : `/admin`, `/admin/usage`, `/events/<id>/stats`.
- **Contenu** : libellé, valeur, variation/tendance optionnelle.
- **États** : *Vide* « — » ; *Chargement* skeleton ; *Erreur* « indisponible » ;
  *Succès* valeur.
- **Inspiration** : `docs/inspiration/app/kpi-tile/`

### 4.9 Téléverseur de photos
- **Rôle** : déposer des photos dans les emplacements d'un template.
- **Pages** : `/events/<id>/content`.
- **Contenu** : zone de dépôt, vignettes, recadrage simple, remplacement.
- **États** : *Vide* emplacement libre ; *Chargement* upload (progression) ;
  *Erreur* format/poids refusé ; *Succès* photo en place.
- **Inspiration** : `docs/inspiration/app/photo-uploader/`

### 4.10 Badge de résultat de scan
- **Rôle** : afficher l'état d'une entrée après scan.
- **Pages** : `/scan/<event>`.
- **Contenu** : état (entrée validée / 1 sur 2 arrivé / déjà entré / refusé :
  invité principal absent / refus mode strict / QR invalide / QR d'un autre
  événement) + table de l'invité + mention éventuelle « n'avait pas confirmé »
  ou « avait décliné » (entrée acceptée).
- **États** : *Succès* entrée validée ; *Erreur/Refus* refusé ou déjà entré ;
  *Chargement* validation ; *Vide* n/a.
- **Inspiration** : `docs/inspiration/app/scan-result-badge/`

### 4.11 Badge d'état d'événement
- **Rôle** : état global d'un événement.
- **Pages** : `/dashboard`, `/events/<id>`.
- **Contenu** : brouillon / essai / payé / programmé / envoyé / clôturé / passé
  (les 7 états calculés de `07-schema-backend.md` § 4.1).
- **États** : *Succès* état courant.
- **Inspiration** : `docs/inspiration/app/event-status-badge/`

### 4.12 Graphe d'entonnoir
- **Rôle** : visualiser la conversion par étapes.
- **Pages** : `/admin/funnel`.
- **Contenu** : barres/étapes avec volumes et taux de passage.
- **États** : *Vide* pas de données ; *Chargement* ; *Erreur* ; *Succès* graphe.
- **Inspiration** : `docs/inspiration/app/funnel-chart/`

### 4.13 Table de statistiques de code promo
- **Rôle** : stats détaillées par code.
- **Pages** : `/admin/promos`, `/admin/promos/<id>`.
- **Contenu** : utilisations, inscriptions, paiements, revenu généré, remise,
  revenu net, conversion, panier moyen.
- **États** : *Vide* code jamais utilisé ; *Chargement* ; *Erreur* ; *Succès*
  lignes affichées.
- **Inspiration** : `docs/inspiration/app/promo-stats-table/`

---

## 5. Primitives UI (catalogue sans dossier — visuel → `04-design-system.md`)

Chaque primitive est décrite par son rôle et ses états ; ses specs visuelles
seront fixées au design-system.

- **Bouton** (primaire/secondaire/danger) — *états* : normal, hover/focus,
  chargement, désactivé.
- **Champ texte / zone de texte** — vide, focus, erreur (message), désactivé.
- **Champ numéro de téléphone** (indicatif pays) — vide, valide, erreur de format.
- **Champ code (OTP)** — vide, en saisie, erreur, succès.
- **Sélecteur / liste déroulante** — fermé, ouvert, sélectionné, désactivé.
- **Sélecteur de date-heure** — vide, choisi, hors plage (date passée).
- **Interrupteur / bascule** (ex. mode strict, relances auto) — on/off, désactivé.
- **Onglets / navigation segmentée** — actif, inactif.
- **Modale / boîte de dialogue de confirmation** — ouverte, chargement, erreur.
- **Notification / toast** — succès, erreur, info.
- **Table de données** (admin) — vide, chargement (skeleton), erreur, triée,
  paginée.
- **Pagination** — page courante, désactivée aux extrêmes.
- **Champ de recherche** — vide, saisie, aucun résultat.
- **Badge / puce générique** — variantes de couleur.
- **Barre de progression / spinner** — déterminée, indéterminée.
- **Bloc d'état vide générique** — illustration + message + CTA.
- **Zone de dépôt de fichier** — au repos, survol, upload, erreur.
- **Navigation** : barre inférieure (mobile, organisateur/accueil), barre latérale
  (desktop, admin), en-tête de page.

---

## 6. Sections pour lesquelles apporter des références visuelles

À déposer dans le dossier `docs/inspiration/app/<nom>/` correspondant. Les
templates d'invitation et styles d'enveloppe sont **hors de cette liste** (étape 6).

**Priorité haute (écrans structurants et différenciants)**
- `rsvp-dashboard` — tableau de bord des RSVP
- `guest-manager` + `guest-form` + `guest-card` — gestion/ajout/carte d'invité
- `package-selector` + `package-card` — sélecteur de forfait
- `payment-screen` — écran de paiement (parcours FedaPay)
- `content-editor` + `photo-uploader` — éditeur de contenu et photos
- `send-preview` — aperçu avant envoi
- `scan-screen` + `scan-result-badge` — écran de scan et ses états
- `arrivals-live` — suivi des arrivées
- `tables-manager` + `table-card` — gestion des tables

**Priorité moyenne (pilotage & admin)**
- `event-dashboard`, `events-list` + `event-card`, `event-status-badge`
- `design-picker`, `hosting-setup`, `post-event-stats`, `reminders`
- `admin-dashboard` + `kpi-tile`, `conversion-funnel` + `funnel-chart`
- `promo-codes` + `promo-stats-table`, `finance-dashboard`
- `usage-quality`, `admin-events-users`, `content-admin`, `platform-settings`

**Priorité basse (écrans simples)**
- `auth-screens`, `scan-join`, `account-settings`, `admin-login`

> Astuce : 2 à 4 références par dossier suffisent (captures d'apps existantes,
> maquettes, liens). Les primitives UI (§ 5) n'ont pas de dossier — leurs
> références iront dans `04-design-system.md`.
