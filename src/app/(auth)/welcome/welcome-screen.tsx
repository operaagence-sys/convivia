'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SuspendedBanner } from '@/components/account/suspended-banner';
import { Button, InlineAlert } from '@/components/ui';
import { ProfileForm, type ProfileFormError } from '@/components/auth/profile-form';
import type { FormStatus } from '@/components/auth/types';
import type { ProfileCountry } from '@/components/account/profile-fields';
import { messages } from '@/content/messages.fr';
import { CITY_MAX, NAME_MAX } from '@/lib/auth/constants';
import { signOutAction } from '@/app/(organizer)/account/actions';
import { saveProfileAction } from './actions';

const LIMITS = { nameMaxLength: NAME_MAX, cityMaxLength: CITY_MAX } as const;
const session = messages.account.session;

type Props = { countries: readonly ProfileCountry[]; suspended?: boolean };

export function WelcomeScreen({ countries, suspended = false }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>('idle');
  const [error, setError] = useState<ProfileFormError>();
  const [outStatus, setOutStatus] = useState<FormStatus>('idle');
  const [outError, setOutError] = useState<'network' | 'signOutFailed'>();

  async function handleSubmit(values: { name: string; city: string; country: string }) {
    setStatus('loading');
    setError(undefined);
    try {
      const result = await saveProfileAction(values);
      if (result.ok) {
        setStatus('success');
        router.replace('/dashboard');
        return;
      }
      // Compte suspendu : le bandeau et le formulaire désactivé l'ont déjà dit ; si l'état change
      // en cours de route, message général d'échec.
      setError(result.error === 'suspended' ? 'saveFailed' : result.error);
    } catch {
      setError('network');
    }
    setStatus('error');
  }

  // Pour sortir d'un mauvais compte : même action que dans /account.
  async function handleSignOut() {
    setOutStatus('loading');
    setOutError(undefined);
    try {
      const result = await signOutAction();
      if (result.ok) {
        setOutStatus('success');
        router.replace('/login');
        return;
      }
      setOutError('signOutFailed');
    } catch {
      setOutError('network');
    }
    setOutStatus('error');
  }

  const signingOut = outStatus === 'loading' || outStatus === 'success';

  return (
    <div className="flex flex-col gap-6">
      {suspended ? <SuspendedBanner /> : null}
      <ProfileForm
        status={status}
        error={error}
        countries={countries}
        limits={LIMITS}
        suspended={suspended}
        onSubmit={handleSubmit}
      />
      <div className="flex flex-col gap-3">
        {outStatus === 'error' ? (
          <InlineAlert tone="error">
            {outError === 'network' ? session.error.network : session.error.signOutFailed}
          </InlineAlert>
        ) : null}
        <Button
          variant="ghost"
          fullWidth
          loading={outStatus === 'loading'}
          disabled={status === 'loading' || status === 'success' || signingOut}
          onClick={handleSignOut}
        >
          {outStatus === 'loading' ? session.signingOut : session.signOut}
        </Button>
      </div>
    </div>
  );
}
