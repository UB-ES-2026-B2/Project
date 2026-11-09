import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import {
  AUTH_UNAUTHORIZED_EVENT,
  TOKEN_STORAGE_KEY,
  apiFetch,
  getStoredToken,
} from '../api/client';

export const PENDING_FAVORITE_KEY = 'pendingFavorite';

export type AuthUser = {
  id: number | string;
  email: string;
  full_name: string | null;
};

type SessionResponse = {
  access_token: string;
  user: AuthUser;
};

/** Credenciales incorrectas (la API responde 401 en /api/auth/login). */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Correo electrónico o contraseña incorrectos.');
    this.name = 'InvalidCredentialsError';
  }
}

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

type AuthProviderProps = {
  children: ReactNode;
  /** Navegación tras el logout. Por defecto recarga la vista principal. */
  navigate?: (path: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function defaultNavigate(path: string) {
  window.location.assign(path);
}

export function AuthProvider({ children, navigate = defaultNavigate }: AuthProviderProps) {
  // Opcional: los tests de formularios montan el provider sin React Query.
  const queryClient = useContext(QueryClientContext);
  const [accessToken, setAccessToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
    queryClient?.clear();
  }, [queryClient]);

  const setSession = useCallback((token: string, authenticatedUser: AuthUser) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setAccessToken(token);
    setUser(authenticatedUser);
  }, []);

  // Al recargar la página con un token guardado, se recupera el perfil con /api/auth/me.
  useEffect(() => {
    if (!accessToken || user) return undefined;
    let cancelled = false;
    apiFetch('/api/auth/me')
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const data: unknown = await response.json();
        if (!cancelled && isAuthUser(data)) setUser(data);
      })
      .catch(() => {
        // Sin red: se mantiene el token y se reintenta en la próxima carga.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, user]);

  // Un 401 en cualquier llamada con token (token caducado) cierra la sesión.
  useEffect(() => {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.status === 401) throw new InvalidCredentialsError();
    if (!response.ok) throw new Error('No se pudo iniciar sesión. Inténtalo de nuevo.');

    const data: unknown = await response.json();
    if (!isSessionResponse(data)) {
      throw new Error('La respuesta del servidor no contiene los datos de sesión esperados.');
    }
    setSession(data.access_token, data.user);
    await runPendingFavorite(queryClient);
    return data.user;
  }, [queryClient, setSession]);

  const logout = useCallback(() => {
    clearSession();
    window.sessionStorage.removeItem(PENDING_FAVORITE_KEY);
    navigate('/');
  }, [clearSession, navigate]);

  const value = useMemo<AuthContextValue>(() => ({
    accessToken,
    user,
    isAuthenticated: accessToken !== null,
    setSession,
    login,
    logout,
  }), [accessToken, user, setSession, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}

/**
 * Si el usuario pulsó "favorito" sin sesión (US 1.2.2), FavoriteButton guardó la acción
 * en sessionStorage. Tras el login se ejecuta una sola vez y se refresca el catálogo.
 */
async function runPendingFavorite(queryClient: QueryClient | undefined) {
  const raw = window.sessionStorage.getItem(PENDING_FAVORITE_KEY);
  if (!raw) return;
  window.sessionStorage.removeItem(PENDING_FAVORITE_KEY);
  try {
    const { pendingFavoriteId } = JSON.parse(raw) as { pendingFavoriteId?: unknown };
    if (typeof pendingFavoriteId !== 'string' || !pendingFavoriteId) return;
    await apiFetch(`/api/v1/favorites/${encodeURIComponent(pendingFavoriteId)}`, {
      method: 'POST',
    });
    await queryClient?.invalidateQueries({ queryKey: ['properties'] });
    await queryClient?.invalidateQueries({ queryKey: ['favorites'] });
  } catch {
    // Si falla, el usuario puede volver a pulsar el corazón; no se bloquea el login.
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (typeof user.id === 'number' || typeof user.id === 'string')
    && typeof user.email === 'string'
    && (user.full_name === null || user.full_name === undefined || typeof user.full_name === 'string');
}

function isSessionResponse(value: unknown): value is SessionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return typeof result.access_token === 'string' && result.access_token !== ''
    && isAuthUser(result.user);
}
