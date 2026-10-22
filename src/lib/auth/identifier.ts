import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { requireServerEnv } from '@/lib/env/server';
import { emailAddressSchema } from '@/lib/email/policy';

/** E-mail en minuscules, sans espaces de bord, au format valide (254 caractères au plus). */
// Même règle que l'envoi (`@/lib/email/policy`): une adresse saisie est une adresse envoyable.
const emailSchema = z.string().trim().toLowerCase().pipe(emailAddressSchema);

/** Renvoie l'e-mail normalisé, ou `null` si l'entrée n'est pas une adresse valide. */
export function parseEmail(input: unknown): string | null {
  const result = emailSchema.safeParse(input);
  return result.success ? result.data : null;
}

/**
 * Adresse « de quota »: regroupe les variantes d'une même boîte pour les limites (60 s, 3 / h,
 * 5 échecs). Découpe au dernier `@`; partie locale coupée au premier `+` (sauf en position 0);
 * `googlemail.com` devient `gmail.com`; pour `gmail.com`, les points de la partie locale sont
 * retirés. Ne sert QU'AUX quotas: le compte, `createUser` et `p_email` gardent l'adresse exacte.
 */
export function emailQuota(emailAccount: string): string {
  const at = emailAccount.lastIndexOf('@');
  if (at === -1) return emailAccount;
  let local = emailAccount.slice(0, at);
  let domain = emailAccount.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replaceAll('.', '');
  return `${local}@${domain}`;
}

/**
 * Empreinte de quota (`p_identifier_hash`): HMAC-SHA256 de `emailQuota`, hexadécimal minuscule.
 * Calculée côté serveur uniquement: le secret ne quitte jamais Node, et l'e-mail n'est jamais
 * écrit dans la table.
 */
export function hashLoginIdentifier(emailAccount: string): string {
  const { LOGIN_ATTEMPTS_HASH_SECRET } = requireServerEnv('LOGIN_ATTEMPTS_HASH_SECRET');
  return createHmac('sha256', LOGIN_ATTEMPTS_HASH_SECRET)
    .update(emailQuota(emailAccount))
    .digest('hex');
}

/** Secondes jusqu'à `iso` (au moins 1) ; `fallback` si la date manque ou est illisible. */
export function secondsUntil(iso: string | null | undefined, now: number, fallback = 60): number {
  if (!iso) return fallback;
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return fallback;
  return Math.max(1, Math.ceil((target - now) / 1000));
}
