import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertProductionRequiredEnv,
  PRODUCTION_ENV_PLANNED,
  PRODUCTION_REQUIRED_ENV,
} from './guards';
import { resetServerEnvCache } from './server';
import { assertServerEnvAtStartup } from './startup';

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

// Les variables sont posées dans le code du test (jamais dans une commande).
function setEnv(vars: Record<string, string>) {
  resetServerEnvCache();
  for (const key of ['VERCEL_ENV', 'WHATSAPP_MODE', 'FEDAPAY_ENV', 'FEDAPAY_SECRET_KEY']) {
    vi.stubEnv(key, '');
  }
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
}

describe('assertServerEnvAtStartup', () => {
  it('passe en local sans aucune variable', () => {
    setEnv({});
    expect(() => assertServerEnvAtStartup()).not.toThrow();
  });

  it('échoue au démarrage pour un preview en mode WhatsApp live', () => {
    setEnv({ VERCEL_ENV: 'preview', WHATSAPP_MODE: 'live' });
    expect(() => assertServerEnvAtStartup()).toThrow(/live refusé/);
  });

  it.each(['simulate', 'test'])('échoue en production avec le mode WhatsApp %s', (mode) => {
    setEnv({ VERCEL_ENV: 'production', WHATSAPP_MODE: mode });
    expect(() => assertServerEnvAtStartup()).toThrow(/doit valoir live/);
  });

  it('échoue en production sans mode WhatsApp (défaut simulate)', () => {
    setEnv({ VERCEL_ENV: 'production' });
    expect(() => assertServerEnvAtStartup()).toThrow(/doit valoir live/);
  });

  it("n'inclut aucune valeur de variable dans le message", () => {
    setEnv({ VERCEL_ENV: 'production', WHATSAPP_MODE: 'simulate' });
    expect(() => assertServerEnvAtStartup()).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('simulate') }),
    );
  });
});

// Valeurs factices fabriquées à l'exécution (aucune clé littérale dans le dépôt).
const fakeKey = (kind: 'live' | 'sandbox') => ['sk', kind, 'y'.repeat(24)].join('_');
const FILLER = 'valeur-factice-test';

function productionVars(overrides: Record<string, string> = {}): Record<string, string> {
  const vars: Record<string, string> = {
    VERCEL_ENV: 'production',
    WHATSAPP_MODE: 'live',
    FEDAPAY_ENV: 'live',
    FEDAPAY_SECRET_KEY: fakeKey('live'),
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
    // Formats imposés par le schéma: 32 caractères au moins, préfixe sb_secret_.
    LOGIN_ATTEMPTS_HASH_SECRET: 'x'.repeat(32),
    LOGIN_IP_HASH_SECRET: 'y'.repeat(32),
    LOGIN_CODE_PEPPER: 'z'.repeat(32),
    SUPABASE_SECRET_KEY: 'sb_secret_fake',
  };
  for (const name of PRODUCTION_REQUIRED_ENV) vars[name] ??= FILLER;
  return { ...vars, ...overrides };
}

function clearAll(vars: Record<string, string>) {
  // Neutralise les variables du jeu complet avant de poser celles du test.
  setEnv({});
  for (const name of PRODUCTION_REQUIRED_ENV) vi.stubEnv(name, '');
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
}

