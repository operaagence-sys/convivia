'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm, type LoginError } from '@/components/auth/login-form';
import type { FormStatus } from '@/components/auth/types';
import { requestCodeAction } from './actions';

export function LoginScreen({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>('idle');
  const [error, setError] = useState<LoginError>();

  async function handleSubmit(email: string) {
    setStatus('loading');
    setError(undefined);
    try {
      const result = await requestCodeAction(email);
      if (result.ok) {
        setStatus('success');
        router.push('/verify');
        return;
      }
      setError(result.error);
    } catch {
      setError({ kind: 'network' });
    }
    setStatus('error');
  }

  return (
    <LoginForm status={status} error={error} defaultEmail={defaultEmail} onSubmit={handleSubmit} />
  );
}
