import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import useProperties from '../components/catalog/useProperties.js';
import App from './App.jsx';

vi.mock('../components/catalog/useProperties.js', () => ({
  default: vi.fn(),
}));

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

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
    renderApp();

    expect(screen.getByText('HOGARES EN BARCELONA')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encuentra tu próximo hogar' })).toBeInTheDocument();
  });

  it('shows loading skeletons while properties are loading', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: true });
    const { container } = renderApp();

    expect(container.querySelectorAll('.property-card--skeleton')).toHaveLength(3);
  });

  it('opens the global auth modal and persists the favorite requested while signed out', () => {
    sessionStorage.clear();
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
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));

    expect(JSON.parse(sessionStorage.getItem('pendingFavorite'))).toEqual({
      pendingFavoriteId: 'test-home',
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('Inicia sesión para guardar favoritos');
  });
});
