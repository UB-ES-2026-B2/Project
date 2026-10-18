import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import PropertyCard, { PropertyCardSkeleton } from './PropertyCard.tsx';

function renderWithQueryClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const property = {
  id: 'test-home',
  title: 'Piso de prueba',
  location: 'Gràcia, Barcelona',
  price: 300000,
  previousPrice: 320000,
  bedrooms: 2,
  bathrooms: 1,
  area: 75,
  images: ['/first.webp', '/second.webp'],
};

describe('PropertyCard', () => {
  it('shows the price-drop badge and keeps gallery controls from selecting the card', () => {
    const onSelect = vi.fn();
    renderWithQueryClient(<PropertyCard property={property} onSelect={onSelect} />);

    expect(screen.getByText('Bajada de precio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen siguiente' }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changes images with a horizontal touch swipe', () => {
    renderWithQueryClient(<PropertyCard property={property} />);
    const gallery = screen.getByAltText('Piso de prueba - imagen 1').parentElement;

    fireEvent.touchStart(gallery, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 60 }] });

    expect(screen.getByAltText('Piso de prueba - imagen 2')).toBeInTheDocument();
  });

  it('falls back to the property placeholder when an image fails', () => {
    renderWithQueryClient(<PropertyCard property={property} />);
    const image = screen.getByAltText('Piso de prueba - imagen 1');

    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/assets/property-placeholder.webp');
  });

  it('renders an animated loading skeleton with a fixed gallery ratio', () => {
    const { container } = render(<PropertyCardSkeleton />);
    const skeleton = container.querySelector('.property-card--skeleton');
    const gallery = container.querySelector('.property-card__gallery');

    expect(skeleton).toBeInTheDocument();
    expect(gallery).toHaveStyle({ aspectRatio: '16 / 9' });
  });
});
