import { useAuth } from '../../src/context/AuthContext.tsx';

const FOOTER_LINKS = [
  { href: '#destacados', label: 'Anuncios' },
  { href: '#tipos', label: 'Tipos de espacio' },
  { href: '#como-funciona', label: 'Cómo funciona' },
];

function SiteFooter() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <a className="site-footer__name" href="#inicio">Llar</a>
          <p className="site-footer__tagline">
            Un lugar para vivir, trabajar y hacer realidad tus ideas.
          </p>
        </div>
        <nav aria-label="Pie de página">
          <ul className="site-footer__links">
            {FOOTER_LINKS.map(({ href, label }) => (
              <li key={href}><a href={href}>{label}</a></li>
            ))}
            {!isAuthenticated && <li><a href="/register">Crear cuenta</a></li>}
          </ul>
        </nav>
      </div>
      <div className="site-footer__legal">
        <p>Proyecto académico · Ingeniería del Software · Universitat de Barcelona · Grupo B2</p>
        <p>© {new Date().getFullYear()} Llar. Anuncios de ejemplo.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
