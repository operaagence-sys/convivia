// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';
import { VerifyCodeForm, type VerifyCodeFormProps } from './verify-code-form';

const text = messages.auth.verify;
const EMAIL = 'awa@exemple.com';

function setup(props: Partial<VerifyCodeFormProps> = {}) {
  const handlers = { onSubmit: vi.fn(), onResend: vi.fn(), onChangeEmail: vi.fn() };
  const view = render(<VerifyCodeForm email={EMAIL} status="idle" {...handlers} {...props} />);
  return { ...handlers, ...view };
}

function digits(): HTMLElement[] {
  return screen.getAllByRole('textbox');
}

function paste(value: string) {
  fireEvent.paste(digits()[0]!, { clipboardData: { getData: () => value } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('VerifyCodeForm', () => {
  it('annonce l’adresse sans révéler si le compte existe', () => {
    setup();
    expect(screen.getByText(t(text.subtitle, { email: EMAIL }))).toBeInTheDocument();
    expect(screen.getByText(text.checkSpam)).toBeInTheDocument();
  });

  it('prépare la saisie assistée : 6 cases numériques, code à usage unique', () => {
    setup();
    expect(digits()).toHaveLength(6);
    expect(digits()[0]).toHaveAttribute('inputmode', 'numeric');
    expect(digits()[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(digits()[0]).toHaveAccessibleName(t(text.digitAriaLabel, { index: 1 }));
  });

  it('affiche la durée de validité seulement si elle est fournie', () => {
    const { unmount } = setup();
    expect(screen.queryByText(t(text.validity, { minutes: 10 }))).not.toBeInTheDocument();
    unmount();
    setup({ validityMinutes: 10 });
    expect(screen.getByText(t(text.validity, { minutes: 10 }))).toBeInTheDocument();
  });

  it('accepte le collage d’un code entier puis le valide', () => {
    const { onSubmit } = setup();
    paste('123 456');
    expect(digits().map((input) => (input as HTMLInputElement).value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('demande les 6 chiffres quand le code est vide ou incomplet', () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.required);
    paste('123');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.incomplete);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche le message neutre d’un code faux, sans nombre d’essais', () => {
    setup({ status: 'error', error: { kind: 'wrong' } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(text.error.wrong);
    expect(alert).not.toHaveTextContent(/essai/i);
  });

  it('efface l’erreur dès que le code est modifié', () => {
    setup({ status: 'error', error: { kind: 'wrong' } });
    paste('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('bloque la saisie et le renvoi pendant le blocage, avec le délai', () => {
    setup({ status: 'error', error: { kind: 'blocked', retryAfterSeconds: 15 * 60 } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Trop de tentatives. Réessayez dans 15 minutes.',
    );
    digits().forEach((input) => expect(input).toBeDisabled());
    expect(screen.getByRole('button', { name: text.submit })).toBeDisabled();
  });

  it('bloque le formulaire pendant la vérification', () => {
    setup({ status: 'loading' });
    digits().forEach((input) => expect(input).toBeDisabled());
    expect(screen.getByRole('button', { name: /Vérification…/ })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('confirme la connexion', () => {
    setup({ status: 'success' });
    expect(screen.getByText(text.success)).toBeInTheDocument();
  });

  it('propose le renvoi après le décompte de 60 s', () => {
    vi.useFakeTimers();
    const { onResend } = setup();
    expect(screen.getByText(t(text.resendIn, { seconds: 60 }))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: text.resend })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.getByText(t(text.resendIn, { seconds: 1 }))).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    fireEvent.click(screen.getByRole('button', { name: text.resend }));
    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it('relance le décompte et confirme après un renvoi réussi', () => {
    vi.useFakeTimers();
    const props = { onSubmit: vi.fn(), onResend: vi.fn(), onChangeEmail: vi.fn() };
    const { rerender } = render(
      <VerifyCodeForm email={EMAIL} status="idle" resendCooldownSeconds={5} {...props} />,
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole('button', { name: text.resend })).toBeInTheDocument();

    rerender(
      <VerifyCodeForm
        email={EMAIL}
        status="idle"
        resendStatus="success"
        resendCooldownSeconds={5}
        {...props}
      />,
    );
    expect(screen.getByText(text.resent)).toBeInTheDocument();
    expect(screen.getByText(t(text.resendIn, { seconds: 5 }))).toBeInTheDocument();
  });

  it('affiche l’échec du renvoi dans une alerte', () => {
    vi.useFakeTimers();
    setup({ resendCooldownSeconds: 0, resendStatus: 'error', resendError: { kind: 'sendFailed' } });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.sendFailed);
  });

  it('permet de changer d’adresse', () => {
    const { onChangeEmail } = setup();
    fireEvent.click(screen.getByRole('button', { name: text.changeEmail }));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it('propose de revenir à la connexion quand la demande n’est plus à jour', () => {
    const { onChangeEmail } = setup({ email: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.missingEmail);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: text.error.missingEmailAction }));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unavailable', text.error.unavailable],
    ['unexpected', text.error.unexpected],
    ['network', text.error.network],
  ] as const)('erreur « %s » : son propre message', (kind, message) => {
    setup({ status: 'error', error: { kind } });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('renvoi trop rapide : message avec délai', () => {
    setup({
      status: 'idle',
      resendStatus: 'error',
      resendError: { kind: 'tooSoon', retryAfterSeconds: 90 },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      t(text.error.tooSoon, { delay: '2 minutes' }),
    );
  });
});
