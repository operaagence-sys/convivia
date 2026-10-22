// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@/content/messages.fr';
import { ProfileForm } from './profile-form';

const text = messages.auth.profile;
const countries = [
  { code: 'BJ', name: messages.auth.countries.BJ },
  { code: 'CI', name: messages.auth.countries.CI },
  { code: 'TG', name: messages.auth.countries.TG },
  { code: 'SN', name: messages.auth.countries.SN },
];

function fill(values: { name?: string; city?: string; country?: string }) {
  if (values.name !== undefined)
    fireEvent.change(screen.getByLabelText(text.nameLabel), { target: { value: values.name } });
  if (values.city !== undefined)
    fireEvent.change(screen.getByLabelText(text.cityLabel), { target: { value: values.city } });
  if (values.country !== undefined)
    fireEvent.change(screen.getByLabelText(text.countryLabel), {
      target: { value: values.country },
    });
}

describe('ProfileForm', () => {
  it('affiche les messages « mal formé » du serveur, pas « obligatoire »', () => {
    const { rerender } = render(
      <ProfileForm status="error" error="nameInvalid" countries={countries} onSubmit={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.nameInvalid);
    rerender(
      <ProfileForm status="error" error="cityInvalid" countries={countries} onSubmit={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.cityInvalid);
    rerender(
      <ProfileForm
        status="error"
        error="countryInvalid"
        countries={countries}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.countryInvalid);
  });

  it('compte suspendu : champs et bouton désactivés, aucun envoi', () => {
    const onSubmit = vi.fn();
    render(<ProfileForm status="idle" countries={countries} suspended onSubmit={onSubmit} />);
    expect(screen.getByLabelText(text.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: text.submit })).toBeDisabled();
  });

  it('propose les pays reçus en props, et eux seulement', () => {
    render(<ProfileForm status="idle" countries={countries} onSubmit={() => {}} />);
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([text.countryPlaceholder, 'Bénin', "Côte d'Ivoire", 'Togo', 'Sénégal']);
  });

  it('signale les trois champs obligatoires', () => {
    const onSubmit = vi.fn();
    render(<ProfileForm status="idle" countries={countries} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual([
      text.error.nameRequired,
      text.error.cityRequired,
      text.error.countryRequired,
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envoie les valeurs nettoyées', () => {
    const onSubmit = vi.fn();
    render(<ProfileForm status="idle" countries={countries} onSubmit={onSubmit} />);
    fill({ name: '  Awa Kossi ', city: ' Cotonou ', country: 'BJ' });
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Awa Kossi', city: 'Cotonou', country: 'BJ' });
  });

  it('montre en direct comment le nom sera affiché', () => {
    render(<ProfileForm status="idle" countries={countries} onSubmit={() => {}} />);
    expect(
      screen.getByText('Il sera affiché ainsi : « De la part de Prénom Nom, via Convivia ».'),
    ).toBeInTheDocument();
    fill({ name: 'Awa Kossi' });
    expect(
      screen.getByText('Il sera affiché ainsi : « De la part de Awa Kossi, via Convivia ».'),
    ).toBeInTheDocument();
  });

  it('refuse un nom plus long que la limite fournie', () => {
    const onSubmit = vi.fn();
    render(
      <ProfileForm
        status="idle"
        countries={countries}
        limits={{ nameMaxLength: 5 }}
        onSubmit={onSubmit}
      />,
    );
    fill({ name: 'Awa Kossi', city: 'Lomé', country: 'TG' });
    fireEvent.click(screen.getByRole('button', { name: text.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.nameTooLong);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche une erreur de champ renvoyée par le serveur sous le champ', () => {
    render(
      <ProfileForm status="error" error="cityTooLong" countries={countries} onSubmit={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.cityTooLong);
    expect(screen.getByLabelText(text.cityLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it('affiche une erreur générale en alerte', () => {
    render(
      <ProfileForm status="error" error="saveFailed" countries={countries} onSubmit={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(text.error.saveFailed);
  });

  it('bloque les champs pendant l’enregistrement', () => {
    render(<ProfileForm status="loading" countries={countries} onSubmit={() => {}} />);
    expect(screen.getByLabelText(text.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});
