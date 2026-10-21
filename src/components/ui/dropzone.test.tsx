// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from './dropzone';

function makeFile(name: string, type: string, size = 1000): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function input(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function dropZone(container: HTMLElement): HTMLElement {
  return container.querySelector('label') as HTMLElement;
}

describe('Dropzone', () => {
  it('annonce les formats et le poids par défaut', () => {
    render(<Dropzone onFiles={() => {}} />);
    expect(screen.getByText('Ajoutez une photo')).toBeInTheDocument();
    expect(
      screen.getByText('Formats acceptés : JPEG, PNG, WebP, HEIC. Poids maximal : 10 Mo.'),
    ).toBeInTheDocument();
  });

  it('accepte une photo valide à la sélection', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    const file = makeFile('a.jpg', 'image/jpeg');
    fireEvent.change(input(container), { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('accepte un HEIC sans type MIME grâce à l’extension', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    fireEvent.change(input(container), { target: { files: [makeFile('IMG.HEIC', '')] } });
    expect(onFiles).toHaveBeenCalledOnce();
  });

  it('refuse un mauvais format à la sélection', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} onReject={onReject} />);
    fireEvent.change(input(container), {
      target: { files: [makeFile('doc.pdf', 'application/pdf')] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith('format', expect.any(File));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Ce format n'est pas accepté. Choisissez une photo en JPEG, PNG, WebP, HEIC.",
    );
  });

  it('refuse un fichier trop lourd à la sélection avec le poids réel', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    const big = makeFile('big.jpg', 'image/jpeg', 12.34 * 1024 * 1024);
    fireEvent.change(input(container), { target: { files: [big] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /trop lourde \(12,4 Mo\)\. Le maximum est 10 Mo/,
    );
  });

  it('refuse un mauvais format au glisser-déposer', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    fireEvent.drop(dropZone(container), {
      dataTransfer: { files: [makeFile('doc.pdf', 'application/pdf')] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("Ce format n'est pas accepté");
  });

  it('refuse un fichier trop lourd au glisser-déposer', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    fireEvent.drop(dropZone(container), {
      dataTransfer: { files: [makeFile('big.png', 'image/png', 11 * 1024 * 1024)] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('trop lourde (11 Mo)');
  });

  it('accepte un dépôt valide et efface l’erreur précédente', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    fireEvent.drop(dropZone(container), {
      dataTransfer: { files: [makeFile('doc.pdf', 'application/pdf')] },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const ok = makeFile('ok.webp', 'image/webp');
    fireEvent.drop(dropZone(container), { dataTransfer: { files: [ok] } });
    expect(onFiles).toHaveBeenCalledWith([ok]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('respecte maxSizeBytes et accept personnalisés', () => {
    const onFiles = vi.fn();
    const { container } = render(
      <Dropzone accept="image/png" maxSizeBytes={1024 * 1024} onFiles={onFiles} />,
    );
    fireEvent.change(input(container), {
      target: { files: [makeFile('a.jpg', 'image/jpeg')] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    fireEvent.change(input(container), {
      target: { files: [makeFile('a.png', 'image/png', 2 * 1024 * 1024)] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Le maximum est 1 Mo');
  });

  it('ignore le dépôt pendant l’envoi et propose Annuler', () => {
    const onFiles = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <Dropzone status="uploading" progress={40} onFiles={onFiles} onCancel={onCancel} />,
    );
    expect(screen.getAllByText('Envoi en cours… 40 %').length).toBeGreaterThan(0);
    fireEvent.drop(dropZone(container), {
      dataTransfer: { files: [makeFile('a.jpg', 'image/jpeg')] },
    });
    expect(onFiles).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: "Annuler l'envoi de la photo" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('ne montre pas Annuler sans callback', () => {
    render(<Dropzone status="uploading" progress={10} onFiles={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('montre l’erreur réseau et Réessayer', () => {
    const onRetry = vi.fn();
    render(<Dropzone status="error" onRetry={onRetry} onFiles={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent("L'envoi a échoué");
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('affiche Obligatoire seulement avec required', () => {
    const { rerender } = render(<Dropzone onFiles={() => {}} />);
    expect(screen.queryByText('Obligatoire')).toBeNull();
    rerender(<Dropzone required onFiles={() => {}} />);
    expect(screen.getByText('Obligatoire')).toBeInTheDocument();
  });

  it('expose le libellé accessible avec formats et poids', () => {
    render(<Dropzone onFiles={() => {}} />);
    expect(
      screen.getByLabelText(
        "Zone d'ajout de photo. Formats acceptés : JPEG, PNG, WebP, HEIC. Poids maximal : 10 Mo.",
      ),
    ).toBeInTheDocument();
  });

  it('propose Remplacer quand rempli', () => {
    render(<Dropzone status="filled" previewUrl="data:image/png;base64,AA==" onFiles={() => {}} />);
    expect(screen.getByText('Remplacer')).toBeInTheDocument();
  });
});
