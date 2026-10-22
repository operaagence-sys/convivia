import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyLoginCode } from '@/lib/auth/verify-code';

// Ordre global des appels (login_code_verify -> createUser -> generateLink -> verifyOtp ->
// ensure_organizer): une seule liste, alimentée par chaque simulation.
const h = vi.hoisted(() => ({
  trace: [] as string[],
  rpc: vi.fn(),
  createUser: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  authClientFor: vi.fn(),
  wait: vi.fn(),
}));

vi.mock('@/lib/env/server', () => ({
  requireServerEnv: () => ({
    LOGIN_ATTEMPTS_HASH_SECRET: 'test-secret',
    LOGIN_CODE_PEPPER: 'test-pepper',
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => ({
    rpc: h.rpc,
    auth: { admin: { createUser: h.createUser, generateLink: h.generateLink } },
  }),
}));
vi.mock('@/lib/supabase/auth-only', () => ({
  createAuthOnlyClient: async (ip: string | undefined) => {
    h.authClientFor(ip);
    return { auth: { verifyOtp: h.verifyOtp, signOut: h.signOut } };
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
vi.mock('@/lib/auth/timing', () => ({ waitForMinimumVerifyDuration: h.wait }));

const EMAIL = 'awa@exemple.com';
const HASH = createHmac('sha256', 'test-secret').update(EMAIL).digest('hex');
const USER_ID = '11111111-1111-1111-1111-111111111111';
const SECRET_TOKEN = 'hashed-token-secret-value';
const SECRET_OTP = '987654';

type Rpc = Record<string, (args: Record<string, unknown>) => unknown>;

function mockRpc(overrides: Rpc = {}) {
  const defaults: Rpc = {
    login_code_verify: () => ({ data: [{ result: 'ok', retry_at: null }], error: null }),
    ensure_organizer: () => ({
      data: [{ created: false, profile_complete: true, organizer_status: 'active' }],
      error: null,
    }),
  };
  const table = { ...defaults, ...overrides };
  h.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    h.trace.push(name);
    const handler = table[name];
    return handler ? handler(args) : { data: null, error: { code: 'unexpected' } };
  });
}

function linkOf(verificationType: string) {
  return {
    data: {
      properties: {
        hashed_token: SECRET_TOKEN,
        email_otp: SECRET_OTP,
        action_link: `https://x.supabase.co/auth/v1/verify?token=${SECRET_TOKEN}`,
        verification_type: verificationType,
      },
      user: { id: USER_ID },
    },
    error: null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  h.trace.length = 0;
  h.wait.mockResolvedValue(undefined);
  h.createUser.mockImplementation(async () => {
    h.trace.push('createUser');
    return { data: {}, error: null };
  });
  h.generateLink.mockImplementation(async () => {
    h.trace.push('generateLink');
    return linkOf('magiclink');
  });
  h.verifyOtp.mockImplementation(async () => {
    h.trace.push('verifyOtp');
    return { data: { user: { id: USER_ID } }, error: null };
  });
  h.signOut.mockResolvedValue({ error: null });
  mockRpc();
});

describe('verifyLoginCode', () => {
  it('sans e-mail en attente : missingEmail, rien n’est appelé', async () => {
    expect(await verifyLoginCode(undefined, '123456')).toEqual({
      ok: false,
      error: { kind: 'missingEmail' },
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each(['', '12345', '1234567', 'abcdef', 123456, null])(
    'code mal formé (%j) : refusé sans compter d’essai ni vérifier',
    async (code) => {
      expect(await verifyLoginCode(EMAIL, code)).toEqual({ ok: false, error: { kind: 'wrong' } });
      expect(h.rpc).not.toHaveBeenCalled();
      expect(h.verifyOtp).not.toHaveBeenCalled();
    },
  );

  it('envoie les empreintes (quota, IP, code saisi) à login_code_verify', async () => {
    await verifyLoginCode(EMAIL, ' 123456 ');
    expect(h.rpc.mock.calls[0]).toEqual([
      'login_code_verify',
      {
        p_identifier_hash: HASH,
        p_ip_hash: 'ip-hash',
        p_ip48_hash: 'ip48-hash',
        p_code_hmac: createHmac('sha256', 'test-pepper')
          .update(`login-code:v1:${HASH}:123456:${EMAIL}`)
          .digest('hex'),
        p_email: EMAIL,
      },
    ]);
  });

  it('code juste : verify -> createUser -> generateLink -> verifyOtp -> ensure_organizer', async () => {
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({ ok: true, next: '/dashboard' });
    expect(h.trace).toEqual([
      'login_code_verify',
      'createUser',
      'generateLink',
      'verifyOtp',
      'ensure_organizer',
    ]);
    expect(h.createUser).toHaveBeenCalledWith({ email: EMAIL, email_confirm: true });
    expect(h.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: EMAIL });
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: SECRET_TOKEN, type: 'magiclink' });
    expect(h.authClientFor).toHaveBeenCalledWith('203.0.113.7');
    expect(h.rpc.mock.calls[1]).toEqual(['ensure_organizer', { p_user_id: USER_ID }]);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.wait).toHaveBeenCalledTimes(1);
  });

  it('profil incomplet : écran profil', async () => {
    mockRpc({
      ensure_organizer: () => ({
        data: [{ created: true, profile_complete: false, organizer_status: 'active' }],
        error: null,
      }),
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({ ok: true, next: '/welcome' });
  });

  it.each([
    [{ status: 422, code: 'email_exists', message: 'x' }],
    [{ code: 'email_exists', message: 'x' }],
  ])('compte déjà existant (%j) : ignoré en silence, connexion poursuivie', async (error) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.createUser.mockResolvedValue({ data: {}, error });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({ ok: true, next: '/dashboard' });
    expect(log).not.toHaveBeenCalled();
  });

  it('autre 422 sans « email_exists » : unavailable, generateLink jamais appelé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.createUser.mockResolvedValue({ data: {}, error: { status: 422, code: 'weak_password' } });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
    expect(h.generateLink).not.toHaveBeenCalled();
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('createUser en échec (hors « existe déjà ») : unavailable, aucune session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.createUser.mockResolvedValue({
      data: {},
      error: { status: 500, code: 'unexpected_failure' },
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
    expect(h.generateLink).not.toHaveBeenCalled();
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it.each(['wrong', 'locked', 'ip_limited'])(
    'résultat « %s » : ni compte, ni lien, ni session',
    async (result) => {
      mockRpc({
        login_code_verify: () => ({
          data: [{ result, retry_at: new Date(Date.now() + 900_000).toISOString() }],
          error: null,
        }),
      });
      const outcome = await verifyLoginCode(EMAIL, '123456');
      expect(h.trace).toEqual(['login_code_verify']);
      expect(h.createUser).not.toHaveBeenCalled();
      expect(h.generateLink).not.toHaveBeenCalled();
      expect(h.verifyOtp).not.toHaveBeenCalled();
      if (result === 'wrong') {
        expect(outcome).toEqual({ ok: false, error: { kind: 'wrong' } });
      } else {
        expect(outcome).toMatchObject({ ok: false, error: { kind: 'blocked' } });
        const delay = (outcome as { error: { retryAfterSeconds: number } }).error.retryAfterSeconds;
        expect(delay).toBeGreaterThan(890);
        expect(delay).toBeLessThanOrEqual(901);
      }
    },
  );

  it('blocage sans date : délai de repli de 900 s', async () => {
    mockRpc({
      login_code_verify: () => ({ data: [{ result: 'locked', retry_at: null }], error: null }),
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toMatchObject({
      ok: false,
      error: { kind: 'blocked', retryAfterSeconds: 900 },
    });
  });

  it('adresse admin : la base ne renvoie jamais « ok », donc aucune session', async () => {
    mockRpc({
      login_code_verify: () => ({ data: [{ result: 'wrong', retry_at: null }], error: null }),
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'wrong' },
    });
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('erreur de la base : unavailable ; 22023 (argument mal formé) : unexpected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({ login_code_verify: () => ({ data: null, error: { code: '57P01' } }) });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
    mockRpc({ login_code_verify: () => ({ data: null, error: { code: '22023' } }) });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unexpected' },
    });
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it.each(['signup', 'recovery', 'invite', 'email_change', 'unknown', undefined])(
    'verification_type inattendu (%s) : arrêt avant verifyOtp, aucune session',
    async (type) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      h.generateLink.mockResolvedValue(linkOf(type as string));
      expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
        ok: false,
        error: { kind: 'unexpected' },
      });
      expect(h.verifyOtp).not.toHaveBeenCalled();
      expect(h.trace).not.toContain('ensure_organizer');
    },
  );

  it('generateLink en échec : unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.generateLink.mockResolvedValue({ data: null, error: { status: 500, code: 'unexpected' } });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('429 de Supabase : unavailable, jamais « code faux », pas de ensure_organizer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { status: 429, name: 'AuthApiError', code: 'over_request_rate_limit', message: 'x' },
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
    expect(h.trace).not.toContain('ensure_organizer');
  });

  it('5xx et service injoignable : unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { status: 503, name: 'AuthApiError', message: 'x' },
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toMatchObject({
      error: { kind: 'unavailable' },
    });
    h.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { status: 0, name: 'AuthRetryableFetchError', message: 'fetch failed' },
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toMatchObject({
      error: { kind: 'unavailable' },
    });
  });

  it('403 access_denied (hook d’accès) : message neutre, aucune session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 403, name: 'AuthApiError', code: 'access_denied', message: 'x' },
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'wrong' },
    });
    expect(h.trace).not.toContain('ensure_organizer');
  });

  it('compte admin (admin_account) : session fermée, message neutre', async () => {
    mockRpc({
      ensure_organizer: () => ({ data: null, error: { code: 'P0001', message: 'admin_account' } }),
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'wrong' },
    });
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('autre échec d’ensure_organizer : session fermée aussi, message générique', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({
      ensure_organizer: () => ({ data: null, error: { code: 'P0002', message: 'unknown_user' } }),
    });
    expect(await verifyLoginCode(EMAIL, '123456')).toEqual({
      ok: false,
      error: { kind: 'unexpected' },
    });
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('exemple.com');
  });

  it('plancher de durée sur tous les chemins (succès, code faux, blocage)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await verifyLoginCode(EMAIL, '123456');
    mockRpc({ login_code_verify: () => ({ data: [{ result: 'wrong' }], error: null }) });
    await verifyLoginCode(EMAIL, '123456');
    mockRpc({ login_code_verify: () => ({ data: [{ result: 'locked' }], error: null }) });
    await verifyLoginCode(EMAIL, '123456');
    expect(h.wait).toHaveBeenCalledTimes(3);
    await verifyLoginCode(EMAIL, 'abc');
    expect(h.wait).toHaveBeenCalledTimes(3);
  });

  it('journaux : ni hashed_token, ni email_otp, ni action_link, ni objet d’erreur entier', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const leaky = (extra: Record<string, unknown>) => ({
      status: 500,
      code: 'unexpected_failure',
      message: `${SECRET_TOKEN} ${SECRET_OTP} ${EMAIL}`,
      ...extra,
    });
    // Chaque point d'échec journalisé, avec une erreur qui contient des secrets.
    h.createUser.mockResolvedValue({ data: {}, error: leaky({}) });
    await verifyLoginCode(EMAIL, '123456');
    h.createUser.mockResolvedValue({ data: {}, error: null });
    h.generateLink.mockResolvedValue({ data: linkOf('magiclink').data, error: leaky({}) });
    await verifyLoginCode(EMAIL, '123456');
    h.generateLink.mockResolvedValue(linkOf('recovery'));
    await verifyLoginCode(EMAIL, '123456');
    h.generateLink.mockResolvedValue(linkOf('magiclink'));
    h.verifyOtp.mockResolvedValue({ data: { user: null }, error: leaky({ name: 'AuthApiError' }) });
    await verifyLoginCode(EMAIL, '123456');
    mockRpc({ ensure_organizer: () => ({ data: null, error: leaky({ message: 'boom' }) }) });
    h.verifyOtp.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    await verifyLoginCode(EMAIL, '123456');

    expect(log).toHaveBeenCalled();
    const logged = JSON.stringify(log.mock.calls);
    for (const secret of [SECRET_TOKEN, SECRET_OTP, 'action_link', 'hashed_token', 'email_otp']) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).not.toContain('exemple.com');
    expect(logged).not.toContain('123456');
  });
});
