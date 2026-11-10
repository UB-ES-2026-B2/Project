import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth, type AuthUser } from '../../context/AuthContext';

type RegisterFormProps = {
  onSuccess?: () => void;
};

type FormValues = {
  email: string;
  password: string;
  termsAccepted: boolean;
};

type FormErrors = {
  email?: string;
  password?: string;
  termsAccepted?: string;
};

type RegisterResponse = {
  access_token: string;
  user: AuthUser;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_VALUES: FormValues = { email: '', password: '', termsAccepted: false };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Introduce un correo electrónico válido.';
  }
  if (values.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!values.termsAccepted) {
    errors.termsAccepted = 'Debes aceptar los términos y condiciones.';
  }
  return errors;
}

function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { setSession } = useAuth();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isEmailAlreadyRegistered, setIsEmailAlreadyRegistered] = useState(false);
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const errors = validate(values);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitted(true);
    setServerError('');
    setIsEmailAlreadyRegistered(false);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });

      if (response.status === 409) {
        setIsEmailAlreadyRegistered(true);
        return;
      }
      if (!response.ok) {
        throw new Error('No se pudo crear la cuenta. Inténtalo de nuevo.');
      }

      const result: unknown = await response.json();
      if (!isRegisterResponse(result)) {
        throw new Error('La respuesta del servidor no contiene los datos de sesión esperados.');
      }

      setSession(result.access_token, result.user);
      onSuccess?.();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'No se pudo crear la cuenta. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailError = (submitted || touched.email) ? errors.email : undefined;
  const passwordError = (submitted || touched.password) ? errors.password : undefined;
  const termsError = submitted ? errors.termsAccepted : undefined;

  return (
    <form className="register-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="register-email">Correo electrónico</label>
      <input
        id="register-email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        aria-required="true"
        aria-invalid={Boolean(emailError)}
        aria-describedby={emailError ? 'register-email-error' : undefined}
        onChange={(event) => {
          setValues({ ...values, email: event.target.value });
          setTouched({ ...touched, email: true });
        }}
        onBlur={() => setTouched({ ...touched, email: true })}
      />
      {emailError && <p id="register-email-error" className="register-form__error">{emailError}</p>}

      <label htmlFor="register-password">Contraseña</label>
      <input
        id="register-password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        aria-required="true"
        aria-invalid={Boolean(passwordError)}
        aria-describedby={passwordError ? 'register-password-error' : undefined}
        onChange={(event) => {
          setValues({ ...values, password: event.target.value });
          setTouched({ ...touched, password: true });
        }}
        onBlur={() => setTouched({ ...touched, password: true })}
      />
      {passwordError && <p id="register-password-error" className="register-form__error">{passwordError}</p>}

      <div className="register-form__terms">
        <label htmlFor="register-terms">
          <input
            id="register-terms"
            name="termsAccepted"
            type="checkbox"
            checked={values.termsAccepted}
            aria-invalid={Boolean(termsError)}
            onChange={(event) => setValues({ ...values, termsAccepted: event.target.checked })}
          />
          <span>Acepto los</span>
        </label>
        <a
          href="#terms-and-conditions"
          onClick={(event) => {
            event.preventDefault();
            setIsTermsDialogOpen(true);
          }}
        >
          términos y condiciones
        </a>
      </div>
      {termsError && <p className="register-form__error">{termsError}</p>}

      {isTermsDialogOpen && (
        <div className="register-terms-backdrop">
          <section
            id="terms-and-conditions"
            className="register-terms-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-terms-title"
          >
            <h2 id="register-terms-title">Términos y condiciones</h2>
            <p>Aún no hay términos y condiciones publicados.</p>
            <button type="button" onClick={() => setIsTermsDialogOpen(false)}>
              Cerrar
            </button>
          </section>
        </div>
      )}

      {(serverError || isEmailAlreadyRegistered) && (
        <p className="register-form__server-error" role="alert">
          {isEmailAlreadyRegistered ? (
            <>
              Este correo electrónico ya está registrado. ¿Deseas{' '}
              <a href="/login">iniciar sesión</a>?
            </>
          ) : serverError}
        </p>
      )}

      <button className="register-form__submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function isRegisterResponse(value: unknown): value is RegisterResponse {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (typeof result.access_token !== 'string' || !result.access_token) return false;
  if (typeof result.user !== 'object' || result.user === null) return false;
  const user = result.user as Record<string, unknown>;
  return typeof user.id === 'number'
    && typeof user.email === 'string'
    && (user.full_name === null || typeof user.full_name === 'string');
}

export default RegisterForm;
