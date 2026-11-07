import { useEffect, useState } from 'react';
import { useAuth } from '../../src/context/AuthContext.tsx';
import { MenuIcon, UserIcon } from './icons.jsx';

const LINKS = [
  { href: '#destacados', label: 'Anuncios' },
  { href: '#tipos', label: 'Tipos de espacio' },
  { href: '#como-funciona', label: 'Cómo funciona' },
];

function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#inicio" onClick={closeMenu}>
          <span className="site-header__logo" aria-hidden="true">L</span>
          Llar
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
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} onClick={closeMenu}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header__actions">
            {isAuthenticated ? (
              <span className="site-header__user-icon" role="img" aria-label="Sesión iniciada">
                <UserIcon />
              </span>
            ) : (
              <a className="button button--ghost" href="/register" onClick={closeMenu}>
                Crear cuenta
              </a>
            )}
            <a className="button button--accent" href="#destacados" onClick={closeMenu}>
              Explorar anuncios
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
