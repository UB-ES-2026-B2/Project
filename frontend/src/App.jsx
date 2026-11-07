import { useState } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../components/catalog/PropertyCard.tsx';
import useProperties from '../components/catalog/useProperties.js';
import AuthModal from './AuthModal.jsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import UserMenu from './components/UserMenu.tsx';
import LocationSearchBar from './components/search/LocationSearchBar.tsx';
import { useAuth } from './context/AuthContext.tsx';

function App() {
  if (window.location.pathname === '/register') {
    return <RegisterPage />;
  }
  if (window.location.pathname === '/login') {
    return <LoginPage />;
  }

  return <PropertyCatalog />;
}

function PropertyCatalog() {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useState(null);
  const { properties, isLoading } = useProperties(location?.id ?? null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="app">
      <header className="page-header">
        <UserMenu />
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
              isAuthenticated={isAuthenticated}
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
