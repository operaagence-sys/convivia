// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@/content/messages.fr';
import { AccountProfileSection } from './account-profile-section';

const text = messages.account.profile;
const countries = [
  { code: 'BJ', name: messages.auth.countries.BJ },
  { code: 'TG', name: messages.auth.countries.TG },
];
const initialValues = { name: 'Awa Kossi', city: 'Cotonou', country: 'BJ' };

function setup(props: Partial<Parameters<typeof AccountProfileSection>[0]> = {}) {
  const onSave = vi.fn();
  const view = render(
    <AccountProfileSection
      email="awa@exemple.com"
      initialValues={initialValues}
      countries={countries}
      status="idle"
      onSave={onSave}
      {...props}
    />,
  );
  return { onSave, ...view };
}

describe('AccountProfileSection', () => {
  it('affiche l’e-mail en lecture seule et les valeurs enregistrées', () => {
    setup();
    expect(screen.getByText('awa@exemple.com')).toBeInTheDocument();
    expect(screen.getByText(text.emailHint)).toBeInTheDocument();
    expect(screen.getByLabelText(text.nameLabel)).toHaveValue('Awa Kossi');
    expect(screen.getByLabelText(text.cityLabel)).toHaveValue('Cotonou');
    expect(screen.getByLabelText(text.countryLabel)).toHaveValue('BJ');
  });

  it('enregistre les valeurs modifiées', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText(text.cityLabel), { target: { value: ' Porto-Novo ' } });
    fireEvent.change(screen.getByLabelText(text.countryLabel), { target: { value: 'TG' } });
    fireEvent.click(screen.getByRole('button', { name: text.save }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Awa Kossi',
      city: 'Porto-Novo',
      country: 'TG',
    });
  });

  it('affiche les messages du serveur pour un nom, une ville ou un pays refusés', () => {
    const { unmount } = setup({ status: 'error', error: 'nameInvalid' });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.nameInvalid);
    unmount();
    const second = setup({ status: 'error', error: 'cityInvalid' });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.cityInvalid);
    second.unmount();
    setup({ status: 'error', error: 'countryInvalid' });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.countryInvalid);
  });

  it('refuse un nom vide', () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText(text.nameLabel), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: text.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.nameRequired);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('confirme l’enregistrement, puis efface la confirmation à la prochaine modification', () => {
    setup({ status: 'success' });
    expect(screen.getByRole('status')).toHaveTextContent(text.saved);
    fireEvent.change(screen.getByLabelText(text.nameLabel), { target: { value: 'Awa K.' } });
    expect(screen.queryByText(text.saved)).not.toBeInTheDocument();
  });

  it('affiche l’échec de l’enregistrement', () => {
    setup({ status: 'error', error: 'saveFailed' });
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.saveFailed);
  });

  it('passe en lecture seule quand le compte est suspendu', () => {
    setup({ suspended: true });
    expect(screen.getByLabelText(text.nameLabel)).toBeDisabled();
    expect(screen.getByLabelText(text.cityLabel)).toBeDisabled();
    expect(screen.getByLabelText(text.countryLabel)).toBeDisabled();
    expect(screen.queryByRole('button', { name: text.save })).not.toBeInTheDocument();
  });
});
