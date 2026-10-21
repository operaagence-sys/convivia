# 05 — Templates & enveloppes Convivia

> Définit les **12 templates** (2 par type d'événement) et les **3 styles
> d'enveloppe** partagés entre les types. Ce document a sa **propre identité
> visuelle**, distincte du design-system de l'application
> (`04-design-system.md`) — voir l'intro de ce dernier. Source amont :
> `00-synthese-convivia.pdf` (§ 7), `01-prd.md` (§ 5).
>
> État des références visuelles : `docs/inspiration/templates/` et
> `docs/inspiration/enveloppes/` sont **vides à ce stade** — les choix
> ci-dessous sont posés sans confrontation à des références collectées, à
> valider/ajuster dès que des images seront déposées.

---

## 1. Base technique commune (tous les templates)

Seule cette base technique est commune aux 12 templates. Mise en page, polices,
couleurs, ornements et animation de l'enveloppe restent **fixes par template**
et sont détaillés au § 3.

### 1.1 Structure de page (ordre des sections)

Après ouverture de l'enveloppe (§ 1.2), le mini-site déroule les sections dans
cet ordre fixe :

1. **En-tête** — nom de l'événement, date, lieu (court, toujours visible en
   haut).
2. **Message d'invitation** — texte personnalisé de l'organisateur + une photo
   clé (l'émotion avant les détails pratiques).
3. **Programme** — étapes horaires de la journée/cérémonie.
4. **Galerie photos** — emplacements définis par template (§ 3).
5. **Infos pratiques** — lieu détaillé, dress code, informations
   complémentaires.
6. **Bloc RSVP** — voir § 1.3.

**QR code** : affiché dans la continuité du bloc RSVP **dès l'ouverture**,
quelle que soit la réponse de l'invité (créé à l'envoi, `01-prd.md` § 6.10) ;
renvoyé en image par WhatsApp après confirmation.
Après le scan le jour J : **table** révélée au même endroit (jamais visible
avant, cf. `01-prd.md` § 7.7).

### 1.2 Enveloppe animée

- **Déclenchement** : **autoplay**. Dès le chargement de la page, l'enveloppe
  fermée (avec le nom de l'invité, « Cher/Chère [Nom] ») s'affiche
  immédiatement — y compris si le reste charge encore, pour que l'invité voie
  tout de suite que son invitation arrive. Après une courte pause (~0,5 s),
  l'animation d'ouverture se joue automatiquement, puis révèle l'invitation.
- Cette ouverture déclenche l'enregistrement du statut RSVP **« ouverte »**.
- **3 styles au lancement**, partagés entre les 6 types d'événement, détaillés
  au § 2. Les couleurs de l'enveloppe s'adaptent automatiquement à la palette
  du template choisi ; le nom de l'invité apparaît sur chaque style.

### 1.3 Boutons RSVP

- **Barre fixe en bas d'écran** (sticky), visible dès que l'invité consulte le
  mini-site : « Je serai présent » / « Je ne pourrai pas venir ».
- **Section RSVP dédiée** en fin de page (§ 1.1, étape 6), reprenant le même
  choix en grand, avec un message d'accroche propre à chaque template (ton
  cohérent avec son ambiance).
- **États** (le QR code reste affiché sous le bloc RSVP dans tous les états) :
  *Sans réponse* (barre + section actives, les deux boutons proposés) ;
  *Confirmé* (« Présence confirmée » à la place du choix, QR mis en avant,
  barre masquée ou remplacée par un rappel discret) ; *Refusé* (bouton « Finalement
  présent » proposé tant que non clôturé) ; *Clôturé* (boutons désactivés,
  message « Réponses clôturées »).

### 1.4 Poids de page et performance (ouverture rapide sur téléphone d'entrée de gamme)

- **Budget critique (avant/pendant l'ouverture de l'enveloppe, avant tout
  scroll) : < 1 Mo**, répartition indicative :
  - HTML/CSS/JS critique : ~200 Ko
  - Police web (sous-ensemble des graisses utilisées) : ~60 Ko
  - Animation d'enveloppe (§ 2) : ~600 Ko
  - Marge : ~140 Ko
- **Au-delà du critique** : toutes les photos (galerie, message, infos
  pratiques) sont **chargées en différé (lazy loading)** au fur et à mesure du
  scroll — pas de budget total fixe sur la page complète.
- **Format des images** : formats modernes compressés (WebP/AVIF), plusieurs
  résolutions servies selon l'écran (responsive images).
- **Pas de vidéo** dans le chargement critique ; aucune vidéo en autoplay.

