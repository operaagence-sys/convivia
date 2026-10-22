import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseProfile } from '@/lib/auth/profile';
import { PENDING_EMAIL_COOKIE } from '@/lib/auth/constants';
import { requestCodeAction } from '@/app/(auth)/login/actions';
import { resendCodeAction, verifyCodeAction } from '@/app/(auth)/verify/actions';
import { saveProfileAction } from '@/app/(auth)/welcome/actions';
import {
  signOutAction,
  signOutAllAction,
  updateProfileAction,
} from '@/app/(organizer)/account/actions';
import SignupPage from '@/app/(auth)/signup/page';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  generateLink: vi.fn(),
  sendEmail: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateResult: vi.fn(),
  cookies: new Map<string, { value: string; options?: Record<string, unknown> }>(),
}));

class Redirect extends Error {}

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = h.cookies.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      h.cookies.set(name, { value, options });
    },
    delete: (arg: string | { name: string }) => {
      h.cookies.delete(typeof arg === 'string' ? arg : arg.name);
    },
  }),
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
    auth: {
      admin: {
        createUser: async () => ({ data: {}, error: null }),
        generateLink: h.generateLink,
      },
    },
  }),
}));
vi.mock('@/lib/supabase/auth-only', () => ({
  createAuthOnlyClient: async () => ({ auth: { verifyOtp: h.verifyOtp, signOut: h.signOut } }),
}));
vi.mock('@/lib/auth/client-ip', () => ({
  getClientIp: async () => ({
    normalized: '203.0.113.7',
    hash: 'ip-hash',
    hash48: null,
    forwarded: '203.0.113.7',
  }),
}));
vi.mock('@/lib/auth/timing', () => ({
  waitForMinimumDuration: async () => {},
  waitForMinimumVerifyDuration: async () => {},
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: h.getUser,
      signOut: h.signOut,
      signInWithOtp: h.signInWithOtp,
      verifyOtp: h.verifyOtp,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }),
      update: (values: Record<string, unknown>) => {
        h.update(values);
        return { eq: () => ({ select: () => h.updateResult() }) };
      },
    }),
  }),
}));

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'awa@exemple.com' };
const ORGANIZER = {
  id: USER.id,
  email: USER.email,
  full_name: 'Awa Koffi',
  city: 'Cotonou',
  country_code: 'BJ',
  status: 'active',
  suspended_at: null,
  created_at: '2026-10-22T08:00:00Z',
  updated_at: '2026-10-22T08:00:00Z',
};
const PROFILE = { name: 'Awa Koffi', city: 'Cotonou', country: 'BJ' };

async function redirectedTo(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Redirect) return error.message;
    throw error;
  }
  return undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.afterCallbacks.length = 0;
  h.sendEmail.mockResolvedValue(undefined);
  h.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'h', verification_type: 'magiclink' } },
    error: null,
  });
  h.cookies.clear();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://convivia.example');
  h.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  h.maybeSingle.mockResolvedValue({ data: ORGANIZER, error: null });
  h.signOut.mockResolvedValue({ error: null });
  h.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  h.verifyOtp.mockResolvedValue({ data: { user: { id: USER.id } }, error: null });
  h.updateResult.mockResolvedValue({ data: [{ id: USER.id }], error: null });
  h.rpc.mockImplementation(async (name: string) => {
    switch (name) {
      case 'login_code_issue':
        return {
          data: [{ allowed: true, reason: 'ok', retry_at: null, deliver: true }],
          error: null,
        };
      case 'login_code_verify':
        return { data: [{ result: 'ok', retry_at: null }], error: null };
      case 'ensure_organizer':
        return {
          data: [{ created: false, profile_complete: true, organizer_status: 'active' }],
          error: null,
        };
      default:
        return { data: null, error: null };
    }
  });
});

