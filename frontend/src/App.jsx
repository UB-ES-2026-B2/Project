import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import CreatePropertyPage from './pages/properties/CreatePropertyPage.tsx';
import HomePage from './pages/HomePage.jsx';
import MyPropertiesPage from './pages/advertiser/MyPropertiesPage.tsx';

function App() {
  if (window.location.pathname === '/mis-anuncios') {
    return <MyPropertiesPage />;
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
