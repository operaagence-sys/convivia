# 04 — Design system Convivia

> Design system de **l'application** (organisateur, invité, équipe d'accueil,
> administration). Les **ambiances des templates d'invitation** (mariage, dot,
> baptême, anniversaire, sortie d'enfant, autre) ont leur propre identité
> visuelle, définie à part dans `05-templates-enveloppes.md` — elles ne suivent
> **pas** ce design system. Source amont : `01-prd.md`, `02-app-flow.md`,
> `03-sections-composants.md`, moodboard `docs/inspiration/app/`.

**Règle d'ensemble** : conçu **mobile-first** pour les faces organisateur,
invité et équipe d'accueil. Seule la face **administration** est pensée
**desktop-first**.

> Les valeurs hexadécimales et l'échelle typographique ci-dessous sont une
> **proposition de point de départ** cohérente avec les choix de direction que
> tu as validés (personnalité, accent, radius, boutons, champs, cartes). Ce
> sont des valeurs à ajuster librement — rien n'est figé dans le code à ce
> stade.

---

## 1. Personnalité visuelle

**Élégant · sobre · moderne**

Esthétique SaaS épurée : fond clair, peu de couleur en dehors de l'accent et
des états, typographie soignée qui porte l'essentiel du style. La couleur et
la chaleur du produit viennent des **templates d'invitation** (étape 6), pas
de l'habillage de l'application elle-même — l'application doit rester un
outil clair et digne de confiance (paiement, données des invités).

---

## 2. Couleurs

### 2.1 Accent (marque)

| Token | Usage | Valeur proposée |
|---|---|---|
| `accent-600` | Boutons primaires, liens actifs, focus, sélection | `#4F46E5` (indigo) |
| `accent-500` | Hover sur fond clair, icônes actives | `#6366F1` |
| `accent-700` | Hover/active sur bouton primaire | `#4338CA` |
| `accent-100` | Fond de puce KPI, fond de sélection légère | `#E0E7FF` |

> Choisi violet/indigo plutôt que vert pour éviter toute confusion avec les
> actions WhatsApp natives (boutons verts du système).

### 2.2 Neutres & fond

| Token | Usage | Valeur proposée |
|---|---|---|
| `bg-page` | Fond de toutes les pages | `#F7F7F9` |
| `bg-surface` | Cartes, modales, barres de navigation | `#FFFFFF` |
| `border-subtle` | Bordure de carte, séparateurs | `#E5E5EA` |
| `text-primary` | Titres, texte principal | `#17171C` |
| `text-secondary` | Texte secondaire, légendes | `#6B6B76` |
| `text-disabled` | Texte désactivé, placeholder | `#AFAFBA` |

### 2.3 Couleurs sémantiques (4)

| Token | État | Valeur proposée | Fond pastel associé |
|---|---|---|---|
| `success` | Succès, confirmé, entrée validée | `#16A34A` | `#DCFCE7` |
| `error` | Erreur, refusé, échec | `#DC2626` | `#FEE2E2` |
| `warning` | Attention, en attente, sans réponse | `#D97706` | `#FEF3C7` |
| `info` | Information, chargement, en cours | `#2563EB` | `#DBEAFE` |

> **Texte sur fond pastel (variantes « ink »)** — décision du porteur du
> projet, 2026-10-21 : pour un contraste suffisant, un texte posé sur le fond
> pastel d'un état utilise la variante foncée de sa couleur : `success-ink`
> `#166534`, `error-ink` `#991B1B`, `warning-ink` `#92400E`, `info-ink`
> `#1E40AF` (tokens `--color-*-ink`). Ce ne sont pas de nouvelles couleurs
> sémantiques, seulement la teinte de texte de chacune des 4.

> Limité à 4 couleurs sémantiques (pas de palette à 6 teintes). Le **gris**
> (`text-secondary` / `border-subtle`) sert pour les états neutres/clôturés,
> ce n'est pas une 5e couleur sémantique.

---

## 3. Typographie

**Police unique : Plus Jakarta Sans** (titres et corps de texte).

| Style | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| H1 | 28px / 36px | 700 | Titre de page (mobile) |
| H2 | 22px / 28px | 700 | Titre de section |
| H3 | 18px / 24px | 600 | Titre de carte, sous-section |
| Corps | 16px / 24px | 400 | Texte par défaut |
| Corps petit | 14px / 20px | 400 | Texte secondaire, cellules de tableau (admin) |
| Légende | 12px / 16px | 500 | Badges, labels, texte d'aide |

