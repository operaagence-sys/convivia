'use client';

import { useId } from 'react';
import { cn } from './cn';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

/** Interrupteur (mode strict, relances auto): accent-600 activé, gris au repos. Ligne ≥ 44 px. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <p id={`${id}-label`} className={cn('text-body', disabled && 'text-text-disabled')}>
          {label}
        </p>
        {description ? (
          <p id={`${id}-desc`} className="text-small text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          'after:absolute after:inset-y-[-8px] after:inset-x-[-4px] after:content-[""]',
          checked ? 'bg-accent-600' : 'bg-border-subtle',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute left-0.5 top-0.5 size-6 rounded-full bg-surface transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}
