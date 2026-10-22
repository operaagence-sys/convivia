import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLoginCode } from '@/lib/auth/request-code';
import { verifyLoginCode } from '@/lib/auth/verify-code';
import { hashLoginIdentifier, parseEmail, secondsUntil } from '@/lib/auth/identifier';
import { getSessionCookieOptions, SESSION_MAX_AGE_SECONDS } from '@/lib/supabase/cookie-options';
import { messages } from '@/content/messages.fr';
import SignupPage from '@/app/(auth)/signup/page';

// Tests complémentaires de la tranche 2 (connexion organisateur), cas limites et non-régressions.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  createUser: vi.fn(),
  generateLink: vi.fn(),
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
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
}));

const ROOT = path.resolve(import.meta.dirname, '../..');
const hashOf = (email: string) => createHmac('sha256', 'test-secret').update(email).digest('hex');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Exécute ce que la requête a confié à after() (après la réponse). */
async function flushAfter() {
  const callbacks = h.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
  return callbacks.length;
}

beforeEach(() => {
  // Compteurs d'appels remis à zéro à chaque test: les assertions sur le nombre d'appels
  // (verifyOtp, sendEmail) ne dépendent plus de l'ordre d'exécution des tests.
  vi.clearAllMocks();
  h.afterCallbacks.length = 0;
  h.sendEmail.mockResolvedValue(undefined);
  h.createUser.mockResolvedValue({ data: {}, error: null });
  h.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'h', verification_type: 'magiclink' } },
    error: null,
  });
  h.signOut.mockResolvedValue({ error: null });
  h.verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('identifiant de connexion (TRD D23, D24, D52)', () => {
  // D52 : le compteur est par identifiant. Varier la casse ou les espaces ne doit pas
  // contourner le blocage ni le plafond horaire.
  it('casse et espaces donnent la même empreinte et la même adresse normalisée', () => {
    expect(parseEmail('  Awa@Exemple.COM ')).toBe('awa@exemple.com');
    expect(parseEmail("o'brien@exemple.com")).toBe("o'brien@exemple.com");
    for (const bad of ['a\r\nb@x.com', 'a<b>@x.com', 'a,b@x.com', 'a@x.com, b@x.com']) {
      expect(parseEmail(bad)).toBeNull();
    }
    expect(hashLoginIdentifier(parseEmail('  Awa@Exemple.COM ')!)).toBe(
      hashLoginIdentifier('awa@exemple.com'),
    );
  });

  it('l’empreinte est un HMAC hexadécimal de 64 caractères qui ne contient pas l’adresse', () => {
    const hash = hashLoginIdentifier('awa@exemple.com');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashOf('awa@exemple.com'));
    expect(hash).not.toBe(hashLoginIdentifier('awb@exemple.com'));
  });

  it.each([
    null,
    undefined,
    42,
    {},
    ['a@b.co'],
    '',
    '   ',
    'sans-arobase',
    'a@',
    '@b.co',
    'a b@c.co',
    'a@b.co\nBcc: victime@exemple.com',
    'a@b.co\r\nSubject: x',
    `${'a'.repeat(250)}@b.co`,
  ])('adresse hostile ou invalide (%j) : refusée avant tout appel', async (input) => {
    expect(await requestLoginCode(input)).toEqual({ ok: false, error: { kind: 'invalid' } });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.afterCallbacks).toHaveLength(0);
  });

  it('secondsUntil : au moins 1 s, repli si la date est absente ou illisible', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    expect(secondsUntil('2026-10-22T10:15:00Z', now)).toBe(900);
    expect(secondsUntil('2026-10-22T10:00:00.200Z', now)).toBe(1);
    expect(secondsUntil('2026-10-22T09:00:00Z', now)).toBe(1);
    expect(secondsUntil(null, now)).toBe(60);
    expect(secondsUntil('pas une date', now, 900)).toBe(900);
  });
});

