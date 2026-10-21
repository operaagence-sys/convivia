# Checklist sur vrai téléphone (preview)

À dérouler en **preview** (WhatsApp en mode `test` vers la liste blanche, FedaPay sandbox) sur
**un Android (Chrome) et un iPhone (Safari)**. Cocher une colonne par appareil : Android / iPhone.

## Tranche 1 : socle (à faire après le premier push, quand le preview existe)

| Action                                                                    | Résultat attendu                                                                  | Android | iPhone |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | ------ |
| Ouvrir l'URL du preview                                                   | La page d'accueil « Convivia » s'affiche, sans erreur, en français                | [ ]     | [ ]    |
| Ouvrir `/une-page-inexistante`                                            | Page « Page introuvable » avec un lien vers l'accueil                             | [ ]     | [ ]    |
| Ouvrir `/i/<jeton quelconque>`                                            | Page sans bouton ni lien vers le site, aucun bandeau de cookies ni fenêtre tierce | [ ]     | [ ]    |
| Ouvrir `/design-system` sur le preview                                    | La page de démonstration s'affiche (et elle est introuvable en production)        | [ ]     | [ ]    |
| Sur `/design-system` : boutons, champs, code à 6 chiffres, ajout de photo | Zones tactiles confortables, clavier numérique pour le code, aucune zone coupée   | [ ]     | [ ]    |
| Réseau lent (4G dégradée) sur `/`                                         | Le contenu apparaît vite, pas de saut de mise en page                             | [ ]     | [ ]    |
