'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ellipsis } from 'lucide-react';
import { cn } from './cn';

export type MenuAction = { label: string; href?: string; onSelect?: () => void };

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Action principale (un `Button`), toujours visible à droite. */
  actions?: ReactNode;
  /** Actions secondaires: repliées dans un menu « Plus d'actions » (surtout utile sur mobile). */
  secondaryActions?: readonly MenuAction[];
  /** Niveau de titre: `h1` (page) ou `h2` (section). */
  level?: 'h1' | 'h2';
  className?: string;
};

/** En-tête de page (04 § 10): titre + actions à droite, actions secondaires repliées. */
export function PageHeader({
  title,
  description,
  actions,
  secondaryActions,
  level = 'h1',
  className,
}: PageHeaderProps) {
  const Heading = level;
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <Heading className={level === 'h1' ? 'text-h1' : 'text-h2'}>{title}</Heading>
        {description ? <p className="mt-1 text-small text-text-secondary">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {secondaryActions && secondaryActions.length > 0 ? (
          <ActionMenu actions={secondaryActions} />
        ) : null}
      </div>
    </header>
  );
}

function ActionMenu({ actions }: { actions: readonly MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass =
    'flex h-11 w-full items-center rounded-sm px-3 text-left text-small hover:bg-page';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Plus d'actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-md border border-border-subtle bg-surface text-text-secondary hover:text-text-primary"
      >
        <Ellipsis aria-hidden className="size-5" />
      </button>
      {open ? (
        <ul
          id={id}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-border-subtle bg-surface p-1"
        >
          {actions.map((action) => (
            <li key={action.label} role="none">
              {action.href ? (
                <Link
                  role="menuitem"
                  href={action.href}
                  className={itemClass}
                  onClick={() => setOpen(false)}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect?.();
                  }}
                >
                  {action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
