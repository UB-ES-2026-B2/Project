import { useAuth } from '../context/AuthContext';

/** Menú de usuario de la cabecera: acceso a login/registro o, con sesión, cerrar sesión. */
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
      <span className="user-menu__name">{user?.full_name || user?.email || 'Mi cuenta'}</span>
      <button className="user-menu__logout" type="button" onClick={logout}>
        Cerrar sesión
      </button>
    </nav>
  );
}

export default UserMenu;
