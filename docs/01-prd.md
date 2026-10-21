# 01 — PRD Convivia

> Document produit. Il répond à trois questions : **qu'est-ce qu'on construit**,
> **pour qui**, et **qu'est-ce qu'on ne construit pas**. Les règles métier ici
> font foi. Source amont : `00-synthese-convivia.pdf`.

---

## 1. Qu'est-ce qu'on construit

Convivia est une plateforme SaaS de création d'**invitations digitales** pour les
événements courants en Afrique de l'Ouest. L'organisateur choisit un template,
renseigne son contenu et ses photos, ajoute ses invités un par un, puis envoie à
chacun une invitation **personnalisée par WhatsApp** avec un **QR code unique**.
Le jour J, l'équipe d'accueil scanne les QR codes pour contrôler l'entrée. Le
paiement se fait **par événement, avant l'envoi**, selon le nombre d'invités.

L'application est une PWA mobile-first (Next.js + Supabase, paiements FedaPay,
WhatsApp via l'API Cloud de Meta en direct, voir `06-trd.md`).

## 2. Pour qui

- **Périmètre du MVP** : zone couverte par FedaPay — **Bénin, Côte d'Ivoire,
  Togo, Sénégal**. Les organisateurs sont dans ces pays ; les invités peuvent se
  trouver n'importe où (réception par WhatsApp).