describe('validation du profil côté serveur', () => {
  it('normalise les espaces et accepte un profil correct', () => {
    expect(parseProfile({ name: '  Awa   Koffi ', city: ' Porto-Novo', country: 'BJ' })).toEqual({
      ok: true,
      value: { name: 'Awa Koffi', city: 'Porto-Novo', country: 'BJ' },
    });
  });

  it.each([
    [{ ...PROFILE, name: 'A' }, 'nameInvalid'],
    [{ ...PROFILE, name: '1234' }, 'nameInvalid'],
    [{ ...PROFILE, name: 'Awa\nKoffi' }, 'nameInvalid'],
    [{ ...PROFILE, name: 'a'.repeat(81) }, 'nameTooLong'],
    [{ ...PROFILE, city: 'x' }, 'cityInvalid'],
    [{ ...PROFILE, city: 'Cotonou\tNord' }, 'cityInvalid'],
    [{ ...PROFILE, city: 'v'.repeat(61) }, 'cityTooLong'],
    [{ ...PROFILE, country: 'benin' }, 'countryInvalid'],
    [{ ...PROFILE, country: '' }, 'countryInvalid'],
    [{ name: 'Awa Koffi', city: 'Cotonou' }, 'countryInvalid'],
  ])('refuse %j', (input, error) => {
    expect(parseProfile(input)).toEqual({ ok: false, error });
  });
});

