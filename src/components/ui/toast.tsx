'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from './cn';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastInput = { tone: ToastTone; message: string; durationMs?: number };
type ToastItem = ToastInput & { id: number };

const toneStyle: Record<ToastTone, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success bg-success-soft text-success-ink', icon: CircleCheck },
  error: { box: 'border-error bg-error-soft text-error-ink', icon: CircleAlert },
  info: { box: 'border-info bg-info-soft text-info-ink', icon: Info },
};

/** Une notification (présentation seule). */
export function Toast({
  tone,
  message,
  onDismiss,
}: {
  tone: ToastTone;
  message: string;
  onDismiss?: () => void;
}) {
  const { box, icon: Icon } = toneStyle[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md border px-4 py-3 text-small', box)}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer la notification"
          className="-m-3 inline-flex size-11 shrink-0 items-center justify-center rounded-sm"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** À placer une fois près de la racine de l'application; `useToast()` ouvre une notification. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    setItems((current) => [...current, { ...toast, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Au-dessus de la barre inférieure mobile (64 px) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((item) => (
          <ToastTimer key={item.id} item={item} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastTimer({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    // Les erreurs restent plus longtemps pour laisser le temps de lire.
    const timer = setTimeout(
      () => onDone(item.id),
      item.durationMs ?? (item.tone === 'error' ? 8000 : 5000),
    );
    return () => clearTimeout(timer);
  }, [item, onDone]);
  return (
    <div className="pointer-events-auto w-full max-w-sm">
      <Toast tone={item.tone} message={item.message} onDismiss={() => onDone(item.id)} />
    </div>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return context;
}
