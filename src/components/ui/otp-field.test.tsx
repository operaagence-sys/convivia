// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OtpField } from './otp-field';

describe('OtpField', () => {
  it('affiche 6 cases et signale l’erreur', () => {
    render(
      <OtpField
        label="Code"
        value=""
        onChange={() => {}}
        status="error"
        message="Code incorrect."
      />,
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect.');
  });

  it('ne garde que les chiffres lors d’un collage et signale la fin', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<OtpField label="Code" value="" onChange={onChange} onComplete={onComplete} />);
    fireEvent.paste(screen.getAllByRole('textbox')[0]!, {
      clipboardData: { getData: () => '12a345 6' },
    });
    expect(onChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});
