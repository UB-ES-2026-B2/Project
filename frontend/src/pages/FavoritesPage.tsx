import { useState } from 'react';
import EmptyFavoritesState from '../components/EmptyFavoritesState';
import PropertyCard, { type Property } from '../../components/catalog/PropertyCard';
import useFavoriteIds from '../../components/catalog/useFavoriteIds';
import useProperties from '../../components/catalog/useProperties';
import SiteHeader from '../../components/landing/SiteHeader.jsx';

function FavoritesPage() {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { data: favoriteIds = [], isLoading: favoritesLoading, isError: favoritesError } =
    useFavoriteIds(true);
  const {
    properties,
    isLoading: propertiesLoading,
  } = useProperties(null, 50) as { properties: Property[]; isLoading: boolean };

  const favoriteProperties = properties.filter((property) => (
    favoriteIds.includes(String(property.id))
  ));
  const isLoading = favoritesLoading || propertiesLoading;

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
          <div className="property-grid">
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
                  className={`favorite-item${removingId === propertyId ? ' is-removing' : ''}`}
                  key={propertyId}
                >
                  <PropertyCard
                    property={property}
                    isAuthenticated
                    showDetailsLink={isAvailable}
                    isAvailable={isAvailable}
                    onBeforeFavoriteRemove={() => new Promise((resolve) => {
                      setRemovingId(propertyId);
                      window.setTimeout(resolve, 180);
                    })}
                    onFavoriteToggleSettled={(success) => {
                      if (!success) setRemovingId(null);
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
