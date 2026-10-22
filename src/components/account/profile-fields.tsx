'use client';

import type { ChangeEvent } from 'react';
import { SelectField, TextField } from '@/components/ui';

/** Valeurs du profil de l'organisateur (D44, D53, D55). `country` = code ISO (BJ, CI, TG, SN). */
export type ProfileValues = { name: string; city: string; country: string };

/** Pays proposé : le code ISO et son nom affiché (la liste vient du parent, jamais en dur ici). */
export type ProfileCountry = { code: string; name: string };

/** Longueurs maximales (D55) : absentes tant que le `supabase-developer` ne les a pas fixées. */
export type ProfileLimits = { nameMaxLength?: number; cityMaxLength?: number };

export type ProfileFieldErrors = Partial<Record<keyof ProfileValues, string>>;

/** Textes d'erreur de validation (les mêmes clés existent pour `auth.profile` et `account.profile`). */
export type ProfileValidationText = {
  nameRequired: string;
  nameTooLong: string;
  cityRequired: string;
  cityTooLong: string;
  countryRequired: string;
};

/** Validation locale : champs obligatoires et longueurs. Le serveur revérifie tout. */
export function validateProfile(
  values: ProfileValues,
  text: ProfileValidationText,
  limits: ProfileLimits = {},
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const name = values.name.trim();
  const city = values.city.trim();
  if (name === '') errors.name = text.nameRequired;
  else if (limits.nameMaxLength !== undefined && name.length > limits.nameMaxLength)
    errors.name = text.nameTooLong;
  if (city === '') errors.city = text.cityRequired;
  else if (limits.cityMaxLength !== undefined && city.length > limits.cityMaxLength)
    errors.city = text.cityTooLong;
  if (values.country === '') errors.country = text.countryRequired;
  return errors;
}

export type ProfileFieldsLabels = {
  name: string;
  nameHint: string;
  namePlaceholder?: string;
  city: string;
  cityPlaceholder?: string;
  country: string;
  countryPlaceholder?: string;
};

type ProfileFieldsProps = {
  values: ProfileValues;
  onChange: (patch: Partial<ProfileValues>) => void;
  errors: ProfileFieldErrors;
  countries: readonly ProfileCountry[];
  labels: ProfileFieldsLabels;
  disabled?: boolean;
};

/** Trois champs du profil : nom, ville (libre), pays (liste fournie). Partagé connexion / compte. */
export function ProfileFields({
  values,
  onChange,
  errors,
  countries,
  labels,
  disabled,
}: ProfileFieldsProps) {
  return (
    <>
      <TextField
        label={labels.name}
        name="name"
        autoComplete="name"
        placeholder={labels.namePlaceholder}
        hint={labels.nameHint}
        value={values.name}
        disabled={disabled}
        error={errors.name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ name: event.target.value })}
      />
      <TextField
        label={labels.city}
        name="city"
        autoComplete="address-level2"
        placeholder={labels.cityPlaceholder}
        value={values.city}
        disabled={disabled}
        error={errors.city}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ city: event.target.value })}
      />
      <SelectField
        label={labels.country}
        name="country"
        autoComplete="country"
        placeholder={labels.countryPlaceholder}
        options={countries.map((country) => ({ value: country.code, label: country.name }))}
        value={values.country}
        disabled={disabled}
        error={errors.country}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange({ country: event.target.value })
        }
      />
    </>
  );
}
