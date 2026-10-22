import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnvCache } from '@/lib/env/server';

const h = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  store: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: h.createServerClient }));
vi.mock('next/headers', () => ({
  cookies: async () => h.store,
  headers: async () => new Headers(),
}));

import { UNKNOWN_IP, hashIp, normalizeIp, pickClientIp } from '@/lib/auth/client-ip';
import { createAuthOnlyClient, FORWARDED_IP_HEADER } from '@/lib/supabase/auth-only';
import { clearPendingEmail, setPendingEmail } from '@/lib/auth/pending-email';
import { updateSession } from '@/lib/supabase/session';
import {
  CODE_REQUEST_JITTER_MS,
  MIN_CODE_REQUEST_MS,
  MIN_VERIFY_MS,
  VERIFY_JITTER_MS,
  waitForMinimumDuration,
  waitForMinimumVerifyDuration,
} from '@/lib/auth/timing';

const IP_SECRET = 'i'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
  vi.stubEnv('LOGIN_IP_HASH_SECRET', IP_SECRET);
  resetServerEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  resetServerEnvCache();
});

describe('normalisation de l’IP (D58)', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    [' 203.0.113.7 ', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::ffff:cb00:7107', '203.0.113.7'],
    ['2001:db8:abcd:12:1:2:3:4', '2001:db8:abcd:12::/64'],
    ['2001:DB8:ABCD:0012:ffff:ffff:ffff:ffff', '2001:db8:abcd:12::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['[2001:db8:1:2::9]', '2001:db8:1:2::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeIp(raw)).toBe(expected);
  });

  it('deux adresses du même /64 donnent la même valeur, deux /64 différents non', () => {
    expect(normalizeIp('2001:db8:1:2:aaaa::1')).toBe(normalizeIp('2001:db8:1:2:bbbb::2'));
    expect(normalizeIp('2001:db8:1:2::1')).not.toBe(normalizeIp('2001:db8:1:3::1'));
  });

  it.each([undefined, null, '', '   ', 'pas-une-ip', '999.1.1.1', '1.2.3', '2001:::1', 'a, b'])(
    '%j -> unknown',
    (raw) => {
      expect(normalizeIp(raw)).toBe(UNKNOWN_IP);
    },
  );

  it('l’empreinte est le HMAC-SHA256 hexadécimal (64) de l’IP normalisée avec LOGIN_IP_HASH_SECRET', () => {
    const hash = hashIp('203.0.113.7');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHmac('sha256', IP_SECRET).update('203.0.113.7').digest('hex'));
    expect(hash).not.toContain('203');
  });
});

describe('source de l’IP: Vercel seulement', () => {
  const headersOf = (map: Record<string, string>) => (name: string) => map[name] ?? null;

  it('sur Vercel: x-vercel-forwarded-for d’abord (audit F3), puis x-real-ip, puis x-forwarded-for', () => {
    expect(
      pickClientIp(
        headersOf({
          'x-vercel-forwarded-for': '198.51.100.9, 10.0.0.2',
          'x-real-ip': '198.51.100.1',
          'x-forwarded-for': '198.51.100.2',
        }),
        true,
      ),
    ).toBe('198.51.100.9');
  });

  it('sur Vercel: x-real-ip d’abord, sinon le premier élément de x-forwarded-for', () => {
    expect(pickClientIp(headersOf({ 'x-real-ip': '198.51.100.1' }), true)).toBe('198.51.100.1');
    expect(pickClientIp(headersOf({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }), true)).toBe(
      '198.51.100.2',
    );
    expect(pickClientIp(headersOf({}), true)).toBeUndefined();
  });

  it('hors Vercel: les en-têtes (injectables par le client) sont ignorés', () => {
    expect(
      pickClientIp(headersOf({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }), false),
    ).toBeUndefined();
  });
});

describe('client Auth du serveur (sb-forwarded-for + clé secrète)', () => {
  const fakeClient = {
    auth: {
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
      signInWithOtp: vi.fn(),
      admin: { createUser: vi.fn() },
    },
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {},
  };

  beforeEach(() => {
    h.createServerClient.mockReturnValue(fakeClient);
  });

  it('envoie l’IP dans sb-forwarded-for avec la clé sb_secret_, jamais la clé anonyme', async () => {
    await createAuthOnlyClient('203.0.113.7');
    const [url, key, options] = h.createServerClient.mock.calls[0]!;
    expect(url).toBe('https://example.supabase.co');
    expect(key).toBe('sb_secret_test');
    expect(FORWARDED_IP_HEADER).toBe('sb-forwarded-for');
    expect(options.global.headers).toEqual({ 'sb-forwarded-for': '203.0.113.7' });
  });

  it('sans IP fiable: aucun en-tête', async () => {
    await createAuthOnlyClient(undefined);
    expect(h.createServerClient.mock.calls[0]![2].global).toBeUndefined();
  });

  it('n’expose QUE verifyOtp et signOut (audit F1): ni from, ni rpc, ni storage, ni admin', async () => {
    const client = await createAuthOnlyClient('203.0.113.7');
    expect(Object.keys(client)).toEqual(['auth']);
    expect(Object.keys(client.auth).sort()).toEqual(['signOut', 'verifyOtp']);
    expect('admin' in client.auth).toBe(false);
    expect('signInWithOtp' in client.auth).toBe(false);
    expect('from' in client).toBe(false);
    expect('rpc' in client).toBe(false);
  });

  it('les deux fonctions exposées appellent bien le client Auth avec leurs arguments', async () => {
    fakeClient.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    fakeClient.auth.signOut.mockResolvedValue({ error: null });
    const client = await createAuthOnlyClient('203.0.113.7');
    await client.auth.verifyOtp({ token_hash: 'x', type: 'magiclink' });
    await client.auth.signOut({ scope: 'local' });
    expect(fakeClient.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'x', type: 'magiclink' });
    expect(fakeClient.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('les cookies de session posés par verifyOtp gardent httpOnly / lax / 30 jours', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    await createAuthOnlyClient('203.0.113.7');
    const options = h.createServerClient.mock.calls[0]![2];
    expect(options.cookieOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });
    options.cookies.setAll([{ name: 'sb-x-auth-token', value: 'v', options: { httpOnly: true } }]);
    expect(h.store.set).toHaveBeenCalledWith('sb-x-auth-token', 'v', { httpOnly: true });
  });

  it('refuse de démarrer sans SUPABASE_SECRET_KEY', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    resetServerEnvCache();
    await expect(createAuthOnlyClient('203.0.113.7')).rejects.toThrow(/SUPABASE_SECRET_KEY/);
  });
});

