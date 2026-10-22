'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { messages } from '@/content/messages.fr';
import { Button, Card, InlineAlert } from '@/components/ui';
import type { FormStatus } from '@/components/auth/types';
import {
  ProfileFields,
  validateProfile,
  type ProfileCountry,
  type ProfileFieldErrors,
  type ProfileLimits,
  type ProfileValues,
} from './profile-fields';

const text = messages.account.profile;

export type AccountProfileError =
  | 'network'
  | 'saveFailed'
  | 'nameInvalid'
  | 'nameTooLong'
  | 'cityInvalid'
  | 'cityTooLong'
  | 'countryInvalid'
  | 'suspended';

export type AccountProfileSectionProps = {
  /** Adresse e-mail du compte : affichée, jamais modifiable (D51). */
  email: string;
  /** Valeurs enregistrées. */
  initialValues: ProfileValues;
  countries: readonly ProfileCountry[];
  status: FormStatus;
  error?: AccountProfileError;
  /** Compte suspendu : lecture seule, champs désactivés, pas de bouton d'enregistrement. */
  suspended?: boolean;
  limits?: ProfileLimits;
  /** Appelé avec les valeurs nettoyées une fois la validation locale réussie. */
  onSave: (values: ProfileValues) => void;
};

/** Carte « Mes informations » de `/account` : e-mail en lecture seule, nom, ville, pays. */
export function AccountProfileSection({
  email,
  initialValues,
  countries,
  status,
  error,
  suspended = false,
  limits,
  onSave,
}: AccountProfileSectionProps) {
  const titleId = useId();
  const [values, setValues] = useState<ProfileValues>(initialValues);
  const [localErrors, setLocalErrors] = useState<ProfileFieldErrors>({});

  // Le message « enregistré » disparaît dès qu'on modifie un champ ou qu'un nouvel état arrive.
  const [touched, setTouched] = useState(false);
  const [seenStatus, setSeenStatus] = useState(status);
  if (seenStatus !== status) {
    setSeenStatus(status);
    setTouched(false);
  }

  const saving = status === 'loading';
  const errors: ProfileFieldErrors = {
    ...(status === 'error' && error === 'nameTooLong' ? { name: text.error.nameTooLong } : {}),
    ...(status === 'error' && error === 'nameInvalid' ? { name: text.error.nameInvalid } : {}),
    ...(status === 'error' && error === 'cityInvalid' ? { city: text.error.cityInvalid } : {}),
    ...(status === 'error' && error === 'cityTooLong' ? { city: text.error.cityTooLong } : {}),
    ...(status === 'error' && error === 'countryInvalid'
      ? { country: text.error.countryInvalid }
      : {}),
    ...localErrors,
  };
  const formMessage =
    status === 'error' && error === 'network'
      ? text.error.network
      : status === 'error' && error === 'saveFailed'
        ? text.error.saveFailed
        : status === 'error' && error === 'suspended'
          ? text.error.suspended
          : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (suspended || saving) return;
    const found = validateProfile(values, text.error, limits);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave({ name: values.name.trim(), city: values.city.trim(), country: values.country });
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="flex flex-col gap-6">
      <h2 id={titleId} className="text-h3">
        {text.title}
      </h2>

      <div className="flex flex-col gap-1">
        <span className="text-small font-medium text-text-primary">{text.emailLabel}</span>
        <p className="break-words text-body text-text-primary">{email}</p>
        <p className="text-caption text-text-secondary">{text.emailHint}</p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
        <ProfileFields
          values={values}
          onChange={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
            setTouched(true);
            setLocalErrors((current) => {
              const next = { ...current };
              for (const key of Object.keys(patch) as Array<keyof ProfileValues>) delete next[key];
              return next;
            });
          }}
          errors={errors}
          countries={countries}
          disabled={suspended || saving}
          labels={{
            name: text.nameLabel,
            nameHint: text.nameHint,
            city: text.cityLabel,
            country: text.countryLabel,
          }}
        />

        {formMessage ? <InlineAlert tone="error">{formMessage}</InlineAlert> : null}
        {status === 'success' && !touched ? (
          <InlineAlert tone="success">{text.saved}</InlineAlert>
        ) : null}

        {suspended ? null : (
          <Button type="submit" fullWidth loading={saving}>
            {saving ? text.saving : text.save}
          </Button>
        )}
        {saving ? (
          <span role="status" className="sr-only">
            {text.saving}
          </span>
        ) : null}
      </form>
    </Card>
  );
}