- **Utilisateur payant** : l'organisateur d'un événement privé (mariage, dot,
  baptême, anniversaire, sortie d'enfant, autre).
- Non ciblés au lancement : professionnels (wedding planners, salles, traiteurs)
  — voir § Hors MVP.

## 3. Types d'utilisateurs

### 3.1 Organisateur
- A un compte. Inscription par **numéro WhatsApp avec code de vérification** ou
  par **email**.
- Crée et pilote ses événements : contenu, invités, paiement, envoi, suivi des
  RSVP, tables, équipe d'accueil, suivi du jour J, remerciements.

### 3.2 Invité
- **Sans compte.** Accède à tout par son **lien personnel** reçu par WhatsApp.
- Ouvre son enveloppe animée (avec son nom), consulte l'invitation et le
  mini-site, répond au RSVP, reçoit et présente son QR code, voit sa table après
  le scan.

### 3.3 Membre de l'équipe d'accueil
- Désigné par l'organisateur pour un événement donné.
- Scanne les QR codes depuis son téléphone (connexion internet requise) et voit
  l'état d'entrée de chaque invité. N'a pas accès au pilotage de l'événement.

## 4. Rôles d'administration

Rôles attribués par le super-admin. **Un compte admin peut cumuler plusieurs
rôles.** Règle transverse : **aucun rôle admin ne voit les coordonnées
personnelles des invités** (nom + numéro WhatsApp), super-admin inclus dans les
écrans courants — ces données servent l'organisateur, pas le pilotage.

| Rôle | Fait | Ne voit jamais |
|------|------|----------------|
| **Super-admin** | Tout : gestion des comptes admin et de leurs rôles, tous les tableaux de bord, gestion des événements/utilisateurs, réglages plateforme (forfaits, prix, pays), **suspension d'un compte organisateur** (abus, fraude, spam WhatsApp). | — (coordonnées des invités exclues comme pour tous) |
| **Marketing** | Codes promo (création, paramètres, stats), influenceurs et liens de suivi, entonnoir de conversion, répartition ville/pays/type, qualité d'usage (ouverture, RSVP, présence). | Détails de paiement FedaPay, remboursements, marges, coordonnées des invités. |
| **Finance** | Paiements FedaPay, remboursements, marges par événement, panier moyen, revenu, exports Excel comptables. | Paramétrage des codes promo/influenceurs (voit l'impact financier agrégé, pas la config), coordonnées des invités. |
| **Support client** | Aide aux organisateurs : recherche d'organisateur/événement, état d'un événement (RSVP, envoi, paiement payé/échoué), assistance au déroulé, **notes internes** sur un organisateur ou un événement. **Lecture seule** pour tout le reste : les modifications restent faites par l'organisateur. | Marges et rentabilité, paramétrage des codes promo, coordonnées des invités. Ne peut pas déclencher de remboursement ni modifier les prix. |
| **Contenu** | Gestion des 12 templates et des 3 styles d'enveloppe (définition, aperçus, emplacements photos). | Données financières, paiements, codes promo, coordonnées des invités. |

**Coordonnées des organisateurs** (nom, e-mail, numéro WhatsApp), selon le
rôle :
- **Super-admin** et **support** : coordonnées complètes (recherche et
  assistance) ;
- **Finance** : nom et e-mail ; numéro **masqué** (`+229 •• •• •• 12`) ;
- **Marketing** : jamais de coordonnées individuelles, seulement des agrégats
  (ville, pays, canal d'acquisition) ;
- **Contenu** : aucune donnée d'organisateur.

**Suspension d'un compte organisateur** (super-admin seulement, tracée) :
l'organisateur garde la **lecture** de ses données mais ne peut plus rien
modifier ni envoyer. Les **notes internes** du support ne sont jamais visibles
par l'organisateur ; une note ne se modifie pas (une correction = une nouvelle
note).

## 5. Types d'événements

Chaque type a ses propres templates et champs spécifiques. **Six types** :
mariage, dot, baptême, anniversaire, sortie d'enfant, autre.

### 5.1 Socle commun à tous les types
Nom de l'événement, date, lieu, programme, dress code, RSVP, QR code, tables,
**groupes d'invités**.

**Groupes d'invités** : l'organisateur crée librement ses propres groupes, pour
tous les types d'événement (ex. « Côté marié », « Côté mariée », « Famille
Adjovi », « Collègues »). Une invitation appartient à **un groupe au plus**
(ou à aucun). Les groupes servent à filtrer la liste et à préparer le plan de
salle ; ils ne sont jamais visibles par les invités.

### 5.2 Spécificités par type
- **Mariage** — socle commun ; les groupes servent typiquement à séparer côté
  marié / côté mariée pour le plan de salle.
- **Dot** — socle commun ; même usage des groupes que pour le mariage.
- **Baptême** — socle commun.
- **Anniversaire** — socle commun.
- **Sortie d'enfant** — cérémonie où un couple présente son enfant à la famille
  et aux proches après la naissance.
- **Autre** — catégorie généraliste pour tout événement hors types prévus.

> Les ambiances visuelles et les 12 templates (2 par type) sont définis dans
> `05-templates-enveloppes.md`.

## 6. Fonctionnalités du MVP

Pour chaque fonctionnalité : son objectif et ses critères de réussite.

### 6.1 Inscription et compte organisateur
- **Objectif** : permettre à un organisateur de créer un compte simplement.
- **Réussite** : inscription par numéro WhatsApp + code de vérification, ou par
  email + code à 6 chiffres (sans mot de passe) ; l'organisateur retrouve ses
  événements à la reconnexion. **Inscription et connexion sont un seul
  parcours** (décision du 2026-10-20) : l'organisateur saisit son numéro ou son
  e-mail, reçoit un code, et le compte est créé s'il n'existe pas ; l'écran ne
  révèle jamais si un compte existe déjà. À la **première connexion**, il
  renseigne son **nom, sa ville et son pays** avant d'arriver au tableau de
  bord ; son nom signe les messages « De la part de [organisateur] »
  (décision du 2026-10-21). Il peut **déconnecter toutes ses sessions**
  depuis son compte.

### 6.2 Création d'un événement
- **Objectif** : cadrer l'événement (type, nom, date, lieu, **pays**, hôtes).
  Le **pays de l'événement** est obligatoire : il fixe le fuseau horaire des
  envois, des relances et du code d'accueil ; il reste modifiable jusqu'au
  premier envoi, puis il est figé. En cas de changement, l'**heure locale est
  conservée** (15 h reste 15 h dans le nouveau pays) et les envois programmés
  sont recalculés (décisions du 2026-10-20).
- **Réussite** : un événement du bon type est créé et modifiable ; les champs du
  socle commun et les champs spécifiques au type sont disponibles. Le **type**
  n'est plus modifiable après le premier envoi d'invitations (le template doit
  rester cohérent avec les invitations déjà parties).

### 6.3 Choix du template et du style d'enveloppe
- **Objectif** : donner une identité visuelle sans édition libre du design.
- **Réussite** : l'organisateur choisit 1 template parmi les 2 de son type, puis
  1 style d'enveloppe parmi les 3 ; un aperçu fidèle est affiché ; les couleurs
  de l'enveloppe s'adaptent à la palette du template.

### 6.4 Renseignement du contenu et mini-site
- **Objectif** : remplir ce que seul l'organisateur peut fournir.
- **Réussite** : message d'invitation, programme, infos pratiques, noms, date,
  lieu et photos sont placés dans les emplacements prévus ; le mini-site est
  généré à partir du template ; le design (mise en page, polices, couleurs,
  animation) reste fixe.

### 6.5 Gestion des invités
- **Objectif** : constituer la liste, un par un, sans import.
- **Réussite** : ajout manuel (**prénom** obligatoire, **nom** facultatif,
  numéro WhatsApp ; décision du 2026-10-21) ; choix du type d'invitation
  par invité — **individuelle** (1 personne) ou **avec accompagnant** (« Nom + 1 »,
  nom de l'accompagnant optionnel) ; rattachement facultatif à un **groupe**
  (§ 5.1) ; chaque invitation est personnalisée ; l'organisateur atteste pour
  chaque invité son accord pour recevoir l'invitation par WhatsApp (§ 7.14).
  Deux invités d'un même événement **peuvent partager un numéro** (un couple,
  par exemple) : aucun refus pour doublon. Le **type d'invitation**
  (individuelle / avec accompagnant) est **figé dès que l'invitation de cet
  invité est envoyée** (décision du 2026-10-20).

### 6.6 Paiement du forfait
- **Objectif** : encaisser avant l'envoi, selon le nombre d'invités.
- **Réussite** : le forfait est calculé selon la grille (§ 7.1), payé via FedaPay,
  et l'envoi est débloqué uniquement après paiement confirmé, ou dans la
  limite de l'essai gratuit (§ 7.4).

### 6.7 Envoi des invitations par WhatsApp
- **Objectif** : livrer à chaque invité son lien personnel et son QR code.
- **Réussite** : envoi immédiat ou programmé ; chaque invité reçoit un lien
  personnel unique ; aperçu disponible avant envoi.

### 6.8 Enveloppe animée et réception
- **Objectif** : offrir une ouverture soignée et personnalisée.
- **Réussite** : à l'ouverture du lien, l'enveloppe s'anime avec le nom de
  l'invité, puis révèle l'invitation (texte, photos, date, lieu) et le mini-site ;
  ouverture rapide sur téléphone.

### 6.9 RSVP et suivi en temps réel
- **Objectif** : collecter les réponses et les suivre.
- **Réussite** : l'invité répond « présent » / « ne pourra pas venir » ; le
  tableau de bord organisateur montre en temps réel ouvertes / confirmées /
  refusées / sans réponse.

### 6.10 QR code
- **Objectif** : donner à chaque invité son titre d'entrée.
- **Réussite** : le QR code personnel est créé **dès l'envoi** et visible sur
  la page de l'invité après l'ouverture de l'enveloppe ; après confirmation, il
  est renvoyé en image par WhatsApp ; un seul QR code par invitation, y compris
  « +1 ».

### 6.11 Relances
- **Objectif** : récupérer les invités sans réponse.
- **Réussite** : relances automatiques des sans-réponse (2 au maximum, § 7.10) ;
  messages groupés ou individuels déclenchables par l'organisateur, dans la
  limite d'un quota par invité.

### 6.12 Gestion des tables
- **Objectif** : affecter chaque invité à une table.
- **Réussite** : création de tables **nommées ou numérotées** (au choix de
  l'organisateur), affectation des invités, filtrage et regroupement par
  **groupe d'invités** (§ 5.1) pour tous les types ; la table n'est visible par
  l'invité **qu'après le scan** (§ 7.7).

### 6.13 Clôture des RSVP
- **Objectif** : figer les réponses.
- **Réussite** : un bouton dédié clôture les RSVP ; après clôture, les invités ne
  peuvent plus modifier leur réponse.

### 6.14 Contrôle à l'entrée (scan)
- **Objectif** : contrôler les entrées le jour J.
- **Réussite** : l'équipe d'accueil scanne (connexion requise) ; l'écran affiche
  l'état selon les règles d'entrée (§ 7.8) et la table de l'invité ; suivi en
  direct des arrivées.

### 6.15 Après l'événement
- **Objectif** : clore proprement.
- **Réussite** : statistiques de présence disponibles ; message de remerciement
  envoyable aux **invités présents** (scannés à l'entrée) uniquement (décision
  du 2026-10-20).

### 6.16 Espace administrateur (pilotage de la croissance)
- **Objectif** : savoir si le SaaS grandit et décider de passer à l'échelle.
- **Réussite** : tableaux de bord utilisateurs / revenu / entonnoir / qualité
  d'usage / fidélisation / rentabilité / répartition, selon les droits de chaque
  rôle (§ 4) ; gestion des événements et utilisateurs avec recherche, suivi des
  paiements et remboursements, export Excel.

### 6.17 Codes promo et liens de suivi
- **Objectif** : mesurer la rentabilité des canaux et influenceurs.
- **Réussite** : création de codes (remise % ou montant fixe, ou simple suivi
  sans remise) et de liens de suivi ; stats par code (§ 7.11).

## 7. Règles métier

### 7.1 Forfaits et grille de prix
Paiement par événement, avant l'envoi, selon le nombre d'invités. Prix de base
**200 FCFA/invité**, prix unitaire dégressif. Grille officielle du MVP
(relevée de 50 FCFA sur chaque palier le 2026-10-20 par rapport à la synthèse
00, pour rester rentable dans le pire cas de coût WhatsApp — voir
`06-trd.md` § 2.4) :

| Forfait | Prix unitaire | Total |
|---|---|---|
| Essai gratuit | — | 10 invités offerts (bonus fixe, cumulable avec un forfait, § 7.4) |
| 50 invités | 200 FCFA | 10 000 FCFA |
| 100 invités | 190 FCFA | 19 000 FCFA |
| 200 invités | 175 FCFA | 35 000 FCFA |
| 300 invités | 165 FCFA | 49 500 FCFA |
| 500 invités | 155 FCFA | 77 500 FCFA |
| 1 000 invités | 150 FCFA | 150 000 FCFA |

- **Au-delà de 1 000 invités** : sur devis, prix unitaire ≥ 150 FCFA.
- Entre deux forfaits, l'organisateur prend le **forfait supérieur** ou **ajoute
  des invités au prix unitaire de son palier**. L'application calcule les deux
  options et met en avant la moins chère.
- **Passage au forfait supérieur** après un paiement : l'organisateur paie la
  **différence entre les prix catalogue** des deux forfaits (ex. 50 → 100 :
  19 000 − 10 000 = 9 000 FCFA), même si le premier paiement a bénéficié d'une
  remise. **Après un remboursement** (décision du 2026-10-20), on part de la
  **valeur déjà acquise** = prix catalogue du palier payé × part des places
  payées restantes (ex. forfait 100 remboursé à 50 places → 9 500 ; passage au
  200 = 35 000 − 9 500 = 25 500 FCFA) ; après un remboursement total, forfait
  complet au prix catalogue, sans code promo.
- **Code promo** : la remise s'applique au **premier paiement** de l'événement
  seulement ; les paiements complémentaires sont au prix catalogue. Une remise
  ne dépasse **jamais 15 %** du montant, sur tous les paliers et sur devis (un
  code à montant fixe est plafonné à 15 % du total) ; contrôle côté serveur
  (décision du 2026-10-20, pour garder une marge positive dans le pire cas de
  coût WhatsApp, `06-trd.md` § 2.4).

### 7.2 Limite d'invitations et décompte « +1 »
- Le nombre d'invitations **envoyées** est **limité par le plafond** de
  l'événement (places payées, plus 10 si l'essai gratuit a été utilisé,
  § 7.4). L'ajout d'invités dans la liste n'est pas limité après un paiement
  (§ 7.5). Après un remboursement, voir § 7.12 (total : aucun envoi ; partiel :
  les invités déjà envoyés restent servis même au-delà du nouveau plafond).
- Une invitation **« Nom + 1 » compte pour 2 invités** dans le décompte du
  forfait (et dans le prix).

### 7.3 Paiement avant l'envoi
- Aucun envoi d'invitation n'est possible tant que le forfait n'est pas **payé et
  confirmé**, sauf dans la limite de l'**essai gratuit** (§ 7.4) ; après un
  remboursement total, aucun envoi, même si l'essai avait été utilisé
  (§ 7.12).

### 7.4 Essai gratuit
- **10 invités offerts**, limités à **un essai par numéro de téléphone vérifié**.
- Un organisateur inscrit par email doit **vérifier un numéro WhatsApp** pour
  accéder à l'essai.
- **Pendant l'essai** (aucun forfait payé), le plafond est strict : l'ajout
  d'un 11e invité est **refusé** ; il faut payer un forfait.
- **Bonus fixe** (décision du 2026-10-20) : si un forfait est payé ensuite, les
  10 invitations offertes **s'ajoutent** aux places payées
  (plafond = places payées + 10 ; ex. forfait 50 → 60 invités, puis passage au
  forfait 100 → 110). Le prix, le choix entre les deux options (§ 7.1) et les
  remboursements (§ 7.12) se calculent sur les **places payées** seulement.
- L'essai n'est proposé **qu'avant tout paiement** de l'événement : il ne
  s'active pas sur un événement déjà payé (décision du 2026-10-20).
- L'essai est **refusé si la liste compte déjà plus de 10 places** :
  l'organisateur retire des invités ou choisit un forfait (décision du
  2026-10-21).

