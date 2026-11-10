import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useProperties from '../components/catalog/useProperties.js';
import { AuthProvider } from './context/AuthContext.tsx';
import App from './App.jsx';

vi.mock('../components/catalog/useProperties.js', () => ({
  default: vi.fn(),
}));

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('initial screen', () => {
  afterEach(() => localStorage.removeItem('access_token'));

  it('shows the landing page sections without a search form', () => {
    localStorage.removeItem('access_token');
    useProperties.mockReturnValue({
      properties: [{
        id: 'test-home',
        title: 'Piso de prueba',
        location: 'Barcelona',
        price: 300000,
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        images: [],
      }],
      isLoading: false,
    });
    renderApp();

    expect(screen.getByRole('heading', {
      name: 'Encuentra el espacio donde empieza tu próximo capítulo',
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anuncios destacados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explora por tipo de espacio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cómo funciona' })).toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.getByText('Piso de prueba')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Crear cuenta' })).toHaveLength(2);
    expect(screen.queryByRole('img', { name: 'Sesión iniciada' })).not.toBeInTheDocument();
  });

  it('replaces the create-account link with a user icon when signed in', () => {
    localStorage.setItem('access_token', 'test-token');
    useProperties.mockReturnValue({ properties: [], isLoading: false });

    renderApp();

    expect(screen.getByRole('img', { name: 'Sesión iniciada' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument();
    localStorage.removeItem('access_token');
  });

  it('shows loading skeletons while properties are loading', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: true });
    const { container } = renderApp();

    expect(container.querySelectorAll('.property-card--skeleton')).toHaveLength(3);
  });

  it('opens the global auth modal and persists the favorite requested while signed out', () => {
    sessionStorage.clear();
    useProperties.mockReturnValue({
      properties: [{
        id: 'test-home',
        title: 'Piso de prueba',
        location: 'Barcelona',
        price: 300000,
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        images: [],
      }],
      isLoading: false,
    });
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));

    expect(JSON.parse(sessionStorage.getItem('pendingFavorite'))).toEqual({
      pendingFavoriteId: 'test-home',
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('Inicia sesión para guardar favoritos');
  });

  it('shows the login page on /login', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: false });
    window.history.pushState(null, '', '/login');
    renderApp();

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    window.history.pushState(null, '', '/');
  });

  it('shows the account menu in the header', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: false });
    renderApp();

    expect(screen.getByRole('navigation', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('shows the location search in the featured listings (US 1.3.2)', () => {
    useProperties.mockReturnValue({ properties: [], isLoading: false });
    renderApp();

    expect(screen.getByRole('combobox', { name: 'Buscar por ubicación' })).toBeInTheDocument();
    // Sin ubicación elegida, el catálogo se pide sin filtro.
    expect(useProperties).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('heading', { name: 'Aún no hay anuncios disponibles' })).toBeInTheDocument();
  });
});
