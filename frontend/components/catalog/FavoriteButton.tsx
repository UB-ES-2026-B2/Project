import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Property } from './PropertyCard.tsx';
import { PROPERTIES_QUERY_KEY } from './useProperties.js';

type FavoriteButtonProps = {
  propertyId: string;
  isFavorite: boolean;
  isAuthenticated: boolean;
  onRequireAuth?: () => void;
};

type FavoriteMutation = {
  propertyId: string;
  nextFavorite: boolean;
};

function FavoriteButton({
  propertyId,
  isFavorite,
  isAuthenticated,
  onRequireAuth,
}: FavoriteButtonProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(false);
  const mutation = useMutation({
    mutationFn: async ({ propertyId: id, nextFavorite }: FavoriteMutation) => {
      const response = await fetch(
        `/api/properties/${encodeURIComponent(id)}/favorite`,
        { method: nextFavorite ? 'POST' : 'DELETE' },
      );
      if (!response.ok) throw new Error('No se pudo actualizar el favorito.');
    },
    onMutate: async ({ propertyId: id, nextFavorite }) => {
      await queryClient.cancelQueries({ queryKey: PROPERTIES_QUERY_KEY });
      const properties = queryClient.getQueryData<Property[]>(PROPERTIES_QUERY_KEY);
      const previousFavorite = properties?.find((property) => property.id === id)?.isFavorite ?? false;
      queryClient.setQueryData<Property[]>(PROPERTIES_QUERY_KEY, (properties) => (
        properties?.map((property) => (
          property.id === id ? { ...property, isFavorite: nextFavorite } : property
        ))
      ));
      return { previousFavorite };
    },
    onError: (_error, { propertyId: id }, context) => {
      if (context) {
        queryClient.setQueryData<Property[]>(PROPERTIES_QUERY_KEY, (properties) => (
          properties?.map((property) => (
            property.id === id ? { ...property, isFavorite: context.previousFavorite } : property
          ))
        ));
      }
      setError(true);
    },
    onSuccess: () => setError(false),
  });

  const handleClick = () => {
    setError(false);
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'pendingFavorite',
        JSON.stringify({ pendingFavoriteId: propertyId }),
      );
      onRequireAuth?.();
      return;
    }
    mutation.mutate({ propertyId, nextFavorite: !isFavorite });
  };

  return (
    <>
      <button
        className={`favorite-button${isFavorite ? ' favorite-button--active' : ''}`}
        type="button"
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        aria-pressed={isFavorite}
        disabled={mutation.isPending}
        onClick={(event) => {
          event.stopPropagation();
          handleClick();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
        </svg>
      </button>
      {error && (
        <p className="favorite-button__error" role="alert">
          No se pudo guardar el favorito. Inténtalo de nuevo.
        </p>
      )}
    </>
  );
}

export default FavoriteButton;
