'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';
import { Button, InlineAlert, OtpField } from '@/components/ui';
import { formatDelay } from './format-delay';
import type { FormStatus, RateLimitError } from './types';
import { useCountdown } from './use-countdown';

const text = messages.auth.verify;
const CODE_LENGTH = 6;

/**
 * Erreur de vérification ou de renvoi. `wrong` couvre code faux et code expiré, sans dire combien
 * d'essais restent (message neutre `error.wrong`, D52 : pas de cas `expired`). `network` = vraie
 * panne réseau côté navigateur ; `unavailable` / `unexpected` = réponse d'erreur du serveur.
 * `blocked`, `hourlyLimit` et `tooSoon` portent le délai restant.
 */
export type VerifyError =
  { kind: 'wrong' | 'network' | 'unavailable' | 'unexpected' | 'sendFailed' } | RateLimitError;

export type VerifyCodeFormProps = {
  /** Adresse à laquelle le code a été envoyé. Absente = demande périmée (écran de retour). */
  email?: string;
  /** État de la vérification du code. `success` = connecté, redirection en cours. */
  status: FormStatus;
  /** Erreur de vérification (nouvel objet à chaque erreur). Affichée quand `status` = `error`. */
  error?: VerifyError;
  /** État du renvoi. `success` affiche la confirmation et relance le décompte. */
  resendStatus?: FormStatus;
  resendError?: VerifyError;
  /** Délai avant de pouvoir renvoyer, en secondes (60 s, PRD). Décompte au montage. */
  resendCooldownSeconds?: number;
  /** Durée de validité du code, en minutes ; la phrase n'apparaît que si elle est fournie. */
  validityMinutes?: number;
  /** Appelé avec les 6 chiffres. */
  onSubmit: (code: string) => void;
  onResend: () => void;
  /** « Changer d'adresse e-mail » et retour depuis l'écran de demande périmée. */
  onChangeEmail: () => void;
};

function messageFor(error: VerifyError, remaining: number): string | undefined {
  const e = text.error;
  switch (error.kind) {
    case 'wrong':
      return e.wrong;
    case 'network':
      return e.network;
    case 'unavailable':
      return e.unavailable;
    case 'unexpected':
      return e.unexpected;
    case 'sendFailed':
      return e.sendFailed;
    case 'blocked':
    case 'hourlyLimit':
    case 'tooSoon':
      return remaining > 0 ? t(e[error.kind], { delay: formatDelay(remaining) }) : undefined;
  }
}

/** Saisie du code à 6 chiffres reçu par e-mail : cases séparées, collage, renvoi, blocage. */
export function VerifyCodeForm({
  email,
  status,
  error,
  resendStatus = 'idle',
  resendError,
  resendCooldownSeconds = 60,
  validityMinutes,
  onSubmit,
  onResend,
  onChangeEmail,
}: VerifyCodeFormProps) {
  const helpId = useId();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string>();

  // L'erreur du serveur s'efface dès que l'on modifie le code (nouvel objet = nouvelle erreur).
  const [dismissed, setDismissed] = useState(false);
  const [seen, setSeen] = useState({ error, status });
  if (seen.error !== error || seen.status !== status) {
    setSeen({ error, status });
    setDismissed(false);
  }

  // Décompte de renvoi : repart à chaque renvoi réussi.
  const [sentCount, setSentCount] = useState(0);
  const [seenResend, setSeenResend] = useState(resendStatus);
  if (seenResend !== resendStatus) {
    setSeenResend(resendStatus);
    if (resendStatus === 'success') setSentCount((count) => count + 1);
  }
  const cooldown = useCountdown(resendCooldownSeconds, sentCount);

  // Blocage / plafond (D52) venant de la vérification ou du renvoi.
  const codeLimit = status === 'error' && error && 'retryAfterSeconds' in error ? error : undefined;
  const resendLimit =
    resendStatus === 'error' && resendError && 'retryAfterSeconds' in resendError
      ? resendError
      : undefined;
  const codeWait = useCountdown(codeLimit?.retryAfterSeconds ?? 0, codeLimit?.kind);
  const resendWait = useCountdown(resendLimit?.retryAfterSeconds ?? 0, resendLimit?.kind);
  const blocked = codeWait > 0;
  const resendBlocked = resendWait > 0 || blocked;

  const verifying = status === 'loading';
  const done = status === 'success';
  const locked = verifying || done || blocked;

  const serverMessage =
    status === 'error' && error && !dismissed ? messageFor(error, codeWait) : undefined;
  const otpMessage = localError ?? serverMessage ?? (done ? text.success : undefined);
  const otpStatus = localError || serverMessage ? 'error' : done ? 'success' : 'idle';

  const resendMessage =
    resendStatus === 'error' && resendError ? messageFor(resendError, resendWait) : undefined;

  if (!email) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-h1">{messages.auth.login.title}</h1>
        <InlineAlert tone="error">{text.error.missingEmail}</InlineAlert>
        <Button fullWidth onClick={onChangeEmail}>
          {text.error.missingEmailAction}
        </Button>
      </div>
    );
  }

  function handleChange(value: string) {
    setCode(value);
    setLocalError(undefined);
    setDismissed(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    if (code.length === 0) return setLocalError(text.error.required);
    if (code.length < CODE_LENGTH) return setLocalError(text.error.incomplete);
    setLocalError(undefined);
    onSubmit(code);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{text.title}</h1>
        <p id={helpId} className="break-words text-small text-text-secondary">
          {t(text.subtitle, { email })}
        </p>
        {validityMinutes !== undefined ? (
          <p className="text-small text-text-secondary">
            {t(text.validity, { minutes: validityMinutes })}
          </p>
        ) : null}
      </div>

      <OtpField
        label={text.codeLabel}
        length={CODE_LENGTH}
        value={code}
        onChange={handleChange}
        status={otpStatus}
        message={otpMessage}
        disabled={locked}
        digitAriaLabel={(index) => t(text.digitAriaLabel, { index })}
        describedById={helpId}
      />

      <div className="flex flex-col gap-3">
        <Button type="submit" fullWidth loading={verifying} disabled={blocked}>
          {verifying ? text.submitting : text.submit}
        </Button>
        {verifying ? (
          <span role="status" className="sr-only">
            {text.submitting}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-small text-text-secondary">{text.checkSpam}</p>

        {resendStatus === 'success' ? (
          <InlineAlert tone="success" className="w-full text-left">
            {text.resent}
          </InlineAlert>
        ) : null}
        {resendMessage ? (
          <InlineAlert tone="error" className="w-full text-left">
            {resendMessage}
          </InlineAlert>
        ) : null}

        {cooldown > 0 ? (
          <p className="flex min-h-11 items-center text-small text-text-secondary">
            {t(text.resendIn, { seconds: cooldown })}
          </p>
        ) : (
          <Button
            variant="ghost"
            onClick={onResend}
            loading={resendStatus === 'loading'}
            disabled={resendBlocked || verifying || done}
          >
            {resendStatus === 'loading' ? text.resending : text.resend}
          </Button>
        )}

        <Button variant="ghost" onClick={onChangeEmail} disabled={verifying || done}>
          {text.changeEmail}
        </Button>
      </div>
    </form>
  );
}