describe('demande de code : mêmes réponses, aucune fuite (TRD D23, D52)', () => {
  const allowIssue = (deliver: boolean) =>
    h.rpc.mockImplementation(async () => ({
      data: [{ allowed: true, reason: 'ok', retry_at: null, deliver }],
      error: null,
    }));

  it('la base reçoit les empreintes, jamais le code ni l’adresse en dehors de p_email', async () => {
    allowIssue(true);
    await requestLoginCode('  AWA@Exemple.com ');
    const [name, args] = h.rpc.mock.calls[0]!;
    expect(name).toBe('login_code_issue');
    expect(args).toMatchObject({
      p_identifier_hash: hashOf('awa@exemple.com'),
      p_ip_hash: 'ip-hash',
      p_ip48_hash: null,
      p_email: 'awa@exemple.com',
    });
    const { p_email: _email, ...withoutEmail } = args as Record<string, unknown>;
    expect(JSON.stringify(withoutEmail)).not.toContain('exemple.com');
    await flushAfter();
    const { code } = h.sendEmail.mock.calls[0]![0] as { code: string };
    expect(JSON.stringify(args)).not.toContain(code);
  });

  it('nouveau compte, compte existant et admin : réponses strictement identiques', async () => {
    allowIssue(true);
    const fresh = await requestLoginCode('inconnu@exemple.com');
    const existing = await requestLoginCode('connu@exemple.com');
    allowIssue(false);
    const admin = await requestLoginCode('admin@exemple.com');
    expect(JSON.stringify(fresh)).toBe(JSON.stringify(existing));
    expect(JSON.stringify(fresh)).toBe(JSON.stringify(admin));
    expect(await flushAfter()).toBe(2);
    expect(h.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('un blocage renvoie le même type de réponse pour tout identifiant', async () => {
    h.rpc.mockImplementation(async () => ({
      data: [
        {
          allowed: false,
          reason: 'locked',
          retry_at: new Date(Date.now() + 900_000).toISOString(),
          deliver: false,
        },
      ],
      error: null,
    }));
    const one = await requestLoginCode('connu@exemple.com');
    const two = await requestLoginCode('jamais-vu@exemple.com');
    expect(one).toMatchObject({ ok: false, error: { kind: 'blocked' } });
    expect(two).toMatchObject({ ok: false, error: { kind: 'blocked' } });
    expect(await flushAfter()).toBe(0);
  });

  it('les textes de connexion ne révèlent jamais l’existence d’un compte ni un admin', () => {
    const forbidden = /n.existe pas|introuvable|aucun compte|inconnu|déjà inscrit|admin/i;
    const texts = [
      ...Object.values(messages.auth.login.error),
      ...Object.values(messages.auth.verify.error),
      messages.auth.verify.subtitle,
      messages.auth.verify.resent,
    ];
    for (const text of texts) expect(text).not.toMatch(forbidden);
    expect(messages.auth.verify.subtitle).toMatch(/^Si cette adresse est valide/);
    expect(messages.auth.verify.resent).toMatch(/^Si cette adresse est valide/);
  });
});

describe('vérification : 5 codes faux puis blocage, même sans compte (TRD D24, D52)', () => {
  // Simule login_code_verify: 5 essais comptés, le 6e est refusé quel que soit le code; un code
  // juste (empreinte identique à celle du code émis) consomme le code et remet le compteur à zéro.
  function installDatabase(limit = 5) {
    const failures = new Map<string, number>();
    const activeCodes = new Map<string, string>();
    h.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      const id = args.p_identifier_hash!;
      if (name === 'login_code_issue') {
        activeCodes.set(id, args.p_code_hmac!);
        return {
          data: [{ allowed: true, reason: 'ok', retry_at: null, deliver: true }],
          error: null,
        };
      }
      if (name === 'login_code_verify') {
        const used = failures.get(id) ?? 0;
        if (used >= limit) {
          const retryAt = new Date(Date.now() + 900_000).toISOString();
          return { data: [{ result: 'locked', retry_at: retryAt }], error: null };
        }
        if (activeCodes.get(id) === args.p_code_hmac) {
          activeCodes.delete(id);
          failures.delete(id);
          return { data: [{ result: 'ok', retry_at: null }], error: null };
        }
        failures.set(id, used + 1);
        return { data: [{ result: 'wrong', retry_at: null }], error: null };
      }
      if (name === 'ensure_organizer') {
        return {
          data: [{ created: false, profile_complete: true, organizer_status: 'active' }],
          error: null,
        };
      }
      return { data: null, error: { code: 'unexpected' } };
    });
  }

  async function issuedCode(email: string): Promise<string> {
    await requestLoginCode(email);
    await flushAfter();
    return (h.sendEmail.mock.calls.at(-1)![0] as { code: string }).code;
  }

  it('6e tentative refusée sans ouvrir de session, même avec le bon code et sans compte', async () => {
    installDatabase();
    const good = await issuedCode('fantome@exemple.com');
    const bad = good === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i += 1) {
      expect(await verifyLoginCode('fantome@exemple.com', bad)).toEqual({
        ok: false,
        error: { kind: 'wrong' },
      });
    }
    const sixth = await verifyLoginCode('fantome@exemple.com', good);
    expect(sixth).toMatchObject({ ok: false, error: { kind: 'blocked' } });
    const delay = (sixth as { error: { retryAfterSeconds: number } }).error.retryAfterSeconds;
    expect(delay).toBeGreaterThan(890);
    expect(delay).toBeLessThanOrEqual(900);
    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(h.generateLink).not.toHaveBeenCalled();
  });

  it('un autre identifiant n’est pas bloqué par le premier', async () => {
    installDatabase();
    for (let i = 0; i < 6; i += 1) await verifyLoginCode('a@exemple.com', '000000');
    const good = await issuedCode('b@exemple.com');
    expect(await verifyLoginCode('b@exemple.com', good)).toEqual({ ok: true, next: '/dashboard' });
  });

  it('une variante « +tag » partage les 5 essais de l’adresse principale', async () => {
    installDatabase();
    for (let i = 0; i < 5; i += 1) await verifyLoginCode('awa+x@exemple.com', '000000');
    expect(await verifyLoginCode('awa+y@exemple.com', '000000')).toMatchObject({
      ok: false,
      error: { kind: 'blocked' },
    });
  });

  it('un code juste ouvre la session et remet le compteur à zéro', async () => {
    installDatabase();
    for (let i = 0; i < 4; i += 1) await verifyLoginCode('c@exemple.com', '000000');
    const good = await issuedCode('c@exemple.com');
    expect(await verifyLoginCode('c@exemple.com', good)).toEqual({ ok: true, next: '/dashboard' });
    expect(h.verifyOtp).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i += 1) {
      expect(await verifyLoginCode('c@exemple.com', '000000')).toMatchObject({
        error: { kind: 'wrong' },
      });
    }
    expect(await verifyLoginCode('c@exemple.com', '000000')).toMatchObject({
      error: { kind: 'blocked' },
    });
  });

  it('un code est à usage unique', async () => {
    installDatabase();
    const good = await issuedCode('d@exemple.com');
    expect(await verifyLoginCode('d@exemple.com', good)).toMatchObject({ ok: true });
    expect(await verifyLoginCode('d@exemple.com', good)).toMatchObject({ ok: false });
    expect(h.verifyOtp).toHaveBeenCalledTimes(1);
  });
});

