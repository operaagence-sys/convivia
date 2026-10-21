import { describe, expect, it } from 'vitest';
import {
  assertModeGuards,
  assertNoSecretPublicVariables,
  EnvGuardError,
  findSecretPublicValues,
  findSecretPublicVariables,
  isProduction,
  looksLikeSecretValue,
  resolveWhatsappDispatch,
} from './guards';

// Fausses clés fabriquées à l'exécution (jamais de clé littérale dans le dépôt).
const fakeKey = (kind: 'live' | 'sandbox') => ['sk', kind, 'x'.repeat(24)].join('_');

const base = {
  vercelEnv: undefined as string | undefined,
  whatsappMode: 'simulate' as string | undefined,
  fedapayEnv: 'sandbox' as string | undefined,
  fedapaySecretKey: undefined as string | undefined,
};

describe('isProduction', () => {
  it('accepte uniquement production, en comparaison stricte', () => {
    expect(isProduction('production')).toBe(true);
    for (const value of [undefined, '', 'preview', 'development', 'Production', 'production ']) {
      expect(isProduction(value)).toBe(false);
    }
  });
});

describe('assertModeGuards: WhatsApp', () => {
  it.each([undefined, 'development', 'preview', 'staging', ''])(
    'refuse le mode live quand VERCEL_ENV vaut %j',
    (vercelEnv) => {
      expect(() => assertModeGuards({ ...base, vercelEnv, whatsappMode: 'live' })).toThrow(
        EnvGuardError,
      );
    },
  );

  it('accepte le mode live en production', () => {
    expect(() =>
      assertModeGuards({
        ...base,
        vercelEnv: 'production',
        whatsappMode: 'live',
        fedapayEnv: 'live',
      }),
    ).not.toThrow();
  });

  it.each(['simulate', 'test'])('accepte le mode %s hors production', (whatsappMode) => {
    expect(() => assertModeGuards({ ...base, vercelEnv: 'preview', whatsappMode })).not.toThrow();
  });
});

describe('assertModeGuards: FedaPay', () => {
  it.each([undefined, 'development', 'preview'])(
    'refuse FEDAPAY_ENV live quand VERCEL_ENV vaut %j',
    (vercelEnv) => {
      expect(() => assertModeGuards({ ...base, vercelEnv, fedapayEnv: 'live' })).toThrow(
        EnvGuardError,
      );
    },
  );

  it.each([undefined, 'development', 'preview'])(
    'refuse une clé live même si FEDAPAY_ENV est sandbox (VERCEL_ENV %j)',
    (vercelEnv) => {
      expect(() =>
        assertModeGuards({ ...base, vercelEnv, fedapaySecretKey: fakeKey('live') }),
      ).toThrow(/live refusée/);
    },
  );

  it('refuse une clé live avec FEDAPAY_ENV sandbox même en production (incohérent)', () => {
    expect(() =>
      assertModeGuards({
        ...base,
        vercelEnv: 'production',
        whatsappMode: 'live',
        fedapayEnv: 'sandbox',
        fedapaySecretKey: fakeKey('live'),
      }),
    ).toThrow(/incohérente/);
  });

  it('refuse une clé sandbox avec FEDAPAY_ENV live en production', () => {
    expect(() =>
      assertModeGuards({
        ...base,
        vercelEnv: 'production',
        whatsappMode: 'live',
        fedapayEnv: 'live',
        fedapaySecretKey: fakeKey('sandbox'),
      }),
    ).toThrow(/incohérente/);
  });

  it('accepte clé live + env live en production, et clé sandbox + sandbox ailleurs', () => {
    expect(() =>
      assertModeGuards({
        ...base,
        vercelEnv: 'production',
        whatsappMode: 'live',
        fedapayEnv: 'live',
        fedapaySecretKey: fakeKey('live'),
      }),
    ).not.toThrow();
    expect(() =>
      assertModeGuards({ ...base, vercelEnv: 'preview', fedapaySecretKey: fakeKey('sandbox') }),
    ).not.toThrow();
  });

  it('ne recopie jamais la clé dans le message', () => {
    const key = fakeKey('live');
    try {
      assertModeGuards({ ...base, fedapaySecretKey: key });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(key);
    }
  });
});

