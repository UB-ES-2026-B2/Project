import LoginForm from './LoginForm';

type LoginPageProps = {
  onNavigate?: (path: string) => void;
};

function LoginPage({ onNavigate = (path) => window.location.assign(path) }: LoginPageProps) {
  const returnTo = new URLSearchParams(window.location.search).get('returnTo');
  const destination = returnTo?.startsWith('/') ? returnTo : '/';

  return (
    <main className="register-page">
      <a className="register-page__back" href="/">
        Volver al catálogo
      </a>
      <section className="register-card" aria-labelledby="login-title">
        <p className="eyebrow">HOGARES EN BARCELONA</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <p className="register-card__intro">Entra para guardar tus inmuebles favoritos.</p>
        <LoginForm onSuccess={() => onNavigate(destination)} />
        <p className="register-card__switch">
          ¿No tienes cuenta? <a href="/register">Crear una cuenta</a>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
