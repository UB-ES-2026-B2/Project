import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext.tsx';
import RegisterForm from './RegisterForm.tsx';
import RegisterPage from './RegisterPage.tsx';

function AuthStatus() {
  const { isAuthenticated, user } = useAuth();
  return <p>{isAuthenticated ? `Sesión de ${user?.email}` : 'Sesión cerrada'}</p>;
}

function renderForm(onSuccess = vi.fn()) {
  localStorage.clear();
  return {
    onSuccess,
    ...render(
      <AuthProvider>
        <RegisterForm onSuccess={onSuccess} />
        <AuthStatus />
      </AuthProvider>,
    ),
  };
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'persona@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'contraseña-segura' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto los' }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegisterForm', () => {
  it('opens a message explaining terms are not published yet', () => {
    renderForm();

    fireEvent.click(screen.getByRole('link', { name: 'términos y condiciones' }));

    expect(screen.getByRole('dialog', { name: 'Términos y condiciones' })).toHaveTextContent(
      'Aún no hay términos y condiciones publicados.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prevents registration when the password has fewer than 8 characters', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderForm();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'persona@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'corta12' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto los' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the returned token, updates auth state, and completes registration', async () => {
    const onSuccess = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        access_token: 'registered-token',
        user: { id: 7, email: 'persona@example.com', full_name: null },
      }),
    });
    renderForm(onSuccess);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('registered-token');
      expect(screen.getByText('Sesión de persona@example.com')).toBeInTheDocument();
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('disables the submit button and shows a loading state while registering', async () => {
    let resolveResponse;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((resolve) => { resolveResponse = resolve; }),
    );
    renderForm();
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
    resolveResponse({
      ok: true,
      status: 201,
      json: async () => ({
        access_token: 'registered-token',
        user: { id: 7, email: 'persona@example.com', full_name: null },
      }),
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
    });
  });

  it('shows the registration page and redirects home after success', async () => {
    const onNavigate = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        access_token: 'registered-token',
        user: { id: 7, email: 'persona@example.com', full_name: null },
      }),
    });
    localStorage.clear();
    render(
      <AuthProvider>
        <RegisterPage onNavigate={onNavigate} />
      </AuthProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/'));
  });

  it('shows the contextual message when the email is already registered', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 409 });
    renderForm();
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este correo electrónico ya está registrado. ¿Deseas iniciar sesión?',
    );
    expect(screen.getByRole('link', { name: 'iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
