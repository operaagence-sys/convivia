// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@/content/messages.fr';
import { LoginForm } from './login-form';

const text = messages.auth.login;

function typeEmail(value: string) {
  fireEvent.change(screen.getByLabelText(text.emailLabel), { target: { value } });
}

describe('LoginForm', () => {
  it('affiche le titre, le champ e-mail et le bouton', () => {
    render(<LoginForm status="idle" onSubmit={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: text.title })).toBeInTheDocument();
    const field = screen.getByLabelText(text.emailLabel);
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByRole('button', { name: text.submit })).toBeEnabled();
  });

  it('demande l’adresse quand le champ est vide', () => {
    const onSubmit = vi.fn();
    render(<LoginForm status="idle" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.required);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuse une adresse mal formée', () => {
    const onSubmit = vi.fn();
    render(<LoginForm status="idle" onSubmit={onSubmit} />);
    typeEmail('prenom@exemple');
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.invalid);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envoie l’adresse nettoyée', () => {
    const onSubmit = vi.fn();
    render(<LoginForm status="idle" onSubmit={onSubmit} />);
    typeEmail('  awa@exemple.com ');
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(onSubmit).toHaveBeenCalledWith('awa@exemple.com');
  });

  it('bloque le formulaire pendant l’envoi', () => {
    render(<LoginForm status="loading" defaultEmail="awa@exemple.com" onSubmit={() => {}} />);
    expect(screen.getByLabelText(text.emailLabel)).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('affiche une erreur de réseau dans une alerte', () => {
    render(<LoginForm status="error" error={{ kind: 'network' }} onSubmit={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.network);
  });

  it('annonce le plafond horaire avec le délai et désactive le bouton', () => {
    render(
      <LoginForm
        status="error"
        error={{ kind: 'hourlyLimit', retryAfterSeconds: 12 * 60 }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vous avez demandé trop de codes. Réessayez dans 12 minutes.',
    );
    expect(screen.getByRole('button', { name: text.submit })).toBeDisabled();
  });

  it('annonce un renvoi trop rapide avec le délai, sans dire « trop de tentatives »', () => {
    render(
      <LoginForm
        status="error"
        error={{ kind: 'tooSoon', retryAfterSeconds: 40 }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Un code vient d’être envoyé. Patientez moins d’une minute avant d’en demander un autre.',
    );
    expect(screen.getByRole('button', { name: text.submit })).toBeDisabled();
  });

  it('annonce le blocage sans dire si le compte existe', () => {
    render(
      <LoginForm
        status="error"
        error={{ kind: 'blocked', retryAfterSeconds: 30 }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans moins d’une minute.',
    );
  });
});
