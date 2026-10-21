import Link from 'next/link';
import { cn } from './cn';
import { isNavItemActive, type NavItem } from './nav-items';

type SidebarNavProps = {
  items: readonly NavItem[];
  pathname: string;
  /** Nom de l'application en tête (provisoire). */
  title?: string;
  className?: string;
};

/**
 * Barre latérale de l'administration (desktop, 04 § 10): icônes outline + libellé, item actif
 * fond accent-100 / texte accent-700. Compacte (items 40 px). Les entrées sont fournies par
 * l'admin-analytics-developer selon les rôles.
 */
export function SidebarNav({ items, pathname, title = 'Convivia', className }: SidebarNavProps) {
  return (
    <nav
      aria-label="Navigation d'administration"
      className={cn(
        'flex w-60 shrink-0 flex-col gap-4 border-r border-border-subtle bg-surface p-3',
        className,
      )}
    >
      <p className="px-3 pt-2 text-h3">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-sm px-3 text-small font-medium transition-colors',
                  active
                    ? 'bg-accent-100 text-accent-700'
                    : 'text-text-secondary hover:bg-page hover:text-text-primary',
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
