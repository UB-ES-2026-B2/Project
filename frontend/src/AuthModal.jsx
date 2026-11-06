function AuthModal({ onClose }) {
  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="auth-modal__close"
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="auth-modal-title">Inicia sesión para guardar favoritos</h2>
        <p>Puedes crear una cuenta para empezar a guardar tus inmuebles favoritos.</p>
        <a className="auth-modal__register" href="/register">Crear una cuenta</a>
        <button className="auth-modal__dismiss" type="button" onClick={onClose}>
          Entendido
        </button>
      </section>
    </div>
  );
}

export default AuthModal;
