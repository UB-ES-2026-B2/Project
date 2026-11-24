import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../src/api/client';
import type { Property } from './PropertyCard';

export const FAVORITES_ME_QUERY_KEY = ['favorites', 'me'];

type RawFavoriteProperty = {
  id: number | string;
  title: string;
  location: string;
  price: number;
  previous_price?: number | null;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  image_url?: string | null;
  images?: string[];
  is_active?: boolean;
};

type FavoritesMeResponse = {
  items?: RawFavoriteProperty[];
};

export function toFavoriteProperty(raw: RawFavoriteProperty): Property {
  return {
    id: String(raw.id),
    title: raw.title,
    location: raw.location,
    price: raw.price,
    previousPrice: raw.previous_price ?? undefined,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    area: raw.area,
    images: raw.images && raw.images.length > 0
      ? raw.images
      : (raw.image_url ? [raw.image_url] : []),
    is_active: raw.is_active ?? true,
    isFavorite: true,
  };
}

/**
 * Inmuebles favoritos del usuario autenticado (`GET /api/v1/favorites/me`, US 1.7.1).
 * Vienen ordenados por fecha de like (del más reciente al más antiguo).
 * Incluye anuncios desactivados con is_active: false.
 */
function useFavoriteProperties(enabled: boolean = true) {
  return useQuery({
    queryKey: FAVORITES_ME_QUERY_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Property[]> => {
      const response = await apiFetch('/api/v1/favorites/me');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los favoritos.');
      }
      const data = (await response.json()) as FavoritesMeResponse;
      return Array.isArray(data.items) ? data.items.map(toFavoriteProperty) : [];
    },
  });
}

export default useFavoriteProperties;
