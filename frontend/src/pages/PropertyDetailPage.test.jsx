import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import PropertyDetailPage from './PropertyDetailPage';

function renderPage(propertyId = '42') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PropertyDetailPage propertyId={propertyId} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('PropertyDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads the detail through a relative API URL and opens/closes the gallery', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 42,
        title: 'Ático soleado',
        location: 'Gràcia, Barcelona',
        price: 350000,
        area: 90,
        bedrooms: 3,
        bathrooms: 2,
        description: 'Luminoso y exterior.',
        images: ['/one.webp', '/two.webp'],
        is_active: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Ático soleado' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/properties/42');
    expect(screen.getByText('350.000 €')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir foto 1' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(within(dialog).getByAltText('Ático soleado - foto 2')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a personalized 404 page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Not found' }),
    }));

    renderPage('999');

    expect(await screen.findByRole('heading', { name: 'Inmueble no encontrado' })).toBeInTheDocument();
  });

  it('hides the sidebar and contact form for inactive properties', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 43,
        title: 'Anuncio retirado',
        location: 'Barcelona',
        price: 200000,
        area: 70,
        images: ['/one.webp'],
        is_active: false,
      }),
    }));

    renderPage('43');

    expect(await screen.findByText(
      'Este anuncio ha sido retirado o ya no está disponible',
    )).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contacta con el anunciante' })).not.toBeInTheDocument();
  });
});
