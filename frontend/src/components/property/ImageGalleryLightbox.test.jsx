import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImageGalleryLightbox from './ImageGalleryLightbox';

describe('ImageGalleryLightbox', () => {
  it('opens and closes with buttons and navigates with the keyboard', () => {
    const onClose = vi.fn();
    render(
      <ImageGalleryLightbox
        images={['/one.webp', '/two.webp', '/three.webp']}
        initialIndex={0}
        title="Piso de prueba"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByAltText('Piso de prueba - foto 1')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByAltText('Piso de prueba - foto 2')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByAltText('Piso de prueba - foto 1')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar galería' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('navigates with floating buttons', () => {
    render(
      <ImageGalleryLightbox
        images={['/one.webp', '/two.webp']}
        initialIndex={0}
        title="Piso de prueba"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByAltText('Piso de prueba - foto 2')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByAltText('Piso de prueba - foto 1')).toBeInTheDocument();
  });
});
