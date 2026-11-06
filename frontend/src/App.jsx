import { useState } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../components/catalog/PropertyCard.tsx';
import useProperties from '../components/catalog/useProperties.js';
import AuthModal from './AuthModal.jsx';
import LocationSearchBar from './components/search/LocationSearchBar.tsx';

function App() {
  const [location, setLocation] = useState(null);
  const { properties, isLoading } = useProperties(location?.id ?? null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="app">
      <header className="page-header">
        <p className="eyebrow">HOGARES EN BARCELONA</p>
        <h1>Encuentra tu próximo hogar</h1>
        <LocationSearchBar onLocationChange={setLocation} />
      </header>
      <section className="property-grid" aria-label="Inmuebles disponibles">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => <PropertyCardSkeleton key={index} />)
          : properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isAuthenticated={false}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          ))}
      </section>
      {!isLoading && location && properties.length === 0 && (
        <p className="catalog-empty" role="status">
          No hay inmuebles disponibles en {location.name} por ahora.
        </p>
      )}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </main>
  );
}

export default App;
