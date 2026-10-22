/** Cookie qui garde l'e-mail entre `/login` et `/verify` (jamais dans l'URL). */
export const PENDING_EMAIL_COOKIE = 'convivia_login_email';
export const PENDING_EMAIL_TTL_SECONDS = 10 * 60;
/** Durée de validité du code (réglage Auth de Supabase : 600 s). */
export const CODE_VALIDITY_MINUTES = 10;
/** Pause avant de pouvoir renvoyer un code (PRD : 60 s). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Longueurs du profil (D55, contraintes de la table `organizers`). */
export const NAME_MAX = 80;
export const CITY_MAX = 60;