describe('/signup?ref= : valeurs hostiles (TRD D57)', () => {
  const to = async (ref: unknown) => {
    try {
      await SignupPage({ searchParams: Promise.resolve({ ref } as { ref?: string }) });
    } catch (error) {
      return (error as { to: string }).to;
    }
    return undefined;
  };

  it.each([
    'javascript:alert(1)',
    '//evil.example',
    'https://evil.example',
    '../../etc/passwd',
    'a b',
    'a&next=https://evil.example',
    'a%0d%0aSet-Cookie:x=1',
    'a\nb',
    '"><img src=x onerror=alert(1)>',
    "a'; DROP TABLE organizers;--",
    'a'.repeat(65),
    'é',
    '',
  ])('%j : redirige vers /login seul', async (ref) => {
    expect(await to(ref)).toBe('/login');
  });

  it('plusieurs ?ref= : seul le premier est examiné', async () => {
    expect(await to(['AMINA-10', 'evil'])).toBe('/login?ref=AMINA-10');
    expect(await to(['<script>', 'AMINA-10'])).toBe('/login');
  });

  it('tirets, soulignés et 64 caractères passent', async () => {
    expect(await to('a_B-9')).toBe('/login?ref=a_B-9');
    expect(await to('a'.repeat(64))).toBe(`/login?ref=${'a'.repeat(64)}`);
  });
});

