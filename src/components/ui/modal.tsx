'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, type ButtonVariant } from './button';
import { cn } from './cn';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Libellés et rôle du bouton de confirmation; absent = modale d'information. */
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void;
  cancelLabel?: string;
  /** Action en cours: bloque les boutons, spinner sur la confirmation, pas de fermeture. */
  loading?: boolean;
  /** Message d'erreur affiché dans la modale (l'action a échoué). */
  error?: string;
};

/**
 * Boîte de dialogue de confirmation basée sur `<dialog>` natif: piégeage du focus, échappement
 * et retour du focus fournis par le navigateur.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  cancelLabel = 'Annuler',
  loading = false,
  error,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !loading) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border-subtle bg-surface p-0 text-text-primary',
        'backdrop:bg-text-primary/40',
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className="text-h3">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
            className="-m-2.5 inline-flex size-11 items-center justify-center rounded-sm text-text-secondary hover:bg-field disabled:opacity-50"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {description ? (
          <p id={`${id}-desc`} className="text-small text-text-secondary">
            {description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-small text-error-ink">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          {confirmLabel && onConfirm ? (
            <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
