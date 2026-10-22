// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@/content/messages.fr';
import { SuspendedBanner } from './suspended-banner';

const text = messages.account.suspended;

describe('SuspendedBanner', () => {
  it('annonce le compte suspendu et offre un lien vers le support', () => {
    render(<SuspendedBanner />);
    expect(screen.getByRole('heading', { name: text.title })).toBeInTheDocument();
    expect(screen.getByText(/Votre compte est suspendu\./)).toHaveTextContent(text.email);
    expect(screen.getByRole('link', { name: text.contactLabel })).toHaveAttribute(
      'href',
      `mailto:${text.email}`,
    );
  });
});
