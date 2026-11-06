import RegisterForm from './RegisterForm';

type RegisterPageProps = {
  onNavigate?: (path: string) => void;
};

function RegisterPage({ onNavigate = (path) => window.location.assign(path) }: RegisterPageProps) {
  return (
    <main className="register-page">
      <a className="register-page__back" href="/">
        Volver al catálogo
      </a>
      <section className="register-card" aria-labelledby="register-title">
        <p className="eyebrow">HOGARES EN BARCELONA</p>
        <h1 id="register-title">Crear cuenta</h1>
        <p className="register-card__intro">Regístrate para guardar tus inmuebles favoritos.</p>
        <RegisterForm onSuccess={() => onNavigate('/')} />
      </section>
    </main>
  );
}

export default RegisterPage;
