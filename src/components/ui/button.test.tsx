// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('appelle onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Payer</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Payer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('est inactif et occupé en chargement', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Payer
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('est inactif quand désactivé', () => {
    render(<Button disabled>Envoyer</Button>);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });
});
