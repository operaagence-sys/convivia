// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it.each([0, 1])('ne rend rien avec %i page(s)', (pageCount) => {
    const { container } = render(
      <Pagination page={1} pageCount={pageCount} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche les libellés et navigue', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByText('Page 2 sur 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Page précédente' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('désactive les extrêmes', () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    rerender(<Pagination page={3} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  });
});
