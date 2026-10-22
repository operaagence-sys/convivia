import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOrganizerAccess, requireOrganizer } from '@/lib/auth/organizer-session';

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

class Redirect extends Error {}

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser, getSession: h.getSession },
    from: () => ({
      select: (columns: string) => {
        h.select(columns);
        return { eq: () => ({ maybeSingle: h.maybeSingle }) };
      },
    }),
  }),
}));

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'awa@exemple.com' };
const COMPLETE = {
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

beforeEach(() => {
  h.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  h.maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
});

async function redirectedTo(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Redirect) return error.message;
    throw error;
  }
  return undefined;
}

describe('contrôle d’accès des pages protégées', () => {
  it('sans session : redirection vers /login', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    expect(await redirectedTo(requireOrganizer({ fresh: true }))).toBe('/login');
    expect(h.maybeSingle).not.toHaveBeenCalled();
  });

  it('jeton invalide (getUser en erreur) : redirection vers /login', async () => {
    h.getUser.mockResolvedValue({ data: { user: USER }, error: { message: 'invalid jwt' } });
    expect(await redirectedTo(requireOrganizer({ fresh: true }))).toBe('/login');
  });

  it('valide toujours avec getUser(), jamais avec getSession()', async () => {
    await requireOrganizer({ fresh: true });
    expect(h.getUser).toHaveBeenCalled();
    expect(h.getSession).not.toHaveBeenCalled();
  });

  it('session sans compte organisateur (ex. admin) : /login, sans rien créer', async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await redirectedTo(requireOrganizer({ fresh: true }))).toBe('/login');
    expect((await loadOrganizerAccess()).kind).toBe('not_organizer');
  });

  it('profil incomplet : écran profil avant tout le reste (D44)', async () => {
    h.maybeSingle.mockResolvedValue({ data: { ...COMPLETE, city: null }, error: null });
    expect(await redirectedTo(requireOrganizer({ fresh: true }))).toBe('/welcome');
    // L’écran profil lui-même reste accessible.
    const context = await requireOrganizer({ profile: 'any', fresh: true });
    expect(context.profileComplete).toBe(false);
  });

  it('profil rempli : contexte renvoyé', async () => {
    const context = await requireOrganizer({ fresh: true });
    expect(context.organizer.full_name).toBe('Awa Koffi');
    expect(context.suspended).toBe(false);
    expect(context.user.id).toBe(USER.id);
  });

  it('compte suspendu : accès en lecture, drapeau levé (bandeau)', async () => {
    h.maybeSingle.mockResolvedValue({
      data: { ...COMPLETE, status: 'suspended', suspended_at: '2026-10-22T09:00:00Z' },
      error: null,
    });
    const context = await requireOrganizer({ fresh: true });
    expect(context.suspended).toBe(true);
  });

  it('liste les colonnes accordées (jamais select *)', async () => {
    await requireOrganizer({ fresh: true });
    const columns = h.select.mock.calls[0]![0] as string;
    expect(columns).not.toContain('*');
    expect(columns).not.toMatch(/suspended_by|suspension_reason/);
  });
});
