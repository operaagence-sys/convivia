'use client';

import { useId, useState } from 'react';
import { messages } from '@/content/messages.fr';
import { Button, Card, InlineAlert, Modal } from '@/components/ui';
import type { FormStatus } from '@/components/auth/types';

const text = messages.account.session;

export type SessionError = 'network' | 'signOutFailed';

export type AccountSessionSectionProps = {
  /** « Se déconnecter » (cet appareil). `success` = déconnecté, redirection en cours. */
  signOutStatus: FormStatus;
  signOutError?: SessionError;
  /** « Déconnecter tous mes appareils » (après confirmation). */
  signOutAllStatus: FormStatus;
  signOutAllError?: SessionError;
  onSignOut: () => void;
  /** Appelé seulement après le clic sur « Tout déconnecter » dans la fenêtre de confirmation. */
  onSignOutAll: () => void;
};

function errorText(error: SessionError | undefined): string {
  return error === 'network' ? text.error.network : text.error.signOutFailed;
}

/** Carte « Session » de `/account` : déconnexion, déconnexion de tous les appareils (confirmée). */
export function AccountSessionSection({
  signOutStatus,
  signOutError,
  signOutAllStatus,
  signOutAllError,
  onSignOut,
  onSignOutAll,
}: AccountSessionSectionProps) {
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);

  const signingOut = signOutStatus === 'loading';
  const signedOut = signOutStatus === 'success';
  const signingOutAll = signOutAllStatus === 'loading';
  const signedOutAll = signOutAllStatus === 'success';
  const busy = signingOut || signedOut || signingOutAll || signedOutAll;

  return (
    <Card role="region" aria-labelledby={titleId} className="flex flex-col gap-6">
      <h2 id={titleId} className="text-h3">
        {text.title}
      </h2>

      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          fullWidth
          loading={signingOut}
          disabled={busy && !signingOut}
          onClick={onSignOut}
        >
          {signingOut ? text.signingOut : text.signOut}
        </Button>
        {signingOut ? (
          <span role="status" className="sr-only">
            {text.signingOut}
          </span>
        ) : null}
        {signOutStatus === 'error' ? (
          <InlineAlert tone="error">{errorText(signOutError)}</InlineAlert>
        ) : null}
        {signedOut ? <InlineAlert tone="success">{text.signedOut}</InlineAlert> : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-6">
        <p className="text-small text-text-secondary">{text.signOutAllHint}</p>
        <Button
          variant="danger-ghost"
          fullWidth
          disabled={busy}
          onClick={() => setConfirming(true)}
          aria-haspopup="dialog"
        >
          {text.signOutAll}
        </Button>
        {signedOutAll ? <InlineAlert tone="success">{text.signedOutAll}</InlineAlert> : null}
      </div>

      <Modal
        open={confirming && !signedOutAll}
        onClose={() => setConfirming(false)}
        title={text.signOutAllConfirm.title}
        description={text.signOutAllConfirm.description}
        confirmLabel={text.signOutAllConfirm.confirm}
        confirmVariant="danger"
        cancelLabel={text.signOutAllConfirm.cancel}
        onConfirm={onSignOutAll}
        loading={signingOutAll}
        error={signOutAllStatus === 'error' ? errorText(signOutAllError) : undefined}
      />
    </Card>
  );
}
