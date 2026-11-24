import { useState } from 'react';
import EmptyFavoritesState from '../components/EmptyFavoritesState';
import PropertyCard from '../../components/catalog/PropertyCard';
import useFavoriteProperties from '../../components/catalog/useFavoriteProperties';
import SiteHeader from '../../components/landing/SiteHeader.jsx';

function FavoritesPage() {
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const {
    data: favoriteProperties = [],
    isLoading,
    isError: favoritesError,
  } = useFavoriteProperties();

  return (
    <>
      <SiteHeader />
      <main className="favorites-page">
        <div className="favorites-page__intro">
          <p className="eyebrow">LISTADO Y BÚSQUEDA</p>
          <h1>Mis inmuebles favoritos</h1>
          <p>Consulta los espacios que has guardado y vuelve a ellos cuando quieras.</p>
        </div>

        {isLoading && (
          <div className="property-grid" aria-label="Cargando favoritos">
            {[0, 1, 2].map((item) => (
              <div className="property-card property-card--skeleton" aria-hidden="true" key={item} />
            ))}
          </div>
        )}

        {!isLoading && favoritesError && (
          <p className="catalog-empty" role="alert">
            No se han podido cargar tus favoritos. Inténtalo de nuevo más tarde.
          </p>
        )}

        {!isLoading && !favoritesError && favoriteProperties.length === 0 && (
          <EmptyFavoritesState />
        )}

        {!isLoading && !favoritesError && favoriteProperties.length > 0 && (
          <div className="property-grid favorites-grid">
            {favoriteProperties.map((property) => {
              const isAvailable = property.is_active !== false;
              const propertyId = String(property.id);
              return (
                <div
                  className={`favorite-item${removingIds.includes(propertyId) ? ' is-removing' : ''}`}
                  key={propertyId}
                >
                  <PropertyCard
                    property={property}
                    isAuthenticated
                    showDetailsLink={isAvailable}
                    isAvailable={isAvailable}
                    onBeforeFavoriteRemove={() => new Promise((resolve) => {
                      setRemovingIds((prev) => [...prev, propertyId]);
                      window.setTimeout(resolve, 180);
                    })}
                    onFavoriteToggleSettled={(success) => {
                      if (!success) {
                        setRemovingIds((prev) => prev.filter((id) => id !== propertyId));
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

export default FavoritesPage;