### 1.5 Image d'aperçu du lien dans WhatsApp (Open Graph)

- **Une image par template** (pas par invité), générée avec les données de
  l'organisateur : visuel/ambiance du template en fond, nom de l'événement et
  date incrustés.
- **Jamais** le nom de l'invité ni une photo personnelle dans cet aperçu — la
  personnalisation reste réservée à l'ouverture de l'enveloppe (effet de
  surprise préservé).
- Dimensions standard **1200 × 630**.

---

## 2. Styles d'enveloppe (3, partagés entre tous les types)

> Les couleurs de chaque style s'adaptent automatiquement à la palette du
> template choisi par l'organisateur. Le nom de l'invité apparaît sur
> l'enveloppe fermée, avant l'animation. *(Quels styles deviendront premium
> plus tard : décision commerciale hors périmètre de ce document.)*

### 2.1 Carte qui se déplie

- Carte pliée en deux (façon faire-part/livret), fermée, nom de l'invité en
  couverture. Animation de dépliage (type origami léger) qui révèle
  l'invitation à plat, pleine page.
- **Registre** : sobre, moderne. Fonctionne pour tous les types, y compris
  « Autre ».

### 2.2 Rideau de particules

- Écran fermé en couleur d'accent du template + nom de l'invité. Un voile de
  particules s'écarte/s'envole pour révéler l'invitation derrière.
