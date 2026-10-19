import { useRef, useState, type KeyboardEvent, type SyntheticEvent, type TouchEvent } from 'react';
import { OPERATIONS, SPACE_TYPE_LABELS } from './spaceTypes.js';

export type Operation = 'sale' | 'rent';
export type SpaceType = 'piso' | 'casa' | 'local' | 'oficina' | 'garaje' | 'trastero';

export type Property = {
  id: string;
  title: string;
  location: string;
  postalCode?: string;
  operation: Operation;
  spaceType: SpaceType;
  /** En alquiler, precio mensual. */
  price: number;
  previousPrice?: number;
  /** Un garaje o un trastero no tienen dormitorios ni baños. */
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  images: string[];
};

type PropertyCardProps = {
  property: Property;
  onSelect?: (property: Property) => void;
  /** Nivel del título según la página: h2 en el catálogo, h3 dentro de una sección. */
  titleAs?: 'h2' | 'h3';
};

const PLACEHOLDER_IMAGE = '/assets/property-placeholder.webp';

function PropertyCard({ property, onSelect, titleAs: Title = 'h2' }: PropertyCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const image = property.images[imageIndex] ?? PLACEHOLDER_IMAGE;
  const hasPriceDrop = property.previousPrice !== undefined && property.previousPrice > property.price;
  const isRent = property.operation === 'rent';

  const changeImage = (direction: number) => {
    if (property.images.length < 2) return;
    setImageIndex((currentIndex) => (
      (currentIndex + direction + property.images.length) % property.images.length
    ));
  };

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const imageElement = event.currentTarget;
    if (imageElement.getAttribute('src') === PLACEHOLDER_IMAGE) {
      imageElement.hidden = true;
      return;
    }
    imageElement.src = PLACEHOLDER_IMAGE;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onSelect(property);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(distance) >= 40) changeImage(distance < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <article
      className="property-card"
      onClick={() => onSelect?.(property)}
      onKeyDown={handleKeyDown}
      role={onSelect ? 'link' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div
        className="property-card__gallery"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          className="property-card__image"
          src={image}
          alt={`${property.title} - imagen ${imageIndex + 1}`}
          onError={handleImageError}
        />
        <div className="property-card__badges">
          {property.operation && (
            <span className={`property-card__operation property-card__operation--${property.operation}`}>
              {OPERATIONS[property.operation].badge}
            </span>
          )}
          {hasPriceDrop && (
            <span className="property-card__price-drop">Bajada de precio</span>
          )}
        </div>
        {property.images.length > 1 && (
          <>
            <button
              className="property-card__gallery-button property-card__gallery-button--previous"
              type="button"
              aria-label="Ver imagen anterior"
              onClick={(event) => {
                event.stopPropagation();
                changeImage(-1);
              }}
            >
              ‹
            </button>
            <button
              className="property-card__gallery-button property-card__gallery-button--next"
              type="button"
              aria-label="Ver imagen siguiente"
              onClick={(event) => {
                event.stopPropagation();
                changeImage(1);
              }}
            >
              ›
            </button>
            <span className="property-card__image-count" aria-live="polite">
              {imageIndex + 1} / {property.images.length}
            </span>
          </>
        )}
      </div>

      <div className="property-card__content">
        <p className="property-card__price">
          {property.price.toLocaleString('es-ES')} €
          {isRent && <span className="property-card__price-period">/mes</span>}
        </p>
        {property.spaceType && (
          <p className="property-card__type">{SPACE_TYPE_LABELS[property.spaceType]}</p>
        )}
        <Title className="property-card__title">{property.title}</Title>
        <p className="property-card__location">{property.location}</p>
        <ul className="property-card__features" aria-label="Características">
          {property.bedrooms !== undefined && <li>{property.bedrooms} hab.</li>}
          {property.bathrooms !== undefined && (
            <li>{property.bathrooms} {property.bathrooms === 1 ? 'baño' : 'baños'}</li>
          )}
          <li>{property.area} m²</li>
        </ul>
        <a className="property-card__details" href={`/inmueble/${property.id}`}>
          Ver inmueble
        </a>
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <article className="property-card property-card--skeleton" aria-hidden="true">
      <div
        className="property-card__gallery property-card__skeleton-image"
        style={{ aspectRatio: '16 / 9' }}
      />
      <div className="property-card__content">
        <span className="property-card__skeleton-line property-card__skeleton-line--price" />
        <span className="property-card__skeleton-line property-card__skeleton-line--title" />
        <span className="property-card__skeleton-line property-card__skeleton-line--location" />
        <span className="property-card__skeleton-line property-card__skeleton-line--features" />
      </div>
    </article>
  );
}

export default PropertyCard;