describe('connexion : cookie de l’e-mail en attente', () => {
  it('succès : cookie httpOnly, secure, sameSite=lax, 10 min, adresse normalisée', async () => {
    expect(await requestCodeAction('  Awa@Exemple.com ')).toEqual({ ok: true });
    const cookie = h.cookies.get(PENDING_EMAIL_COOKIE);
    expect(cookie?.value).toBe('awa@exemple.com');
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/verify',
    });
  });

  it('compte admin (deliver = false) : même réponse et même cookie, mais aucun envoi', async () => {
    h.rpc.mockImplementation(async () => ({
      data: [{ allowed: true, reason: 'ok', retry_at: null, deliver: false }],
      error: null,
    }));
    expect(await requestCodeAction('admin@exemple.com')).toEqual({ ok: true });
    expect(h.cookies.get(PENDING_EMAIL_COOKIE)?.value).toBe('admin@exemple.com');
    expect(h.afterCallbacks).toHaveLength(0);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('refus (plafond) : aucun cookie', async () => {
    h.rpc.mockResolvedValue({
      data: [
        {
          allowed: false,
          reason: 'hourly_cap',
          retry_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      error: null,
    });
    const result = await requestCodeAction('awa@exemple.com');
    expect(result).toMatchObject({ ok: false, error: { kind: 'hourlyLimit' } });
    expect(h.cookies.size).toBe(0);
  });

  it('/verify utilise l’adresse du cookie, jamais celle du navigateur, et le vide après succès', async () => {
    h.cookies.set(PENDING_EMAIL_COOKIE, { value: 'awa@exemple.com' });
    expect(await verifyCodeAction('123456')).toEqual({ ok: true, next: '/dashboard' });
    const verifyCall = h.rpc.mock.calls.find(([name]) => name === 'login_code_verify')!;
    expect((verifyCall[1] as { p_email: string }).p_email).toBe('awa@exemple.com');
    expect(h.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'awa@exemple.com' });
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'magiclink' });
    expect(h.cookies.has(PENDING_EMAIL_COOKIE)).toBe(false);
  });

  it('/verify sans cookie : missingEmail, rien n’est vérifié', async () => {
    expect(await verifyCodeAction('123456')).toEqual({
      ok: false,
      error: { kind: 'missingEmail' },
    });
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('/verify : un code faux garde le cookie (nouvelle saisie possible)', async () => {
    h.cookies.set(PENDING_EMAIL_COOKIE, { value: 'awa@exemple.com' });
    h.rpc.mockImplementation(async () => ({
      data: [{ result: 'wrong', retry_at: null }],
      error: null,
    }));
    expect(await verifyCodeAction('000000')).toEqual({ ok: false, error: { kind: 'wrong' } });
    expect(h.cookies.has(PENDING_EMAIL_COOKIE)).toBe(true);
  });

  it('un cookie falsifié (pas une adresse) est ignoré', async () => {
    h.cookies.set(PENDING_EMAIL_COOKIE, { value: 'pas une adresse' });
    expect(await verifyCodeAction('123456')).toEqual({
      ok: false,
      error: { kind: 'missingEmail' },
    });
    expect(await resendCodeAction()).toEqual({ ok: false, error: { kind: 'missingEmail' } });
  });

  it('renvoi : même chemin que /login (plafond compté avant tout envoi)', async () => {
    h.cookies.set(PENDING_EMAIL_COOKIE, { value: 'awa@exemple.com' });
    expect(await resendCodeAction()).toEqual({ ok: true });
    expect(h.rpc.mock.calls[0]![0]).toBe('login_code_issue');
    expect(h.afterCallbacks).toHaveLength(1);
  });
});

describe('/signup', () => {
  it('redirige vers /login en gardant ?ref=', async () => {
    const to = await redirectedTo(
      SignupPage({ searchParams: Promise.resolve({ ref: 'AMINA-10' }) }),
    );
    expect(to).toBe('/login?ref=AMINA-10');
  });

  it('sans ref, ou avec un ref douteux : /login seul', async () => {
    expect(await redirectedTo(SignupPage({ searchParams: Promise.resolve({}) }))).toBe('/login');
    expect(
      await redirectedTo(SignupPage({ searchParams: Promise.resolve({ ref: '<script>' }) })),
    ).toBe('/login');
  });
});

describe('actions protégées', () => {
  it.each([
    ['saveProfileAction', () => saveProfileAction(PROFILE)],
    ['updateProfileAction', () => updateProfileAction(PROFILE)],
    ['signOutAction', () => signOutAction()],
    ['signOutAllAction', () => signOutAllAction()],
  ])('%s sans session : redirection vers /login, aucune écriture', async (_name, run) => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    expect(await redirectedTo(run())).toBe('/login');
    expect(h.update).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('enregistre le profil avec les seules trois colonnes autorisées', async () => {
    expect(
      await updateProfileAction({ ...PROFILE, status: 'active', email: 'x@y.z' } as typeof PROFILE),
    ).toEqual({ ok: true });
    expect(h.update).toHaveBeenCalledWith({
      full_name: 'Awa Koffi',
      city: 'Cotonou',
      country_code: 'BJ',
    });
  });

  it('entrée invalide : aucune écriture', async () => {
    expect(await updateProfileAction({ ...PROFILE, name: 'x' })).toEqual({
      ok: false,
      error: 'nameInvalid',
    });
    expect(h.update).not.toHaveBeenCalled();
  });

  it('compte suspendu : mise à jour sans effet (0 ligne) détectée', async () => {
    h.maybeSingle.mockResolvedValue({
      data: { ...ORGANIZER, status: 'suspended', suspended_at: '2026-10-22T09:00:00Z' },
      error: null,
    });
    h.updateResult.mockResolvedValue({ data: [], error: null });
    expect(await updateProfileAction(PROFILE)).toEqual({ ok: false, error: 'suspended' });
  });

  it('0 ligne sans suspension : échec général', async () => {
    h.updateResult.mockResolvedValue({ data: [], error: null });
    expect(await updateProfileAction(PROFILE)).toEqual({ ok: false, error: 'saveFailed' });
  });

  it.each([
    [{ code: 'P0001', message: 'country XX is not an active country' }, 'countryInvalid'],
    [
      { code: '23514', message: 'violates check constraint "organizers_city_format"' },
      'cityInvalid',
    ],
    [
      { code: '23514', message: 'violates check constraint "organizers_full_name_format"' },
      'nameInvalid',
    ],
    [{ code: '42501', message: 'new row violates row-level security' }, 'saveFailed'],
  ])('erreur de la base %j', async (dbError, expected) => {
    h.updateResult.mockResolvedValue({ data: null, error: dbError });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await updateProfileAction(PROFILE)).toEqual({ ok: false, error: expected });
  });

  it('profil incomplet : /account renvoie vers /welcome', async () => {
    h.maybeSingle.mockResolvedValue({ data: { ...ORGANIZER, full_name: null }, error: null });
    expect(await redirectedTo(updateProfileAction(PROFILE))).toBe('/welcome');
    // L’écran profil accepte le premier enregistrement.
    expect(await saveProfileAction(PROFILE)).toEqual({ ok: true });
  });

  it('se déconnecter : cet appareil seulement ; tout déconnecter : toutes les sessions', async () => {
    expect(await signOutAction()).toEqual({ ok: true });
    expect(h.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    expect(await signOutAllAction()).toEqual({ ok: true });
    expect(h.signOut).toHaveBeenLastCalledWith({ scope: 'global' });
  });

  it('déconnexion refusée : erreur, sans détail technique', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.signOut.mockResolvedValue({ error: { status: 500, code: 'x', message: 'boom' } });
    expect(await signOutAllAction()).toEqual({ ok: false, error: 'signOutFailed' });
  });
});
