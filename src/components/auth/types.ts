/** États d'un formulaire de présentation (le parent pilote l'état, le composant l'affiche). */
export type FormStatus = 'idle' | 'loading' | 'error' | 'success';

/** Blocage ou plafond de codes (D52) : `retryAfterSeconds` = délai restant avant de pouvoir réessayer. */
export type RateLimitError = {
  kind: 'hourlyLimit' | 'blocked' | 'tooSoon';
  retryAfterSeconds: number;
};
