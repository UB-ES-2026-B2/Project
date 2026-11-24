import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import FavoritesPage from './FavoritesPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FavoritesPage />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('FavoritesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders favorite properties in the order returned by the backend (newest first)', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/favorites/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 102,
                title: 'Piso Recién Likeado',
                location: 'Eixample, Barcelona',
                price: 320000,
                previous_price: null,
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                image_url: 'https://example.com/piso2.jpg',
                is_active: true,
              },
              {
                id: 101,
                title: 'Ático Primer Like',
                location: 'Gràcia, Barcelona',
                price: 450000,
                previous_price: 470000,
                bedrooms: 3,
                bathrooms: 2,
                area: 95,
                image_url: 'https://example.com/piso1.jpg',
                is_active: true,
              },
            ],
          }),
        };
      }
      if (url === '/api/v1/favorites') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ property_ids: [102, 101] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Piso Recién Likeado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ático Primer Like' })).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('Piso Recién Likeado');
    expect(headings[1]).toHaveTextContent('Ático Primer Like');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/favorites/me', undefined);
  });

  it('shows unavailable badge and hides details link when is_active is false', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/favorites/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 200,
                title: 'Inmueble Desactivado',
                location: 'Sants, Barcelona',
                price: 180000,
                previous_price: null,
                bedrooms: 1,
                bathrooms: 1,
                area: 45,
                image_url: null,
                is_active: false,
              },
            ],
          }),
        };
      }
      if (url === '/api/v1/favorites') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ property_ids: [200] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Inmueble Desactivado' })).toBeInTheDocument();
    expect(screen.getByText('Propiedad no disponible')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver inmueble' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument();
  });

  it('renders EmptyFavoritesState when items list is empty', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/favorites/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Aún no tienes favoritos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar inmuebles' })).toHaveAttribute('href', '/');
  });

  it('shows error alert when request fails', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/favorites/me') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Internal Server Error' }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se han podido cargar tus favoritos. Inténtalo de nuevo más tarde.',
    );
  });

  it('adds is-removing animation class when removing a favorite', async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (url, init = {}) => {
      if (url === '/api/v1/favorites/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: deleted ? [] : [
              {
                id: 300,
                title: 'Piso a Eliminar',
                location: 'Poblenou, Barcelona',
                price: 260000,
                previous_price: null,
                bedrooms: 2,
                bathrooms: 1,
                area: 60,
                image_url: null,
                is_active: true,
              },
            ],
          }),
        };
      }
      if (url === '/api/v1/favorites') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ property_ids: deleted ? [] : [300] }),
        };
      }
      if (url === '/api/v1/favorites/300' && init.method === 'DELETE') {
        deleted = true;
        return { ok: true, status: 204, json: async () => null };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    const cardHeading = await screen.findByRole('heading', { name: 'Piso a Eliminar' });
    expect(cardHeading).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'Quitar de favoritos' });
    fireEvent.click(removeButton);

    const cardContainer = cardHeading.closest('.favorite-item');
    expect(cardContainer).toHaveClass('is-removing');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Piso a Eliminar' })).not.toBeInTheDocument();
    });
  });
});