describe('session de 30 jours (TRD § 7.4)', () => {
  it('la durée est de 30 jours exactement', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(2_592_000);
  });

  it('cookies httpOnly, SameSite=Lax, 30 jours, secure sur un déploiement HTTPS', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(getSessionCookieOptions()).toEqual({
      maxAge: 2_592_000,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(getSessionCookieOptions().secure).toBe(true);
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://convivia.test');
    expect(getSessionCookieOptions().secure).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    expect(getSessionCookieOptions().secure).toBe(false);
    expect(getSessionCookieOptions().httpOnly).toBe(true);
    vi.unstubAllEnvs();
  });

  it.each(['server.ts', 'session.ts', 'auth-only.ts'])(
    '%s applique les options de cookie de session',
    (file) => {
      const source = readFileSync(path.join(ROOT, 'src/lib/supabase', file), 'utf8');
      expect(source).toMatch(/getSessionCookieOptions\(\)/);
    },
  );

  it('il n’existe plus de client Supabase navigateur (cookies httpOnly)', () => {
    expect(() => readFileSync(path.join(ROOT, 'src/lib/supabase/client.ts'), 'utf8')).toThrow();
  });
});

describe('e-mail jamais dans l’URL ni dans le stockage du navigateur (TRD D47)', () => {
  const authFiles = walk(path.join(ROOT, 'src/app/(auth)')).filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f),
  );

  it('aucune navigation de /login ou /verify ne met l’adresse dans l’URL', () => {
    expect(authFiles.length).toBeGreaterThan(0);
    for (const file of authFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/[?&]e-?mail=/);
      expect(source, file).not.toMatch(/localStorage|sessionStorage/);
      expect(source, file).not.toMatch(/router\.(push|replace)\([^)]*email/);
    }
  });

  it('l’adresse en attente est réservée au cookie httpOnly de 10 min', () => {
    const source = readFileSync(path.join(ROOT, 'src/lib/auth/pending-email.ts'), 'utf8');
    expect(source).toMatch(/httpOnly: true/);
    expect(source).toMatch(/sameSite: 'lax'/);
    expect(source).toMatch(/maxAge: PENDING_EMAIL_TTL_SECONDS/);
    expect(source).toMatch(/secure: isHttpsDeployment\(\)/);
    expect(source).toMatch(/PENDING_EMAIL_PATHS = \['\/login', '\/verify'\]/);
    expect(source).not.toMatch(/path: '\/'/);
  });
});

describe('/i/* sans cookie ni session (non-régression, CLAUDE.md § 5)', () => {
  const invitationFiles = walk(path.join(ROOT, 'src/app/i')).filter((f) => /\.tsx?$/.test(f));

  it('aucun fichier de /i/* ne lit ni n’écrit de cookie, ni n’ouvre de session', () => {
    expect(invitationFiles.length).toBeGreaterThan(0);
    for (const file of invitationFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bcookies\(|document\.cookie/);
      expect(source, file).not.toMatch(/lib\/supabase\/(server|client|session)|lib\/auth\//);
      expect(source, file).not.toMatch(/from ['"][^'"]*(posthog|sentry|gtag)/i);
    }
  });
});
