import Link from 'next/link';
import { cn } from './cn';
import { isNavItemActive, type NavItem } from './nav-items';

type BottomNavProps = {
  items: readonly NavItem[];
  /** Adresse courante, pour marquer l'onglet actif. */
  pathname: string;
  ariaLabel?: string;
  /** `fixed` pour l'application; `static` pour la page de démonstration. */
  position?: 'fixed' | 'static';
};

/**
 * Barre de navigation inférieure (04 § 10): icônes outline + libellé court, onglet actif en
 * accent-600. Hauteur 64 px, cibles ≥ 44 px, zone sûre iPhone respectée. Jamais sur /i/*.
 * Le contenu de la page doit réserver `pb-20` pour ne pas passer dessous.
 */
export function BottomNav({
  items,
  pathname,
  ariaLabel = 'Navigation principale',
  position = 'fixed',
}: BottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'border-t border-border-subtle bg-surface pb-[env(safe-area-inset-bottom)]',
        position === 'fixed' && 'fixed inset-x-0 bottom-0 z-40',
      )}
    >
      <ul className="mx-auto flex h-16 max-w-xl items-stretch">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full min-h-11 flex-col items-center justify-center gap-1 text-caption transition-colors',
                  active ? 'text-accent-600' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
