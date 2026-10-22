import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './button';
import { cn } from './cn';

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

/** Lien de navigation qui a l'apparence d'un bouton (mêmes variantes, hauteur 44 px). */
export function ButtonLink({
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={cn(buttonClass({ variant, size, fullWidth }), className)} {...rest} />;
}
