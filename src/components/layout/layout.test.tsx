// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';
import { AuthScreenLayout } from './auth-screen-layout';

describe('AuthScreenLayout', () => {
  it('affiche le contenu sans aucune navigation', () => {
    render(
      <AuthScreenLayout>
        <h1>Connexion</h1>
      </AuthScreenLayout>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('place le bandeau et le contenu dans main, et la barre en dehors', () => {
    render(
      <AppShell nav={<nav aria-label="Barre">barre</nav>} banner={<p>Bandeau</p>}>
        <p>Contenu</p>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByText('Bandeau'));
    expect(main).toContainElement(screen.getByText('Contenu'));
    expect(main).not.toContainElement(screen.getByRole('navigation', { name: 'Barre' }));
  });
});