### 7.5 Ajout d'invités au-delà du plafond
Règle du 2026-10-20 :
- Avant le premier paiement (hors essai), l'ajout d'invités est libre ; aucun
  envoi n'est possible (§ 7.3).
- Après un paiement, l'ajout d'invités reste **libre**, même au-delà du
  plafond. Les invités **en excédent** — parmi les invités **dont l'invitation
  n'est pas encore partie**, les **derniers ajoutés** au-delà du plafond, dans
  l'ordre d'ajout (le « +1 » compte pour 2) — sont marqués **« en attente de
  paiement »** : ils ne reçoivent **rien** (invitation, relances, messages)
  tant que le complément n'est pas payé. Tous les autres invités continuent de
  recevoir normalement.
- Un invité **déjà envoyé** n'est **jamais** en excédent : il garde son QR,
  ses relances et les notifications (décision du 2026-10-20).
- Le complément se paie par **passage au palier supérieur** ou **ajout au prix
  unitaire du palier** (§ 7.1) ; une fois payé, les invités en excédent
  deviennent envoyables.
- Cette règle ne s'applique pas pendant l'essai seul (§ 7.4). Elle s'applique
  aussi après un **remboursement partiel** (§ 7.12).

### 7.6 RSVP, changement d'avis et clôture
- L'invité répond **« présent »** ou **« ne pourra pas venir »**.
- Il **ne peut pas** ajouter d'accompagnant ni modifier le nombre de places.
- S'il a décliné, il peut **changer d'avis et confirmer plus tard**, tant que
  l'organisateur **n'a pas clôturé** les réponses.
