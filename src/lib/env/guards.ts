/**
 * Garde-fous de mode (CLAUDE.md 5, TRD 15). Fonctions pures, sans dépendance, testées.
 *
 * Règle: WhatsApp `live` et la clé FedaPay live ne sont acceptés que si
 * `VERCEL_ENV === 'production'` (comparaison stricte). Toute autre valeur, y compris
 * l'absence de `VERCEL_ENV` (poste local, CI), vaut « pas la production ». Ne jamais
 * assouplir ce fichier pour « débloquer » un test: poser les variables dans le test.
 */

export type WhatsappMode = 'simulate' | 'test' | 'live';
export type FedapayEnv = 'sandbox' | 'live';

export class EnvGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvGuardError';
  }
}

export function isProduction(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production';
}

export type ModeGuardInput = {
  vercelEnv: string | undefined;
  whatsappMode: string | undefined;
  fedapayEnv: string | undefined;
  fedapaySecretKey: string | undefined;
};

const LIVE_KEY_PREFIX = /^sk_live_/i;
const SANDBOX_KEY_PREFIX = /^sk_sandbox_/i;

/**
 * Lève `EnvGuardError` si une configuration réelle (WhatsApp live, FedaPay live) est demandée
 * hors production, ou si la clé FedaPay ne correspond pas à `FEDAPAY_ENV`.
 * Les messages ne contiennent jamais de valeur de variable.
 */
export function assertModeGuards(input: ModeGuardInput): void {
  const production = isProduction(input.vercelEnv);

  // Décision du porteur (2026-10-21): en production, seul `live` est accepté, sinon le site
  // encaisserait sans envoyer.
  if (production && input.whatsappMode !== 'live') {
    throw new EnvGuardError(
      'Mode WhatsApp non live refusé en production: WHATSAPP_MODE doit valoir live quand VERCEL_ENV vaut production.',
    );
  }

  if (input.whatsappMode === 'live' && !production) {
    throw new EnvGuardError(
      "Mode WhatsApp live refusé: il n'est autorisé que si VERCEL_ENV vaut production.",
    );
  }

  if (input.fedapayEnv === 'live' && !production) {
    throw new EnvGuardError(
      "Environnement FedaPay live refusé: il n'est autorisé que si VERCEL_ENV vaut production.",
    );
  }

  const key = input.fedapaySecretKey;
  if (key) {
    const isLiveKey = LIVE_KEY_PREFIX.test(key);
    if (isLiveKey && !production) {
      throw new EnvGuardError(
        "Clé FedaPay live refusée: elle n'est autorisée que si VERCEL_ENV vaut production.",
      );
    }
    if (isLiveKey && input.fedapayEnv !== 'live') {
      throw new EnvGuardError('Clé FedaPay live incohérente avec FEDAPAY_ENV (attendu: live).');
    }
    if (SANDBOX_KEY_PREFIX.test(key) && input.fedapayEnv === 'live') {
      throw new EnvGuardError(
        'Clé FedaPay sandbox incohérente avec FEDAPAY_ENV (attendu: sandbox).',
      );
    }
  }

  // Décision du porteur (2026-10-21): en production, FedaPay est live (environnement ET clé).
  // Ces contrôles viennent après les contrôles de cohérence ci-dessus. Une clé absente est
  // signalée par `assertProductionRequiredEnv` (nom de la variable).
  if (production) {
    if (input.fedapayEnv !== 'live') {
      throw new EnvGuardError(
        'FedaPay sandbox refusé en production: FEDAPAY_ENV doit valoir live quand VERCEL_ENV vaut production.',
      );
    }
    if (key && !LIVE_KEY_PREFIX.test(key)) {
      throw new EnvGuardError(
        'Clé FedaPay non live refusée en production: FEDAPAY_SECRET_KEY doit être une clé live.',
      );
    }
  }
}

/**
 * Variables indispensables en production (TRD 15), limitées aux fonctions DÉJÀ LIVRÉES
 * (décision du porteur, 2026-10-21: ajout tranche par tranche). Vérifiées au build et au
 * démarrage; hors production, elles restent exigées à l'usage seulement (`requireServerEnv`).
 * Règle: la tranche qui introduit une variable indispensable l'ajoute ici (et la retire de
 * `PRODUCTION_ENV_PLANNED`). Les garde-fous de mode (`assertModeGuards`) ne dépendent pas de
 * cette liste.
 */
