/**
 * Nettoyage des rapports d'erreur avant envoi (TRD 1.2, 12.2; CLAUDE.md 5):
 * - numéros masqués au format `+229 •• •• •• 12`;
 * - noms et coordonnées supprimés (clés connues, e-mails);
 * - jetons des liens invités `/i/<token>` remplacés par `/i/[token]`;
 * - URL sans paramètres de requête ni fragment;
 * - aucune donnée utilisateur, cookie ou en-tête sensible.
 *
 * Fonctions pures, sans dépendance au SDK (testées). Le nettoyage est une défense en
 * profondeur: le code ne doit de toute façon jamais journaliser de coordonnées d'invité.
 */

const FILTERED = '[Filtered]';
const MASK = '••';

/** Indicatifs des pays ouverts (Bénin, Côte d'Ivoire, Togo, Sénégal). */
const KNOWN_DIAL_CODES = ['229', '225', '228', '221'];

/** Clés dont la valeur est toujours supprimée, où qu'elles soient dans l'événement. */
const SENSITIVE_KEY =
  /^(phone|phone_?e164|phone_?number|msisdn|full_?name|first_?name|last_?name|companion_?name|guest_?name|display_?name|email|password|token|access_?token|authorization|cookie|set-cookie|secret|api_?key)$/i;

/** Clés supprimées seulement dans les données libres (extra, breadcrumbs, corps de requête). */
const FREE_DATA_SENSITIVE_KEY = /^(name|guest|contact|guest_?contact|invitee)$/i;

const INVITATION_PATH = /\/i\/[^/?#\s"'<>]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Numéro précédé de `+` (séparateurs tolérés), ou suite de 8 à 15 chiffres isolée.
const PHONE = /\+\d[\d\s().-]{6,18}\d|(?<![\w.-])\d{8,15}(?![\w.-])/g;

/** `+22997123412` ou `+229 97 12 34 12` -> `+229 •• •• •• 12`. */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const last = digits.slice(-2);
  const hadPlus = raw.trim().startsWith('+');
  const dial = hadPlus ? KNOWN_DIAL_CODES.find((code) => digits.startsWith(code)) : undefined;
  const tail = `${MASK} ${MASK} ${MASK} ${last}`;
  return dial ? `+${dial} ${tail}` : tail;
}

/** Retire requête et fragment, remplace le jeton d'invitation. Garde le chemin lisible. */
export function scrubUrl(url: string): string {
  const withoutQuery = url.replace(/[?#].*$/, '');
  return withoutQuery.replace(INVITATION_PATH, '/i/[token]');
}

/** Nettoie une chaîne libre (message d'erreur, fil d'Ariane, nom de transaction). */
export function scrubString(value: string): string {
  return value
    .replace(INVITATION_PATH, '/i/[token]')
    .replace(EMAIL, '[email]')
    .replace(PHONE, (match) => maskPhone(match));
}

type Json = unknown;

function scrubDeep(value: Json, freeData: boolean, depth: number): Json {
  if (depth > 8) return FILTERED;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, freeData, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key) || (freeData && FREE_DATA_SENSITIVE_KEY.test(key))) {
        out[key] = FILTERED;
      } else if (/url$/i.test(key) && typeof inner === 'string') {
        out[key] = scrubString(scrubUrl(inner));
      } else {
        out[key] = scrubDeep(inner, freeData, depth + 1);
      }
    }
    return out;
  }
  return value;
}

type AnyRecord = Record<string, unknown>;

/**
 * Nettoie un événement Sentry (type volontairement générique pour ne pas dépendre du SDK).
 * Renvoie un nouvel objet; l'entrée n'est pas modifiée.
 */
export function scrubEvent<T extends object>(event: T): T {
  const source = event as AnyRecord;
  const out: AnyRecord = { ...source };

  // Aucune donnée utilisateur (adresse IP, identifiant, e-mail).
  delete out.user;
  out.server_name = undefined;

  if (typeof out.transaction === 'string') out.transaction = scrubString(scrubUrl(out.transaction));
  if (typeof out.message === 'string') out.message = scrubString(out.message);

  const request = source.request;
  if (request && typeof request === 'object') {
    // Liste blanche: seuls la méthode et l'URL nettoyée sont conservées.
    const raw = request as AnyRecord;
    const req: AnyRecord = {};
    if (typeof raw.method === 'string') req.method = raw.method;
    if (typeof raw.url === 'string') req.url = scrubUrl(raw.url);
    out.request = req;
  }

  if (source.exception && typeof source.exception === 'object') {
    out.exception = scrubDeep(source.exception, false, 0);
  }
  for (const key of ['extra', 'breadcrumbs', 'tags', 'contexts'] as const) {
    if (source[key] !== undefined) {
      out[key] = scrubDeep(source[key], key !== 'contexts', 0);
    }
  }
  return out as T;
}

/** Pour `beforeBreadcrumb`. */
export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  const source = breadcrumb as AnyRecord;
  const out: AnyRecord = { ...source };
  if (typeof out.message === 'string') out.message = scrubString(out.message);
  if (source.data !== undefined) out.data = scrubDeep(source.data, true, 0);
  return out as T;
}
