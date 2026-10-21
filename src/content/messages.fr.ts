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
