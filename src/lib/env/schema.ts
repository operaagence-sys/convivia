import { z } from 'zod';

import { parseEmailAllowlist, parseMailbox } from '../email/policy';

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
  // Clé secrète `sb_secret_…`: seule à permettre le transfert de l'IP du visiteur à Supabase Auth
  // (en-tête `sb-forwarded-for`). Réservée au client « auth seulement » (jamais `.from()`/`.rpc()`).
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_').optional(),

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
  // Empreintes HMAC de la connexion (tables login_attempts et login_ip_attempts, tranche 2).
  // 32 caractères au moins (`openssl rand -base64 32`), un secret par environnement.
  LOGIN_ATTEMPTS_HASH_SECRET: z.string().min(32).optional(),
  LOGIN_IP_HASH_SECRET: z.string().min(32).optional(),
  // Poivre du code de connexion (HMAC du code stocké dans login_attempts.code_hmac): 32 caractères au moins,
  // Sensitive, un secret différent par environnement.
  LOGIN_CODE_PEPPER: z.string().min(32).optional(),

  // E-mail (envoi par Resend depuis Node, src/lib/email). Supabase n'envoie plus aucun e-mail.
  RESEND_API_KEY: optionalText,
  // `Nom <adresse@domaine>` ou `adresse@domaine`; défaut Convivia <noreply@convivia.app>.
  EMAIL_FROM: z
    .string()
    .optional()
    .refine((value) => value === undefined || parseMailbox(value) !== undefined, {
      message: 'adresse e-mail attendue',
    }),
  // Défaut support@convivia.app. Vide ('') = aucun en-tête (conservé par parseServerEnv).
  EMAIL_REPLY_TO: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === '' || parseMailbox(value) !== undefined, {
      message: 'adresse e-mail attendue',
    }),
  // Adresses séparées par des virgules. Hors production: seules ces adresses reçoivent un e-mail.
  EMAIL_TEST_ALLOWLIST: z
    .string()
    .optional()
    .transform((value, ctx) => {
      const list = parseEmailAllowlist(value);
      if (list === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'adresses e-mail séparées par des virgules attendues',
        });
        return z.NEVER;
      }
      return list;
    })
    .pipe(z.array(z.string()).max(20)),

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
