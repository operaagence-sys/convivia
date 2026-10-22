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

## Tranche 2 : connexion organisateur et compte

À dérouler sur le **preview**, sur **un Android (Chrome) et un iPhone (Safari)**. Cochez la colonne
de l'appareil que vous testez.

**Avant de commencer**

- Utilisez **l'adresse e-mail du compte Resend** : c'est la seule adresse qui reçoit les e-mails
  tant que le domaine `convivia.app` n'est pas vérifié. Toute autre adresse ne recevra rien : c'est
  normal.
- Gardez sous la main **une adresse neuve** (qui n'a jamais servi) pour les étapes « code faux ».
  Aucun e-mail ne lui sera envoyé : c'est normal, et le message affiché sera le même.
- Attention aux **limites** : 3 codes au plus par heure pour une même adresse, et 5 codes faux
  bloquent la connexion 15 minutes. Si vous êtes bloqué, attendez ou continuez avec un autre appareil
  et une autre adresse.
- Utilisez des noms et des villes fictifs.

### A. Premier accès et e-mail

| Action                                                                | Résultat attendu                                                                                                   | Android | iPhone |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- | ------ |
| Ouvrez l'adresse du preview suivie de `/login`                        | L'écran « Connexion » s'affiche en français, sans barre d'onglets en bas                                           | [ ]     | [ ]    |
| Touchez le champ « Adresse e-mail »                                   | Le clavier propose le « @ » et ne met pas de majuscule automatique                                                 | [ ]     | [ ]    |
| Touchez « Recevoir un code » avec le champ vide                       | Le message « Entrez votre adresse e-mail. » apparaît, rien n'est envoyé                                            | [ ]     | [ ]    |
| Écrivez `abc` puis touchez « Recevoir un code »                       | Le message « Cette adresse e-mail ne semble pas correcte… » apparaît                                               | [ ]     | [ ]    |
| Écrivez l'adresse du compte Resend, puis touchez « Recevoir un code » | Le bouton indique « Envoi du code… » puis l'écran « Saisissez votre code » s'affiche                               | [ ]     | [ ]    |
| Regardez la barre d'adresse du navigateur                             | L'adresse e-mail n'apparaît **nulle part** dans l'adresse de la page (seulement `/verify`)                         | [ ]     | [ ]    |
| Lisez la phrase du haut de l'écran de saisie                          | Elle commence par « Si cette adresse est valide, un code à 6 chiffres… » (même phrase que le compte existe ou non) | [ ]     | [ ]    |
| Ouvrez votre messagerie sur le même téléphone                         | L'e-mail de Convivia arrive en moins d'une minute, avec un code à 6 chiffres                                       | [ ]     | [ ]    |
| Si rien n'arrive, ouvrez le dossier des courriers indésirables        | L'e-mail y est ; notez-le dans vos remarques                                                                       | [ ]     | [ ]    |
| Lisez le texte de l'e-mail                                            | Texte en français, code bien lisible, durée de validité (10 minutes) indiquée, aucune image cassée                 | [ ]     | [ ]    |

### B. Saisie du code

| Action                                                                            | Résultat attendu                                                                              | Android | iPhone |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- | ------ |
| Touchez la première case du code                                                  | Le clavier **numérique** s'ouvre                                                              | [ ]     | [ ]    |
| Tapez les chiffres un par un                                                      | Le curseur passe à la case suivante                                                           | [ ]     | [ ]    |
| Touchez la touche « effacer » dans une case vide                                  | Le curseur revient à la case précédente                                                       | [ ]     | [ ]    |
| Effacez tout, copiez le code depuis l'e-mail, puis **collez-le**                  | Les 6 chiffres se répartissent dans les 6 cases                                               | [ ]     | [ ]    |
| Demandez un nouveau code, puis touchez la suggestion de code au-dessus du clavier | Le code se remplit tout seul ; si le téléphone ne le propose pas, notez-le dans vos remarques | [ ]     | [ ]    |
| Touchez « Valider » avec moins de 6 chiffres                                      | Le message « Le code contient 6 chiffres. » apparaît                                          | [ ]     | [ ]    |
| Tapez les 6 chiffres justes et touchez « Valider »                                | Le bouton indique « Vérification… » puis l'écran « Votre profil » s'affiche (premier accès)   | [ ]     | [ ]    |
| Coupez le réseau (mode avion), saisissez 6 chiffres, touchez « Valider »          | Le message « Impossible de vous joindre… » apparaît, sans texte technique                     | [ ]     | [ ]    |
| Rétablissez le réseau et touchez « Valider » de nouveau                           | La vérification se fait normalement                                                           | [ ]     | [ ]    |

### C. Renvoi, code faux et blocage

| Action                                                                          | Résultat attendu                                                                                          | Android | iPhone |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- | ------ |
| Sur « Saisissez votre code », regardez le bouton de renvoi dès l'arrivée        | Il indique « Renvoyer le code dans … s » et ne se touche pas                                              | [ ]     | [ ]    |
| Attendez 60 secondes                                                            | Le bouton devient « Renvoyer le code » et se touche                                                       | [ ]     | [ ]    |
| Touchez « Renvoyer le code »                                                    | « Si cette adresse est valide, un nouveau code vient de lui être envoyé. » apparaît ; un 2e e-mail arrive | [ ]     | [ ]    |
| Saisissez l'**ancien** code (celui du 1er e-mail)                               | Refusé : « Ce code est incorrect… » (sinon, notez que l'ancien code marche encore)                        | [ ]     | [ ]    |
| Touchez « Renvoyer le code » une 2e fois (après 60 s), puis une 3e fois         | Le 3e renvoi est refusé : « Vous avez demandé trop de codes. Réessayez dans … » (3 codes par heure)       | [ ]     | [ ]    |
| Avec une adresse neuve, tapez un code faux, 1 à 4 fois                          | À chaque fois « Ce code est incorrect… », vous pouvez réessayer                                           | [ ]     | [ ]    |
| Tapez un 5e code faux, puis un 6e                                               | Le 6e est refusé : « Trop de tentatives. Réessayez dans 15 minutes. »                                     | [ ]     | [ ]    |
| Pendant le blocage, revenez à `/login` et redemandez un code pour cette adresse | Refusé avec le même message « Trop de tentatives… » ; aucun e-mail n'arrive                               | [ ]     | [ ]    |
| Refaites tout cela avec une adresse **qui n'a jamais eu de compte**             | Exactement les mêmes messages et le même blocage (rien ne dit si le compte existe)                        | [ ]     | [ ]    |
| Attendez 15 minutes, puis redemandez un code                                    | Le code est envoyé de nouveau                                                                             | [ ]     | [ ]    |
| Attendez plus de 10 minutes après un envoi, puis saisissez ce code              | Refusé comme un code incorrect ; demandez-en un nouveau                                                   | [ ]     | [ ]    |
| Sur « Saisissez votre code », touchez « Changer d'adresse e-mail »              | Retour à `/login`, l'adresse précédente est encore remplie                                                | [ ]     | [ ]    |
| Restez 10 minutes sur « Saisissez votre code » puis rechargez la page           | « Votre demande n'est plus à jour… » et le bouton « Retour à la connexion » apparaissent                  | [ ]     | [ ]    |

