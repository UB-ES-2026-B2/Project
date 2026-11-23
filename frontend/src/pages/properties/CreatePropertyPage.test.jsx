import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext.tsx';
import CreatePropertyPage from './CreatePropertyPage.tsx';

function renderPage(authenticated = false) {
  if (authenticated) localStorage.setItem('access_token', 'test-token');
  return render(
    <AuthProvider>
      <CreatePropertyPage />
    </AuthProvider>,
  );
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Operación'), { target: { value: 'venta' } });
  fireEvent.change(screen.getByLabelText('Tipo de espacio'), { target: { value: 'piso' } });
  fireEvent.change(screen.getByLabelText('Precio (€)'), { target: { value: '250000' } });
  fireEvent.change(screen.getByLabelText('Superficie (m²)'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Dirección'), {
    target: { value: 'Carrer de Mallorca 10' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Buscar por ubicación' }), {
    target: { value: 'Barcelona' },
  });
  fireEvent.click(await screen.findByRole('option', { name: /Barcelona/ }));
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Piso luminoso y reformado.' } });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).startsWith('/api/v1/locations/suggest')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: '12', name: 'Barcelona', type: 'city' }],
      };
    }
    if (url === '/api/auth/me') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 1, email: 'owner@example.com', full_name: 'Propietario' }),
      };
    }
    return { ok: true, status: 201 };
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('CreatePropertyPage', () => {
  it('requires an authenticated user to publish', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Inicia sesión para publicar' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: expect.stringMatching(/\/login$/) }),
      ]),
    );
  });

  it('blocks invalid prices and updates validation as the form changes', () => {
    renderPage(true);

    const submit = screen.getByRole('button', { name: 'Publicar anuncio' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Precio (€)'), { target: { value: '-1' } });
    expect(screen.getByText('Introduce un precio mayor que cero.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Precio (€)'), { target: { value: '250000' } });
    expect(screen.queryByText('Introduce un precio mayor que cero.')).not.toBeInTheDocument();
  });

  it('previews the local form data with the shared property card', async () => {
    renderPage(true);
    await fillValidForm();

    fireEvent.click(screen.getByRole('tab', { name: 'Modo Vista Previa' }));

    expect(screen.getByRole('heading', { name: 'Piso en venta' })).toBeInTheDocument();
    expect(screen.getByText('250.000 €')).toBeInTheDocument();
    expect(screen.getByText('Piso luminoso y reformado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Añadir a favoritos' })).not.toBeInTheDocument();
  });

  it('posts the valid form through the authenticated API client using the backend contract', async () => {
    renderPage(true);
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tu anuncio se ha publicado correctamente.',
    );
    await waitFor(() => {
      const request = fetch.mock.calls.find(([url]) => url === '/api/v1/properties');
      expect(request).toBeDefined();
      expect(request[1].method).toBe('POST');
      expect(request[1].headers.get('Authorization')).toBe('Bearer test-token');
      expect(JSON.parse(request[1].body)).toEqual({
        title: 'Piso en venta',
        location_id: 12,
        operation_type: 'sale',
        property_type: 'flat',
        description: 'Piso luminoso y reformado.',
        address: 'Carrer de Mallorca 10',
        price: 250000,
        bedrooms: 0,
        bathrooms: 0,
        area: 80,
        image_url: null,
      });
    });
  });

  it('offers the photo manager for the new listing once it is published', async () => {
    fetch.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/v1/locations/suggest')) {
        return { ok: true, status: 200, json: async () => [{ id: '12', name: 'Barcelona', type: 'city' }] };
      }
      if (url === '/api/auth/me') {
        return { ok: true, status: 200, json: async () => ({ id: 1, email: 'owner@example.com' }) };
      }
      if (url === '/api/v1/properties/55/images') return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 201, json: async () => ({ id: 55 }) };
    });
    renderPage(true);
    await fillValidForm();
    expect(screen.queryByRole('heading', { name: 'Fotos del anuncio' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(await screen.findByRole('heading', { name: 'Fotos del anuncio' })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/properties/55/images'));
  });
});
