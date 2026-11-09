import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FavoriteButton from './FavoriteButton.tsx';
import { FAVORITES_QUERY_KEY } from './useFavoriteIds';

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

/**
 * Backend falso: GET /api/v1/favorites devuelve `saved` y POST/DELETE lo modifican.
 * `failWrites` simula un 500 en POST/DELETE.
 */
function fakeApi({ saved = [], failWrites = false } = {}) {
  const favorites = new Set(saved.map(String));
  const calls = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url === '/api/v1/favorites' && method === 'GET') {
      return json({ property_ids: [...favorites].map(Number) });
    }
    const match = /^\/api\/v1\/favorites\/(.+)$/.exec(url);
    if (match && failWrites) return json({}, 500);
    if (match && method === 'POST') { favorites.add(match[1]); return json(null, 201); }
    if (match && method === 'DELETE') { favorites.delete(match[1]); return json(null, 204); }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, favorites };
}

function renderButton({ isAuthenticated = true, propertyId = 7, isFavorite = false, onRequireAuth } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <FavoriteButton
        propertyId={propertyId}
        isFavorite={isFavorite}
        isAuthenticated={isAuthenticated}
        onRequireAuth={onRequireAuth}
      />
    </QueryClientProvider>,
  );
  return { queryClient };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.setItem('access_token', 'token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('FavoriteButton', () => {
  it('stores the pending favorite as text and requests authentication when signed out', () => {
    const onRequireAuth = vi.fn();
    const { calls } = fakeApi();
    renderButton({ isAuthenticated: false, onRequireAuth });

    fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));

    // El id del catálogo es numérico; AuthContext solo envía ids de texto tras el login.
    expect(JSON.parse(sessionStorage.getItem('pendingFavorite'))).toEqual({ pendingFavoriteId: '7' });
    expect(onRequireAuth).toHaveBeenCalledOnce();
    expect(calls).toEqual([]);
  });

  it('shows the heart filled when the property is already saved in the backend', async () => {
    fakeApi({ saved: [7] });
    renderButton();

    const button = await screen.findByRole('button', { name: 'Quitar de favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses POST to add and DELETE to remove an authenticated favorite', async () => {
    const { calls, favorites } = fakeApi();
    renderButton();
    await waitFor(() => expect(calls).toContain('GET /api/v1/favorites'));
    const button = screen.getByRole('button', { name: 'Añadir a favoritos' });

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(favorites.has('7')).toBe(true);

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    await waitFor(() => expect(favorites.has('7')).toBe(false));

    expect(calls).toContain('POST /api/v1/favorites/7');
    expect(calls).toContain('DELETE /api/v1/favorites/7');
  });

  it('sends DELETE straight away for a property that was already saved', async () => {
    const { calls } = fakeApi({ saved: [7] });
    renderButton();

    fireEvent.click(await screen.findByRole('button', { name: 'Quitar de favoritos' }));

    await waitFor(() => expect(calls).toContain('DELETE /api/v1/favorites/7'));
    expect(calls).not.toContain('POST /api/v1/favorites/7');
  });

  it('updates the icon optimistically and restores it with an error toast on HTTP 5xx', async () => {
    const { calls } = fakeApi({ failWrites: true });
    const { queryClient } = renderButton();
    await waitFor(() => expect(calls).toContain('GET /api/v1/favorites'));
    const button = screen.getByRole('button', { name: 'Añadir a favoritos' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el favorito');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
    expect(queryClient.getQueryData(FAVORITES_QUERY_KEY)).toEqual([]);
  });

  it('does not ask the backend for favorites without a session', () => {
    const { calls } = fakeApi();
    renderButton({ isAuthenticated: false });

    expect(calls).toEqual([]);
    expect(screen.getByRole('button', { name: 'Añadir a favoritos' })).toHaveAttribute('aria-pressed', 'false');
  });
});
