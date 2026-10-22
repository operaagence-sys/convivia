import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTION_REQUIRED_ENV } from './guards';
import {
  getFedapayConfig,
  getServerEnv,
  getWhatsappConfig,
  parseServerEnv,
  requireServerEnv,
  resetServerEnvCache,
  whatsappDispatchFor,
} from './server';

// Les variables sont posées ici, dans le code du test (jamais dans une commande).
const fakeKey = (kind: 'live' | 'sandbox') => ['sk', kind, 'y'.repeat(24)].join('_');

afterEach(() => {
  resetServerEnvCache();
});

describe('parseServerEnv', () => {
  it('démarre sans aucune variable: mode simulate et FedaPay sandbox par défaut', () => {
    const env = parseServerEnv({});
    expect(env.WHATSAPP_MODE).toBe('simulate');
    expect(env.FEDAPAY_ENV).toBe('sandbox');
    expect(env.WHATSAPP_TEST_ALLOWLIST).toEqual([]);
  });

  it('traite les valeurs vides comme absentes (copie de .env.example)', () => {
    const env = parseServerEnv({ WHATSAPP_MODE: '', FEDAPAY_SECRET_KEY: '', SENTRY_DSN: '' });
    expect(env.WHATSAPP_MODE).toBe('simulate');
    expect(env.FEDAPAY_SECRET_KEY).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('refuse un mode WhatsApp inconnu (échec fermé)', () => {
    expect(() => parseServerEnv({ WHATSAPP_MODE: 'prod' })).toThrow(/WHATSAPP_MODE/);
  });

  it('refuse le mode live WhatsApp hors production, avec ou sans VERCEL_ENV', () => {
    expect(() => parseServerEnv({ WHATSAPP_MODE: 'live' })).toThrow(/live refusé/);
    expect(() => parseServerEnv({ WHATSAPP_MODE: 'live', VERCEL_ENV: 'preview' })).toThrow(
      /live refusé/,
    );
    expect(() => parseServerEnv({ WHATSAPP_MODE: 'live', VERCEL_ENV: 'development' })).toThrow(
      /live refusé/,
    );
  });

  it('refuse une clé FedaPay live hors production', () => {
    expect(() =>
      parseServerEnv({ VERCEL_ENV: 'preview', FEDAPAY_SECRET_KEY: fakeKey('live') }),
    ).toThrow(/live refusée/);
    expect(() => parseServerEnv({ FEDAPAY_ENV: 'live' })).toThrow(/FedaPay live refusé/);
  });

  it('accepte le live complet en production', () => {
    const required = Object.fromEntries(PRODUCTION_REQUIRED_ENV.map((name) => [name, 'factice']));
    const env = parseServerEnv({
      ...required,
      LOGIN_ATTEMPTS_HASH_SECRET: 'x'.repeat(32),
      LOGIN_IP_HASH_SECRET: 'y'.repeat(32),
      LOGIN_CODE_PEPPER: 'z'.repeat(32),
      SUPABASE_SECRET_KEY: 'sb_secret_fake',
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
      VERCEL_ENV: 'production',
      WHATSAPP_MODE: 'live',
      FEDAPAY_ENV: 'live',
      FEDAPAY_SECRET_KEY: fakeKey('live'),
    });
    expect(env.WHATSAPP_MODE).toBe('live');
  });

  it('refuse une valeur VERCEL_ENV inconnue', () => {
    expect(() => parseServerEnv({ VERCEL_ENV: 'prod' })).toThrow(/VERCEL_ENV/);
  });

  it('refuse un secret préfixé NEXT_PUBLIC_', () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x' })).toThrow(
      /NEXT_PUBLIC_/,
    );
  });

  it('valide la liste blanche de test (E.164, 5 au plus)', () => {
    expect(
      parseServerEnv({ WHATSAPP_TEST_ALLOWLIST: '+22900000001, +22500000002' })
        .WHATSAPP_TEST_ALLOWLIST,
    ).toEqual(['+22900000001', '+22500000002']);
    expect(() => parseServerEnv({ WHATSAPP_TEST_ALLOWLIST: '0197000000' })).toThrow();
    expect(() =>
      parseServerEnv({
        WHATSAPP_TEST_ALLOWLIST: Array.from({ length: 6 }, (_, i) => `+2290000000${i}`).join(','),
      }),
    ).toThrow();
  });

  it('ne recopie pas les valeurs dans les messages d’erreur', () => {
    try {
      parseServerEnv({ WHATSAPP_MODE: 'valeur-secrète-unique' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('valeur-secrète-unique');
    }
  });
});

describe('accès via process.env', () => {
  it('getServerEnv applique les garde-fous', () => {
    vi.stubEnv('WHATSAPP_MODE', 'live');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(() => getServerEnv()).toThrow(/live refusé/);
  });

  it('getWhatsappConfig et whatsappDispatchFor suivent le mode test', () => {
    vi.stubEnv('WHATSAPP_MODE', 'test');
    vi.stubEnv('WHATSAPP_TEST_ALLOWLIST', '+22900000001');
    expect(getWhatsappConfig()).toEqual({ mode: 'test', allowlist: ['+22900000001'] });
    expect(whatsappDispatchFor('+22900000001')).toBe('send');
    expect(whatsappDispatchFor('+22900000009')).toBe('simulate');
  });

  it('requireServerEnv signale les variables manquantes par leur nom', () => {
    expect(() => requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('getFedapayConfig exige la clé secrète', () => {
    expect(() => getFedapayConfig()).toThrow(/FEDAPAY_SECRET_KEY/);
    vi.stubEnv('FEDAPAY_SECRET_KEY', fakeKey('sandbox'));
    resetServerEnvCache();
    expect(getFedapayConfig().env).toBe('sandbox');
  });
});

describe('secrets de connexion (tranche 2)', () => {
  it('refuse un secret de hachage de moins de 32 caractères', () => {
    expect(() => parseServerEnv({ LOGIN_ATTEMPTS_HASH_SECRET: 'x'.repeat(31) })).toThrow(
      /LOGIN_ATTEMPTS_HASH_SECRET/,
    );
    expect(() => parseServerEnv({ LOGIN_IP_HASH_SECRET: 'y'.repeat(31) })).toThrow(
      /LOGIN_IP_HASH_SECRET/,
    );
    expect(
      parseServerEnv({
        LOGIN_ATTEMPTS_HASH_SECRET: 'x'.repeat(32),
        LOGIN_IP_HASH_SECRET: 'y'.repeat(32),
      }).LOGIN_IP_HASH_SECRET,
    ).toHaveLength(32);
  });

  it('SUPABASE_SECRET_KEY doit commencer par sb_secret_', () => {
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: 'eyJhbGciOi.service.role' })).toThrow(
      /SUPABASE_SECRET_KEY/,
    );
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: 'sb_secret_abc' }).SUPABASE_SECRET_KEY).toBe(
      'sb_secret_abc',
    );
  });

  it('SUPABASE_SECRET_KEY ne peut jamais être exposée au navigateur', () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_SECRET_KEY: 'sb_secret_abc' })).toThrow();
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_abc' })).toThrow();
  });

  it('les variables de connexion et d’e-mail sont exigées en production', () => {
    for (const name of [
      'LOGIN_ATTEMPTS_HASH_SECRET',
      'LOGIN_IP_HASH_SECRET',
      'LOGIN_CODE_PEPPER',
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
    ])
      expect(PRODUCTION_REQUIRED_ENV).toContain(name);
  });

  it('refuse deux secrets de connexion identiques, sans afficher la valeur', () => {
    const same = 's'.repeat(32);
    const pairs: Array<Record<string, string>> = [
      { LOGIN_CODE_PEPPER: same, LOGIN_ATTEMPTS_HASH_SECRET: same },
      { LOGIN_CODE_PEPPER: same, LOGIN_IP_HASH_SECRET: same },
      { LOGIN_ATTEMPTS_HASH_SECRET: same, LOGIN_IP_HASH_SECRET: same },
    ];
    for (const pair of pairs) {
      expect(() => parseServerEnv(pair)).toThrow(/identiques refusés/);
      expect(() => parseServerEnv(pair)).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining(same) }),
      );
    }
    expect(() =>
      parseServerEnv({
        LOGIN_CODE_PEPPER: 'a'.repeat(32),
        LOGIN_ATTEMPTS_HASH_SECRET: 'b'.repeat(32),
        LOGIN_IP_HASH_SECRET: 'c'.repeat(32),
      }),
    ).not.toThrow();
  });

  it('refuse un poivre de code de moins de 32 caractères', () => {
    expect(() => parseServerEnv({ LOGIN_CODE_PEPPER: 'p'.repeat(31) })).toThrow(
      /LOGIN_CODE_PEPPER/,
    );
    expect(parseServerEnv({ LOGIN_CODE_PEPPER: 'p'.repeat(32) }).LOGIN_CODE_PEPPER).toHaveLength(
      32,
    );
  });
});