- Après **clôture** (bouton dédié), plus aucune modification de réponse possible.

### 7.7 Table visible seulement après le scan
- L'invité voit sa table (nom ou numéro, selon le choix de l'organisateur)
  **uniquement après le scan** de son QR code à l'entrée. Le numéro de table
  **n'est pas visible avant** le scan.

### 7.8 Règles d'entrée et mode strict
- Le scan se fait **en ligne** (pas de mode hors ligne).
- **Invitation individuelle** → **1 entrée**.
- **Invitation avec accompagnant** → **2 entrées, un seul QR code**. L'invité
  principal peut entrer seul (état « 1/2 arrivé »). L'accompagnant **ne peut pas
  entrer sans l'invité principal** (déjà présent ou arrivant en même temps).
- **Mode strict** (réglage optionnel de l'organisateur) : l'entrée n'est validée
  **que si les deux personnes sont présentes ensemble**.
- L'écran de scan affiche clairement l'état : « 1/2 arrivé », « déjà entré »,
  « refusé : invité principal absent », ainsi que la table de l'invité.
- Pour une invitation avec accompagnant, après le scan, l'équipe d'accueil
  indique qui entre : **« Les deux »**, **« Invité principal seul »** ou
  **« Accompagnant seul »** (en mode strict, seul « Les deux » est proposé au
  premier passage).
- **Invité non confirmé ou ayant décliné** : l'entrée est **acceptée** avec la
  mention « n'avait pas confirmé » ou « avait décliné » ; sa réponse passe
  automatiquement à « présent ».
- **Invité sans son QR code** (téléphone perdu, batterie vide) : l'équipe
  d'accueil **n'a jamais accès à la liste des invités** et ne peut pas le
  rechercher. Elle le renvoie vers l'organisateur, qui peut **afficher le QR de
  cet invité** depuis son espace pour qu'il soit scanné.

### 7.9 Modification de la date ou du lieu après l'envoi
- Date et lieu restent **modifiables à tout moment**.
- Le mini-site se met à jour **pour tous les invités** ; une **notification
  WhatsApp de changement** est envoyée aux invités ; les QR codes restent valides.
- La notification est envoyée à **tous les invités sauf ceux qui ont décliné** ;
  plusieurs modifications dans la même heure donnent une seule notification ;
  elle ne compte pas dans le quota de messages (§ 7.10). Coût : ~2,4 FCFA
  (message utilitaire), budgété à 13,5 FCFA par prudence (`06-trd.md` § 2.2).

### 7.10 Relances
- Relances **automatiques** des invités sans réponse : **2 au maximum**, à
  **J+3** après l'envoi puis à **J-7** avant l'événement. **Événement à 10
  jours ou moins de l'envoi** (décision du 2026-10-20) : **une seule** relance, à
  J+3, et seulement si elle tombe avant le jour de l'événement. Une relance
  est annulée si l'invité a répondu, si les RSVP sont clôturés ou si
  l'organisateur a désactivé les relances.
- L'organisateur peut aussi envoyer des **messages groupés ou individuels**
  (remerciement compris), choisis parmi des **modèles fixes** : **quota de 3
  messages par invité**, en plus de l'invitation, du QR code, des relances
  automatiques et des notifications de changement.
- **Renvoi de l'invitation** (décision du 2026-10-20) : **un renvoi gratuit**
  par invité, hors quota, seulement après un **échec de livraison** ou un
  **changement de numéro** ; au-delà, chaque renvoi compte dans le quota de 3.
  Le lien et le QR restent les mêmes.

### 7.11 Codes promo et liens de suivi
- Chaque code : soit une **remise** au client (pourcentage ou montant fixe),
  **15 % au maximum** (§ 7.1), soit un **simple suivi de canal sans remise**.
- Paramètres d'un code : durée, limite d'utilisation, canal ou influenceur
  rattaché.
- **Influenceur** : simple **fiche** (nom, réseau, contact) à laquelle on
  rattache des codes et des liens de suivi. Les **versements** aux
  influenceurs se font **entièrement hors de Convivia** et n'y sont pas
  enregistrés.
- Stats par code : utilisations, inscriptions, paiements, revenu généré, remise
  accordée, revenu net, taux de conversion, panier moyen.
- **Lien de suivi** en complément du code, pour capter aussi ceux qui s'inscrivent
  sans payer tout de suite.
- Pour comparer deux influenceurs équitablement, leur donner le **même type de
  code**.
- **Attribution** : le lien de suivi est mémorisé **30 jours** et rattaché
  définitivement au compte à l'inscription (compte les inscriptions) ; au
  paiement, le **code saisi l'emporte** sur le lien pour l'attribution de
  l'événement. Le revenu des paiements complémentaires reste attribué au même
  code.

### 7.12 Remboursement
- **Aucun remboursement** une fois le paiement effectué.
- Le remboursement reste un **acte exceptionnel et manuel**, réservé au rôle
  **finance**, et tracé pour les exports comptables.
- Il est **enregistré dans Convivia** puis **exécuté hors de l'application** :
  tableau de bord FedaPay pour MTN Mobile Money (seul moyen remboursable par
  FedaPay aujourd'hui), transfert mobile money manuel pour les autres moyens ;
  la référence de l'opération est saisie dans Convivia.
- **Remboursement total** : l'événement repasse en **brouillon**, plus aucun
  envoi possible ; les liens et QR déjà envoyés restent valides. Si l'essai
  gratuit avait été utilisé, les 10 places offertes sont **gardées pour plus
  tard** : elles ne resservent que si l'organisateur paie de nouveau un
  forfait (plafond = places payées + 10, § 7.4) ; d'ici là, aucun envoi
  (décision du 2026-10-20).
  **Remboursement partiel** : le nombre de **places payées** est réduit en
  proportion (le bonus de l'essai n'est pas touché) ; on applique ensuite la
  règle du dépassement (§ 7.5) : seuls les invités en excédent, pas encore
  envoyés, sont « en attente de paiement » ; les invités déjà servis gardent
  QR, relances et notifications (décision du 2026-10-20).
- L'organisateur voit dans son historique de paiement le **montant**, le
  **statut** et la **date** de ses remboursements, mais **pas le motif
  interne** saisi par la finance.

### 7.13 Conservation des données des invités
- Nom et numéro WhatsApp des invités conservés **jusqu'à la suppression de
  l'événement ou du compte** par l'organisateur, et **suppression sur demande**.
- Pas de purge automatique à délai fixe. Les **statistiques agrégées** (présence,
  RSVP) sont conservées.
- **Suppression d'un événement ou d'un compte, même payé** : les données
  personnelles sont effacées (invités, coordonnées, photos, QR, tables,
  réponses, contenus ; pour un compte, aussi le nom, l'e-mail et le numéro de
  l'organisateur). Sont **conservés**, sans donnée personnelle : les
  **paiements** et **remboursements** (obligations comptables, affichés
  « organisateur supprimé »), les **coûts WhatsApp** de l'événement (marge),
  les **statistiques agrégées**, l'**empreinte** du numéro ayant utilisé
  l'essai gratuit (un seul essai par numéro, § 7.4) et la **liste
  d'exclusion** WhatsApp (§ 7.14). Détail : `07-schema-backend.md` § 16.

### 7.14 Consentement des invités aux messages WhatsApp
- À l'ajout de chaque invité, l'organisateur **atteste** que l'invité accepte de
  recevoir son invitation par WhatsApp (attestation horodatée).
- Chaque message indique « de la part de [organisateur], via Convivia » et les
  messages marketing portent un bouton **« Ne plus recevoir »**.
- Un invité qui l'utilise (ou répond STOP, ou bloque le numéro) entre dans une
  **liste d'exclusion commune à toute la plateforme** : il ne reçoit plus aucun
  message, quel que soit l'organisateur. L'organisateur en est informé et peut
  lui transmettre le lien lui-même.

## 8. Hors MVP

Explicitement **non construit** au lancement :
- Offre destinée aux **professionnels** (wedding planners, salles, traiteurs).
- **Options payantes** supplémentaires (packs d'invités).
- **Templates et enveloppes premium** (payants).
- **Commission automatique** des influenceurs (envisagée plus tard) et
  **enregistrement des versements** aux influenceurs (faits hors de
  l'application).
- Import de liste d'invités (ajout **manuel uniquement**).
- **Mode hors ligne** pour le scan à l'entrée.

## 9. Points encore ouverts (hors périmètre de décision du PRD)

Ces points n'ont pas d'incidence sur les règles ci-dessus mais restent à confirmer
en aval :
- Conditions d'encaissement FedaPay en Côte d'Ivoire, au Togo et au Sénégal
  (compte marchand, commissions) — à confirmer par écrit auprès de FedaPay,
  voir `06-trd.md` § 3.4.
- Création de la société porteuse (prérequis de FedaPay en mode réel et de la
  vérification d'entreprise Meta) — `06-trd.md` § 17.
- Références visuelles et emplacements photos des 12 templates et 3 styles
  d'enveloppe — `05-templates-enveloppes.md`.
- Vérification du nom Convivia (domaine, réseaux sociaux, marque OAPI).
