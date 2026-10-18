import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useProperties from '../components/catalog/useProperties.js';
import App from './App.jsx';

vi.mock('../components/catalog/useProperties.js', () => ({
  default: vi.fn(),
}));

describe('initial screen', () => {
  it('shows the Barcelona homes heading', () => {
    useProperties.mockReturnValue({
      properties: [{
        id: 'test-home',
        title: 'Piso de prueba',
        location: 'Barcelona',
        price: 300000,
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        images: [],
      }],
      isLoading: false,
    });
    render(<App />);

    expect(screen.getByText('HOGARES EN BARCELONA')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encuentra tu próximo hogar' })).toBeInTheDocument();
  });

  it('shows loading skeletons while properties are loading', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: true });
    const { container } = render(<App />);

    expect(container.querySelectorAll('.property-card--skeleton')).toHaveLength(3);
  });
});
