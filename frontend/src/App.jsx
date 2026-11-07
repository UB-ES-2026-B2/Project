import RegisterPage from './pages/auth/RegisterPage.tsx';
import HomePage from './pages/HomePage.jsx';

function App() {
  if (window.location.pathname === '/register') {
    return <RegisterPage />;
  }

  return <HomePage />;
}

export default App;
