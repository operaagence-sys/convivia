import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from './cn';

export type InlineAlertTone = 'success' | 'error' | 'warning' | 'info';

const toneStyle: Record<InlineAlertTone, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success bg-success-soft text-success-ink', icon: CircleCheck },
  error: { box: 'border-error bg-error-soft text-error-ink', icon: CircleAlert },
  warning: { box: 'border-warning bg-warning-soft text-warning-ink', icon: TriangleAlert },
  info: { box: 'border-info bg-info-soft text-info-ink', icon: Info },
};

type InlineAlertProps = {
  tone: InlineAlertTone;
  children: ReactNode;
  /** Par défaut : `alert` pour une erreur, `status` sinon. `none` pour un bandeau permanent. */
  role?: 'alert' | 'status' | 'none';
  className?: string;
};

/**
 * Message dans la page (formulaire, bandeau) : fond pastel, texte en variante « ink », icône
 * outline. Une erreur est annoncée tout de suite (`role="alert"`), le reste poliment.
 */
export function InlineAlert({ tone, children, role, className }: InlineAlertProps) {
  const { box, icon: Icon } = toneStyle[tone];
  const resolved = role ?? (tone === 'error' ? 'alert' : 'status');
  return (
    <div
      role={resolved === 'none' ? undefined : resolved}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-small',
        box,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
