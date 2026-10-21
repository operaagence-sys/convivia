'use client';

import { useId, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from './cn';

export type OtpStatus = 'idle' | 'error' | 'success';

export type OtpFieldProps = {
  label: string;
  /** Valeur courante (chiffres seulement, `length` au plus). */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  status?: OtpStatus;
  /** Message d'aide ou d'erreur sous les cases. */
  message?: string;
  disabled?: boolean;
  /** Appelé quand toutes les cases sont remplies. */
  onComplete?: (value: string) => void;
  className?: string;
};

const statusClass: Record<OtpStatus, string> = {
  idle: 'bg-field focus:ring-2 focus:ring-inset focus:ring-accent-600',
  error: 'bg-field-error text-error ring-1 ring-inset ring-error focus:ring-2',
  success: 'bg-success-soft text-success-ink ring-1 ring-inset ring-success',
};

/** Code à usage unique en cases séparées (chiffres), collage et suppression gérés. */
export function OtpField({
  label,
  value,
  onChange,
  length = 6,
  status = 'idle',
  message,
  disabled,
  onComplete,
  className,
}: OtpFieldProps) {
  const id = useId();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  function commit(next: string, focusIndex?: number) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (focusIndex !== undefined) refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  }

  function handleInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, '');
    if (typed === '') {
      commit(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    // Un chiffre saisi sur une case déjà remplie remplace; plusieurs (saisie assistée) se répartissent.
    const next = (value.slice(0, index) + typed + value.slice(index + 1)).slice(0, length);
    commit(next, index + typed.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    commit(pasted, pasted.replace(/\D/g, '').length);
  }

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={cn('flex flex-col gap-2', className)}
    >
      <span id={`${id}-label`} className="text-small font-medium text-text-primary">
        {label}
      </span>
      <div className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={digit}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            disabled={disabled}
            aria-label={`Chiffre ${index + 1} sur ${length}`}
            aria-invalid={status === 'error' ? true : undefined}
            className={cn(
              'h-12 min-w-0 max-w-12 flex-1 rounded-sm text-center text-h3 text-text-primary focus-visible:outline-none',
              statusClass[status],
              'disabled:cursor-not-allowed disabled:bg-field-disabled disabled:text-text-disabled',
            )}
          />
        ))}
      </div>
      {message ? (
        <p
          role={status === 'error' ? 'alert' : undefined}
          className={cn(
            'text-caption',
            status === 'error'
              ? 'text-error'
              : status === 'success'
                ? 'text-success-ink'
                : 'text-text-secondary',
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
