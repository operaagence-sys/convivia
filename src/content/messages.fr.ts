// Fichier de textes unique (français, vouvoiement). Variables : {nom}, remplacées par `t()` (./format).
// Les valeurs de {formats} et {maxSize} viennent de ./photo-constraints.
export const messages = {
  notFound: {
    title: 'Page introuvable',
    description:
      "Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse, ou revenez à l'accueil.",
    action: "Retour à l'accueil",
    actionLabel: "Retourner à la page d'accueil de Convivia",
  },
  guestNotFound: {
    title: 'Invitation introuvable',
    description:
      "Ce lien ne fonctionne pas. Vérifiez que vous l'avez copié en entier, ou demandez un nouveau lien à la personne qui vous a invité(e).",
  },
  error: {
    title: 'Un problème est survenu',
    description: "Cet écran ne s'est pas affiché correctement. Réessayez dans un instant.",
    retry: 'Réessayer',
    home: "Retour à l'accueil",
    retryLabel: "Réessayer d'afficher cet écran",
  },
  globalError: {
    title: "Convivia ne s'affiche pas",
    description:
      'Un problème est survenu. Vérifiez votre connexion, puis réessayez. Si cela continue, revenez un peu plus tard.',
    retry: 'Réessayer',
    retryLabel: 'Réessayer de charger Convivia',
  },
  loading: {
    label: 'Chargement en cours',
    button: 'Veuillez patienter',
  },
  placeholder: {
    dashboard: { title: 'Mes événements', description: 'Cette page sera bientôt disponible.' },
    login: { title: 'Connexion', description: 'La connexion sera bientôt disponible.' },
    scan: { title: 'Scan des invitations', description: 'Cette page sera bientôt disponible.' },
    admin: { title: 'Administration', description: 'Cet espace sera bientôt disponible.' },
    home: "Retour à l'accueil",
  },
  nav: {
    organizer: {
      ariaLabel: 'Navigation principale',
      events: 'Événements',
      create: 'Créer',
      account: 'Compte',
    },
    event: {
      ariaLabel: "Navigation de l'événement",
      overview: 'Aperçu',
      guests: 'Invités',
      send: 'Envoi',
      rsvp: 'Réponses',
    },
    host: {
      ariaLabel: "Navigation de l'accueil",
      scan: 'Scanner',
      arrivals: 'Arrivées',
    },
  },
  // Page provisoire de « Créer » jusqu'à la tranche 3 (D58).
  createSoon: {
    title: 'Créer un événement',
    description:
      'La création d’événement arrive très bientôt. Vous pourrez choisir un modèle, ajouter vos photos et préparer vos invitations.',
    action: 'Voir mes événements',
  },
  auth: {
    login: {
      title: 'Connexion',
      subtitle:
        'Entrez votre adresse e-mail. Nous vous envoyons un code pour vous connecter ou créer votre compte.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'prenom@exemple.com',
      submit: 'Recevoir un code',
      submitting: 'Envoi du code…',
      hint: 'Pas de mot de passe à retenir.',
      error: {
        required: 'Entrez votre adresse e-mail.',
        invalid: 'Cette adresse e-mail ne semble pas correcte. Vérifiez-la, puis réessayez.',
        network: 'Impossible de vous joindre. Vérifiez votre connexion, puis réessayez.',
        sendFailed: "Le code n'a pas pu être envoyé. Réessayez dans un instant.",
        // Plafond de 3 codes par heure (D52). {delay} : « 12 minutes », « 1 minute »…
        hourlyLimit: 'Vous avez demandé trop de codes. Réessayez dans {delay}.',
        // Blocage de 15 min après 5 codes faux (D52). Ne dit pas si le compte existe.
        blocked: 'Trop de tentatives. Réessayez dans {delay}.',
        // Nouvelle demande moins de 60 s après la précédente.
        tooSoon: 'Un code vient d’être envoyé. Patientez {delay} avant d’en demander un autre.',
      },
    },
    verify: {
      title: 'Saisissez votre code',
      // Message neutre : identique que le compte existe ou non (D23, D47).
      subtitle:
        'Si cette adresse est valide, un code à 6 chiffres vient de lui être envoyé : {email}.',
      codeLabel: 'Code à 6 chiffres',
      digitAriaLabel: 'Chiffre {index} sur 6',
      validity: 'Le code est valable {minutes} minutes.',
      submit: 'Valider',
      submitting: 'Vérification…',
      checkSpam: 'Vous ne le voyez pas ? Regardez aussi dans vos courriers indésirables.',
      resend: 'Renvoyer le code',
      resendIn: 'Renvoyer le code dans {seconds} s',
      resending: 'Envoi du code…',
      resent: 'Si cette adresse est valide, un nouveau code vient de lui être envoyé.',
      changeEmail: "Changer d'adresse e-mail",
      error: {
        required: 'Entrez les 6 chiffres du code.',
        incomplete: 'Le code contient 6 chiffres.',
        // Ne révèle rien sur le compte. {remaining} : tentatives restantes avant blocage.
        wrong: 'Ce code est incorrect. Vérifiez-le, puis réessayez.',
        wrongRemaining: 'Ce code est incorrect. Il vous reste {remaining} essais.',
        wrongRemainingOne: 'Ce code est incorrect. Il vous reste 1 essai.',
        expired: 'Ce code a expiré. Demandez-en un nouveau.',
        blocked: 'Trop de tentatives. Réessayez dans {delay}.',
        hourlyLimit: 'Vous avez demandé trop de codes. Réessayez dans {delay}.',
        tooSoon: 'Un code vient d’être envoyé. Patientez {delay} avant d’en demander un autre.',
        network: 'Impossible de vous joindre. Vérifiez votre connexion, puis réessayez.',
        // Le service répond mais ne peut pas traiter la demande : inutile de vérifier sa connexion.
        unavailable: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.',
        // Erreur imprévue après un code juste. Neutre, sans détail technique.
        unexpected: 'Un problème est survenu. Réessayez dans un instant.',
        sendFailed: "Le code n'a pas pu être envoyé. Réessayez dans un instant.",
        missingEmail: "Votre demande n'est plus à jour. Entrez de nouveau votre adresse e-mail.",
        missingEmailAction: 'Retour à la connexion',
      },
      success: 'Vous êtes connecté(e).',
    },
    delay: {
      // Durées pour {delay}.
      minutes: '{count} minutes',
      minuteOne: '1 minute',
      lessThanMinute: 'moins d’une minute',
    },
    profile: {
      title: 'Votre profil',
      subtitle:
        'Dites-nous qui vous êtes. Votre nom apparaît dans les messages envoyés à vos invités.',
      nameLabel: 'Votre nom',
      nameHint: 'Il sera affiché ainsi : « De la part de {exemple}, via Convivia ».',
      nameExample: 'Prénom Nom',
      namePlaceholder: 'Prénom Nom',
      cityLabel: 'Ville',
      cityPlaceholder: 'Votre ville',
      countryLabel: 'Pays',
      countryPlaceholder: 'Choisissez votre pays',
      submit: 'Continuer',
      submitting: 'Enregistrement…',
      error: {
        nameRequired: 'Entrez votre nom.',
        nameTooLong: 'Ce nom est trop long. Raccourcissez-le.',
        nameInvalid: 'Ce nom ne semble pas correct. Utilisez des lettres (2 à 80 caractères).',
        cityRequired: 'Entrez votre ville.',
        cityTooLong: 'Ce nom de ville est trop long. Raccourcissez-le.',
        cityInvalid:
          'Cette ville ne semble pas correcte. Utilisez des lettres (2 à 60 caractères).',
        countryRequired: 'Choisissez votre pays.',
        countryInvalid: 'Ce pays n’est pas disponible. Choisissez un pays de la liste.',
        network: 'Impossible de vous joindre. Vérifiez votre connexion, puis réessayez.',
        saveFailed: "Vos informations n'ont pas pu être enregistrées. Réessayez dans un instant.",
      },
    },
    // Noms des pays actifs (D53), par code ISO.
    countries: {
      BJ: 'Bénin',
      CI: "Côte d'Ivoire",
      TG: 'Togo',
      SN: 'Sénégal',
    },
  },
  account: {
    title: 'Compte',
    loading: 'Chargement de votre compte',
    suspended: {
      title: 'Compte suspendu',
      description:
        'Votre compte est suspendu. Vous pouvez consulter vos informations, mais pas les modifier ni envoyer d’invitations. Pour en savoir plus, écrivez à {email}.',
      contactLabel: 'Écrire au support',
      email: 'support@convivia.app',
    },
    profile: {
      title: 'Mes informations',
      emailLabel: 'Adresse e-mail',
      emailHint: 'Votre adresse e-mail ne peut pas être modifiée.',
      nameLabel: 'Nom',
      nameHint: 'Il apparaît dans « De la part de [votre nom], via Convivia ».',
      cityLabel: 'Ville',
      countryLabel: 'Pays',
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      saved: 'Vos informations sont enregistrées.',
      error: {
        nameRequired: 'Entrez votre nom.',
        nameTooLong: 'Ce nom est trop long. Raccourcissez-le.',
        nameInvalid: 'Ce nom ne semble pas correct. Utilisez des lettres (2 à 80 caractères).',
        cityRequired: 'Entrez votre ville.',
        cityTooLong: 'Ce nom de ville est trop long. Raccourcissez-le.',
        cityInvalid:
          'Cette ville ne semble pas correcte. Utilisez des lettres (2 à 60 caractères).',
        countryRequired: 'Choisissez votre pays.',
        countryInvalid: 'Ce pays n’est pas disponible. Choisissez un pays de la liste.',
        network: 'Impossible de vous joindre. Vérifiez votre connexion, puis réessayez.',
        saveFailed: "Vos informations n'ont pas pu être enregistrées. Réessayez dans un instant.",
        suspended: 'Votre compte est suspendu : vous ne pouvez pas modifier vos informations.',
      },
    },
    session: {
      title: 'Session',
      signOut: 'Se déconnecter',
      signingOut: 'Déconnexion…',
      signedOut: 'Vous êtes déconnecté(e).',
      signOutAll: 'Déconnecter tous mes appareils',
      signOutAllHint:
        'Utile si vous avez perdu un téléphone ou utilisé un appareil qui n’est pas le vôtre.',
      signOutAllConfirm: {
        title: 'Déconnecter tous vos appareils ?',
        description:
          'Vous serez déconnecté(e) partout, y compris sur cet appareil. Pour revenir, il faudra demander un nouveau code.',
        confirm: 'Tout déconnecter',
        cancel: 'Annuler',
      },
      signedOutAll: 'Tous vos appareils ont été déconnectés.',
      error: {
        network: 'Impossible de vous joindre. Vérifiez votre connexion, puis réessayez.',
        signOutFailed: "La déconnexion n'a pas abouti. Réessayez dans un instant.",
      },
    },
  },
  dropzone: {
    idle: {
      title: 'Ajoutez une photo',
      hint: 'Touchez ici pour choisir une photo, ou déposez-la ici.',
      constraints: 'Formats acceptés : {formats}. Poids maximal : {maxSize}.',
    },
    hover: 'Déposez la photo ici',
    uploading: 'Envoi en cours… {progress} %',
    cancel: 'Annuler',
    cancelLabel: "Annuler l'envoi de la photo",
    error: {
      format: "Ce format n'est pas accepté. Choisissez une photo en {formats}.",
      tooLarge:
        'Cette photo est trop lourde ({size}). Le maximum est {maxSize}. Choisissez une photo plus légère.',
      heic: "Cette photo n'a pas pu être lue. Enregistrez-la en JPEG, puis réessayez.",
      network: "L'envoi a échoué. Vérifiez votre connexion, puis réessayez.",
    },
    retry: 'Réessayer',
    replace: 'Remplacer',
    required: 'Obligatoire',
    ariaLabel: "Zone d'ajout de photo. Formats acceptés : {formats}. Poids maximal : {maxSize}.",
  },
  pagination: {
    empty: 'Aucun résultat',
    page: 'Page {current} sur {total}',
    previous: 'Page précédente',
    next: 'Page suivante',
    nav: 'Pagination',
  },
} as const;

export type Messages = typeof messages;
