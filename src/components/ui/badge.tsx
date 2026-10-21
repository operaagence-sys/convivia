import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'error' | 'warning' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

// Texte foncé sur fond pastel pour garder un contraste >= 4,5:1 (proposition, voir tokens.css).
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-field text-text-secondary',
  accent: 'bg-accent-100 text-accent-700',
  success: 'bg-success-soft text-success-ink',
  error: 'bg-error-soft text-error-ink',
  warning: 'bg-warning-soft text-warning-ink',
  info: 'bg-info-soft text-info-ink',
};

/** Badge / puce générique. Le sens ne repose jamais sur la couleur seule: toujours un libellé. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
