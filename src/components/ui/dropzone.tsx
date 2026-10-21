'use client';

import { useId, useState } from 'react';
import type { DragEvent } from 'react';
import { CircleAlert, ImagePlus, RefreshCw } from 'lucide-react';
import { messages } from '@/content/messages.fr';
import { t } from '@/content/format';
import {
  PHOTO_FORMATS_LABEL,
  PHOTO_MAX_SIZE_BYTES,
  PHOTO_MAX_SIZE_LABEL,
  PHOTO_TEXT_VARS,
} from '@/content/photo-constraints';
import { Button } from './button';
import { cn } from './cn';
import { Progress } from './progress';

export type DropzoneStatus = 'idle' | 'uploading' | 'error' | 'filled';

/** Types acceptés par défaut (TRD § 9). HEIC: le type est souvent vide selon le navigateur, d'où les extensions. */
export const DEFAULT_PHOTO_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export type DropzoneRejectReason = 'format' | 'tooLarge';

export type DropzoneProps = {
  /** Titre de la zone. Défaut: `dropzone.idle.title`. */
  label?: string;
  /** Types acceptés (attribut `accept`). Défaut: formats photos du TRD § 9. */
  accept?: string;
  /** Poids maximal en octets. Défaut: 10 Mo. */
  maxSizeBytes?: number;
  /** Libellé des formats pour les messages ({formats}). Défaut: formats photos. */
  formatsLabel?: string;
  status?: DropzoneStatus;
  /** Progression 0-100 pendant `uploading`. */
  progress?: number;
  /** Remplace le message d'erreur réseau quand `status="error"` (erreur venue du téléverseur). */
  errorMessage?: string;
  /** Aperçu une fois rempli. */
  previewUrl?: string;
  previewAlt?: string;
  /** Remplace le texte d'aide par défaut (`dropzone.idle.hint`). */
  hint?: string;
  /** Mention « Obligatoire » (sans conséquence promise). */
  required?: boolean;
  /** Fichiers qui ont passé la validation de format et de poids. */
  onFiles: (files: File[]) => void;
  /** Un fichier a été refusé (format ou poids). */
  onReject?: (reason: DropzoneRejectReason, file: File) => void;
  /** Affiche le bouton Annuler pendant `uploading`. */
  onCancel?: () => void;
  /** Affiche le bouton Réessayer en erreur d'envoi. */
  onRetry?: () => void;
  disabled?: boolean;
  className?: string;
};

function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith('.')) return name.endsWith(token);
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

/** Poids en Mo, arrondi au dixième supérieur (jamais « 10 Mo » pour un fichier refusé à 10 Mo). */
function formatMegabytes(bytes: number): string {
  const mb = Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
  return `${mb.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Zone de dépôt (photos): bordure pointillée au repos; survol de glisser-déposer; téléversement
 * (progression + annuler); erreur (+ réessayer); rempli (miniature + remplacer). Valide le format et
 * le poids à la sélection ET au dépôt, mais ne téléverse rien: elle expose des callbacks.
 */
export function Dropzone({
  label = messages.dropzone.idle.title,
  accept = DEFAULT_PHOTO_ACCEPT,
  maxSizeBytes = PHOTO_MAX_SIZE_BYTES,
  formatsLabel = PHOTO_FORMATS_LABEL,
  status = 'idle',
  progress,
  errorMessage,
  previewUrl,
  previewAlt = '',
  hint,
  required,
  onFiles,
  onReject,
  onCancel,
  onRetry,
  disabled,
  className,
}: DropzoneProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const uploading = status === 'uploading';
  const busy = uploading || disabled;

  const maxSizeLabel =
    maxSizeBytes === PHOTO_MAX_SIZE_BYTES ? PHOTO_MAX_SIZE_LABEL : formatMegabytes(maxSizeBytes);
  const vars = { ...PHOTO_TEXT_VARS, formats: formatsLabel, maxSize: maxSizeLabel };

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    for (const file of files) {
      if (!matchesAccept(file, accept)) {
        setRejection(t(messages.dropzone.error.format, vars));
        onReject?.('format', file);
        return;
      }
      if (file.size > maxSizeBytes) {
        setRejection(
          t(messages.dropzone.error.tooLarge, { ...vars, size: formatMegabytes(file.size) }),
        );
        onReject?.('tooLarge', file);
        return;
      }
    }
    setRejection(null);
    onFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    handleFiles(Array.from(event.dataTransfer.files));
  }

  const shownError = uploading
    ? undefined
    : (rejection ??
      (status === 'error' ? (errorMessage ?? t(messages.dropzone.error.network)) : undefined));
  const hasError = Boolean(shownError);
  const uploadText = t(messages.dropzone.uploading, { progress: Math.round(progress ?? 0) });

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center transition-colors',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-600',
          dragging
            ? 'border-accent-600 bg-accent-100'
            : hasError
              ? 'border-error bg-field-error'
              : status === 'filled'
                ? 'border-border-subtle bg-surface'
                : 'border-border-subtle bg-surface hover:border-accent-500',
          busy && 'cursor-not-allowed opacity-70',
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          required={required && status !== 'filled'}
          aria-label={t(messages.dropzone.ariaLabel, vars)}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="sr-only"
          onChange={(event) => {
            handleFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        {uploading ? (
          <>
            <span className="text-small text-text-secondary">{uploadText}</span>
            <Progress label={uploadText} value={progress} className="max-w-48" />
          </>
        ) : status === 'filled' && previewUrl && !hasError ? (
          <>
            {/* Aperçu local/signé: <img> plutôt que next/image (URL temporaire). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={previewAlt} className="h-20 w-20 rounded-sm object-cover" />
            <span className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-accent-600">
              <RefreshCw aria-hidden className="size-4" />
              {messages.dropzone.replace}
            </span>
          </>
        ) : (
          <>
            {hasError ? (
              <CircleAlert aria-hidden className="size-6 text-error" />
            ) : (
              <ImagePlus aria-hidden className="size-6 text-text-secondary" />
            )}
            <span className="text-small font-semibold text-text-primary">{label}</span>
            <span className="text-caption text-text-secondary">
              {dragging ? messages.dropzone.hover : (hint ?? messages.dropzone.idle.hint)}
            </span>
            <span className="text-caption text-text-secondary">
              {t(messages.dropzone.idle.constraints, vars)}
            </span>
          </>
        )}
        {required ? (
          <span className="text-caption font-medium text-text-secondary">
            {messages.dropzone.required}
          </span>
        ) : null}
      </label>
      {shownError ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {shownError}
        </p>
      ) : null}
      {uploading && onCancel ? (
        <Button
          variant="ghost"
          onClick={onCancel}
          aria-label={messages.dropzone.cancelLabel}
          className="self-center"
        >
          {messages.dropzone.cancel}
        </Button>
      ) : null}
      {status === 'error' && !rejection && onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="self-center">
          {messages.dropzone.retry}
        </Button>
      ) : null}
    </div>
  );
}
