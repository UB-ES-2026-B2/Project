import { forwardRef } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../catalog/PropertyCard.tsx';
import { OPERATIONS, SPACE_TYPES } from '../catalog/spaceTypes.js';
import { ArrowIcon, CloseIcon } from './icons.jsx';

function activeChips(filters) {
  const chips = [];
  if (filters.operation) chips.push({ key: 'operation', label: OPERATIONS[filters.operation].badge });
  if (filters.location.trim()) chips.push({ key: 'location', label: filters.location.trim() });
  if (filters.spaceType !== 'all') {
    chips.push({ key: 'spaceType', label: SPACE_TYPES.find(({ id }) => id === filters.spaceType).plural });
  }
  return chips;
}

/** El ref apunta al título: HomePage le pasa el foco después de cada búsqueda. */
const FeaturedListings = forwardRef(function FeaturedListings(
  { properties, isLoading, title, filters, onRemoveFilter, onClear },
  titleRef,
) {
  const chips = activeChips(filters);

  return (
    <section id="destacados" className="section" aria-labelledby="destacados-title" aria-busy={isLoading}>
      <div className="section__header section__header--row">
        <h2 id="destacados-title" ref={titleRef} className="section__title" tabIndex={-1}>
          {isLoading ? 'Cargando espacios…' : title}
        </h2>
        <a className="text-link" href="#/catalogo">
          Ver catálogo completo <ArrowIcon />
        </a>
      </div>

      {chips.length > 0 && (
        <ul className="filter-chips" aria-label="Filtros activos">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                className="filter-chip"
                type="button"
                aria-label={`Quitar filtro: ${chip.label}`}
                onClick={() => onRemoveFilter(chip.key)}
              >
                {chip.label}
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isLoading && (
        <div className="listing-grid">
          {Array.from({ length: 3 }, (_, index) => <PropertyCardSkeleton key={index} />)}
        </div>
      )}

      {!isLoading && properties.length > 0 && (
        <ul className="listing-grid">
          {properties.map((property) => (
            <li key={property.id}>
              <PropertyCard property={property} titleAs="h3" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && properties.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">No hay espacios que coincidan con tu búsqueda.</p>
          <p className="empty-state__text">Prueba con otra ubicación, otro tipo de espacio o cambia entre compra y alquiler.</p>
          <button className="button button--accent" type="button" onClick={onClear}>
            Limpiar búsqueda
          </button>
        </div>
      )}
    </section>
  );
});

export default FeaturedListings;
