import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FavoriteButton from './FavoriteButton.tsx';
import { PROPERTIES_QUERY_KEY } from './useProperties.js';

function FavoriteButtonHarness() {
  const { data: properties } = useQuery({
    queryKey: PROPERTIES_QUERY_KEY,
    queryFn: () => [{ id: 'test-home', isFavorite: false }],
    staleTime: Infinity,
  });
  return (
    <FavoriteButton
      propertyId="test-home"
      isFavorite={properties[0].isFavorite}
      isAuthenticated
    />
  );
}

function renderFavoriteButton({ isAuthenticated = false, onRequireAuth, properties } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(PROPERTIES_QUERY_KEY, properties ?? [
    { id: 'test-home', isFavorite: false },
  ]);
  const content = isAuthenticated
    ? <FavoriteButtonHarness />
    : (
      <FavoriteButton
        propertyId="test-home"
        isFavorite={false}
        isAuthenticated={false}
        onRequireAuth={onRequireAuth}
      />
    );
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{content}</QueryClientProvider>),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FavoriteButton', () => {
  it('stores the pending favorite and requests authentication when signed out', () => {
    const onRequireAuth = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    renderFavoriteButton({ onRequireAuth });

    fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));

    expect(JSON.parse(sessionStorage.getItem('pendingFavorite'))).toEqual({
      pendingFavoriteId: 'test-home',
    });
    expect(onRequireAuth).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses POST to add and DELETE to remove an authenticated favorite', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderFavoriteButton({ isAuthenticated: true });
    const button = screen.getByRole('button', { name: 'Añadir a favoritos' });

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/properties/test-home/favorite',
      { method: 'POST' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/properties/test-home/favorite',
      { method: 'DELETE' },
    );
  });

  it('updates the icon optimistically and restores it with an error toast on HTTP 5xx', async () => {
    let finishRequest;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      finishRequest = resolve;
    })));
    const { queryClient } = renderFavoriteButton({ isAuthenticated: true });
    const button = screen.getByRole('button', { name: 'Añadir a favoritos' });

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(queryClient.getQueryData(PROPERTIES_QUERY_KEY)[0].isFavorite).toBe(true);
    finishRequest({ ok: false, status: 500 });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el favorito');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
