import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';

export type SortDirection = 'asc' | 'desc';

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
};

export type DataTableProps<Row> = {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Chargement: lignes squelettes. */
  loading?: boolean;
  /** Erreur de chargement: message + bouton Réessayer. */
  error?: string;
  onRetry?: () => void;
  /** Rendu de l'état vide (un `EmptyState`). */
  empty?: ReactNode;
  sort?: { key: string; direction: SortDirection };
  onSortChange?: (sort: { key: string; direction: SortDirection }) => void;
  /** Pied de tableau (la `Pagination`). */
  footer?: ReactNode;
  className?: string;
};

const SKELETON_ROWS = 5;

/**
 * Table de données de l'administration: dense (lignes 40 px, corps 14 px), bordure fine sans
 * ombre. États: chargement (squelette), erreur, vide, triée, paginée (via `footer`).
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty,
  sort,
  onSortChange,
  footer,
  className,
}: DataTableProps<Row>) {
  function toggleSort(key: string) {
    if (!onSortChange) return;
    const direction: SortDirection = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, direction });
  }

  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border-subtle bg-surface', className)}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-small">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-page text-caption text-text-secondary">
            <tr>
              {columns.map((column) => {
                const direction = sort?.key === column.key ? sort.direction : undefined;
                const Icon =
                  direction === undefined ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      direction === undefined
                        ? undefined
                        : direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                    }
                    className={cn(
                      'h-10 border-b border-border-subtle px-3 font-medium',
                      column.align === 'right' && 'text-right',
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 rounded-sm hover:text-text-primary"
                      >
                        {column.header}
                        <Icon aria-hidden className="size-3.5" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr
                    key={index}
                    aria-hidden
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="h-10 px-3">
                        <span className="block h-3 w-3/4 animate-pulse rounded-sm bg-border-subtle" />
                      </td>
                    ))}
                  </tr>
                ))
              : error
                ? null
                : rows.map((row) => (
                    <tr
                      key={rowKey(row)}
                      className="border-b border-border-subtle last:border-b-0 hover:bg-page"
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            'h-10 px-3 text-text-primary',
                            column.align === 'right' && 'text-right',
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      {loading ? (
        <span className="sr-only" role="status">
          Chargement des données
        </span>
      ) : null}
      {error && !loading ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <CircleAlert aria-hidden className="size-6 text-error" />
          <p className="text-small text-text-primary">{error}</p>
          {onRetry ? (
            <Button variant="secondary" size="admin" onClick={onRetry}>
              Réessayer
            </Button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? empty : null}
      {footer ? <div className="border-t border-border-subtle px-3 py-2">{footer}</div> : null}
    </div>
  );
}
