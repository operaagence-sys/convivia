'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';
import { Button, InlineAlert, TextField } from '@/components/ui';
import { formatDelay } from './format-delay';
import type { FormStatus, RateLimitError } from './types';
import { useCountdown } from './use-countdown';

const text = messages.auth.login;

export type LoginError = { kind: 'network' | 'sendFailed' | 'invalid' } | RateLimitError;

export type LoginFormProps = {
  /** `loading` et `success` (redirection en cours) bloquent le formulaire. */
  status: FormStatus;
  /** Erreur renvoyée par le serveur (réseau, envoi, plafond ou blocage avec délai). */
  error?: LoginError;
  /** Adresse à pré-remplir (retour depuis « Changer d'adresse e-mail »). */
  defaultEmail?: string;
  /** Appelé avec l'adresse nettoyée (espaces retirés) une fois la validation locale réussie. */
  onSubmit: (email: string) => void;
};

// Contrôle volontairement simple : le serveur reste juge de la validité de l'adresse.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Écran de connexion par e-mail (D47) : un champ, un bouton, aucun mot de passe. */
export function LoginForm({ status, error, defaultEmail = '', onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [fieldError, setFieldError] = useState<string>();

  const waitSeconds = error && 'retryAfterSeconds' in error ? error.retryAfterSeconds : 0;
  const remaining = useCountdown(waitSeconds, error?.kind);
  const busy = status === 'loading' || status === 'success';

  function serverMessage(): string | undefined {
    if (!error) return undefined;
    switch (error.kind) {
      case 'network':
        return text.error.network;
      case 'invalid':
        return text.error.invalid;
      case 'sendFailed':
        return text.error.sendFailed;
      case 'hourlyLimit':
      case 'blocked':
      case 'tooSoon':
        if (remaining <= 0) return undefined;
        return t(text.error[error.kind], { delay: formatDelay(remaining) });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || remaining > 0) return;
    const value = email.trim();
    if (value === '') return setFieldError(text.error.required);
    if (!EMAIL_PATTERN.test(value)) return setFieldError(text.error.invalid);
    setFieldError(undefined);
    onSubmit(value);
  }

  const formMessage = status === 'error' ? serverMessage() : undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{text.title}</h1>
        <p className="text-small text-text-secondary">{text.subtitle}</p>
      </div>

      <TextField
        label={text.emailLabel}
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={text.emailPlaceholder}
        value={email}
        disabled={busy}
        error={fieldError}
        onChange={(event) => {
          setEmail(event.target.value);
          setFieldError(undefined);
        }}
      />

      {formMessage ? <InlineAlert tone="error">{formMessage}</InlineAlert> : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" fullWidth loading={busy} disabled={!busy && remaining > 0}>
          {busy ? text.submitting : text.submit}
        </Button>
        {busy ? (
          <span role="status" className="sr-only">
            {text.submitting}
          </span>
        ) : null}
        <p className="text-center text-caption text-text-secondary">{text.hint}</p>
      </div>
    </form>
  );
}
