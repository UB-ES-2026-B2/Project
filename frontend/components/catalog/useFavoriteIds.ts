import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../src/api/client';

/** Caché de react-query con los ids (como texto) de los favoritos del usuario. */
export const FAVORITES_QUERY_KEY = ['favorites'];

type FavoritesResponse = { property_ids?: unknown };

/**
 * Ids de los inmuebles favoritos del usuario autenticado (`GET /api/v1/favorites`, US 1.2.1).
 * Sin sesión no se pide nada. Al cerrar sesión, AuthContext vacía la caché.
 */
function useFavoriteIds(enabled: boolean) {
  return useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const response = await apiFetch('/api/v1/favorites');
      if (!response.ok) throw new Error('No se pudieron cargar los favoritos.');
      const body = (await response.json()) as FavoritesResponse;
      return Array.isArray(body.property_ids) ? body.property_ids.map(String) : [];
    },
  });
}

export default useFavoriteIds;