describe('assertServerEnvAtStartup: production', () => {
  it('passe avec WhatsApp live, FedaPay live, clé live et toutes les variables', () => {
    clearAll(productionVars());
    expect(() => assertServerEnvAtStartup()).not.toThrow();
  });

  it('refuse FEDAPAY_ENV sandbox', () => {
    clearAll(productionVars({ FEDAPAY_ENV: 'sandbox', FEDAPAY_SECRET_KEY: fakeKey('sandbox') }));
    expect(() => assertServerEnvAtStartup()).toThrow(/FedaPay sandbox refusé en production/);
  });

  it('refuse FEDAPAY_ENV absent (défaut sandbox)', () => {
    clearAll(productionVars({ FEDAPAY_ENV: '', FEDAPAY_SECRET_KEY: '' }));
    expect(() => assertServerEnvAtStartup()).toThrow(/FedaPay sandbox refusé en production/);
  });

  it('refuse une clé sandbox même avec FEDAPAY_ENV live, sans la recopier', () => {
    const key = fakeKey('sandbox');
    clearAll(productionVars({ FEDAPAY_SECRET_KEY: key }));
    expect(() => assertServerEnvAtStartup()).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(key) }),
    );
  });

  it('refuse une clé qui ne ressemble pas à une clé live', () => {
    clearAll(productionVars({ FEDAPAY_SECRET_KEY: FILLER }));
    expect(() => assertServerEnvAtStartup()).toThrow(/non live refusée en production/);
  });

  it('refuse une variable manquante en citant son nom, sans valeur', () => {
    clearAll(productionVars({ SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }));
    let message = '';
    try {
      assertServerEnvAtStartup();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(message).not.toContain(FILLER);
    expect(message).not.toContain('sk_live');
  });

  it.each([...PRODUCTION_REQUIRED_ENV])('refuse l’absence de %s', (name) => {
    clearAll(productionVars({ [name]: '' }));
    expect(() => assertServerEnvAtStartup()).toThrow(new RegExp(name));
  });
});

describe('variables prévues pour les tranches suivantes', () => {
  it('ne sont pas exigées en production, mais restent listées sans doublon', () => {
    const planned = Object.keys(PRODUCTION_ENV_PLANNED);
    expect(planned.length).toBeGreaterThan(0);
    for (const name of planned) {
      expect(PRODUCTION_REQUIRED_ENV as readonly string[]).not.toContain(name);
    }
    clearAll(productionVars());
    for (const name of planned) vi.stubEnv(name, '');
    expect(() => assertServerEnvAtStartup()).not.toThrow();
  });

  it('garde-fous inchangés sans ces variables: WhatsApp non live et FedaPay sandbox refusés', () => {
    clearAll(productionVars({ WHATSAPP_MODE: 'simulate' }));
    expect(() => assertServerEnvAtStartup()).toThrow(/doit valoir live/);
    clearAll(productionVars({ FEDAPAY_ENV: 'sandbox', FEDAPAY_SECRET_KEY: '' }));
    expect(() => assertServerEnvAtStartup()).toThrow(/FedaPay sandbox refusé en production/);
    clearAll(productionVars({ FEDAPAY_SECRET_KEY: FILLER }));
    expect(() => assertServerEnvAtStartup()).toThrow(/non live refusée en production/);
  });
});

describe('assertServerEnvAtStartup: hors production, exigences inchangées', () => {
  it('preview sans variable indispensable: passe (mode test, sandbox)', () => {
    clearAll({ VERCEL_ENV: 'preview', WHATSAPP_MODE: 'test', FEDAPAY_ENV: 'sandbox' });
    expect(() => assertServerEnvAtStartup()).not.toThrow();
  });

  it('preview avec clé sandbox: passe', () => {
    clearAll({ VERCEL_ENV: 'preview', FEDAPAY_SECRET_KEY: fakeKey('sandbox') });
    expect(() => assertServerEnvAtStartup()).not.toThrow();
  });

  it('local avec clé sandbox: passe; FedaPay live reste refusé', () => {
    clearAll({ FEDAPAY_SECRET_KEY: fakeKey('sandbox') });
    expect(() => assertServerEnvAtStartup()).not.toThrow();
    clearAll({ FEDAPAY_ENV: 'live' });
    expect(() => assertServerEnvAtStartup()).toThrow(/live refusé/);
  });
});

describe('assertProductionRequiredEnv (utilisé par next.config.ts au build)', () => {
  it('sans effet hors production, même sans aucune variable', () => {
    for (const vercelEnv of [undefined, 'development', 'preview']) {
      expect(() => assertProductionRequiredEnv(vercelEnv, {})).not.toThrow();
    }
  });

  it('en production, liste les noms manquants seulement', () => {
    expect(() =>
      assertProductionRequiredEnv('production', { SUPABASE_SERVICE_ROLE_KEY: FILLER }),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(FILLER),
      }),
    );
    expect(() => assertProductionRequiredEnv('production', productionVars())).not.toThrow();
  });
});
