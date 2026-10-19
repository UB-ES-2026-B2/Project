import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PropertyCard, { PropertyCardSkeleton } from './PropertyCard.tsx';

const property = {
  id: 'test-home',
  title: 'Piso de prueba',
  location: 'Gràcia, Barcelona',
  operation: 'sale',
  spaceType: 'piso',
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
    render(<PropertyCard property={property} onSelect={onSelect} />);

    expect(screen.getByText('Bajada de precio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen siguiente' }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changes images with a horizontal touch swipe', () => {
    render(<PropertyCard property={property} />);
    const gallery = screen.getByAltText('Piso de prueba - imagen 1').parentElement;

    fireEvent.touchStart(gallery, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 60 }] });

    expect(screen.getByAltText('Piso de prueba - imagen 2')).toBeInTheDocument();
  });

  it('falls back to the property placeholder when an image fails', () => {
    render(<PropertyCard property={property} />);
    const image = screen.getByAltText('Piso de prueba - imagen 1');

    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/assets/property-placeholder.webp');
  });

  it('labels a sale listing and shows its rooms and space type', () => {
    render(<PropertyCard property={property} />);

    expect(screen.getByText('En venta')).toBeInTheDocument();
    expect(screen.getByText('Piso')).toBeInTheDocument();
    expect(screen.getByText('300.000 €')).toBeInTheDocument();
    expect(screen.queryByText('/mes')).not.toBeInTheDocument();
    expect(screen.getByText('2 hab.')).toBeInTheDocument();
    expect(screen.getByText('1 baño')).toBeInTheDocument();
  });

  it('shows the monthly price and the rent label for rentals', () => {
    render(<PropertyCard property={{ ...property, operation: 'rent', price: 1650, previousPrice: undefined }} />);

    expect(screen.getByText('En alquiler')).toBeInTheDocument();
    expect(screen.getByText('/mes')).toBeInTheDocument();
    expect(screen.getByText('/mes').closest('p')).toHaveTextContent('1650 €/mes');
  });

  it('hides bedrooms and bathrooms for spaces without them, like a garage', () => {
    const garage = {
      ...property, spaceType: 'garaje', bedrooms: undefined, bathrooms: undefined, area: 12,
    };
    render(<PropertyCard property={garage} titleAs="h3" />);

    expect(screen.getByText('Garaje')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Piso de prueba' })).toBeInTheDocument();
    const features = screen.getByRole('list', { name: 'Características' });
    expect(features).toHaveTextContent('12 m²');
    expect(features).not.toHaveTextContent('hab.');
    expect(features).not.toHaveTextContent('baño');
  });

  it('renders an animated loading skeleton with a fixed gallery ratio', () => {
    const { container } = render(<PropertyCardSkeleton />);
    const skeleton = container.querySelector('.property-card--skeleton');
    const gallery = container.querySelector('.property-card__gallery');

    expect(skeleton).toBeInTheDocument();
    expect(gallery).toHaveStyle({ aspectRatio: '16 / 9' });
  });
});
