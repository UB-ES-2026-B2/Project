import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useProperties from '../components/catalog/useProperties.js';
import App from './App.jsx';

vi.mock('../components/catalog/useProperties.js', () => ({
  default: vi.fn(),
}));

const property = {
  id: 'test-home',
  title: 'Piso de prueba',
  location: 'Barcelona',
  operation: 'sale',
  spaceType: 'piso',
  price: 300000,
  bedrooms: 2,
  bathrooms: 1,
  area: 75,
  images: [],
};

afterEach(() => {
  window.location.hash = '';
});

describe('App', () => {
  it('shows the landing page about buying and renting spaces by default', () => {
    useProperties.mockReturnValue({ properties: [property], isLoading: false });
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Compra o alquila el espacio que necesitas' }))
      .toBeInTheDocument();
    expect(screen.queryByText('HOGARES EN BARCELONA')).not.toBeInTheDocument();
  });

  it('keeps the original catalog screen at #/catalogo', () => {
    useProperties.mockReturnValue({ properties: [property], isLoading: false });
    render(<App />);

    act(() => {
      window.location.hash = '#/catalogo';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(screen.getByText('HOGARES EN BARCELONA')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encuentra tu próximo hogar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Volver al inicio' })).toHaveAttribute('href', '#inicio');
  });

  it('shows loading skeletons while properties are loading', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: true });
    const { container } = render(<App />);

    expect(container.querySelectorAll('.property-card--skeleton')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Cargando espacios…' })).toBeInTheDocument();
  });
});
