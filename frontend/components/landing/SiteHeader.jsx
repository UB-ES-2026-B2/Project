import { useEffect, useState } from 'react';
import { BRAND_NAME } from './brand.js';
import { MenuIcon } from './icons.jsx';

function SiteHeader({ onSelectOperation, onComingSoon }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const selectOperation = (event, operation) => {
    event.preventDefault();
    setIsMenuOpen(false);
    onSelectOperation(operation);
  };

  const comingSoon = (feature) => {
    setIsMenuOpen(false);
    onComingSoon(feature);
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#inicio">
          <span className="site-header__logo" aria-hidden="true">{BRAND_NAME.charAt(0)}</span>
          {BRAND_NAME}
        </a>

        <button
          className="site-header__menu-button"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="site-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <MenuIcon open={isMenuOpen} />
          <span className="visually-hidden">{isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
        </button>

        <div id="site-menu" className={`site-header__menu${isMenuOpen ? ' is-open' : ''}`}>
          <nav aria-label="Principal">
            <ul className="site-header__links">
              <li><a href="#destacados" onClick={(event) => selectOperation(event, 'sale')}>Comprar</a></li>
              <li><a href="#destacados" onClick={(event) => selectOperation(event, 'rent')}>Alquilar</a></li>
              <li><a href="#tipos" onClick={() => setIsMenuOpen(false)}>Tipos de espacio</a></li>
            </ul>
          </nav>
          <div className="site-header__actions">
            <button className="button button--ghost" type="button" onClick={() => comingSoon('Iniciar sesión')}>
              Iniciar sesión
            </button>
            <button className="button button--accent" type="button" onClick={() => comingSoon('Publicar anuncios')}>
              Publica tu anuncio
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