export const PRODUCTION_REQUIRED_ENV = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Tranche 2 (connexion): compteur des codes faux, lu par la route de vérification.
  'LOGIN_ATTEMPTS_HASH_SECRET',
  'LOGIN_IP_HASH_SECRET',
  // Transfert de l'IP du visiteur à Supabase Auth (clé secrète `sb_secret_…`).
  'SUPABASE_SECRET_KEY',
  // Tranche 2 (connexion): le serveur fabrique, hache et envoie le code.
  'LOGIN_CODE_PEPPER',
  'RESEND_API_KEY',
] as const;

/**
 * Variables indispensables en production dont le code n'est pas encore livré: NON exigées
 * aujourd'hui, listées pour qu'aucune ne soit oubliée. Chaque tranche déplace les siennes
 * vers `PRODUCTION_REQUIRED_ENV` quand son code arrive.
 */
export const PRODUCTION_ENV_PLANNED = {
  // Tranche 6 (paiement FedaPay)
  FEDAPAY_SECRET_KEY: 6,
  FEDAPAY_WEBHOOK_SECRET: 6,
  // Tranche 7 (QR, session de scan, code d'accueil)
  QR_SIGNING_SECRET: 7,
  SCAN_SESSION_SECRET: 7,
  SCAN_CODE_ENCRYPTION_KEY: 7,
  // Tranche 11 (API Cloud de Meta, désinscription)
  WHATSAPP_ACCESS_TOKEN: 11,
  WHATSAPP_PHONE_NUMBER_ID: 11,
  WHATSAPP_BUSINESS_ACCOUNT_ID: 11,
  WHATSAPP_APP_SECRET: 11,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 11,
  OPTOUT_HASH_SECRET: 11,
} as const satisfies Record<string, number>;

/** Noms (jamais les valeurs) des variables de production absentes ou vides. */
export function findMissingProductionEnv(env: Record<string, string | undefined>): string[] {
  return PRODUCTION_REQUIRED_ENV.filter((name) => !env[name]);
}

/** En production seulement: lève si une variable indispensable manque. Sans effet ailleurs. */
export function assertProductionRequiredEnv(
  vercelEnv: string | undefined,
  env: Record<string, string | undefined>,
): void {
  if (!isProduction(vercelEnv)) return;
  const missing = findMissingProductionEnv(env);
  if (missing.length > 0) {
    throw new EnvGuardError(
      `Variable(s) d'environnement manquante(s) en production: ${missing.join(', ')}.`,
    );
  }
}

/** Secrets de la connexion par code: trois valeurs différentes (séparation des usages). */
export const LOGIN_SECRET_NAMES = [
  'LOGIN_CODE_PEPPER',
  'LOGIN_ATTEMPTS_HASH_SECRET',
  'LOGIN_IP_HASH_SECRET',
] as const;

/**
 * Lève si deux secrets de connexion posés ont la même valeur (toute environnement). Le message
 * ne contient que des noms de variables, jamais de valeur. Une variable absente est ignorée.
 */
export function assertDistinctLoginSecrets(env: Record<string, string | undefined>): void {
  const seen = new Map<string, string>();
  for (const name of LOGIN_SECRET_NAMES) {
    const value = env[name];
    if (!value) continue;
    const other = seen.get(value);
    if (other) {
      throw new EnvGuardError(
        `Secrets de connexion identiques refusés: ${other} et ${name} doivent avoir des valeurs différentes.`,
      );
    }
    seen.set(value, name);
  }
}

/**
 * Une variable `NEXT_PUBLIC_*` est copiée dans le JavaScript envoyé au navigateur au BUILD:
 * elle ne doit jamais porter un secret. Contrôle en deux temps:
 * 1. liste blanche des noms (ceux de `.env.example`); tout autre `NEXT_PUBLIC_*` est refusé;
 * 2. contrôle des valeurs des variables publiques (clé service_role collée dans la clé anonyme,
 *    clé secrète Supabase `sb_secret_`, clés FedaPay `sk_*`).
 * Les messages ne contiennent que des noms de variables, jamais de valeur.
 */
