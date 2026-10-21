import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Style rempli (04 § 7): fond gris clair, pas de bordure au repos, anneau accent 2 px au focus,
 * fond rosé + anneau error 1 px en erreur, fond page + texte désactivé. Anneaux en `inset` pour
 * éviter tout décalage de mise en page.
 */
export function controlClass(options: { invalid?: boolean } = {}): string {
  return cn(
    'w-full rounded-sm px-4 text-body text-text-primary transition-shadow',
    'placeholder:text-text-disabled focus-visible:outline-none',
    'focus:ring-2 focus:ring-inset focus:ring-accent-600',
    options.invalid ? 'bg-field-error ring-1 ring-inset ring-error text-error' : 'bg-field',
    'disabled:cursor-not-allowed disabled:bg-field-disabled disabled:text-text-disabled',
  );
}

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label au-dessus (pas de label flottant), texte d'aide ou message d'erreur dessous. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-small font-medium text-text-primary">
        {label}
        {required ? (
          <span aria-hidden className="text-error">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type CommonFieldProps = { label: string; hint?: string; error?: string };

export type TextFieldProps = CommonFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { id?: string };

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  required,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(controlClass({ invalid: Boolean(error) }), 'h-11')}
        {...rest}
      />
    </FieldShell>
  );
}

export type TextareaFieldProps = CommonFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { id?: string };

export function TextareaField({
  label,
  hint,
  error,
  id,
  className,
  required,
  rows = 4,
  ...rest
}: TextareaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(controlClass({ invalid: Boolean(error) }), 'resize-y py-3')}
        {...rest}
      />
    </FieldShell>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectFieldProps = CommonFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
    id?: string;
    options: readonly SelectOption[];
    /** Option vide initiale (ex. « Choisir… »). */
    placeholder?: string;
  };

/** Liste déroulante native stylée (clavier, lecteurs d'écran et sélecteur mobile gratuits). */
export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  required,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div className="relative">
        <select
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
          className={cn(controlClass({ invalid: Boolean(error) }), 'h-11 appearance-none pr-10')}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-text-secondary"
        />
      </div>
    </FieldShell>
  );
}

export type DateTimeFieldProps = CommonFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
    id?: string;
    /** Fuseau affiché sous le champ (texte fourni par l'appelant, ex. « Heure de Cotonou (UTC+1) »). */
    timeZoneLabel?: string;
  };

/**
 * Date et heure natives (`datetime-local`). `min` / `max` limitent la plage choisie dans le sélecteur;
 * le message « hors plage » est porté par `error` (l'appelant compare la valeur à min/max et fournit
 * le texte). `timeZoneLabel` affiche le fuseau sous le champ.
 */
export function DateTimeField({
  label,
  hint,
  error,
  id,
  className,
  required,
  timeZoneLabel,
  ...rest
}: DateTimeFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const zoneId = `${fieldId}-zone`;
  const described = [timeZoneLabel ? zoneId : null, describedBy(fieldId, error, hint)]
    .filter(Boolean)
    .join(' ');
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        id={fieldId}
        type="datetime-local"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={cn(controlClass({ invalid: Boolean(error) }), 'h-11')}
        {...rest}
      />
      {timeZoneLabel ? (
        <p id={zoneId} className="text-caption text-text-secondary">
          {timeZoneLabel}
        </p>
      ) : null}
    </FieldShell>
  );
}
