import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';
import { controlClass, FieldShell } from './field';

export type DialCode = { value: string; label: string };

/** Pays actifs au lancement (BJ, CI, TG, SN). Provisoire: la liste réelle vient des pays actifs. */
export const DEFAULT_DIAL_CODES: readonly DialCode[] = [
  { value: '+229', label: 'BJ +229' },
  { value: '+225', label: 'CI +225' },
  { value: '+228', label: 'TG +228' },
  { value: '+221', label: 'SN +221' },
];

export type PhoneFieldProps = {
  label: string;
  hint?: string;
  /** Message d'erreur de format. */
  error?: string;
  /** Numéro jugé valide: affiche une coche. */
  valid?: boolean;
  dialCodes?: readonly DialCode[];
  /** Noms des champs envoyés au formulaire. */
  dialCodeName?: string;
  name?: string;
  className?: string;
  defaultDialCode?: string;
  dialCodeLabel?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'name' | 'className'>;

/** Indicatif pays (liste) + numéro. États: vide, valide (coche), erreur de format. */
export function PhoneField({
  label,
  hint,
  error,
  valid,
  dialCodes = DEFAULT_DIAL_CODES,
  dialCodeName = 'dialCode',
  name = 'phone',
  className,
  defaultDialCode,
  dialCodeLabel = 'Indicatif du pays',
  required,
  ...rest
}: PhoneFieldProps) {
  const id = useId();
  const invalid = Boolean(error);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div className="flex gap-2">
        <select
          aria-label={dialCodeLabel}
          name={dialCodeName}
          defaultValue={defaultDialCode ?? dialCodes[0]?.value}
          disabled={rest.disabled}
          className={cn(controlClass({ invalid }), 'h-11 w-28 shrink-0 px-3')}
        >
          {dialCodes.map((code) => (
            <option key={code.value} value={code.value}>
              {code.label}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            name={name}
            required={required}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(controlClass({ invalid }), 'h-11', valid && 'pr-10')}
            {...rest}
          />
          {valid && !invalid ? (
            <Check
              aria-label="Numéro valide"
              role="img"
              className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-success"
            />
          ) : null}
        </div>
      </div>
    </FieldShell>
  );
}
