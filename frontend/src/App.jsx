import { useState } from 'react';
import PropertyCard, { PropertyCardSkeleton } from '../components/catalog/PropertyCard.tsx';
import useProperties from '../components/catalog/useProperties.js';
import { useAuth } from './context/AuthContext.tsx';
import AuthModal from './AuthModal.jsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import UserMenu from './components/UserMenu.tsx';

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
  const { properties, isLoading } = useProperties();
  const { isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="app">
      <header className="page-header">
        <UserMenu />
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
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          ))}
      </section>
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
    </main>
  );
}

export default App;
