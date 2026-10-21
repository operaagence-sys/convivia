import 'server-only';
import {
  assertModeGuards,
  assertProductionRequiredEnv,
  assertNoSecretPublicVariables,
  resolveWhatsappDispatch,
  type WhatsappMode,
} from './guards';
import { dropEmptyValues, serverEnvSchema, type ServerEnv } from './schema';

/**
 * Accès unique aux variables d'environnement côté serveur.
 * Premier appel: validation zod + garde-fous de mode (live refusé hors production).
 * Une erreur de configuration est fatale (un échec net vaut mieux qu'un envoi réel accidentel).
 */

let cached: ServerEnv | undefined;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const clean = dropEmptyValues(source);
  assertNoSecretPublicVariables(clean);
  const result = serverEnvSchema.safeParse(clean);
  if (!result.success) {
    // Uniquement les noms de variables et le type d'erreur; jamais les valeurs.
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Configuration invalide: ${problems.join('; ')}`);
  }
  const env = result.data;
  assertModeGuards({
    vercelEnv: env.VERCEL_ENV,
    whatsappMode: env.WHATSAPP_MODE,
    fedapayEnv: env.FEDAPAY_ENV,
    fedapaySecretKey: env.FEDAPAY_SECRET_KEY,
  });
  // Production seulement: variables indispensables présentes dès le démarrage.
  assertProductionRequiredEnv(env.VERCEL_ENV, clean);
  return env;
}

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Pour les tests uniquement. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/** Exige la présence des variables listées (à l'usage d'une fonctionnalité). */
export function requireServerEnv<K extends keyof ServerEnv>(
  ...keys: K[]
): { [P in K]-?: NonNullable<ServerEnv[P]> } {
  const env = getServerEnv();
  const missing = keys.filter((key) => env[key] === undefined || env[key] === null);
  if (missing.length > 0) {
    throw new Error(`Variable(s) d'environnement manquante(s): ${missing.join(', ')}`);
  }
  return env as unknown as { [P in K]-?: NonNullable<ServerEnv[P]> };
}

export type WhatsappConfig = { mode: WhatsappMode; allowlist: readonly string[] };

export function getWhatsappConfig(): WhatsappConfig {
  const env = getServerEnv();
  return { mode: env.WHATSAPP_MODE, allowlist: env.WHATSAPP_TEST_ALLOWLIST };
}

/** `send` ou `simulate` pour un destinataire donné, selon le mode et la liste blanche. */
export function whatsappDispatchFor(recipientE164: string): 'send' | 'simulate' {
  const env = getServerEnv();
  return resolveWhatsappDispatch({
    vercelEnv: env.VERCEL_ENV,
    mode: env.WHATSAPP_MODE,
    allowlist: env.WHATSAPP_TEST_ALLOWLIST,
    recipientE164,
  });
}

export function getFedapayConfig(): { env: 'sandbox' | 'live'; secretKey: string } {
  const { FEDAPAY_ENV, FEDAPAY_SECRET_KEY } = requireServerEnv('FEDAPAY_ENV', 'FEDAPAY_SECRET_KEY');
  return { env: FEDAPAY_ENV, secretKey: FEDAPAY_SECRET_KEY };
}
