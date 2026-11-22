import { useAuth } from '../context/AuthContext';

/** Menú de usuario de la cabecera: acceso a login/registro o acciones de la cuenta. */
function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <nav className="user-menu" aria-label="Cuenta">
        <a className="user-menu__link" href="/login">Iniciar sesión</a>
        <a className="user-menu__link user-menu__link--primary" href="/register">Crear cuenta</a>
      </nav>
    );
  }

  return (
    <nav className="user-menu" aria-label="Cuenta">
      <details className="user-menu__profile">
        <summary className="user-menu__summary">
          <span className="user-menu__avatar" aria-hidden="true">
            {(user?.full_name || user?.email || 'M').charAt(0).toUpperCase()}
          </span>
          <span className="user-menu__name">
            {user?.full_name || user?.email || 'Mi cuenta'}
          </span>
          <span className="user-menu__chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="user-menu__dropdown">
          <a className="user-menu__dropdown-link" href="/publicar">Publicar anuncio</a>
          <a className="user-menu__dropdown-link" href="/mis-anuncios">Mis anuncios</a>
          <button className="user-menu__logout" type="button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </details>
    </nav>
  );
}

export default UserMenu;
