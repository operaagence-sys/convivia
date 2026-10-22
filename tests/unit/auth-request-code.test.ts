import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLoginCode } from '@/lib/auth/request-code';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  createUser: vi.fn(),
  generateLink: vi.fn(),
  authClientFor: vi.fn(),
  wait: vi.fn(),
  sendEmail: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock('@/lib/env/server', () => ({
  requireServerEnv: () => ({
    LOGIN_ATTEMPTS_HASH_SECRET: 'test-secret',
    LOGIN_CODE_PEPPER: 'test-pepper',
  }),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: (callback: () => unknown) => {
    h.afterCallbacks.push(callback);
  },
}));
vi.mock('@/lib/email', () => ({ sendLoginCodeEmail: h.sendEmail }));
vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    auth: { admin: { createUser: h.createUser, generateLink: h.generateLink } },
  }),
}));
vi.mock('@/lib/supabase/auth-only', () => ({
  createAuthOnlyClient: async (ip: string | undefined) => {
    h.authClientFor(ip);
    return { auth: {} };
  },
}));
vi.mock('@/lib/auth/client-ip', () => ({
  getClientIp: async () => ({
    normalized: '203.0.113.7',
    hash: 'ip-hash',
    hash48: 'ip48-hash',
    forwarded: '203.0.113.7',
  }),
}));
vi.mock('@/lib/auth/timing', () => ({ waitForMinimumDuration: h.wait }));

const EMAIL = 'awa@exemple.com';
const HASH = createHmac('sha256', 'test-secret').update(EMAIL).digest('hex');

type Rpc = Record<string, (args: Record<string, unknown>) => unknown>;

function mockRpc(overrides: Rpc = {}) {
  const defaults: Rpc = {
    login_code_issue: () => ({
      data: [{ allowed: true, reason: 'ok', retry_at: null, deliver: true }],
      error: null,
    }),
  };
  const table = { ...defaults, ...overrides };
  h.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const handler = table[name];
    return handler ? handler(args) : { data: null, error: { code: 'unexpected' } };
  });
}

function refused(reason: string, retryInSeconds = 600) {
  return () => ({
    data: [
      {
        allowed: false,
        reason,
        retry_at: new Date(Date.now() + retryInSeconds * 1000).toISOString(),
        deliver: false,
      },
    ],
    error: null,
  });
}

/** Exécute ce que la requête a confié à `after()` (après la réponse). */
async function flushAfter() {
  const callbacks = h.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
  return callbacks.length;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  h.afterCallbacks.length = 0;
  h.wait.mockResolvedValue(undefined);
  h.sendEmail.mockResolvedValue(undefined);
  mockRpc();
});

