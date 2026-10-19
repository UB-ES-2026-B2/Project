import { BRAND_NAME } from './brand.js';

function SiteFooter({ onSelectOperation }) {
  const selectOperation = (event, operation) => {
    event.preventDefault();
    onSelectOperation(operation);
  };

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <p className="site-footer__name">{BRAND_NAME}</p>
          <p className="site-footer__tagline">Compra y alquiler de pisos, casas, locales, oficinas, garajes y trasteros.</p>
        </div>

        <nav aria-label="Pie de página">
          <ul className="site-footer__links">
            <li><a href="#destacados" onClick={(event) => selectOperation(event, 'sale')}>Comprar</a></li>
            <li><a href="#destacados" onClick={(event) => selectOperation(event, 'rent')}>Alquilar</a></li>
            <li><a href="#tipos">Tipos de espacio</a></li>
            <li><a href="#como-funciona">Cómo funciona</a></li>
            <li><a href="#/catalogo">Catálogo completo</a></li>
          </ul>
        </nav>
      </div>

      <div className="site-footer__legal">
        <p>Proyecto académico · Ingeniería del Software · Universitat de Barcelona · Grupo B2</p>
        <p>© {new Date().getFullYear()} {BRAND_NAME}. Los anuncios son datos de ejemplo.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
