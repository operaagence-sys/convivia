'use client';

import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from './cn';

export type TabItem = { value: string; label: string; disabled?: boolean };

type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

function moveFocus(event: KeyboardEvent<HTMLElement>, selector: string) {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const list = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
      `${selector}:not(:disabled)`,
    ) ?? [],
  );
  const index = list.indexOf(event.currentTarget);
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % list.length;
  if (event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = list.length - 1;
  event.preventDefault();
  list[next]?.focus();
  list[next]?.click();
}

/** Onglets soulignés (navigation dans une page). Le panneau est fourni par l'appelant. */
export function Tabs({ items, value, onValueChange, ariaLabel, className }: TabsProps) {
  const id = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-1 overflow-x-auto border-b border-border-subtle', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => moveFocus(event, '[role="tab"]')}
            className={cn(
              '-mb-px h-11 shrink-0 border-b-2 px-4 text-small font-semibold transition-colors',
              active
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-text-secondary hover:text-text-primary',
              item.disabled && 'cursor-not-allowed text-text-disabled hover:text-text-disabled',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

type SegmentedControlProps = {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Contrôle segmenté (bascule immédiat/programmé, individuel/+1): un seul choix parmi peu. */
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  fullWidth = true,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex gap-1 rounded-md bg-field p-1',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => moveFocus(event, '[role="radio"]')}
            className={cn(
              'h-11 min-w-0 flex-1 rounded-sm px-3 text-small font-semibold transition-colors',
              active
                ? 'border border-border-subtle bg-surface text-accent-600'
                : 'text-text-secondary hover:text-text-primary',
              item.disabled && 'cursor-not-allowed text-text-disabled hover:text-text-disabled',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
