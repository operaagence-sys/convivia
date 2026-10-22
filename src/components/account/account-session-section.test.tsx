// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { messages } from '@/content/messages.fr';
import { AccountSessionSection } from './account-session-section';

const text = messages.account.session;

// jsdom n'implémente pas `<dialog>.showModal()` : on simule seulement l'ouverture et la fermeture.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

function setup(props: Partial<Parameters<typeof AccountSessionSection>[0]> = {}) {
  const onSignOut = vi.fn();
  const onSignOutAll = vi.fn();
  const view = render(
    <AccountSessionSection
      signOutStatus="idle"
      signOutAllStatus="idle"
      onSignOut={onSignOut}
      onSignOutAll={onSignOutAll}
      {...props}
    />,
  );
  return { onSignOut, onSignOutAll, ...view };
}

describe('AccountSessionSection', () => {
  it('déconnecte cet appareil', () => {
    const { onSignOut } = setup();
    fireEvent.click(screen.getByRole('button', { name: text.signOut }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('demande confirmation avant de déconnecter tous les appareils', () => {
    const { onSignOutAll } = setup();
    fireEvent.click(screen.getByRole('button', { name: text.signOutAll }));
    expect(onSignOutAll).not.toHaveBeenCalled();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(text.signOutAllConfirm.title)).toBeInTheDocument();
    expect(screen.getByText(text.signOutAllConfirm.description)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: text.signOutAllConfirm.confirm }));
    expect(onSignOutAll).toHaveBeenCalledTimes(1);
  });

  it('n’agit pas si on annule', () => {
    const { onSignOutAll } = setup();
    fireEvent.click(screen.getByRole('button', { name: text.signOutAll }));
    fireEvent.click(screen.getByRole('button', { name: text.signOutAllConfirm.cancel }));
    expect(onSignOutAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('montre l’échec dans la fenêtre de confirmation, qui reste ouverte', () => {
    const props = { onSignOut: vi.fn(), onSignOutAll: vi.fn() };
    const { rerender } = render(
      <AccountSessionSection signOutStatus="idle" signOutAllStatus="idle" {...props} />,
    );
    fireEvent.click(screen.getByRole('button', { name: text.signOutAll }));
    rerender(
      <AccountSessionSection
        signOutStatus="idle"
        signOutAllStatus="error"
        signOutAllError="signOutFailed"
        {...props}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.signOutFailed);
  });

  it('affiche l’échec d’une déconnexion simple', () => {
    setup({ signOutStatus: 'error', signOutError: 'network' });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.network);
  });

  it('confirme la déconnexion et bloque les autres actions', () => {
    setup({ signOutStatus: 'success' });
    expect(screen.getByRole('status')).toHaveTextContent(text.signedOut);
    expect(screen.getByRole('button', { name: text.signOutAll })).toBeDisabled();
  });
});