> Sur l'admin desktop, H1 peut monter à 32px en en-tête de tableau de bord ;
> le corps petit (14px) devient la taille par défaut des tableaux de données
> pour rester compact.

---

## 4. Espacement

Échelle de base **4px** : `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

- **Mobile (organisateur, invité, accueil)** : densité **aérée**. Zones
  tactiles ≥ 44px de hauteur, padding de carte 16–24px, espacement entre blocs
  16–24px.
- **Admin desktop** : densité **compacte**. Lignes de tableau 36–44px, padding
  de carte 12–16px, espacement entre éléments 8–12px — pour afficher plus de
  données à l'écran.

---

## 5. Arrondis (border-radius)

Échelle **modérée**, cohérente avec « sobre » (pas de boutons en pilule) :

| Token | Valeur | Usage |
|---|---|---|
| `radius-sm` | 8px | Champs de formulaire, petits boutons, badges/puces |
| `radius-md` | 10–12px | Boutons standards, cartes de composant (carte d'invité, carte de forfait) |
| `radius-lg` | 14–16px | Cartes de section, modales |
| `radius-full` | cercle | Avatars, puces d'icône KPI, points d'état |

---

## 6. Boutons

| Variante | Fond | Texte | Bordure | Usage |
|---|---|---|---|---|
| **Primaire** | `accent-600` plein (sans dégradé) | Blanc | — | Action principale (payer, envoyer, confirmer) |
| **Secondaire** | Blanc | `accent-600` | 1px `accent-600` | Action alternative (annuler, retour) |
| **Danger** | `error` plein | Blanc | — | Action destructive (supprimer, révoquer) |
| **Fantôme** | Transparent | `accent-600` | — | Lien d'action, action tertiaire |

**États** : normal · hover (`accent-700`) · focus (anneau 2px `accent-100`) ·
chargement (spinner, libellé masqué) · désactivé (fond `border-subtle`, texte
`text-disabled`).

**Hauteur** : 44px mobile (zone tactile), 36–40px admin desktop.
**Radius** : `radius-md`.

---

## 7. Champs de formulaire

**Style rempli** : fond gris clair, pas de bordure visible au repos.

| État | Fond | Bordure | Texte |
|---|---|---|---|
| Repos | `#F2F2F5` | aucune | `text-primary` / placeholder `text-disabled` |
| Focus | `#F2F2F5` | 2px `accent-600` | `text-primary` |
| Erreur | `#FEF2F2` | 1px `error` | `error` (+ message d'aide sous le champ) |
| Désactivé | `#F7F7F9` | aucune | `text-disabled` |

**Radius** : `radius-sm`. Label au-dessus du champ (pas de label flottant).
S'applique aux champs texte, numéro de téléphone, code OTP (cases séparées),
sélecteurs, date-heure. Les interrupteurs (mode strict, relances auto) suivent
le même accent : `accent-600` à l'état activé, gris au repos.

---

## 8. Cartes

**Style bordure fine, sans ombre** — partout (mobile et admin), pour rester
cohérent avec la direction sobre et bien se comporter dans les listes/tableaux
denses de l'admin.

- Fond `bg-surface` (blanc), bordure 1px `border-subtle`, `radius-lg`.
- Pas d'ombre portée.
- Variante **accent de statut** : liseré de 3–4px sur le bord gauche, coloré
  selon l'état sémantique (ex. carte de table incomplète en `warning`) —
  usage ponctuel, pas systématique.

---

## 9. Icônes

- **Style** : trait fin (outline, 1.5–2px), 20–24px mobile / 16–20px admin.
- **Navigation** (barre inférieure mobile, barre latérale admin) : icônes
  outline seules, pas de fond.
- **Tuiles KPI** : icône dans une **puce ronde pastel** (`radius-full`, ~40px),
  couleur de fond = version pastel de la couleur sémantique ou de l'accent
  associée à l'indicateur (ex. revenu → pastel accent, taux d'erreur → pastel
  `error`).

---

## 10. Navigation

- **Mobile** (organisateur, invité, accueil) : barre de navigation inférieure
  fixe, icônes outline + libellé court, item actif en `accent-600`.
- **Admin desktop** : barre latérale fixe, icônes outline + libellé, item actif
  avec fond `accent-100` et texte `accent-700`.
- **En-tête de page** : titre (H1/H2) + actions à droite ; sur mobile, actions
  secondaires repliées dans un menu.

---

## 11. Description visuelle des sections du catalogue

