import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';

type SpinnerProps = {
  className?: string;
  /** Texte lu par les lecteurs d'écran. */
  label?: string;
};

/** Indicateur de chargement indéterminé. */
export function Spinner({ className, label = 'Chargement' }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex">
      <LoaderCircle aria-hidden className={cn('size-5 animate-spin', className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
