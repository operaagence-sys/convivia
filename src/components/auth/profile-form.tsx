'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';
import { Button, InlineAlert } from '@/components/ui';
import {
  ProfileFields,
  validateProfile,
  type ProfileCountry,
  type ProfileFieldErrors,
  type ProfileLimits,
  type ProfileValues,
} from '@/components/account/profile-fields';
import type { FormStatus } from './types';

const text = messages.auth.profile;

export type ProfileFormError =
  | 'network'
  | 'saveFailed'
  | 'nameInvalid'
  | 'nameTooLong'
  | 'cityInvalid'
  | 'cityTooLong'
  | 'countryInvalid';

export type ProfileFormProps = {
  status: FormStatus;
  /** Erreur du serveur : les trois erreurs de champ se posent sous le champ, les autres en haut du bouton. */
  error?: ProfileFormError;
  /** Les 4 pays actifs (D53), déjà nommés : `{ code: 'BJ', name: 'Bénin' }`… */
  countries: readonly ProfileCountry[];
  /** Pré-remplissage éventuel (ex. pays déduit de l'indicatif). */
  defaultValues?: Partial<ProfileValues>;
  /** Longueurs maximales (D55) ; sans elles, seul le serveur contrôle la longueur. */
  limits?: ProfileLimits;
  /** Compte suspendu : champs et bouton désactivés (le parent affiche le bandeau). */
  suspended?: boolean;
  /** Appelé avec les valeurs nettoyées (espaces retirés) une fois la validation locale réussie. */
  onSubmit: (values: ProfileValues) => void;
};

/** Écran « Votre profil » après le premier code : nom, ville libre, pays (D44, D53, D55). */
export function ProfileForm({
  status,
  error,
  countries,
  defaultValues,
  limits,
  suspended = false,
  onSubmit,
}: ProfileFormProps) {
  const [values, setValues] = useState<ProfileValues>({
    name: defaultValues?.name ?? '',
    city: defaultValues?.city ?? '',
    country: defaultValues?.country ?? '',
  });
  const [localErrors, setLocalErrors] = useState<ProfileFieldErrors>({});
  const busy = status === 'loading' || status === 'success';
  const disabled = busy || suspended;

  const serverErrors: ProfileFieldErrors =
    status === 'error'
      ? {
          name:
            error === 'nameTooLong'
              ? text.error.nameTooLong
              : error === 'nameInvalid'
                ? text.error.nameInvalid
                : undefined,
          city:
            error === 'cityTooLong'
              ? text.error.cityTooLong
              : error === 'cityInvalid'
                ? text.error.cityInvalid
                : undefined,
          country: error === 'countryInvalid' ? text.error.countryInvalid : undefined,
        }
      : {};
  const errors: ProfileFieldErrors = {
    name: localErrors.name ?? serverErrors.name,
    city: localErrors.city ?? serverErrors.city,
    country: localErrors.country ?? serverErrors.country,
  };
  const formMessage =
    status === 'error' && error === 'network'
      ? text.error.network
      : status === 'error' && error === 'saveFailed'
        ? text.error.saveFailed
        : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const found = validateProfile(values, text.error, limits);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      name: values.name.trim(),
      city: values.city.trim(),
      country: values.country,
    });
  }

  const preview = values.name.trim() || text.nameExample;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{text.title}</h1>
        <p className="text-small text-text-secondary">{text.subtitle}</p>
      </div>

      <ProfileFields
        values={values}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          setLocalErrors((current) => {
            const next = { ...current };
            for (const key of Object.keys(patch) as Array<keyof ProfileValues>) delete next[key];
            return next;
          });
        }}
        errors={errors}
        countries={countries}
        disabled={disabled}
        labels={{
          name: text.nameLabel,
          nameHint: t(text.nameHint, { exemple: preview }),
          namePlaceholder: text.namePlaceholder,
          city: text.cityLabel,
          cityPlaceholder: text.cityPlaceholder,
          country: text.countryLabel,
          countryPlaceholder: text.countryPlaceholder,
        }}
      />

      {formMessage ? <InlineAlert tone="error">{formMessage}</InlineAlert> : null}

      <Button type="submit" fullWidth loading={busy} disabled={suspended}>
        {busy ? text.submitting : text.submit}
      </Button>
      {busy ? (
        <span role="status" className="sr-only">
          {text.submitting}
        </span>
      ) : null}
    </form>
  );
}
