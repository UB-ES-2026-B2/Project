import { useState } from 'react';
import type { FormEvent } from 'react';
import { InvalidCredentialsError, useAuth } from '../../context/AuthContext';

type LoginFormProps = {
  onSuccess?: () => void;
};

type FormErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Introduce un correo electrónico válido.';
  if (!password) errors.password = 'Introduce tu contraseña.';
  return errors;
}

function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const errors = validate(email, password);
  const emailError = submitted ? errors.email : undefined;
  const passwordError = submitted ? errors.password : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitted(true);
    setServerError('');
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      onSuccess?.();
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        // Se vacía la contraseña para reintentar; sin marcar el campo como error de validación.
        setPassword('');
        setSubmitted(false);
      }
      setServerError(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="register-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="login-email">Correo electrónico</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        aria-required="true"
        aria-invalid={Boolean(emailError)}
        aria-describedby={emailError ? 'login-email-error' : undefined}
        onChange={(event) => setEmail(event.target.value)}
      />
      {emailError && <p id="login-email-error" className="register-form__error">{emailError}</p>}

      <label htmlFor="login-password">Contraseña</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        aria-required="true"
        aria-invalid={Boolean(passwordError)}
        aria-describedby={passwordError ? 'login-password-error' : undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      {passwordError && (
        <p id="login-password-error" className="register-form__error">{passwordError}</p>
      )}

      {serverError && (
        <p className="register-form__server-error" role="alert">
          {serverError}
        </p>
      )}

      <button className="register-form__submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}

export default LoginForm;
