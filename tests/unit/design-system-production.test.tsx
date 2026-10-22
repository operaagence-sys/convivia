// Tranche 1 : /design-system est introuvable (404) en production (08 tranche 1, 09 § 20 bis).
import { describe, expect, it, vi } from 'vitest';
import { resetServerEnvCache } from '../../src/lib/env/server';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('../../src/app/design-system/showcase', () => ({ Showcase: () => null }));

async function callPage() {
  resetServerEnvCache();
  const mod = await import('../../src/app/design-system/page');
  return mod.default();
}

describe('/design-system', () => {
  it('lève notFound en production (configuration de production valide)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('WHATSAPP_MODE', 'live');
    vi.stubEnv('FEDAPAY_ENV', 'live');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-fake');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-fake');
    vi.stubEnv('LOGIN_ATTEMPTS_HASH_SECRET', 'a'.repeat(32));
    vi.stubEnv('LOGIN_IP_HASH_SECRET', 'b'.repeat(32));
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_fake');
    vi.stubEnv('LOGIN_CODE_PEPPER', 'c'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_fake');
    await expect(callPage()).rejects.toThrow('NEXT_NOT_FOUND');
    resetServerEnvCache();
  });

  it('s’affiche en preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('WHATSAPP_MODE', 'simulate');
    await expect(callPage()).resolves.toBeDefined();
    resetServerEnvCache();
  });

  it('s’affiche en local (VERCEL_ENV absent)', async () => {
    vi.stubEnv('VERCEL_ENV', '');
    await expect(callPage()).resolves.toBeDefined();
    resetServerEnvCache();
  });
});
