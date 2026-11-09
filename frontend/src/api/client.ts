export const TOKEN_STORAGE_KEY = 'access_token';
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * `fetch` con el "interceptor" de autenticación de la aplicación (US 4.2.2):
 * - si hay sesión, añade `Authorization: Bearer <token>` a la petición;
 * - si la API responde 401 con un token puesto (caducado o revocado), avisa al
 *   AuthContext con el evento `auth:unauthorized` para que cierre la sesión.
 * Todas las llamadas a la API que necesiten al usuario deben pasar por aquí.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  if (!token) return fetch(input, init);

  const headers = new Headers(init?.headers);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
  return response;
}
