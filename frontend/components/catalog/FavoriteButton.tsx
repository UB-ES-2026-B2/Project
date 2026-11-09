import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useFavoriteIds, { FAVORITES_QUERY_KEY } from './useFavoriteIds';
import { apiFetch } from '../../src/api/client';

type FavoriteButtonProps = {
  propertyId: string | number;
  /** Valor inicial mientras no se conocen los favoritos del usuario (o sin sesión). */
  isFavorite: boolean;
  isAuthenticated: boolean;
  onRequireAuth?: () => void;
};

type FavoriteMutation = {
  id: string;
  nextFavorite: boolean;
};

function FavoriteButton({
  propertyId,
  isFavorite: initialFavorite,
  isAuthenticated,
  onRequireAuth,
}: FavoriteButtonProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState(false);
  const id = String(propertyId);
  // Con sesión, la fuente de verdad son los favoritos guardados en el backend (US 1.2.1).
  const { data: favoriteIds } = useFavoriteIds(isAuthenticated);
  const isFavorite = isAuthenticated && favoriteIds ? favoriteIds.includes(id) : initialFavorite;

  const mutation = useMutation({
    mutationFn: async ({ id: targetId, nextFavorite }: FavoriteMutation) => {
      // apiFetch añade la cabecera Authorization: Bearer <token> (US 4.2.2).
      const response = await apiFetch(
        `/api/v1/favorites/${encodeURIComponent(targetId)}`,
        { method: nextFavorite ? 'POST' : 'DELETE' },
      );
      if (!response.ok) throw new Error('No se pudo actualizar el favorito.');
    },
    // Actualización optimista: el corazón cambia al momento y se deshace si la API falla.
    onMutate: async ({ id: targetId, nextFavorite }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const previous = queryClient.getQueryData<string[]>(FAVORITES_QUERY_KEY);
      const current = previous ?? (initialFavorite ? [targetId] : []);
      queryClient.setQueryData<string[]>(FAVORITES_QUERY_KEY, nextFavorite
        ? [targetId, ...current.filter((favoriteId) => favoriteId !== targetId)]
        : current.filter((favoriteId) => favoriteId !== targetId));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(FAVORITES_QUERY_KEY, context?.previous);
      setError(true);
    },
    onSuccess: () => setError(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY }),
  });

  const handleClick = () => {
    setError(false);
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'pendingFavorite',
        JSON.stringify({ pendingFavoriteId: id }),
      );
      onRequireAuth?.();
      return;
    }
    mutation.mutate({ id, nextFavorite: !isFavorite });
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
