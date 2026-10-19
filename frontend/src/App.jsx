import { useEffect, useState } from 'react';
import CatalogPage from './pages/CatalogPage.jsx';
import HomePage from './pages/HomePage.jsx';

// Sin react-router: una sola página con anclas, más el catálogo completo en #/catalogo.
export const CATALOG_HASH = '#/catalogo';

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  return hash;
}

function App() {
  const isCatalog = useHash() === CATALOG_HASH;

  // Al cambiar de página, empezar arriba (las anclas de la landing no cambian de página).
  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [isCatalog]);

  return isCatalog ? <CatalogPage /> : <HomePage />;
}

export default App;