> Référence croisée avec `03-sections-composants.md`. Chaque entrée applique
> les tokens ci-dessus ; seules les nuances propres à la section sont notées.

### 11.1 Face organisateur (mobile)

| Section | Description visuelle |
|---|---|
| Écrans d'authentification | Fond `bg-page`, carte blanche centrée, champs remplis, bouton primaire pleine largeur. Pas de bloc héros illustré (contrairement à auth-screens du moodboard) — rester sobre. |
| Liste des événements | Grille 1 colonne de cartes d'événement (bordure fine), badge d'état en haut à droite de chaque carte, CTA « Nouvel événement » en bouton primaire flottant ou en en-tête. |
| Création d'événement | Formulaire simple en carte unique, champs remplis empilés, sélecteur de type en grille de 6 puces (icône + libellé). |
| Tableau de bord d'un événement | En-tête carte (nom, date, lieu, badge d'état) puis grille de tuiles de navigation 2 colonnes (icône outline + libellé), chaque tuile = carte `radius-md`. Le jour J, un bloc « Arrivées en direct » (compteurs entrés / 1-2 arrivés / restants, mêmes tuiles KPI que les statistiques) s'insère entre l'en-tête et la grille (TRD D31). |
| Sélecteur de design | Vignettes de template en grille 2 colonnes (ratio portrait), sélection = bordure `accent-600` 2px. Enveloppes en ligne de 3 vignettes rondes/carrées sous le template. |
| Éditeur de contenu & photos | Formulaire long en sections repliables (accordéon), téléverseur de photos en grille d'emplacements avec bordure pointillée au repos. |
| Gestion des invités | Formulaire d'ajout en carte fixe en haut (ou modale), liste de cartes d'invité en dessous, compteur en barre de progression (`accent-600` jusqu'au plafond, `warning` si proche du plafond, `warning` plein + nombre d'invités « en attente de paiement » si dépassé après paiement, PRD § 7.5). Les cartes d'invités en excédent portent une puce `warning` « en attente de paiement ». |
| Sélecteur de forfait | Cartes de forfait empilées, carte sélectionnée en bordure `accent-600` + coche. Carte « essai gratuit » et carte « devis » visuellement distinctes (fond `accent-100` léger). |
| Écran de paiement | Carte de récapitulatif sobre, montants en gros corps (H2), bouton primaire « Payer avec FedaPay » pleine largeur, état succès avec icône `success` grand format. |
| Aperçu avant envoi & envoi | Aperçu encadré (simulateur de téléphone), sous lui un récapitulatif chiffré, bascule immédiat/programmé en segmented control, bouton primaire. |
| Tableau de bord des RSVP | 4 tuiles de stats en grille 2×2 en haut (une par état sémantique : confirmée=`success`, refusée=`error`, sans réponse=`warning`, ouverte=`info`), liste de cartes d'invité avec puce d'état en dessous. |
| Relances | Interrupteur en tête de carte, liste de sélection d'invités (cases à cocher), zone de composition de message en bas, historique en liste compacte. |
| Gestion des tables | Cartes de table en grille, glisser-déposer des cartes d'invité à l'intérieur ; regroupement famille signalé par un sous-en-tête de couleur neutre dans la carte. |
| Équipe d'accueil (préparation) | Carte unique centrée avec le code en gros caractères (H1, espacé), bouton copier, interrupteur mode strict en dessous. |
| Après l'événement | Tuiles KPI (puces colorées), graphe d'arrivées simple (courbe/barres), zone de composition du message de remerciement en bas de page. |
| Paramètres du compte | Liste d'options type réglages (icône + libellé + chevron), action de suppression isolée en bas, en bouton danger fantôme. |

### 11.2 Face équipe d'accueil (mobile)

| Section | Description visuelle |
|---|---|
| Rejoindre un événement | Carte centrée verticalement, champ code en grands caractères espacés (type OTP), bouton primaire « Rejoindre ». |
| Écran de scan | Plein écran, viseur caméra dominant, résultat affiché en **bandeau plein écran coloré** selon l'état (fond pastel `success`/`error`/`warning`) avec icône et texte en grand (H2), table de l'invité affichée juste en dessous. Priorité à la lisibilité en extérieur/basse luminosité. |
| Suivi des arrivées en direct | 3 compteurs en tuiles en haut (entrés/1-2 arrivés/restants), liste chronologique compacte en dessous (type flux), pas de photo ni coordonnées. |

### 11.3 Face administration (desktop)

