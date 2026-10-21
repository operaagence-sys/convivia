import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost';
export type ButtonSize = 'default' | 'admin';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** `default` = 44 px (tactile), `admin` = 40 px (desktop compact). */
  size?: ButtonSize;
  /** Affiche un spinner, masque le libellé (largeur conservée) et bloque le clic. */
  loading?: boolean;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary: 'bg-surface text-accent-600 border border-accent-600 hover:bg-accent-100',
  danger: 'bg-error text-white hover:bg-error-ink',
  ghost: 'bg-transparent text-accent-600 hover:bg-accent-100',
  // Action de suppression isolée (04 § 11.1, paramètres du compte).
  'danger-ghost': 'bg-transparent text-error hover:bg-error-soft',
};

export function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-md px-5 text-body font-semibold transition-colors',
        size === 'admin' ? 'h-10 text-small' : 'h-11',
        fullWidth && 'w-full',
        // Désactivé (04 § 6): fond border-subtle, texte text-disabled. En chargement, on garde
        // la couleur de la variante pour que l'action ne paraisse pas indisponible.
        disabled
          ? 'cursor-not-allowed border-0 bg-border-subtle text-text-disabled'
          : variants[variant],
        loading && 'cursor-progress',
        className,
      )}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
