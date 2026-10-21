import { cn } from './cn';

type ProgressProps = {
  /** Absent = indéterminée. */
  value?: number;
  max?: number;
  label: string;
  tone?: 'accent' | 'warning' | 'success' | 'error';
  className?: string;
};

const fill = {
  accent: 'bg-accent-600',
  warning: 'bg-warning',
  success: 'bg-success',
  error: 'bg-error',
} as const;

/** Barre de progression déterminée ou indéterminée (compteur d'invités, envoi, téléversement). */
export function Progress({ value, max = 100, label, tone = 'accent', className }: ProgressProps) {
  const determinate = value !== undefined;
  const percent = determinate ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? max : undefined}
      aria-valuenow={determinate ? value : undefined}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-border-subtle', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          fill[tone],
          !determinate && 'w-1/3 animate-pulse',
        )}
        style={determinate ? { width: `${percent}%` } : undefined}
      />
    </div>
  );
}