- **Nature des particules adaptée au template** : pétales fins (mariage,
  sortie d'enfant), confettis (anniversaire), motifs discrets ou lumière douce
  (baptême, dot, autre).
- **Registre** : festif, vivant.

### 2.3 Enveloppe à ruban

- Enveloppe papier fermée par un ruban noué (couleur accent du template). Le
  ruban se dénoue et glisse hors champ, puis le rabat de l'enveloppe s'ouvre
  pour révéler l'invitation.
- **Registre** : élégant, cérémoniel, texture « textile » — cohérent en
  particulier avec mariage et dot, reste utilisable pour les autres types.

---

## 3. Templates par type d'événement

> Un bloc par type, chacun avec ses 2 templates (variante classique / variante
> moderne de la même ambiance). Les valeurs hexadécimales sont une
> **proposition de point de départ** (même logique que `04-design-system.md`),
> à ajuster librement.

### 3.1 Mariage — romantique et élégant

Ambiance commune aux deux variantes : fond ivoire, or, typographie raffinée,
filets dorés, fleurs fines. Les deux variantes divergent par leur **couleur
d'accent**, leurs **ornements** et leur **mise en page**.

#### Variante Classique

| Élément | Valeur |
|---|---|
| Fond | ivoire `#FBF6EC` |
| Or (filets, cadres) | `#C9A227` |
| Accent | rose poudré `#E8B4B8` |
| Texte | brun chaud `#3A2E22` |
| Titres | Cormorant Garamond |
| Noms des mariés | script (ex. Parisienne) |
| Corps de texte | Lato |
| Ornements | couronnes florales fines (coins de l'en-tête et du bloc RSVP), filets dorés sous les titres de section, cadre doré fin autour des photos |
| Mise en page | symétrique, centrée |

#### Variante Moderne

| Élément | Valeur |
|---|---|
| Fond | ivoire clair `#FFFDF9` |
| Or (filet seul, pas de cadre) | `#C9A227` |
| Accent | vert sauge `#9CAF88` |
| Texte | brun foncé `#2E2A22` |
| Titres | Fraunces |
| Corps de texte | Work Sans |
| Ornements | brins de feuillage en line art (motif unique répété), filet doré fin en séparateur de section |
| Mise en page | aérée, asymétrique (décalage des blocs, marges généreuses) |

#### Emplacements photos (5, communs aux deux variantes)

1. Photo du couple — en-tête/message, portrait 4:5, recadrage centré visage.
2–5. Galerie (4 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- **Côté marié / côté mariée** : champ interne à la gestion des invités et des
  tables (plan de salle, `01-prd.md` § 5.2) — **non affiché** sur le mini-site.
- Noms des mariés, hôtes/parents : texte libre dans le message d'invitation.

### 3.2 Dot — traditionnel, riche et respectueux

Ambiance commune aux deux variantes : tissus et pagnes, motifs africains bien
présents (wax/kente), or. Les deux variantes divergent par leur **couleur
dominante**, la **densité des motifs** et leur **mise en page**.

#### Variante Classique

| Élément | Valeur |
|---|---|
| Fond | crème chaud `#F7EEDF` |
| Dominante | bordeaux `#7B1E3A` |
| Or (filets, cadres épais) | `#C9A227` |
| Texte | brun très foncé `#2A1810` |
| Titres | Marcellus |
| Corps de texte | Lora |
| Ornements | motifs wax/kente **denses** en bordure et en fond de section, cadres épais autour des photos |
| Mise en page | symétrique, affirmée |

#### Variante Moderne

| Élément | Valeur |
|---|---|
| Fond | crème clair `#FBF8F3` |
| Dominante | indigo `#2C3E66` |
| Or (touches fines) | `#C9A227` |
| Texte | bleu-gris très foncé `#1F2430` |
| Titres | Spectral |
| Corps de texte | Work Sans |
| Ornements | motifs africains réinterprétés en **line art géométrique discret**, utilisés en touches ponctuelles (séparateurs, puces) plutôt qu'en fond |
| Mise en page | aérée, plus de blancs tournants |

#### Emplacements photos (5, communs aux deux variantes)

1. Photo du couple en tenue traditionnelle — en-tête/message, portrait 4:5,
   recadrage centré visage.
2–5. Galerie (4 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- **Côté marié / côté mariée** : champ interne à la gestion des invités et des
  tables (plan de salle, `01-prd.md` § 5.2) — **non affiché** sur le
  mini-site, comme pour le mariage (§ 3.1).
- Noms du couple, hôtes/parents : texte libre dans le message d'invitation.

### 3.3 Baptême — doux, lumineux et paisible

Ambiance commune aux deux variantes : lumière douce, touches dorées, symbole
discret de la foi (colombe). Les deux variantes divergent par leur **couleur
d'accent**, le **traitement du symbole** et leur **typographie**.

#### Variante Classique

| Élément | Valeur |
|---|---|
| Fond | blanc `#FFFFFF` |
| Accent | bleu ciel `#A9D1E8` |
| Or (touches) | `#C9A227` |
| Texte | gris bleuté foncé `#2B3240` |
| Titres | Cormorant Garamond |
| Corps de texte | Lato |
| Symbole | colombe en fine ligne (line art détaillé), présente dans l'en-tête et en filigrane léger derrière le bloc RSVP |
| Mise en page | centrée, douce, beaucoup de blanc |

#### Variante Moderne

| Élément | Valeur |
|---|---|
| Fond | crème `#FBF6EC` |
| Accent | or seul `#C9A227` (pas de bleu) |
| Texte | brun doux `#3A3228` |
| Titres | Quicksand |
| Corps de texte | Work Sans |
| Symbole | rayon de lumière / auréole abstraite en line art minimaliste (pas de colombe figurative) |
| Mise en page | aérée, asymétrique légère |

#### Emplacements photos (4, communs aux deux variantes)

1. Photo de l'enfant — en-tête/message, portrait 4:5, recadrage centré visage.
2–4. Galerie (3 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- Aucun au-delà du socle commun (`01-prd.md` § 5.2 : baptême = socle commun).
- Noms de l'enfant et des parents/parrain-marraine (le cas échéant) : texte
  libre dans le message d'invitation.

### 3.4 Anniversaire — festif et énergique

Ambiance commune aux deux variantes : couleurs vives, confettis, typographie
ludique. Les deux variantes divergent par leur **registre** (fête élégante
adulte vs fête pop) — l'organisateur choisit celui qui convient à son public.

#### Variante Classique (fête élégante)

| Élément | Valeur |
|---|---|
| Fond | bleu nuit `#1B2240` |
| Or | `#C9A227` |
| Accent vif | un accent au choix parmi une petite palette (ex. fuchsia `#D6336C`) |
| Texte | blanc cassé `#F7F5F2` |
| Titres | Baloo 2 (ludique mais tenue) |
| Corps de texte | Nunito |
| Ornements | confettis dorés discrets en bordure, filet doré en séparateur |
| Mise en page | symétrique, centrée |

#### Variante Moderne (fête pop)

| Élément | Valeur |
|---|---|
| Fond | blanc `#FFFFFF` |
| Blocs de couleurs vives | multicolore (jaune `#FFC43D`, turquoise `#2EC4B6`, fuchsia `#D6336C` — combinaison ajustable) |
| Texte | noir doux `#1A1A1A` |
| Titres | Baloo 2 (plus grand, plus coloré) |
| Corps de texte | Nunito |
| Ornements | confettis généreux en bordure et en fond de section |
| Mise en page | blocs de couleur pleine largeur, dynamique |

#### Emplacements photos (5, communs aux deux variantes)

1. Photo du fêté/fêtée — en-tête/message, portrait 4:5, recadrage centré
   visage.
2–5. Galerie (4 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- Aucun au-delà du socle commun (`01-prd.md` § 5.2 : anniversaire = socle
  commun).

### 3.5 Sortie d'enfant — tendre et chaleureux

Ambiance commune aux deux variantes : douceur, chaleur, présentation de
l'enfant à la famille. Les deux variantes divergent par leur **palette** et
leur **traitement graphique** (illustration figurative vs motifs en line art).

#### Variante Classique

| Élément | Valeur |
|---|---|
| Fond | blanc cassé `#FFFBF7` |
| Pastel dominant | rose poudré `#F3D1D1` |
| Pastel secondaire | jaune pâle `#FCE8B4` |
| Texte | brun doux `#3A3228` |
| Titres | Baloo 2 |
| Corps de texte | Quicksand |
| Ornements | petites illustrations douces en bordure (animaux, lune, étoiles) |
| Mise en page | centrée, douce |

#### Variante Moderne

| Élément | Valeur |
|---|---|
| Fond | beige clair `#F2E9DD` |
| Dominante | terracotta clair `#D99A7C` |
| Accent secondaire | ocre `#C9A227` |
| Texte | brun foncé `#332A22` |
| Titres | Fraunces |
| Corps de texte | Work Sans |
| Ornements | motifs africains délicats en line art (plutôt que figuratif) |
| Mise en page | aérée, épurée |

#### Emplacements photos (4, communs aux deux variantes)

1. Photo de l'enfant — en-tête/message, portrait 4:5, recadrage centré
   visage.
2–4. Galerie (3 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- Aucun au-delà du socle commun (`01-prd.md` § 5.2). Noms du couple et de
  l'enfant : texte libre dans le message d'invitation.

### 3.6 Autre — sobre et polyvalent

Catégorie généraliste : aucune thématique figurative (pas de symbole, pas de
motif) — reste neutre pour n'importe quel type d'événement non couvert. Les
deux variantes divergent par leur **couleur d'accent**, leur **typographie**
et leur **mise en page**.

#### Variante Classique

| Élément | Valeur |
|---|---|
| Fond | blanc `#FFFFFF` |
| Accent | bleu profond `#2C3E66` |
| Texte | gris très foncé `#1F2430` |
| Titres | Lora |
| Corps de texte | Lato |
| Ornements | filets fins comme seule décoration (pas de motif) |
| Mise en page | symétrique, centrée |

#### Variante Moderne

| Élément | Valeur |
|---|---|
| Fond | blanc `#FFFFFF` |
| Accent | terracotta `#C1623D` |
| Texte | gris très foncé `#1F2430` |
| Titres | Work Sans (graisse 700) |
| Corps de texte | Work Sans (graisse 400) |
| Ornements | aucun — blocs de couleur plats en guise de séparation |
| Mise en page | asymétrique, blocs pleine largeur |

#### Emplacements photos (4, communs aux deux variantes)

1. Photo principale — en-tête/message, portrait 4:5 **ou** paysage 3:2 (au
   choix de l'organisateur à l'upload).
2–4. Galerie (3 photos) — carré 1:1, recadrage centré.

#### Champs spécifiques

- Aucun au-delà du socle commun (`01-prd.md` § 5.2 : autre = catégorie
  généraliste).

---

## 4. Points ouverts

- **Aucune référence visuelle confrontée** : `docs/inspiration/templates/` et
  `docs/inspiration/enveloppes/` sont vides — tous les choix de ce document
  (palettes, ornements, polices) sont à valider/ajuster dès que des
  références seront déposées.
- **Nom des 12 templates** dans l'interface organisateur (sélecteur de design,
  `03-sections-composants.md` § 1.5) : ce document utilise « Classique » /
  « Moderne » par type — à confirmer ou remplacer par des noms plus évocateurs
  (ex. « Mariage — Rose poudré » / « Mariage — Vert sauge »).
- ~~Implémentation technique de l'animation d'enveloppe~~ → **tranché dans
  `06-trd.md` § 11.3** : CSS + SVG (couleurs par variables CSS issues de la
  palette du template), `<canvas>` léger pour le rideau de particules, sans
  Lottie. Le respect du budget de poids (§ 1.4) est vérifié en intégration
  continue.
- **Polices retenues** : propositions Google Fonts à vérifier (disponibilité,
  licence, poids réel une fois les graisses utilisées figées).
- **Styles d'enveloppe premium** : lequel des 3 styles (§ 2) pourrait devenir
  payant plus tard — décision commerciale hors périmètre de ce document.
