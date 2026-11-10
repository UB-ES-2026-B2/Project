import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, InvalidCredentialsError, useAuth } from './AuthContext.tsx';

const USER = { id: 7, email: 'persona@example.com', full_name: 'Persona de prueba' };

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function renderAuth({ navigate = vi.fn(), queryClient = new QueryClient() } = {}) {
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider navigate={navigate}>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { navigate, queryClient, ...renderHook(() => useAuth(), { wrapper }) };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AuthContext · persistencia de la sesión', () => {
  it('stores the session in localStorage and exposes it in the context', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderAuth();

    act(() => result.current.setSession('token-123', USER));

    expect(localStorage.getItem('access_token')).toBe('token-123');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe('token-123');
    expect(result.current.user).toEqual(USER);
  });

  it('restores the token after a reload and loads the profile from /api/auth/me', async () => {
    localStorage.setItem('access_token', 'saved-token');
    const fetchMock = vi.fn(async () => jsonResponse(USER));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderAuth();

    expect(result.current.isAuthenticated).toBe(true);
    await waitFor(() => expect(result.current.user).toEqual(USER));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init.headers.get('Authorization')).toBe('Bearer saved-token');
  });

  it('closes the session when /api/auth/me says the saved token is no longer valid', async () => {
    localStorage.setItem('access_token', 'expired-token');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Unauthorized' }, 401)));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('keeps the token if the profile request fails for network reasons', async () => {
    localStorage.setItem('access_token', 'saved-token');
    const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderAuth();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeNull();
  });
});

describe('AuthContext · logout', () => {
  it('purges the token, resets the React Query cache and goes back to the main view', () => {
    vi.stubGlobal('fetch', vi.fn());
    const queryClient = new QueryClient();
    queryClient.setQueryData(['properties'], [{ id: 'home', isFavorite: true }]);
    const clearSpy = vi.spyOn(queryClient, 'clear');
    const { result, navigate } = renderAuth({ queryClient });
    act(() => result.current.setSession('token-123', USER));
    sessionStorage.setItem('pendingFavorite', JSON.stringify({ pendingFavoriteId: 'home' }));

    act(() => result.current.logout());

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('pendingFavorite')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['properties'])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('closes the session when any authenticated request returns 401', async () => {
    const { result } = renderAuth();
    act(() => result.current.setSession('token-123', USER));

    act(() => window.dispatchEvent(new Event('auth:unauthorized')));

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('AuthContext · login', () => {
  it('sends the credentials as JSON and stores the returned session', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'login-token', token_type: 'bearer', user: USER }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderAuth();

    let user;
    await act(async () => { user = await result.current.login('persona@example.com', 'contraseña-segura'); });

    expect(user).toEqual(USER);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'persona@example.com', password: 'contraseña-segura' }),
    });
    expect(localStorage.getItem('access_token')).toBe('login-token');
    expect(result.current.user).toEqual(USER);
  });

  it('accepts users whose id is a UUID string', async () => {
    const uuidUser = { id: 'c0a8012e-7d1b-4c6a-9d0e-0a1b2c3d4e5f', email: 'a@b.com', full_name: null };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ access_token: 't', user: uuidUser })));
    const { result } = renderAuth();

    await act(async () => { await result.current.login('a@b.com', 'contraseña'); });

    expect(result.current.user).toEqual(uuidUser);
  });

  it('throws InvalidCredentialsError on 401 and does not create a session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Incorrect' }, 401)));
    const { result } = renderAuth();

    await act(async () => {
      await expect(result.current.login('persona@example.com', 'mala')).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('throws a generic error when the server fails or returns an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ token: 'sin access_token' })));
    const { result } = renderAuth();

    await act(async () => {
      await expect(result.current.login('a@b.com', 'x')).rejects.toThrow('No se pudo iniciar sesión');
      await expect(result.current.login('a@b.com', 'x')).rejects.toThrow('datos de sesión esperados');
    });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('runs the favorite queued before login once, with the new token, and refreshes the catalog', async () => {
    sessionStorage.setItem('pendingFavorite', JSON.stringify({ pendingFavoriteId: 'piso 1' }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'login-token', user: USER }))
      .mockResolvedValueOnce(jsonResponse({}, 204));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderAuth({ queryClient });

    await act(async () => { await result.current.login('persona@example.com', 'contraseña-segura'); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/v1/favorites/piso%201');
    expect(init.method).toBe('POST');
    expect(init.headers.get('Authorization')).toBe('Bearer login-token');
    expect(sessionStorage.getItem('pendingFavorite')).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['properties'] });
  });

  it('ignores a malformed queued action without breaking the login', async () => {
    sessionStorage.setItem('pendingFavorite', '{no es json');
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'login-token', user: USER }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderAuth();

    await act(async () => { await result.current.login('persona@example.com', 'contraseña-segura'); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('pendingFavorite')).toBeNull();
  });
});

describe('useAuth', () => {
  it('fails with a clear message outside AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Consumer() {
      useAuth();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow('useAuth debe utilizarse dentro de AuthProvider');
  });

  it('works without React Query (the forms mount it alone)', () => {
    function Status() {
      const { isAuthenticated } = useAuth();
      return <p>{isAuthenticated ? 'con sesión' : 'sin sesión'}</p>;
    }
    render(<AuthProvider><Status /></AuthProvider>);
    expect(screen.getByText('sin sesión')).toBeInTheDocument();
  });
});
