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