describe('e-mail (Resend)', () => {
  it('valide l’expéditeur, la réponse et la liste blanche', () => {
    expect(() => parseServerEnv({ EMAIL_FROM: 'pas une adresse' })).toThrow(/EMAIL_FROM/);
    expect(() => parseServerEnv({ EMAIL_REPLY_TO: 'x' })).toThrow(/EMAIL_REPLY_TO/);
    expect(() => parseServerEnv({ EMAIL_TEST_ALLOWLIST: 'a@x.fr, nope' })).toThrow(
      /EMAIL_TEST_ALLOWLIST/,
    );
    expect(
      parseServerEnv({ EMAIL_TEST_ALLOWLIST: 'A@x.fr, b@y.com' }).EMAIL_TEST_ALLOWLIST,
    ).toEqual(['a@x.fr', 'b@y.com']);
    expect(parseServerEnv({}).EMAIL_TEST_ALLOWLIST).toEqual([]);
  });

  it('EMAIL_REPLY_TO vide est conservé (aucun en-tête), absent = défaut', () => {
    expect(parseServerEnv({ EMAIL_REPLY_TO: '' }).EMAIL_REPLY_TO).toBe('');
    expect(parseServerEnv({}).EMAIL_REPLY_TO).toBeUndefined();
  });

  it('un expéditeur hors convivia.app est refusé en production, accepté ailleurs', () => {
    const production = {
      VERCEL_ENV: 'production',
      WHATSAPP_MODE: 'live',
      FEDAPAY_ENV: 'live',
      EMAIL_FROM: 'Convivia <onboarding@resend.dev>',
    };
    expect(() => parseServerEnv(production)).toThrow(/convivia\.app/);
    expect(
      parseServerEnv({ EMAIL_FROM: 'Convivia <onboarding@resend.dev>', VERCEL_ENV: 'preview' })
        .EMAIL_FROM,
    ).toBe('Convivia <onboarding@resend.dev>');
  });
});