| Section | Description visuelle |
|---|---|
| Connexion admin | Carte centrée sur fond `bg-page`, sans bloc héros — plus sobre que les refs du moodboard (admin-login, auth-screens) qui utilisent un dégradé coloré. |
| Tableau de bord principal | Barre latérale fixe + grille de tuiles KPI (puces colorées) en haut, graphiques/tableaux en dessous. Très proche de l'esprit Saledash/Niond du moodboard, en version bordure fine sans ombre. |
| Entonnoir de conversion | Graphe d'entonnoir horizontal ou vertical, chaque étape = barre avec volume et taux de passage affiché en légende, filtres en barre au-dessus. |
| Qualité d'usage & répartition | Mix de tuiles KPI et de graphiques de répartition (barres par pays/type), table géographique simple (pas de carte interactive au MVP sauf décision contraire). |
| Codes promo & influenceurs | Table de données dense (bordure fine, lignes compactes) pour la liste des codes ; formulaire de création en panneau latéral ou modale ; stats par code en cartes résumé au-dessus de la table détaillée. |
| Finances | Table de transactions dense, tuiles de marge/revenu en haut, action de remboursement en bouton danger dans une ligne (avec confirmation modale). |
| Gestion événements & utilisateurs | Barre de recherche + filtres en haut, table de données dense, fiche de détail en panneau latéral au clic. |
| Contenu (templates & enveloppes) | Grille de vignettes de template par type (admin only), éditeur d'emplacements en vue superposée simple — rendu visuel détaillé renvoyé à l'étape 6. |
| Réglages plateforme | Formulaire de grille de prix en table éditable, liste des comptes admin avec puces de rôle (une couleur par rôle, cohérente avec la palette sémantique/accent). |

---

## 12. Composants réutilisables métier

| Composant | Description visuelle |
|---|---|
| Formulaire d'ajout d'invité | Carte ou modale, champs remplis empilés, bascule individuelle/+1 en segmented control. |
| Carte d'invité | Ligne compacte : nom (corps 16px), puce d'état RSVP à droite, sous-texte table/type en corps petit. |
| Carte d'événement | Carte verticale, badge d'état en haut, nom en H3, date/lieu en corps petit `text-secondary`. |
| Carte de forfait | Carte avec nombre d'invités en H2, prix unitaire et total en dessous, état sélectionné = bordure `accent-600`. |
| Tuiles de stats RSVP | 4 mini-cartes carrées, chiffre en H2, libellé en légende, couleur de fond pastel par état. |
| Puce d'état RSVP | Badge pilule, fond pastel + texte de la couleur sémantique correspondante (confirmée=`success`, refusée=`error`, sans réponse=`warning`, ouverte=`info`). |
| Carte de table | Carte avec nom/numéro en H3, liste d'invités en corps petit, compteur de capacité en légende. |
| Tuile KPI | Puce d'icône colorée + valeur en H2 + libellé en légende + variation optionnelle (flèche `success`/`error`). |
| Téléverseur de photos | Zone à bordure pointillée, icône + texte au repos ; aperçu miniature + bouton remplacer une fois rempli. |
| Badge de résultat de scan | Bandeau pleine largeur, fond pastel sémantique, icône + texte en grand. |
| Badge d'état d'événement | Badge pilule discret, couleur neutre (brouillon/programmé) ou sémantique (payé=`success`, clôturé=gris). |
| Graphe d'entonnoir | Barres horizontales dégressives, taux de passage affiché entre chaque étape. |
| Table de statistiques de code promo | Table de données dense, mêmes règles que les tables admin. |

---

## 13. Références visuelles manquantes

État du dossier `docs/inspiration/app/` : **20 dossiers renseignés / 39**. Les
**19 dossiers encore vides** ci-dessous, groupés par priorité (reprend les
tiers de `03-sections-composants.md` § 6) :

**Priorité haute**
- `rsvp-dashboard`, `rsvp-status-chip`
- `guest-manager`, `guest-form`, `guest-card`
- `package-selector`
- `content-editor`, `photo-uploader`
- `send-preview`
- `scan-screen`, `scan-result-badge`
- `tables-manager`, `table-card`

**Priorité moyenne**
- `events-list`
- `post-event-stats`
- `funnel-chart`
- `usage-quality`
- `platform-settings`

**Priorité basse**
- `scan-join`

> Ces dossiers n'ont aucune image pour l'instant : les descriptions visuelles
> correspondantes au § 11 sont des **propositions déduites du système**, pas
> encore confrontées à une référence. À prioriser en premier pour valider ou
> ajuster le système avant de passer aux maquettes.
