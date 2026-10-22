// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@/content/messages.fr';
import { CreateSoon } from './create-soon';

const text = messages.createSoon;

describe('CreateSoon', () => {
  it('explique que la création arrive bientôt et ramène à la liste', () => {
    render(<CreateSoon />);
    expect(screen.getByRole('heading', { level: 1, name: text.title })).toBeInTheDocument();
    expect(screen.getByText(text.description)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: text.action })).toHaveAttribute('href', '/dashboard');
  });

  it('accepte une autre adresse de retour', () => {
    render(<CreateSoon eventsHref="/mes-evenements" />);
    expect(screen.getByRole('link', { name: text.action })).toHaveAttribute(
      'href',
      '/mes-evenements',
    );
  });
});
