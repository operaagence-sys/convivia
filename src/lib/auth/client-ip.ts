import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { isOnVercel } from '@/lib/env/public';
import { requireServerEnv } from '@/lib/env/server';

/** Valeur utilisée quand l'IP est introuvable ou non fiable: tous ces visiteurs partagent un seuil. */
export const UNKNOWN_IP = 'unknown';

/**
 * Normalise une IP pour la limite par IP (TRD D58):
 * - IPv4 telle quelle ; `::ffff:a.b.c.d` (et sa forme hexadécimale) devient l'IPv4 ;
 * - IPv6 réduite à son préfixe /64 (un abonné reçoit au moins un /64: sinon il changerait d'IP
 *   à volonté), écrit `h0:h1:h2:h3::/64` en minuscules sans zéros de tête ;
 * - tout le reste (vide, invalide) devient `unknown`.
 */
export function normalizeIp(raw: string | null | undefined): string {
  let value = (raw ?? '').trim();
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
  const zone = value.indexOf('%');
  if (zone !== -1) value = value.slice(0, zone);

  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return UNKNOWN_IP;

  const groups = expandIpv6(value);
  if (!groups) return UNKNOWN_IP;

  // ::ffff:0:0/96 (IPv4 mappée): les deux derniers groupes portent l'IPv4.
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    const [high, low] = [groups[6]!, groups[7]!];
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}

/** Les 8 groupes de 16 bits d'une IPv6 valide (gère `::` et l'IPv4 en queue), sinon `undefined`. */
function expandIpv6(address: string): number[] | undefined {
  let text = address.toLowerCase();
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return undefined;
    }
    const hex = (a: number, b: number) => ((a << 8) | b).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hex(octets[0]!, octets[1]!)}:${hex(octets[2]!, octets[3]!)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return undefined;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const head = parse(halves[0]!);
  const rest = halves.length === 2 ? parse(halves[1]!) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const groups = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : Number.NaN));
  return groups.length === 8 && groups.every((g) => !Number.isNaN(g)) ? groups : undefined;
}

/**
 * Préfixe /48 d'une IPv6 non mappée, écrit `h0:h1:h2::/48` (minuscules, sans zéros de tête).
 * `null` pour une IPv4, une IPv6 mappée sur IPv4 ou une valeur invalide: la limite par /48 ne
 * s'applique qu'aux IPv6 (TRD D58).
 */
export function normalizeIp48(raw: string | null | undefined): string | null {
  let value = (raw ?? '').trim();
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
  const zone = value.indexOf('%');
  if (zone !== -1) value = value.slice(0, zone);
  if (isIP(value) !== 6) return null;
  const groups = expandIpv6(value);
  if (!groups) return null;
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) return null;
  return `${groups
    .slice(0, 3)
    .map((g) => g.toString(16))
    .join(':')}::/48`;
}

/** HMAC-SHA256 de l'IP normalisée (ou du préfixe /48), hexadécimal minuscule (64 caractères). */
export function hashIp(normalizedIp: string): string {
  const { LOGIN_IP_HASH_SECRET } = requireServerEnv('LOGIN_IP_HASH_SECRET');
  return createHmac('sha256', LOGIN_IP_HASH_SECRET).update(normalizedIp).digest('hex');
}

/**
 * Source de l'IP: uniquement sur Vercel. Vercel ÉCRASE `x-vercel-forwarded-for`, `x-real-ip` et
 * `x-forwarded-for` avec l'adresse réelle du client (il ne transmet pas les valeurs envoyées par
 * le visiteur): `x-vercel-forwarded-for` est préféré (audit F3), puis `x-real-ip`, puis le
 * premier élément de `x-forwarded-for`. Hors Vercel (poste local, CI), ces en-têtes viennent du
 * client et peuvent être inventés pour échapper à la limite: on les ignore (`unknown`).
 */
export function pickClientIp(
  get: (name: string) => string | null,
  onVercel: boolean,
): string | undefined {
  if (!onVercel) return undefined;
  const vercel = get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercel) return vercel;
  const real = get('x-real-ip')?.trim();
  if (real) return real;
  return get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
}

export type ClientIp = {
  /** IP normalisée (voir `normalizeIp`), ou `unknown`. */
  normalized: string;
  /** Empreinte (IPv4 ou /64) pour `login_code_issue` / `login_code_verify` (`p_ip_hash`). */
  hash: string;
  /** Empreinte du /48 (`p_ip48_hash`), `null` pour une IPv4 ou une IPv6 mappée. */
  hash48: string | null;
  /** IP brute à transmettre à Supabase Auth, absente si inconnue. */
  forwarded: string | undefined;
};

export async function getClientIp(): Promise<ClientIp> {
  const store = await headers();
  const onVercel = isOnVercel();
  const raw = pickClientIp((name) => store.get(name), onVercel);
  const normalized = normalizeIp(raw);
  if (onVercel && normalized === UNKNOWN_IP) {
    // Événement fixe (aucune IP, aucun en-tête): tous ces visiteurs partagent un seuil.
    console.error('[auth] ip_unknown_on_vercel');
  }
  const prefix48 = normalizeIp48(raw);
  return {
    normalized,
    hash: hashIp(normalized),
    hash48: prefix48 ? hashIp(prefix48) : null,
    forwarded: normalized === UNKNOWN_IP ? undefined : raw?.replace(/^\[|\]$/g, ''),
  };
}
