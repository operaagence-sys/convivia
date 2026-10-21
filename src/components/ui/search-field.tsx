'use client';

import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';
import { controlClass } from './field';

type SearchFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Hauteur admin (40 px) au lieu de 44 px. */
  compact?: boolean;
};

/** Champ de recherche: icône, bouton d'effacement dès qu'il y a une saisie. */
export function SearchField({
  value,
  onValueChange,
  label = 'Rechercher',
  placeholder = 'Rechercher',
  className,
  compact = false,
}: SearchFieldProps) {
  const id = useId();
  return (
    <div className={cn('relative', className)} role="search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-secondary"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          controlClass(),
          'pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden',
          compact ? 'h-10 text-small' : 'h-11',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm text-text-secondary hover:text-text-primary"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
