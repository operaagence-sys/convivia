import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardTone = 'success' | 'error' | 'warning' | 'info';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** `section` = radius-lg (cartes de section, 04 § 5); `component` = radius-md. */
  level?: 'section' | 'component';
  /** Padding: aéré (mobile) ou compact (admin). */
  density?: 'comfortable' | 'compact';
  /** Liseré de statut sur le bord gauche (04 § 8), usage ponctuel. */
  statusTone?: CardTone;
  /** Carte sélectionnée: bordure accent 2 px. */
  selected?: boolean;
};

const statusBar: Record<CardTone, string> = {
  success: 'before:bg-success',
  error: 'before:bg-error',
  warning: 'before:bg-warning',
  info: 'before:bg-info',
};

/** Carte à bordure fine, sans ombre (04 § 8). */
export function Card({
  level = 'section',
  density = 'comfortable',
  statusTone,
  selected = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border bg-surface',
        level === 'section' ? 'rounded-lg' : 'rounded-md',
        density === 'comfortable' ? 'p-4 sm:p-6' : 'p-3 sm:p-4',
        selected ? 'border-2 border-accent-600' : 'border-border-subtle',
        statusTone &&
          cn(
            "before:absolute before:inset-y-0 before:left-0 before:w-(--status-bar-width) before:content-['']",
            statusBar[statusTone],
          ),
        className,
      )}
      {...rest}
    />
  );
}
