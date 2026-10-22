// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/content/messages.fr';
import OrganizerLayout from '@/app/(organizer)/layout';
import LoginPage from '@/app/(auth)/login/page';
import WelcomePage from '@/app/(auth)/welcome/page';
import AccountPage from '@/app/(organizer)/account/page';
import NewEventPage from '@/app/(organizer)/events/new/page';

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  pending: undefined as string | undefined,
}));

class Redirect extends Error {}

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (h.pending ? { value: h.pending } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock('@/app/(auth)/login/actions', () => ({ requestCodeAction: vi.fn() }));
vi.mock('@/app/(auth)/welcome/actions', () => ({ saveProfileAction: vi.fn() }));
vi.mock('@/app/(organizer)/account/actions', () => ({
  updateProfileAction: vi.fn(),
  signOutAction: vi.fn(),
  signOutAllAction: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => ({
      select: () =>
        table === 'countries'
          ? {
              eq: () => ({
                order: async () => ({
                  data: [
                    { code: 'BJ', name: 'Benin' },
                    { code: 'CI', name: 'Cote d’Ivoire' },
                  ],
                  error: null,
                }),
              }),
            }
          : { eq: () => ({ maybeSingle: h.maybeSingle }) },
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
  h.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  h.maybeSingle.mockResolvedValue({ data: ORGANIZER, error: null });
});

describe('pages protégées', () => {
  it.each([
    ['layout', () => OrganizerLayout({ children: <p>x</p> })],
    ['/account', () => AccountPage()],
    ['/events/new', () => NewEventPage()],
  ])('%s sans session : /login', async (_name, run) => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    expect(await redirectedTo(run())).toBe('/login');
  });

  it.each([
    ['layout', () => OrganizerLayout({ children: <p>x</p> })],
    ['/account', () => AccountPage()],
    ['/events/new', () => NewEventPage()],
  ])('%s avec un profil incomplet : /welcome', async (_name, run) => {
    h.maybeSingle.mockResolvedValue({ data: { ...ORGANIZER, city: null }, error: null });
    expect(await redirectedTo(run())).toBe('/welcome');
  });

  it('le layout affiche la barre d’onglets, sans bandeau pour un compte actif', async () => {
    render(await OrganizerLayout({ children: <p>Contenu</p> }));
    expect(
      screen.getByRole('navigation', { name: messages.nav.organizer.ariaLabel }),
    ).toBeVisible();
    expect(screen.getByText('Contenu')).toBeVisible();
    expect(screen.queryByText(messages.account.suspended.title)).toBeNull();
  });

  it('le layout affiche le bandeau « Compte suspendu » sur toutes les pages', async () => {
    h.maybeSingle.mockResolvedValue({
      data: { ...ORGANIZER, status: 'suspended', suspended_at: '2026-10-22T09:00:00Z' },
      error: null,
    });
    render(await OrganizerLayout({ children: <p>Contenu</p> }));
    expect(screen.getByRole('heading', { name: messages.account.suspended.title })).toBeVisible();
  });

  it('/events/new affiche la page provisoire « Créer »', async () => {
    render(await NewEventPage());
    expect(screen.getByRole('heading', { name: messages.createSoon.title })).toBeVisible();
  });

  it('/account : e-mail non modifiable, champs désactivés si le compte est suspendu', async () => {
    h.maybeSingle.mockResolvedValue({
      data: { ...ORGANIZER, status: 'suspended', suspended_at: '2026-10-22T09:00:00Z' },
      error: null,
    });
    render(await AccountPage());
    expect(screen.getByText(USER.email)).toBeVisible();
    expect(screen.queryByRole('textbox', { name: /adresse e-mail/i })).toBeNull();
    for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled();
    expect(screen.queryByRole('button', { name: messages.account.profile.save })).toBeNull();
  });

  it('/account propose les pays lus dans la base', async () => {
    render(await AccountPage());
    expect(screen.getByRole('option', { name: 'Bénin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: "Côte d'Ivoire" })).toBeInTheDocument();
  });
});

describe('pages publiques', () => {
  it('/login déjà connecté : /dashboard', async () => {
    expect(await redirectedTo(LoginPage({ searchParams: Promise.resolve({}) }))).toBe('/dashboard');
  });

  it('/login non connecté : le formulaire, sans barre de navigation', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { name: messages.auth.login.title })).toBeVisible();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('/login : l’adresse en attente n’est pré-remplie que depuis « Changer d’adresse » (?change=1)', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    h.pending = 'awa@exemple.com';
    try {
      const plain = render(await LoginPage({ searchParams: Promise.resolve({}) }));
      expect(screen.queryByDisplayValue('awa@exemple.com')).toBeNull();
      plain.unmount();
      render(await LoginPage({ searchParams: Promise.resolve({ change: '1' }) }));
      expect(screen.getByDisplayValue('awa@exemple.com')).toBeVisible();
    } finally {
      h.pending = undefined;
    }
  });

  it('/login avec une session sans compte organisateur (admin) : le formulaire, sans boucle', async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { name: messages.auth.login.title })).toBeVisible();
  });

  it('/welcome sans session : /login ; profil déjà rempli : /dashboard', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    expect(await redirectedTo(WelcomePage())).toBe('/login');
    h.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    expect(await redirectedTo(WelcomePage())).toBe('/dashboard');
  });

  it('/welcome avec un profil incomplet : l’écran profil', async () => {
    h.maybeSingle.mockResolvedValue({ data: { ...ORGANIZER, full_name: null }, error: null });
    render(await WelcomePage());
    expect(screen.getByRole('heading', { name: messages.auth.profile.title })).toBeVisible();
  });

  it('/welcome : « Se déconnecter » est proposé', async () => {
    h.maybeSingle.mockResolvedValue({ data: { ...ORGANIZER, full_name: null }, error: null });
    render(await WelcomePage());
    expect(screen.getByRole('button', { name: messages.account.session.signOut })).toBeVisible();
  });

  it('/welcome avec un compte suspendu : bandeau et formulaire désactivé', async () => {
    h.maybeSingle.mockResolvedValue({
      data: { ...ORGANIZER, full_name: null, status: 'suspended' },
      error: null,
    });
    render(await WelcomePage());
    expect(screen.getByText(messages.account.suspended.title)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.auth.profile.submit })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.account.session.signOut })).toBeEnabled();
  });
});
