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

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Operación'), { target: { value: 'venta' } });
  fireEvent.change(screen.getByLabelText('Tipo de espacio'), { target: { value: 'piso' } });
  fireEvent.change(screen.getByLabelText('Precio (€)'), { target: { value: '250000' } });
  fireEvent.change(screen.getByLabelText('Superficie (m²)'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Carrer de Mallorca 10, Barcelona' } });
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Piso luminoso y reformado.' } });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
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

  it('previews the local form data with the shared property card', () => {
    renderPage(true);
    fillValidForm();

    fireEvent.click(screen.getByRole('tab', { name: 'Modo Vista Previa' }));

    expect(screen.getByRole('heading', { name: 'Piso en venta' })).toBeInTheDocument();
    expect(screen.getByText('250.000 €')).toBeInTheDocument();
    expect(screen.getByText('Piso luminoso y reformado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Añadir a favoritos' })).not.toBeInTheDocument();
  });

  it('posts the valid form through the authenticated API client', async () => {
    renderPage(true);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tu anuncio se ha publicado correctamente.',
    );
    await waitFor(() => {
      const request = fetch.mock.calls.find(([url]) => url === '/api/properties');
      expect(request).toBeDefined();
      expect(request[1].method).toBe('POST');
      expect(request[1].headers.get('Authorization')).toBe('Bearer test-token');
      expect(JSON.parse(request[1].body)).toEqual({
        operation: 'venta',
        space_type: 'piso',
        price: 250000,
        surface_m2: 80,
        address: 'Carrer de Mallorca 10, Barcelona',
        description: 'Piso luminoso y reformado.',
      });
    });
  });
});
