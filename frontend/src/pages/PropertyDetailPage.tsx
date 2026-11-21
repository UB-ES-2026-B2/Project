import { useEffect, useState, type FormEvent, type SyntheticEvent } from 'react';
import FavoriteButton from '../../components/catalog/FavoriteButton';
import SiteFooter from '../../components/landing/SiteFooter';
import SiteHeader from '../../components/landing/SiteHeader';
import ImageGalleryLightbox from '../components/property/ImageGalleryLightbox';
import { useAuth } from '../context/AuthContext';

type PropertyDetail = {
  id: string | number;
  title: string;
  location: string;
  price: number;
  previousPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  description?: string;
  images: string[];
  isActive?: boolean;
  isFavorite?: boolean;
};

type PropertyDetailPageProps = {
  propertyId: string;
};

const PLACEHOLDER_IMAGE = '/assets/property-placeholder.webp';

function asPropertyDetail(value: Record<string, unknown>, id: string): PropertyDetail {
  const rawImages = Array.isArray(value.images) ? value.images : [];
  const fallbackImage = typeof value.image_url === 'string'
    ? value.image_url
    : typeof value.imageUrl === 'string'
      ? value.imageUrl
      : '';
  const images = rawImages
    .filter((image): image is string => typeof image === 'string')
    .concat(fallbackImage ? [fallbackImage] : [])
    .filter((image, index, all) => all.indexOf(image) === index);
  const price = Number(value.price);
  const rawId = value.id;
  const detailId = typeof rawId === 'number' || typeof rawId === 'string'
    ? rawId
    : id;

  return {
    id: detailId,
    title: typeof value.title === 'string' ? value.title : 'Inmueble',
    location: typeof value.location === 'string' ? value.location : '',
    price: Number.isFinite(price) ? price : 0,
    previousPrice: value.previous_price !== undefined
      ? Number(value.previous_price)
      : value.previousPrice !== undefined
        ? Number(value.previousPrice)
        : undefined,
    bedrooms: typeof value.bedrooms === 'number' ? value.bedrooms : undefined,
    bathrooms: typeof value.bathrooms === 'number' ? value.bathrooms : undefined,
    area: Number(value.area ?? value.surface_m2) || 0,
    description: typeof value.description === 'string' ? value.description : '',
    images,
    isActive: typeof value.is_active === 'boolean'
      ? value.is_active
      : typeof value.isActive === 'boolean'
        ? value.isActive
        : true,
    isFavorite: typeof value.isFavorite === 'boolean' ? value.isFavorite : false,
  };
}

function PropertyDetailPage({ propertyId }: PropertyDetailPageProps) {
  const { isAuthenticated } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/properties/' + encodeURIComponent(propertyId))
      .then((response) => {
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!response.ok) throw new Error('No se pudo cargar el inmueble');
        return response.json();
      })
      .then((data) => {
        if (!cancelled && data) setProperty(asPropertyDetail(data as Record<string, unknown>, propertyId));
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxIndex]);

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSent(true);
  };

  const handleGridImageError = (
    event: SyntheticEvent<HTMLImageElement>,
    index: number,
  ) => {
    setFailedImages((current) => ({ ...current, [index]: true }));
    event.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="property-detail-page" aria-busy="true">
          <p className="property-detail__status">Cargando inmueble...</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (notFound || !property) {
    return (
      <>
        <SiteHeader />
        <main className="property-detail-page">
          <section className="property-detail__not-found" role="status">
            <p className="eyebrow">ERROR 404</p>
            <h1>Inmueble no encontrado</h1>
            <p>El anuncio que buscas no existe o ya no está disponible.</p>
            <a className="button button--accent" href="/">Volver al inicio</a>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const galleryImages = property.images.length > 0 ? property.images : [PLACEHOLDER_IMAGE];

  return (
    <>
      <SiteHeader />
      <main className="property-detail-page">
        {property.isActive === false && (
          <div className="property-detail__inactive" role="alert">
            Este anuncio ha sido retirado o ya no está disponible
          </div>
        )}

        <section className="property-detail__gallery" aria-label="Fotos del inmueble">
          {galleryImages.slice(0, 5).map((image, index) => (
            <button
              className={`property-detail__photo property-detail__photo--${index + 1}`}
              type="button"
              key={`${image}-${index}`}
              aria-label={`Abrir foto ${index + 1}`}
              onClick={() => setLightboxIndex(index)}
            >
              <img
                src={failedImages[index] ? PLACEHOLDER_IMAGE : image}
                alt={`${property.title} - foto ${index + 1}`}
                onError={(event) => handleGridImageError(event, index)}
              />
            </button>
          ))}
          <button
            className="property-detail__view-all"
            type="button"
            onClick={() => setLightboxIndex(0)}
          >
            Ver todas las fotos ({galleryImages.length})
          </button>
        </section>

        <div className="property-detail__layout">
          <article className="property-detail__content">
            <p className="eyebrow">{property.location}</p>
            <h1>{property.title}</h1>
            <ul className="property-detail__features" aria-label="Características">
              {property.bedrooms !== undefined && <li>{property.bedrooms} hab.</li>}
              {property.bathrooms !== undefined && <li>{property.bathrooms} baños</li>}
              {property.area > 0 && <li>{property.area} m²</li>}
            </ul>
            {property.description && (
              <section className="property-detail__description">
                <h2>Descripción</h2>
                <p>{property.description}</p>
              </section>
            )}
          </article>

          {property.isActive !== false && (
            <aside className="property-detail__sidebar">
              <div className="property-detail__price-row">
                <p className="property-detail__price">
                  {property.price.toLocaleString('es-ES')} €
                </p>
                <FavoriteButton
                  propertyId={property.id}
                  isFavorite={property.isFavorite ?? false}
                  isAuthenticated={isAuthenticated}
                />
              </div>

              <form className="property-detail__contact" onSubmit={handleContactSubmit}>
                <h2>Contacta con el anunciante</h2>
                <label>
                  Nombre
                  <input name="name" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Mensaje
                  <textarea name="message" required defaultValue="Hola, estoy interesado en este inmueble." />
                </label>
                <button type="submit">Enviar mensaje</button>
                {contactSent && (
                  <p role="status">Tu mensaje ha sido enviado.</p>
                )}
              </form>
            </aside>
          )}
        </div>
      </main>
      <SiteFooter />
      {lightboxIndex !== null && (
        <ImageGalleryLightbox
          images={galleryImages}
          initialIndex={lightboxIndex}
          title={property.title}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

export default PropertyDetailPage;