describe('variables NEXT_PUBLIC_ secrètes', () => {
  // Noms assemblés à l'exécution: le test porte sur des noms, aucune valeur réelle.
  const serviceRole = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  // JWT factice (signature bidon): seul le rôle de la charge utile compte.
  const fakeJwt = (role: string) =>
    `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role, iss: 'supabase' })}.fake-signature`;
  const allowed = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x',
    NEXT_PUBLIC_SITE_URL: 'https://convivia.test',
    NEXT_PUBLIC_POSTHOG_KEY: 'x',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    NEXT_PUBLIC_SENTRY_DSN: 'x',
  };

  it('refuse un nom NEXT_PUBLIC_ hors liste blanche', () => {
    const env = {
      ...allowed,
      [`NEXT_PUBLIC_${serviceRole}`]: 'x',
      NEXT_PUBLIC_FEDAPAY_SK: 'x',
      NEXT_PUBLIC_RESEND_API_KEY: 'x',
      NEXT_PUBLIC_ANYTHING_ELSE: 'x',
      [serviceRole]: 'x',
    };
    expect(findSecretPublicVariables(env).sort()).toEqual([
      'NEXT_PUBLIC_ANYTHING_ELSE',
      'NEXT_PUBLIC_FEDAPAY_SK',
      'NEXT_PUBLIC_RESEND_API_KEY',
      `NEXT_PUBLIC_${serviceRole}`,
    ]);
    expect(() => assertNoSecretPublicVariables(env)).toThrow(EnvGuardError);
  });

  it('accepte les variables publiques prévues, une clé anonyme JWT role=anon et sb_publishable_', () => {
    expect(() => assertNoSecretPublicVariables(allowed)).not.toThrow();
    expect(() =>
      assertNoSecretPublicVariables({ ...allowed, NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeJwt('anon') }),
    ).not.toThrow();
    expect(() =>
      assertNoSecretPublicVariables({
        ...allowed,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc',
      }),
    ).not.toThrow();
  });

  it('refuse un JWT role=service_role dans une variable publique, sans afficher la valeur', () => {
    const jwt = fakeJwt('service_role');
    const env = { ...allowed, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt };
    expect(findSecretPublicValues(env)).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    let message = '';
    try {
      assertNoSecretPublicVariables(env);
    } catch (error) {
      expect(error).toBeInstanceOf(EnvGuardError);
      message = (error as Error).message;
    }
    expect(message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(message).not.toContain(jwt);
    expect(message).not.toContain('fake-signature');
  });

  it('refuse un JWT service_role entouré d’espaces', () => {
    expect(looksLikeSecretValue(`  ${fakeJwt('service_role')}  `)).toBe(true);
  });

  it('refuse sb_secret_ et les préfixes de clés FedaPay (test, sandbox)', () => {
    for (const value of ['sb_secret_abc', '  sb_secret_abc  ', 'sk_test_abc', 'sk_sandbox_abc']) {
      expect(looksLikeSecretValue(value)).toBe(true);
      expect(() =>
        assertNoSecretPublicVariables({ ...allowed, NEXT_PUBLIC_POSTHOG_KEY: value }),
      ).toThrow(/NEXT_PUBLIC_POSTHOG_KEY/);
    }
    expect(looksLikeSecretValue('prefix-sk_test_abc')).toBe(true);
  });

  it('ne se trompe pas sur des valeurs ordinaires ou un JWT illisible', () => {
    expect(looksLikeSecretValue('')).toBe(false);
    expect(looksLikeSecretValue('https://abc.supabase.co')).toBe(false);
    expect(looksLikeSecretValue('a.b.c')).toBe(false);
    expect(looksLikeSecretValue('a.%%%.c')).toBe(false);
    expect(looksLikeSecretValue(fakeJwt('authenticated'))).toBe(false);
  });

  it('accepte les variables système Vercel NEXT_PUBLIC_VERCEL_*', () => {
    const env = {
      ...allowed,
      NEXT_PUBLIC_VERCEL_URL: 'convivia-abc.vercel.app',
      NEXT_PUBLIC_VERCEL_ENV: 'preview',
      NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'abc123',
    };
    expect(findSecretPublicVariables(env)).toEqual([]);
    expect(() => assertNoSecretPublicVariables(env)).not.toThrow();
  });

  it('contrôle quand même la valeur des NEXT_PUBLIC_VERCEL_*', () => {
    const jwt = fakeJwt('service_role');
    const env = { ...allowed, NEXT_PUBLIC_VERCEL_X: jwt };
    expect(findSecretPublicValues(env)).toEqual(['NEXT_PUBLIC_VERCEL_X']);
    expect(() => assertNoSecretPublicVariables(env)).toThrow(/NEXT_PUBLIC_VERCEL_X/);
  });

  it('refuse NEXT_PUBLIC_VERCELX (sans tiret bas)', () => {
    const env = { ...allowed, NEXT_PUBLIC_VERCELX: 'x' };
    expect(findSecretPublicVariables(env)).toEqual(['NEXT_PUBLIC_VERCELX']);
    expect(() => assertNoSecretPublicVariables(env)).toThrow(EnvGuardError);
  });

  it('ne contrôle pas les variables serveur (pas de préfixe NEXT_PUBLIC_)', () => {
    expect(() =>
      assertNoSecretPublicVariables({ ...allowed, [serviceRole]: fakeJwt('service_role') }),
    ).not.toThrow();
  });
});

describe('resolveWhatsappDispatch', () => {
  const allowlist = ['+22900000001'];

  it('simulate: jamais d’envoi', () => {
    expect(
      resolveWhatsappDispatch({
        vercelEnv: undefined,
        mode: 'simulate',
        allowlist,
        recipientE164: '+22900000001',
      }),
    ).toBe('simulate');
  });

  it('test: envoi seulement vers la liste blanche', () => {
    const common = { vercelEnv: 'preview', mode: 'test' as const, allowlist };
    expect(resolveWhatsappDispatch({ ...common, recipientE164: '+22900000001' })).toBe('send');
    expect(resolveWhatsappDispatch({ ...common, recipientE164: '+22900000002' })).toBe('simulate');
    expect(
      resolveWhatsappDispatch({ ...common, allowlist: [], recipientE164: '+22900000001' }),
    ).toBe('simulate');
  });

  it('live: refusé hors production même si seule cette fonction est appelée', () => {
    expect(() =>
      resolveWhatsappDispatch({
        vercelEnv: 'preview',
        mode: 'live',
        allowlist,
        recipientE164: '+22900000002',
      }),
    ).toThrow(EnvGuardError);
  });

  it('live: envoi en production', () => {
    expect(
      resolveWhatsappDispatch({
        vercelEnv: 'production',
        mode: 'live',
        allowlist: [],
        recipientE164: '+22900000002',
      }),
    ).toBe('send');
  });
});

describe('assertModeGuards: production exige WhatsApp live', () => {
  it.each(['simulate', 'test', undefined, ''])(
    'refuse le mode %j en production, sans recopier la valeur',
    (whatsappMode) => {
      const attempt = () =>
        assertModeGuards({ ...base, vercelEnv: 'production', whatsappMode, fedapayEnv: 'live' });
      expect(attempt).toThrow(EnvGuardError);
      expect(attempt).toThrow(/doit valoir live/);
    },
  );
});
