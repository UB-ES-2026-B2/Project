import { useState } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../../components/catalog/PropertyCard.tsx';
import useProperties from '../../components/catalog/useProperties.js';
import HowItWorks from '../../components/landing/HowItWorks.jsx';
import SiteFooter from '../../components/landing/SiteFooter.jsx';
import SiteHeader from '../../components/landing/SiteHeader.jsx';
import SpaceTypeGrid from '../../components/landing/SpaceTypeGrid.jsx';
import LocationSearchBar from '../components/search/LocationSearchBar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import AuthModal from '../AuthModal.jsx';

function HomePage() {
  const { isAuthenticated } = useAuth();
  // US 1.3.2: la ubicación elegida en el buscador filtra los anuncios (location_id).
  const [location, setLocation] = useState(null);
  const { properties, isLoading } = useProperties(location?.id ?? null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      <a className="skip-link" href="#destacados">Saltar a los anuncios</a>
      <SiteHeader />
      <main id="inicio">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero__inner">
            <p className="home-hero__eyebrow">HOGARES Y ESPACIOS EN BARCELONA</p>
            <h1 id="home-hero-title" className="home-hero__title">
              Encuentra el espacio donde empieza tu próximo capítulo
            </h1>
            <p className="home-hero__subtitle">
              Explora hogares y espacios para vivir, trabajar y emprender.
            </p>
            <a className="button button--accent home-hero__button" href="#destacados">
              Ver anuncios
              <span aria-hidden="true">→</span>
            </a>
            <p className="home-hero__note">Un lugar para cada plan, en Barcelona y alrededores.</p>
          </div>
        </section>

        <div className="home-content">
          <SpaceTypeGrid />

          <section
            id="destacados"
            className="home-section"
            aria-labelledby="featured-title"
            aria-busy={isLoading}
          >
            <div className="home-section__header">
              <div>
                <p className="home-section__eyebrow">ENCUENTRA TU LUGAR</p>
                <h2 id="featured-title" className="home-section__title">
                  Anuncios destacados
                </h2>
              </div>
              <p className="home-section__description">
                Espacios seleccionados para ayudarte a dar el siguiente paso.
              </p>
            </div>

            <LocationSearchBar onLocationChange={setLocation} />

            {isLoading && (
              <div className="home-listing-grid">
                {Array.from({ length: 3 }, (_, index) => (
                  <PropertyCardSkeleton key={index} />
                ))}
              </div>
            )}

            {!isLoading && properties.length > 0 && (
              <div className="home-listing-grid">
                {properties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isAuthenticated={isAuthenticated}
                    onRequireAuth={() => setIsAuthModalOpen(true)}
                  />
                ))}
              </div>
            )}

            {!isLoading && properties.length === 0 && location && (
              <p className="catalog-empty" role="status">
                No hay inmuebles disponibles en {location.name} por ahora.
              </p>
            )}

            {!isLoading && properties.length === 0 && !location && (
              <div className="home-empty-state">
                <h3>Aún no hay anuncios disponibles</h3>
                <p>Vuelve pronto para descubrir nuevos espacios.</p>
              </div>
            )}
          </section>

          <HowItWorks />
        </div>
      </main>
      <SiteFooter />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
}

export default HomePage;