### D. Profil (premier accès)

| Action                                                                         | Résultat attendu                                                                | Android | iPhone |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------- | ------ |
| Sur « Votre profil », touchez « Continuer » sans rien remplir                  | Trois messages : nom, ville et pays à renseigner                                | [ ]     | [ ]    |
| Écrivez un nom d'un seul caractère                                             | Message « Ce nom ne semble pas correct… »                                       | [ ]     | [ ]    |
| Collez un texte de plus de 80 caractères dans le nom                           | Message « Ce nom est trop long. Raccourcissez-le. »                             | [ ]     | [ ]    |
| Ouvrez la liste des pays                                                       | Exactement 4 pays : Bénin, Côte d'Ivoire, Togo, Sénégal ; la liste s'ouvre bien | [ ]     | [ ]    |
| Choisissez chaque pays à tour de rôle (Bénin, Côte d'Ivoire, Togo, Sénégal)    | Le pays choisi s'affiche correctement, avec ses accents                         | [ ]     | [ ]    |
| Écrivez « Aïcha Kouassi-Dossou » comme nom et « Porto-Novo » comme ville       | Les caractères sont acceptés                                                    | [ ]     | [ ]    |
| Touchez « Continuer » avec un profil juste                                     | Vous arrivez sur le tableau de bord, avec les onglets Événements, Créer, Compte | [ ]     | [ ]    |
| Avec un nouveau compte, avant de finir le profil, tapez `/dashboard` à la main | Vous êtes ramené à l'écran « Votre profil »                                     | [ ]     | [ ]    |
| Sur l'écran « Votre profil », touchez « Se déconnecter »                       | Vous revenez à `/login`                                                         | [ ]     | [ ]    |

### E. Navigation et compte

| Action                                                    | Résultat attendu                                                                                                            | Android | iPhone |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| Sur le tableau de bord, regardez le bas de l'écran        | Trois onglets : Événements, Créer, Compte ; l'onglet actif est mis en évidence ; rien n'est caché par la barre du téléphone | [ ]     | [ ]    |
| Touchez « Créer »                                         | Page « Créer un événement » (la création arrive bientôt), avec un bouton « Voir mes événements »                            | [ ]     | [ ]    |
| Touchez « Compte »                                        | L'e-mail est affiché et **ne se modifie pas** ; nom, ville et pays sont modifiables                                         | [ ]     | [ ]    |
| Changez la ville puis touchez « Enregistrer »             | « Vos informations sont enregistrées. » apparaît ; après rechargement, la nouvelle ville est là                             | [ ]     | [ ]    |
| Videz le nom puis touchez « Enregistrer »                 | « Entrez votre nom. » apparaît, rien n'est enregistré                                                                       | [ ]     | [ ]    |
| Tournez le téléphone en paysage, puis revenez en portrait | Rien n'est coupé, la barre d'onglets reste utilisable                                                                       | [ ]     | [ ]    |
| Agrandissez la taille de texte du téléphone               | Les écrans restent lisibles, aucun bouton coupé                                                                             | [ ]     | [ ]    |

### F. Session gardée, déconnexion et appareils multiples

| Action                                                                              | Résultat attendu                                                                               | Android | iPhone |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- | ------ |
| Connecté, fermez complètement le navigateur, puis rouvrez-le et ouvrez `/dashboard` | Vous êtes toujours connecté, sans nouveau code                                                 | [ ]     | [ ]    |
| Redémarrez le téléphone, puis ouvrez `/dashboard`                                   | Toujours connecté                                                                              | [ ]     | [ ]    |
| Le lendemain, ouvrez `/dashboard`                                                   | Toujours connecté (la session dure 30 jours)                                                   | [ ]     | [ ]    |
| Ouvrez `/login` en étant connecté                                                   | Vous êtes renvoyé directement vers `/dashboard`                                                | [ ]     | [ ]    |
| Sur « Compte », touchez « Se déconnecter »                                          | « Vous êtes déconnecté(e). » puis retour à `/login`                                            | [ ]     | [ ]    |
| Après la déconnexion, touchez « Retour » du navigateur                              | Le contenu du compte ne s'affiche pas ; vous restez sur `/login`                               | [ ]     | [ ]    |
| Après la déconnexion, ouvrez `/dashboard` puis `/account` à la main                 | Dans les deux cas, vous arrivez sur `/login`                                                   | [ ]     | [ ]    |
| Connectez-vous sur **deux appareils** (Android et iPhone) avec la même adresse      | Les deux sont connectés (un code différent pour chacun)                                        | [ ]     | [ ]    |
| Sur l'appareil 1, touchez « Se déconnecter »                                        | L'appareil 1 est déconnecté                                                                    | [ ]     | [ ]    |
| Sur l'appareil 2, rechargez la page                                                 | L'appareil 2 **reste connecté**                                                                | [ ]     | [ ]    |
| Reconnectez l'appareil 1, puis touchez « Déconnecter tous mes appareils »           | Une confirmation « Déconnecter tous vos appareils ? » avec « Annuler » et « Tout déconnecter » | [ ]     | [ ]    |
| Touchez « Annuler »                                                                 | Rien ne change, vous restez connecté                                                           | [ ]     | [ ]    |
| Touchez de nouveau « Déconnecter tous mes appareils », puis « Tout déconnecter »    | « Tous vos appareils ont été déconnectés. » puis retour à `/login`                             | [ ]     | [ ]    |
| Sur l'appareil 2, rechargez la page ou touchez un onglet de la barre du bas         | L'appareil 2 est aussi déconnecté et renvoyé vers `/login`                                     | [ ]     | [ ]    |

### G. Plusieurs onglets

| Action                                                                | Résultat attendu                                             | Android | iPhone |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ------- | ------ |
| Connecté, ouvrez `/dashboard` dans deux onglets                       | Les deux affichent le tableau de bord                        | [ ]     | [ ]    |
| Dans l'onglet 1, touchez « Se déconnecter »                           | L'onglet 1 revient à `/login`                                | [ ]     | [ ]    |
| Dans l'onglet 2, touchez un onglet de la barre du bas                 | L'onglet 2 est renvoyé vers `/login`, sans écran cassé       | [ ]     | [ ]    |
| Ouvrez `/login` dans deux onglets et demandez un code dans le premier | Le deuxième onglet n'affiche aucune erreur                   | [ ]     | [ ]    |
| Dans le deuxième onglet, ouvrez `/verify` et saisissez le code        | Le code est accepté (l'adresse est gardée par le navigateur) | [ ]     | [ ]    |

### H. Application installée sur l'écran d'accueil

| Action                                                                     | Résultat attendu                                                                               | Android | iPhone |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- | ------ |
| Ajoutez Convivia à l'écran d'accueil, puis ouvrez-la depuis l'icône        | L'application s'ouvre en plein écran                                                           | [ ]     | [ ]    |
| Demandez un code dans l'application installée                              | L'écran « Saisissez votre code » s'affiche                                                     | [ ]     | [ ]    |
| Allez chercher le code dans votre messagerie, puis revenez à l'application | L'écran de saisie est toujours là ; sinon notez ce qui s'est passé (adresse perdue, page vide) | [ ]     | [ ]    |
| Saisissez le code                                                          | Vous arrivez sur le tableau de bord                                                            | [ ]     | [ ]    |
| Fermez l'application installée et rouvrez-la le lendemain                  | Toujours connecté                                                                              | [ ]     | [ ]    |

### I. Page invité (non-régression)

| Action                                         | Résultat attendu                                                                                    | Android | iPhone |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- | ------ |
| Étant connecté, ouvrez `/i/<jeton quelconque>` | La page invité s'affiche sans barre d'onglets, sans lien vers votre compte, sans bandeau de cookies | [ ]     | [ ]    |
| Même chose après vous être déconnecté          | Même résultat                                                                                       | [ ]     | [ ]    |

### J. Compte suspendu (seulement si un compte de test peut être suspendu dans la base)

| Action                                                                      | Résultat attendu                                                                       | Android | iPhone |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- | ------ |
| Faites passer le compte de test à « suspendu », puis rechargez `/dashboard` | Un bandeau « Compte suspendu » apparaît, avec le moyen d'écrire à support@convivia.app | [ ]     | [ ]    |
| Ouvrez « Compte »                                                           | Les informations sont lisibles ; les champs et « Enregistrer » sont désactivés         | [ ]     | [ ]    |
| Touchez « Se déconnecter »                                                  | La déconnexion fonctionne malgré la suspension                                         | [ ]     | [ ]    |

### K. Compte administrateur (seulement si un compte admin de test existe)

| Action                                                             | Résultat attendu                                                                   | Android | iPhone |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------- | ------ |
| Sur `/login`, écrivez l'adresse d'un compte administrateur de test | Même écran « Saisissez votre code » que pour une adresse normale                   | [ ]     | [ ]    |
| Attendez 2 minutes                                                 | **Aucun e-mail n'arrive** (les administrateurs ne se connectent pas par cet écran) | [ ]     | [ ]    |
| Saisissez n'importe quel code à 6 chiffres                         | « Ce code est incorrect… », sans autre indication                                  | [ ]     | [ ]    |

**Remarques à noter pendant le test** : délai réel de l'e-mail, dossier où il arrive, lisibilité du
code, gêne éventuelle du clavier, et tout texte qui vous paraît faux ou en anglais.
