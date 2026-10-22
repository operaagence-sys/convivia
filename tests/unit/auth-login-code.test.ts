import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnvCache } from '@/lib/env/server';
import { emailQuota, hashLoginIdentifier } from '@/lib/auth/identifier';
import { computeCodeHmac, generateLoginCode } from '@/lib/auth/login-code';
import { hashIp, normalizeIp48 } from '@/lib/auth/client-ip';

// Formules du code de connexion (TRD D47-D58), vérifiées avec des vecteurs fixes: toute
// modification de ces formules casse la compatibilité avec les codes déjà émis et les compteurs.

vi.mock('next/headers', () => ({
  cookies: async () => ({}),
  headers: async () => new Headers(),
}));

beforeEach(() => {
  vi.stubEnv('LOGIN_ATTEMPTS_HASH_SECRET', 'a'.repeat(32));
  vi.stubEnv('LOGIN_CODE_PEPPER', 'p'.repeat(32));
  vi.stubEnv('LOGIN_IP_HASH_SECRET', 'i'.repeat(32));
  resetServerEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe('emailQuota', () => {
  it.each([
    ['awa@exemple.com', 'awa@exemple.com'],
    ['awa+promo@exemple.com', 'awa@exemple.com'],
    ['awa+a+b@exemple.com', 'awa@exemple.com'],
    ['awa.k@exemple.com', 'awa.k@exemple.com'], // points conservés hors Gmail
    ['awa.k+x@gmail.com', 'awak@gmail.com'],
    ['a.w.a@gmail.com', 'awa@gmail.com'],
    ['awa.k@googlemail.com', 'awak@gmail.com'],
    ['awa+x@googlemail.com', 'awa@gmail.com'],
    ['+tag@exemple.com', '+tag@exemple.com'], // « + » en tête: conservé
    ['+tag.x@gmail.com', '+tagx@gmail.com'],
    ['"a@b"@exemple.com', '"a@b"@exemple.com'], // découpe au DERNIER @
    ['awa@gmail.com.evil.com', 'awa@gmail.com.evil.com'],
  ])('%s -> %s', (input, expected) => {
    expect(emailQuota(input)).toBe(expected);
  });

  it('toutes les variantes d’une même boîte Gmail ont la même empreinte de quota', () => {
    const ids = ['awa.k@gmail.com', 'awak+a@gmail.com', 'a.w.a.k@googlemail.com'].map(
      hashLoginIdentifier,
    );
    expect(new Set(ids).size).toBe(1);
    expect(hashLoginIdentifier('awak@exemple.com')).not.toBe(ids[0]);
  });
});

describe('empreintes (vecteurs fixes)', () => {
  const ID = '771b320fb130b08efe6b56ee82380f029938a2cc65ca984029127dccd0a53deb';

  it('p_identifier_hash = HMAC-SHA256(secret, emailQuota)', () => {
    expect(hashLoginIdentifier('awa@gmail.com')).toBe(ID);
    expect(hashLoginIdentifier('a.w.a+x@googlemail.com')).toBe(ID);
  });

  it('p_code_hmac = HMAC-SHA256(pepper, "login-code:v1:" + id + ":" + code + ":" + adresse)', () => {
    expect(
      computeCodeHmac({ identifierHash: ID, code: '042517', emailAccount: 'awa@gmail.com' }),
    ).toBe('f646df3c9f5400079c4f4ae31bf85a82cc363be89201330296ac8bfe80d8d6e0');
  });

  it('le code est lié à l’adresse exacte du compte, pas seulement au quota', () => {
    const base = { identifierHash: ID, code: '042517', emailAccount: 'awa+x@gmail.com' };
    expect(computeCodeHmac({ ...base, emailAccount: 'awa+y@gmail.com' })).not.toBe(
      computeCodeHmac(base),
    );
    expect(computeCodeHmac({ ...base, code: '042518' })).not.toBe(computeCodeHmac(base));
  });

  it('p_ip48_hash: HMAC du préfixe /48 écrit h0:h1:h2::/48, seulement pour une IPv6 non mappée', () => {
    expect(normalizeIp48('2001:0db8:ABCD:1234::1')).toBe('2001:db8:abcd::/48');
    expect(hashIp('2001:db8:abcd::/48')).toBe(
      '8ab061dd30ccc2ca13ae12609f329dddea4bfd8b9e86f691042c425b2205ad86',
    );
    expect(normalizeIp48('[2001:db8:abcd:1::1]')).toBe('2001:db8:abcd::/48');
    expect(normalizeIp48('2001:db8:abcd:ffff::9')).toBe(normalizeIp48('2001:db8:abcd::2'));
    expect(normalizeIp48('203.0.113.7')).toBeNull();
    expect(normalizeIp48('::ffff:203.0.113.7')).toBeNull();
    expect(normalizeIp48('unknown')).toBeNull();
    expect(normalizeIp48(undefined)).toBeNull();
  });
});

describe('code à 6 chiffres', () => {
  it('toujours 6 chiffres, zéros de tête conservés', () => {
    const codes = Array.from({ length: 2000 }, generateLoginCode);
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
  });

  it('n’utilise pas Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    generateLoginCode();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
