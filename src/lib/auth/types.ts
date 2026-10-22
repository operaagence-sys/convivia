/** Résultats des Server Actions de connexion : sérialisables, sans donnée personnelle. */

export type CodeRequestError =
  | { kind: 'invalid' | 'sendFailed' }
  | { kind: 'hourlyLimit' | 'blocked' | 'tooSoon'; retryAfterSeconds: number };

export type CodeRequestResult = { ok: true } | { ok: false; error: CodeRequestError };

export type ResendResult =
  { ok: true } | { ok: false; error: CodeRequestError | { kind: 'missingEmail' } };

/**
 * `wrong` couvre code faux, expiré, déjà utilisé ET adresse sans code (message neutre, D23 / D52 :
 * la base ne distingue pas ces cas dans sa réponse, d'où l'absence de `expired`). `unavailable` = panne de la base ou du service
 * d'authentification ; `unexpected` = erreur imprévue après un code juste. La vraie panne réseau
 * (`network`) ne peut être constatée que côté navigateur, jamais ici.
 */
export type VerifyError =
  | { kind: 'wrong' | 'unavailable' | 'unexpected' | 'missingEmail' }
  | { kind: 'blocked'; retryAfterSeconds: number };

export type VerifyResult =
  { ok: true; next: '/dashboard' | '/welcome' } | { ok: false; error: VerifyError };

/** Erreurs de l'enregistrement du profil (écran profil et `/account`). */
export type ProfileSaveError =
  | 'nameInvalid'
  | 'nameTooLong'
  | 'cityInvalid'
  | 'cityTooLong'
  | 'countryInvalid'
  | 'suspended'
  | 'saveFailed';

export type ProfileSaveResult = { ok: true } | { ok: false; error: ProfileSaveError };

export type SessionActionResult = { ok: true } | { ok: false; error: 'signOutFailed' };
