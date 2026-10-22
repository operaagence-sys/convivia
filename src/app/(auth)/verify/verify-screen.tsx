'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormStatus } from '@/components/auth/types';
import { VerifyCodeForm, type VerifyError } from '@/components/auth/verify-code-form';
import { CODE_VALIDITY_MINUTES, RESEND_COOLDOWN_SECONDS } from '@/lib/auth/constants';
import type { CodeRequestError, VerifyError as ServerVerifyError } from '@/lib/auth/types';
import { resendCodeAction, verifyCodeAction } from './actions';

/** Erreur du serveur -> erreur affichable (`missingEmail` est traité avant, jamais affiché). */
function toDisplayError(
  error: ServerVerifyError | CodeRequestError | { kind: 'missingEmail' },
): VerifyError {
  switch (error.kind) {
    case 'blocked':
    case 'hourlyLimit':
    case 'tooSoon':
      return { kind: error.kind, retryAfterSeconds: error.retryAfterSeconds };
    case 'unavailable':
    case 'unexpected':
    case 'sendFailed':
    case 'wrong':
      return { kind: error.kind };
    case 'invalid':
      // Ne peut pas arriver au renvoi (l'e-mail du cookie est déjà validé).
      return { kind: 'sendFailed' };
    case 'missingEmail':
      return { kind: 'wrong' };
  }
}

export function VerifyScreen({ email: initialEmail }: { email?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [error, setError] = useState<VerifyError>();
  const [resendStatus, setResendStatus] = useState<FormStatus>('idle');
  const [resendError, setResendError] = useState<VerifyError>();

  async function handleSubmit(code: string) {
    setStatus('loading');
    setError(undefined);
    try {
      const result = await verifyCodeAction(code);
      if (result.ok) {
        setStatus('success');
        router.replace(result.next);
        return;
      }
      if (result.error.kind === 'missingEmail') {
        setEmail(undefined);
        setStatus('idle');
        return;
      }
      setError(toDisplayError(result.error));
    } catch {
      setError({ kind: 'network' });
    }
    setStatus('error');
  }

  async function handleResend() {
    setResendStatus('loading');
    setResendError(undefined);
    try {
      const result = await resendCodeAction();
      if (result.ok) {
        setResendStatus('success');
        return;
      }
      if (result.error.kind === 'missingEmail') {
        setEmail(undefined);
        setResendStatus('idle');
        return;
      }
      setResendError(toDisplayError(result.error));
    } catch {
      setResendError({ kind: 'network' });
    }
    setResendStatus('error');
  }

  return (
    <VerifyCodeForm
      email={email}
      status={status}
      error={error}
      resendStatus={resendStatus}
      resendError={resendError}
      resendCooldownSeconds={RESEND_COOLDOWN_SECONDS}
      validityMinutes={CODE_VALIDITY_MINUTES}
      onSubmit={handleSubmit}
      onResend={handleResend}
      onChangeEmail={() => router.push('/login?change=1')}
    />
  );
}
