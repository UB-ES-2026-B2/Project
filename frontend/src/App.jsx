import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import CreatePropertyPage from './pages/properties/CreatePropertyPage.tsx';
import FavoritesPage from './pages/FavoritesPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import HomePage from './pages/HomePage.jsx';

function App() {
  if (window.location.pathname === '/publicar') {
    return <CreatePropertyPage />;
  }
  if (window.location.pathname === '/favoritos') {
    return (
      <ProtectedRoute>
        <FavoritesPage />
      </ProtectedRoute>
    );
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
