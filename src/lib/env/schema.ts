import { z } from 'zod';

/**
 * Schéma des variables d'environnement serveur (TRD 15). Tout est optionnel au niveau du
 * schéma: la présence des variables nécessaires à une fonctionnalité est exigée au moment de
 * son usage (`requireServerEnv`), pour que le build et la CI n'aient besoin d'aucun secret.
 * Les valeurs vides (`FOO=` copié depuis .env.example) sont traitées comme absentes.
 */

const optionalText = z.string().min(1).optional();

export const serverEnvSchema = z.object({
  // Fournie par Vercel; absente en local et en CI (= pas la production).
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,

  // FedaPay
  FEDAPAY_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  FEDAPAY_SECRET_KEY: optionalText,
  FEDAPAY_WEBHOOK_SECRET: optionalText,

  // WhatsApp (Meta Cloud API)
  WHATSAPP_MODE: z.enum(['simulate', 'test', 'live']).default('simulate'),
  WHATSAPP_ACCESS_TOKEN: optionalText,
  WHATSAPP_PHONE_NUMBER_ID: optionalText,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalText,
  WHATSAPP_APP_SECRET: optionalText,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalText,
  // Numéros E.164 séparés par des virgules (5 au plus chez Meta).
  WHATSAPP_TEST_ALLOWLIST: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    )
    .pipe(z.array(z.string().regex(/^\+[1-9]\d{7,14}$/, 'numéro E.164 attendu')).max(5)),

  // Signatures, empreintes, chiffrement
  QR_SIGNING_SECRET: optionalText,
  SCAN_SESSION_SECRET: optionalText,
  OPTOUT_HASH_SECRET: optionalText,
  SCAN_CODE_ENCRYPTION_KEY: optionalText,

  // E-mail (la clé est surtout configurée dans Supabase Auth)
  RESEND_API_KEY: optionalText,

  // Observabilité
  SENTRY_DSN: z.url().optional(),
  SENTRY_AUTH_TOKEN: optionalText,
  SENTRY_ORG: optionalText,
  SENTRY_PROJECT: optionalText,

  // Public
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: optionalText,
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Retire les valeurs vides (`FOO=`) avant validation. */
export function dropEmptyValues(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}
