import { useState } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../components/catalog/PropertyCard.tsx';
import useProperties from '../components/catalog/useProperties.js';
import AuthModal from './AuthModal.jsx';

function App() {
  const { properties, isLoading } = useProperties();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="app">
      <header className="page-header">
        <p className="eyebrow">HOGARES EN BARCELONA</p>
        <h1>Encuentra tu próximo hogar</h1>
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
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </main>
  );
}

export default App;
