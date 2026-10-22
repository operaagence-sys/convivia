import 'server-only';
import { createHmac, randomInt } from 'node:crypto';
import { requireServerEnv } from '@/lib/env/server';

export const CODE_PATTERN = /^\d{6}$/;

/**
 * Code de connexion à 6 chiffres, tiré par `crypto.randomInt` (jamais `Math.random`). Il ne doit
 * apparaître dans aucun journal ni aucune réponse: il n'existe qu'ici, dans l'e-mail envoyé et
 * (sous forme d'empreinte) dans la base.
 */
export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Empreinte du code (`p_code_hmac`): HMAC-SHA256(LOGIN_CODE_PEPPER,
 * "login-code:v1:" + identifierHash + ":" + code + ":" + emailAccount), hexadécimal minuscule.
 * Le même calcul sert à l'émission (code tiré) et à la vérification (code saisi).
 */
export function computeCodeHmac(args: {
  identifierHash: string;
  code: string;
  emailAccount: string;
}): string {
  const { LOGIN_CODE_PEPPER } = requireServerEnv('LOGIN_CODE_PEPPER');
  return createHmac('sha256', LOGIN_CODE_PEPPER)
    .update(`login-code:v1:${args.identifierHash}:${args.code}:${args.emailAccount}`)
    .digest('hex');
}
