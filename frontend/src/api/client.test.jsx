import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client.ts';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('passes the request through unchanged when there is no session', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/v1/properties', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/properties', { method: 'GET' });
  });

  it('adds Authorization: Bearer <token> and keeps the other headers', async () => {
    localStorage.setItem('access_token', 'abc');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/auth/me', { headers: { Accept: 'application/json' } });

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.get('Authorization')).toBe('Bearer abc');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('does not overwrite an explicit Authorization header', async () => {
    localStorage.setItem('access_token', 'abc');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/x', { headers: { Authorization: 'Bearer otro' } });

    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer otro');
  });

  it('announces a 401 with a token so the session can be closed', async () => {
    localStorage.setItem('access_token', 'expired');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    const response = await apiFetch('/api/auth/me');

    expect(response.status).toBe(401);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('auth:unauthorized', listener);
  });
});
