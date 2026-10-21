import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Appel à l'action (un `Button`). */
  action?: ReactNode;
  className?: string;
};

/** Bloc d'état vide: puce d'icône + message + CTA (sobre, sans illustration). */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <Icon aria-hidden className="size-6" />
      </span>
      <h3 className="text-h3">{title}</h3>
      {description ? (
        <p className="max-w-sm text-small text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
