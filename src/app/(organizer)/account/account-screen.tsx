'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AccountProfileSection,
  type AccountProfileError,
} from '@/components/account/account-profile-section';
import {
  AccountSessionSection,
  type SessionError,
} from '@/components/account/account-session-section';
import type { ProfileCountry, ProfileValues } from '@/components/account/profile-fields';
import type { FormStatus } from '@/components/auth/types';
import { CITY_MAX, NAME_MAX } from '@/lib/auth/constants';
import type { SessionActionResult } from '@/lib/auth/types';
import { signOutAction, signOutAllAction, updateProfileAction } from './actions';

const LIMITS = { nameMaxLength: NAME_MAX, cityMaxLength: CITY_MAX } as const;

type Props = {
  email: string;
  initialValues: ProfileValues;
  countries: readonly ProfileCountry[];
  suspended: boolean;
};

export function AccountScreen({ email, initialValues, countries, suspended }: Props) {
  const router = useRouter();

  const [saveStatus, setSaveStatus] = useState<FormStatus>('idle');
  const [saveError, setSaveError] = useState<AccountProfileError>();

  const [outStatus, setOutStatus] = useState<FormStatus>('idle');
  const [outError, setOutError] = useState<SessionError>();
  const [outAllStatus, setOutAllStatus] = useState<FormStatus>('idle');
  const [outAllError, setOutAllError] = useState<SessionError>();

  async function handleSave(values: ProfileValues) {
    setSaveStatus('loading');
    setSaveError(undefined);
    try {
      const result = await updateProfileAction(values);
      if (result.ok) {
        setSaveStatus('success');
        return;
      }
      setSaveError(result.error);
    } catch {
      setSaveError('network');
    }
    setSaveStatus('error');
  }

  async function runSignOut(
    action: () => Promise<SessionActionResult>,
    setStatus: (status: FormStatus) => void,
    setError: (error: SessionError | undefined) => void,
  ) {
    setStatus('loading');
    setError(undefined);
    try {
      const result = await action();
      if (result.ok) {
        setStatus('success');
        router.replace('/login');
        return;
      }
      setError('signOutFailed');
    } catch {
      setError('network');
    }
    setStatus('error');
  }

  return (
    <>
      <AccountProfileSection
        email={email}
        initialValues={initialValues}
        countries={countries}
        status={saveStatus}
        error={saveError}
        suspended={suspended}
        limits={LIMITS}
        onSave={handleSave}
      />
      <AccountSessionSection
        signOutStatus={outStatus}
        signOutError={outError}
        signOutAllStatus={outAllStatus}
        signOutAllError={outAllError}
        onSignOut={() => runSignOut(signOutAction, setOutStatus, setOutError)}
        onSignOutAll={() => runSignOut(signOutAllAction, setOutAllStatus, setOutAllError)}
      />
    </>
  );
}
