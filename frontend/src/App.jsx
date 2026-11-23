import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import CreatePropertyPage from './pages/properties/CreatePropertyPage.tsx';
import PropertyDetailPage from './pages/PropertyDetailPage.tsx';
import HomePage from './pages/HomePage.jsx';

function App() {
  const propertyDetailMatch = window.location.pathname.match(/^\/inmueble\/([^/]+)\/?$/);
  if (propertyDetailMatch) {
    return <PropertyDetailPage propertyId={decodeURIComponent(propertyDetailMatch[1])} />;
  }
  if (window.location.pathname === '/publicar') {
    return <CreatePropertyPage />;
  }
  if (window.location.pathname === '/register') {
    return <RegisterPage />;
  }
  if (window.location.pathname === '/login') {
    return <LoginPage />;
  }

  return <HomePage />;
}

export default App;
