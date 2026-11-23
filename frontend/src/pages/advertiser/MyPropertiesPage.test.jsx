import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext.tsx';
import MyPropertiesPage from './MyPropertiesPage.tsx';

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const listing = (overrides = {}) => ({
  id: 1,
  title: 'Piso en venta',
  location: 'Gràcia, Barcelona',
  price: 300000,
  previous_price: null,
  bedrooms: 2,
  bathrooms: 1,
  area: 80,
  image_url: null,
  is_active: true,
  ...overrides,
});

function fakeApi({ items = [listing()], failStatus = false, failDelete = false } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body });
    if (url === '/api/auth/me') return json({ id: 1, email: 'owner@example.com' });
    if (url === '/api/v1/properties/mine') return json({ items });
    if (url.endsWith('/status')) {
      return failStatus ? json({}, 500) : json({ ...items[0], ...JSON.parse(init.body) });
    }
    if (method === 'PATCH') return json({ ...items[0], ...JSON.parse(init.body) });
    if (method === 'DELETE') return failDelete ? json({}, 500) : { ok: true, status: 204 };
    if (url.endsWith('/images')) return json([]);
    return json({}, 404);
  }));
  return calls;
}

function renderPage(authenticated = true) {
  if (authenticated) localStorage.setItem('access_token', 'token');
  return render(<AuthProvider><MyPropertiesPage /></AuthProvider>);
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('MyPropertiesPage', () => {
  it('asks to log in without a session', () => {
    fakeApi();
    renderPage(false);

    expect(screen.getByText('Inicia sesión para gestionar tus anuncios.')).toBeInTheDocument();
  });

  it('lists own listings with their status badge', async () => {
    fakeApi({ items: [listing(), listing({ id: 2, title: 'Local retirado', is_active: false })] });
    renderPage();

    const list = await screen.findByRole('list', { name: 'Mis anuncios' });
    const items = within(list).getAllByRole('listitem');
    expect(within(items[0]).getByText('Activo')).toBeInTheDocument();
    expect(within(items[1]).getByText('Desactivado')).toBeInTheDocument();
    expect(within(items[1]).getByRole('switch')).not.toBeChecked();
  });

  it('shows an empty state', async () => {
    fakeApi({ items: [] });
    renderPage();

    expect(await screen.findByText('Todavía no has publicado ningún anuncio.')).toBeInTheDocument();
  });

  it('deactivates a listing optimistically and confirms it with a toast', async () => {
    const calls = fakeApi();
    renderPage();

    fireEvent.click(await screen.findByRole('switch', { name: 'Anuncio Piso en venta activo' }));

    expect(screen.getByText('Desactivado')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Anuncio desactivado');
    const request = calls.find(({ url }) => url === '/api/v1/properties/1/status');
    expect(JSON.parse(request.body)).toEqual({ is_active: false });
  });

  it('rolls the switch back when the API fails', async () => {
    fakeApi({ failStatus: true });
    renderPage();

    fireEvent.click(await screen.findByRole('switch'));

    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo cambiar');
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('asks for confirmation before deleting', async () => {
    const calls = fakeApi();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Esta acción no se puede deshacer');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some(({ method }) => method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(screen.queryByText('Piso en venta')).not.toBeInTheDocument());
    expect(calls).toContainEqual(expect.objectContaining({ url: '/api/v1/properties/1', method: 'DELETE' }));
  });

  it('edits a listing in the modal and shows the saved values', async () => {
    const calls = fakeApi();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar anuncio' });
    fireEvent.change(within(dialog).getByLabelText('Precio (€)'), { target: { value: '280000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('280.000 € · 80 m²')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const request = calls.find(({ method }) => method === 'PATCH');
    expect(JSON.parse(request.body)).toMatchObject({ price: 280000, title: 'Piso en venta' });
  });
});
