import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext.tsx';
import UserMenu from '../../components/UserMenu.tsx';
import LoginForm from './LoginForm.tsx';
import LoginPage from './LoginPage.tsx';

const USER = { id: 7, email: 'persona@example.com', full_name: null };

function AuthStatus() {
  const { isAuthenticated, user } = useAuth();
  return <p>{isAuthenticated ? `Sesión de ${user?.email}` : 'Sesión cerrada'}</p>;
}

function renderForm(onSuccess = vi.fn()) {
  render(
    <AuthProvider>
      <LoginForm onSuccess={onSuccess} />
      <AuthStatus />
    </AuthProvider>,
  );
  return { onSuccess };
}

function fill(email, password) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LoginForm', () => {
  it('validates the fields before calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderForm();

    submit();

    expect(screen.getByText('Introduce un correo electrónico válido.')).toBeInTheDocument();
    expect(screen.getByText('Introduce tu contraseña.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in, stores the session and calls onSuccess', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ access_token: 'login-token', user: USER }),
    })));
    const { onSuccess } = renderForm();
    fill('  persona@example.com ', 'contraseña-segura');

    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(screen.getByText('Sesión de persona@example.com')).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBe('login-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body).email).toBe('persona@example.com');
  });

  it('shows a clear message and empties the password on wrong credentials (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    const { onSuccess } = renderForm();
    fill('persona@example.com', 'contraseña-mala');

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo electrónico o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.queryByText('Introduce tu contraseña.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('persona@example.com');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows a generic error when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    renderForm();
    fill('persona@example.com', 'contraseña');

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión. Inténtalo de nuevo.');
  });

  it('disables the button while the request is in flight', async () => {
    let resolveResponse;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveResponse = resolve; })));
    renderForm();
    fill('persona@example.com', 'contraseña');

    submit();

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
    resolveResponse({ ok: true, status: 200, json: async () => ({ access_token: 't', user: USER }) });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled());
  });
});

describe('LoginPage', () => {
  it('shows the login page, links to registration and goes home after logging in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ access_token: 'login-token', user: USER }),
    })));
    const onNavigate = vi.fn();
    render(<AuthProvider><LoginPage onNavigate={onNavigate} /></AuthProvider>);

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear una cuenta' })).toHaveAttribute('href', '/register');
    fill('persona@example.com', 'contraseña-segura');
    submit();

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/'));
  });
});

describe('UserMenu', () => {
  it('offers login and registration when signed out', () => {
    render(<AuthProvider><UserMenu /></AuthProvider>);

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('shows the user and logs out from the menu', async () => {
    localStorage.setItem('access_token', 'saved-token');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => USER })));
    const navigate = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider navigate={navigate}><UserMenu /></AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('persona@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
