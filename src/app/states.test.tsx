// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotFound from './not-found';
import ErrorPage from './error';
import GlobalError from './global-error';
import Loading from './loading';
import GuestNotFound from './i/not-found';
import DashboardPage from './(organizer)/dashboard/page';
import LoginPage from './(organizer)/login/page';
import ScanEntryPage from './(reception)/scan/page';
import AdminHomePage from './(admin)/admin/page';
import { messages } from '@/content/messages.fr';
import { t } from '@/content/format';
import { PHOTO_TEXT_VARS } from '@/content/photo-constraints';

describe("pages d'état", () => {
  it('404 globale', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.notFound.actionLabel })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('erreur avec réessai, sans détail technique', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('secret')} reset={reset} />);
    expect(screen.getByText('Un problème est survenu')).toBeInTheDocument();
    expect(screen.queryByText(/secret/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: messages.error.retryLabel }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('erreur globale', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('x')} reset={reset} />);
    expect(screen.getByText("Convivia ne s'affiche pas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.globalError.retryLabel }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('chargement', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement en cours');
  });

  it('404 invités sans lien ni bouton', () => {
    const { container } = render(<GuestNotFound />);
    expect(screen.getByText('Invitation introuvable')).toBeInTheDocument();
    expect(container.querySelector('a, button')).toBeNull();
  });

  it.each([
    [DashboardPage, 'Mes événements'],
    [LoginPage, 'Connexion'],
    [ScanEntryPage, 'Scan des invitations'],
    [AdminHomePage, 'Administration'],
  ])('page provisoire %#', (Page, title) => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });
});

describe('t()', () => {
  it('remplace les variables', () => {
    expect(t(messages.pagination.page, { current: 2, total: 5 })).toBe('Page 2 sur 5');
    expect(t(messages.dropzone.idle.constraints, PHOTO_TEXT_VARS)).toBe(
      'Formats acceptés : JPEG, PNG, WebP, HEIC. Poids maximal : 10 Mo.',
    );
  });
  it('laisse une variable inconnue', () => {
    expect(t('a {x}', {})).toBe('a {x}');
  });
});