describe('cookie de l’e-mail en attente', () => {
  it('posé uniquement sur /login et /verify, httpOnly, lax, 10 min, secure en HTTPS', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await setPendingEmail('awa@exemple.com');
    const calls = h.store.set.mock.calls as unknown as [string, string, Record<string, unknown>][];
    expect(calls.map(([, , o]) => o.path).sort()).toEqual(['/login', '/verify']);
    for (const [, , o] of calls) {
      expect(o).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
    }
  });

  it('non secure seulement en http://localhost', async () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    await setPendingEmail('awa@exemple.com');
    expect(h.store.set.mock.calls[0]![2]).toMatchObject({ secure: false });
  });

  it('effacé sur les deux chemins', async () => {
    await clearPendingEmail();
    const paths = h.store.delete.mock.calls.map(([o]) => (o as { path: string }).path).sort();
    expect(paths).toEqual(['/login', '/verify']);
  });
});

describe('rafraîchissement refusé par le hook (403 access_denied)', () => {
  beforeEach(() => {
    h.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'access_denied' },
    });
    h.signOut.mockResolvedValue({ error: null });
    h.createServerClient.mockReturnValue({ auth: { getUser: h.getUser, signOut: h.signOut } });
  });

  const requestTo = (path: string) =>
    new NextRequest(`https://convivia.test${path}`, {
      headers: { cookie: 'sb-ref-auth-token=jeton' },
    });

  it('ferme la session, expire les cookies et renvoie vers /login', async () => {
    const response = await updateSession(requestTo('/dashboard'));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    const cookie = response.cookies.get('sb-ref-auth-token');
    expect(cookie?.value).toBe('');
  });

  it('déjà sur /login: pas de boucle de redirection', async () => {
    const response = await updateSession(requestTo('/login'));
    expect(response.status).toBe(200);
  });

  it('refus reconnu aussi par le statut 403 + le message, sans code (audit F4)', async () => {
    h.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, message: 'access_denied' },
    });
    const response = await updateSession(requestTo('/dashboard'));
    expect(response.status).toBe(307);
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('un 403 sans rapport avec le hook ne ferme pas la session', async () => {
    h.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, message: 'forbidden for another reason' },
    });
    const response = await updateSession(requestTo('/dashboard'));
    expect(response.status).toBe(200);
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('une autre erreur (jeton expiré, réseau) ne redirige pas', async () => {
    h.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401, code: 'bad_jwt' },
    });
    const response = await updateSession(requestTo('/dashboard'));
    expect(response.status).toBe(200);
    expect(h.signOut).not.toHaveBeenCalled();
  });
});

describe('durée minimale de la demande de code', () => {
  it('attend le plancher puis un aléa borné; rien si déjà dépassé', async () => {
    vi.useFakeTimers();
    let done = false;
    const pending = waitForMinimumDuration(Date.now()).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(MIN_CODE_REQUEST_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(CODE_REQUEST_JITTER_MS + 2);
    await pending;
    expect(done).toBe(true);

    const late = Date.now() - 10_000;
    let lateDone = false;
    const latePending = waitForMinimumDuration(late).then(() => {
      lateDone = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await latePending;
    expect(lateDone).toBe(true);
  });

  it('même durée pour tous les chemins: l’attente se compte depuis le début', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    await vi.advanceTimersByTimeAsync(500); // chemin « lent » déjà écoulé
    let done = false;
    const pending = waitForMinimumDuration(start).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(CODE_REQUEST_JITTER_MS + MIN_CODE_REQUEST_MS - 500);
    await pending;
    expect(done).toBe(true);
    expect(Date.now() - start).toBeLessThan(MIN_CODE_REQUEST_MS + CODE_REQUEST_JITTER_MS + 1);
  });

  it('/verify a son propre plancher (1 s + aléa)', async () => {
    vi.useFakeTimers();
    let done = false;
    const pending = waitForMinimumVerifyDuration(Date.now()).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(MIN_VERIFY_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(VERIFY_JITTER_MS + 2);
    await pending;
    expect(done).toBe(true);
  });
});