export const PUBLIC_ENV_ALLOWLIST = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

/** Préfixes de clés secrètes FedaPay (live, test, sandbox) et Supabase (`sb_secret_`). */
const SECRET_VALUE_MARKERS = ['sk_live_', 'sk_test_', 'sk_sandbox_'];

function decodeBase64UrlJson(segment: string): unknown {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return undefined;
  }
}

/** Vrai si la valeur ressemble à un secret (JWT service_role, sb_secret_, clé FedaPay). */
export function looksLikeSecretValue(rawValue: string): boolean {
  const value = rawValue.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith('sb_secret_')) return true;
  if (SECRET_VALUE_MARKERS.some((marker) => lower.includes(marker))) return true;
  const parts = value.split('.');
  if (parts.length === 3) {
    // Décodage sans vérification de signature: on ne cherche que le rôle déclaré.
    const payload = decodeBase64UrlJson(parts[1] ?? '');
    if (payload && typeof payload === 'object' && 'role' in payload) {
      return (payload as { role?: unknown }).role === 'service_role';
    }
  }
  return false;
}

/**
 * Préfixe des variables système que Vercel injecte au build (« Automatically expose System
 * Environment Variables »: NEXT_PUBLIC_VERCEL_ENV, _URL, _GIT_*, etc.). Non secrètes, acceptées
 * en plus de la liste blanche; le contrôle des VALEURS s'applique quand même.
 */
export const PUBLIC_VERCEL_SYSTEM_PREFIX = 'NEXT_PUBLIC_VERCEL_';

/** Noms (jamais les valeurs) des variables `NEXT_PUBLIC_*` hors liste blanche. */
export function findSecretPublicVariables(env: Record<string, string | undefined>): string[] {
  const allowed: readonly string[] = PUBLIC_ENV_ALLOWLIST;
  return Object.keys(env).filter(
    (name) =>
      name.startsWith('NEXT_PUBLIC_') &&
      !allowed.includes(name) &&
      !name.startsWith(PUBLIC_VERCEL_SYSTEM_PREFIX),
  );
}

/** Noms des variables `NEXT_PUBLIC_*` dont la valeur ressemble à un secret. */
export function findSecretPublicValues(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((name) => {
    if (!name.startsWith('NEXT_PUBLIC_')) return false;
    const value = env[name];
    return typeof value === 'string' && looksLikeSecretValue(value);
  });
}

export function assertNoSecretPublicVariables(env: Record<string, string | undefined>): void {
  const unknownNames = findSecretPublicVariables(env);
  if (unknownNames.length > 0) {
    throw new EnvGuardError(
      `Variable(s) NEXT_PUBLIC_ non autorisée(s) (exposées au navigateur, liste blanche dans guards.ts): ${unknownNames.join(', ')}.`,
    );
  }
  const secretValues = findSecretPublicValues(env);
  if (secretValues.length > 0) {
    throw new EnvGuardError(
      `Variable(s) NEXT_PUBLIC_ dont la valeur ressemble à un secret (exposée au navigateur): ${secretValues.join(', ')}.`,
    );
  }
}

/**
 * Décision d'envoi WhatsApp selon le mode (TRD 15):
 * - simulate: jamais d'appel à Meta;
 * - test: envoi réel uniquement vers un numéro de la liste blanche, sinon simulé;
 * - live: envoi réel.
 * Le mode `live` est déjà refusé hors production par `assertModeGuards`; on le revalide ici
 * pour qu'un appelant ne puisse pas contourner le garde-fou en n'appelant que cette fonction.
 */
export function resolveWhatsappDispatch(params: {
  vercelEnv: string | undefined;
  mode: WhatsappMode;
  allowlist: readonly string[];
  recipientE164: string;
}): 'send' | 'simulate' {
  const { vercelEnv, mode, allowlist, recipientE164 } = params;
  if (mode === 'live') {
    if (!isProduction(vercelEnv)) {
      throw new EnvGuardError('Envoi WhatsApp live refusé hors production.');
    }
    return 'send';
  }
  if (mode === 'test') {
    return allowlist.includes(recipientE164) ? 'send' : 'simulate';
  }
  return 'simulate';
}
