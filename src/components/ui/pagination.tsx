import { ChevronLeft, ChevronRight } from 'lucide-react';
import { messages } from '@/content/messages.fr';
import { t } from '@/content/format';
import { Button } from './button';
import { cn } from './cn';

type PaginationProps = {
  /** Page courante, à partir de 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  size?: 'default' | 'admin';
  className?: string;
};

/**
 * Pagination précédent / suivant avec page courante; boutons désactivés aux extrêmes.
 * Ne rend rien s'il n'y a qu'une page (ou aucune).
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  size = 'admin',
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label={messages.pagination.nav}
      className={cn('flex items-center justify-between gap-3', className)}
    >
      <Button
        variant="secondary"
        size={size}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={messages.pagination.previous}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </Button>
      <p className="text-small text-text-secondary" aria-live="polite">
        {t(messages.pagination.page, { current: page, total: pageCount })}
      </p>
      <Button
        variant="secondary"
        size={size}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label={messages.pagination.next}
      >
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </nav>
  );
}
