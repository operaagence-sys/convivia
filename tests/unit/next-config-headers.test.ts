// Tranche 1 : en-têtes de sécurité et CSP (TRD § 4, § 12.2 ; CLAUDE.md § 5).
import { describe, expect, it } from 'vitest';
import config from '../../next.config';

type Rule = { source: string; headers: { key: string; value: string }[] };

async function loadRules(): Promise<{
  app: Record<string, string>;
  invite: Record<string, string>;
}> {
  const resolved = await config();
  const rules = (await resolved.headers!()) as Rule[];
  const toMap = (r: Rule) =>
    Object.fromEntries(r.headers.map((h) => [h.key.toLowerCase(), h.value]));
  const invite = rules.find((r) => r.source.startsWith('/i/'));
  const app = rules.find((r) => !r.source.startsWith('/i/'));
  expect(invite).toBeDefined();
  expect(app).toBeDefined();
  return { app: toMap(app!), invite: toMap(invite!) };
}

describe('en-têtes de sécurité (next.config)', () => {
  it('/i/* : noindex, no-referrer, CSP sans aucune origine tierce', async () => {
    const { invite } = await loadRules();
    expect(invite['x-robots-tag']).toBe('noindex, nofollow');
    expect(invite['referrer-policy']).toBe('no-referrer');
    const csp = invite['content-security-policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(
      /posthog|sentry|googletagmanager|google-analytics|facebook|https?:\/\/(?!\*\.supabase\.co)/i,
    );
    // connect-src : le site seul (aucun appel sortant depuis une page invité).
    expect(csp).toMatch(/connect-src 'self'(;|$| ws:\/\/localhost)/);
  });

  it('hors /i/* : CSP, anti-framing, HSTS, nosniff, caméra limitée au site', async () => {
    const { app } = await loadRules();
    expect(app['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(app['x-frame-options']).toBe('DENY');
    expect(app['x-content-type-options']).toBe('nosniff');
    expect(app['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    expect(app['permissions-policy']).toContain('camera=(self)');
    expect(app['permissions-policy']).toContain('microphone=()');
    expect(app['permissions-policy']).toContain('geolocation=()');
    expect(app['x-robots-tag']).toBeUndefined();
  });

  it('le matcher hors /i/* ne couvre pas /i/', async () => {
    const resolved = await config();
    const rules = (await resolved.headers!()) as Rule[];
    const appSource = rules.find((r) => !r.source.startsWith('/i/'))!.source;
    const re = new RegExp(
      `^${appSource.replace(/:path/, '').replace(/\(\?!i\/\)\.\*/, '(?!i/).*')}$`,
    );
    expect(re.test('/i/abc')).toBe(false);
    expect(re.test('/login')).toBe(true);
  });

  it('pas de X-Powered-By ni de source maps navigateur publiques', async () => {
    const resolved = await config();
    expect(resolved.poweredByHeader).toBe(false);
    expect(resolved.productionBrowserSourceMaps).toBe(false);
  });
});