describe('requestLoginCode', () => {
  it('refuse une adresse invalide sans rien appeler', async () => {
    expect(await requestLoginCode('pas-un-email')).toEqual({
      ok: false,
      error: { kind: 'invalid' },
    });
    expect(await requestLoginCode(undefined)).toEqual({ ok: false, error: { kind: 'invalid' } });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.afterCallbacks).toHaveLength(0);
  });

  it('un seul appel à la base (login_code_issue) avec les empreintes, jamais Supabase Auth', async () => {
    expect(await requestLoginCode('  Awa@Exemple.COM ')).toEqual({ ok: true });

    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(['login_code_issue']);
    const args = h.rpc.mock.calls[0]![1] as Record<string, string>;
    expect(args).toEqual({
      p_identifier_hash: HASH,
      p_ip_hash: 'ip-hash',
      p_ip48_hash: 'ip48-hash',
      p_code_hmac: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_email: EMAIL,
    });
    // Ni createUser, ni generateLink, ni client Auth: plus rien côté Supabase Auth ici.
    expect(h.createUser).not.toHaveBeenCalled();
    expect(h.generateLink).not.toHaveBeenCalled();
    expect(h.authClientFor).not.toHaveBeenCalled();
  });

  it('l’empreinte envoyée est celle du code qui part par e-mail (même formule que /verify)', async () => {
    await requestLoginCode(EMAIL);
    expect(await flushAfter()).toBe(1);
    const { to, code } = h.sendEmail.mock.calls[0]![0] as { to: string; code: string };
    expect(to).toBe(EMAIL);
    expect(code).toMatch(/^\d{6}$/);
    const expected = createHmac('sha256', 'test-pepper')
      .update(`login-code:v1:${HASH}:${code}:${EMAIL}`)
      .digest('hex');
    expect((h.rpc.mock.calls[0]![1] as { p_code_hmac: string }).p_code_hmac).toBe(expected);
  });

  it('l’e-mail part dans after(), pas avant la réponse', async () => {
    await requestLoginCode(EMAIL);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.afterCallbacks).toHaveLength(1);
    await flushAfter();
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('deliver = false (admin) : aucun envoi, même réponse que pour un succès', async () => {
    const normal = await requestLoginCode(EMAIL);
    await flushAfter();
    h.sendEmail.mockClear();

    mockRpc({
      login_code_issue: () => ({
        data: [{ allowed: true, reason: 'ok', retry_at: null, deliver: false }],
        error: null,
      }),
    });
    const admin = await requestLoginCode(EMAIL);
    expect(await flushAfter()).toBe(0);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(admin)).toBe(JSON.stringify(normal));
  });

  it('l’échec de l’envoi est journalisé (événement fixe) et ne change pas la réponse', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.sendEmail.mockRejectedValue(
      Object.assign(new Error(`boom ${EMAIL} 123456`), { reason: 'network', status: 502 }),
    );
    expect(await requestLoginCode(EMAIL)).toEqual({ ok: true });
    await flushAfter();
    expect(log).toHaveBeenCalledWith('[auth] login_code_email_failed', {
      reason: 'network',
      status: 502,
    });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('exemple.com');
    expect(logged).not.toMatch(/\b\d{6}\b/);
  });

  it.each([
    ['hourly_cap', 'hourlyLimit'],
    ['locked', 'blocked'],
    ['too_soon', 'tooSoon'],
    ['ip_limited', 'blocked'],
    ['global_cap', 'blocked'],
  ])('refus « %s » : aucun envoi, délai renvoyé', async (reason, kind) => {
    mockRpc({ login_code_issue: refused(reason, 600) });
    const result = await requestLoginCode(EMAIL);
    expect(result).toMatchObject({ ok: false, error: { kind } });
    const error = (result as { error: { retryAfterSeconds: number } }).error;
    expect(error.retryAfterSeconds).toBeGreaterThan(590);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(601);
    expect(await flushAfter()).toBe(0);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('plafond global : événement fixe journalisé, sans adresse ni code', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({ login_code_issue: refused('global_cap', 600) });
    await requestLoginCode(EMAIL);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[auth] login_code_global_cap');
    mockRpc({ login_code_issue: refused('locked', 600) });
    log.mockClear();
    await requestLoginCode(EMAIL);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: '57P01' }],
    [{ code: '22023' }], // argument mal formé: bogue, même erreur générale
  ])('échec de la base (%j) : sendFailed, aucun envoi', async (error) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({ login_code_issue: () => ({ data: null, error }) });
    expect(await requestLoginCode(EMAIL)).toEqual({ ok: false, error: { kind: 'sendFailed' } });
    expect(await flushAfter()).toBe(0);
  });

  it('plancher de durée appliqué à chaque chemin, pas à l’adresse invalide', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await requestLoginCode(EMAIL);
    mockRpc({ login_code_issue: refused('locked') });
    await requestLoginCode(EMAIL);
    mockRpc({ login_code_issue: () => ({ data: null, error: { code: '57P01' } }) });
    await requestLoginCode(EMAIL);
    expect(h.wait).toHaveBeenCalledTimes(3);
    await requestLoginCode('pas-un-email');
    expect(h.wait).toHaveBeenCalledTimes(3);
  });
});
