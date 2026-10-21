// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('affiche le titre', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Convivia' })).toBeInTheDocument();
  });
});
