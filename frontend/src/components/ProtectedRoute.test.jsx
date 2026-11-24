import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

function renderWithAuth(children, { isAuthenticated = false } = {}) {
  if (isAuthenticated) {
    localStorage.setItem('access_token', 'fake-token');
  } else {
    localStorage.removeItem('access_token');
  }

  return render(
    <AuthProvider>
      <ProtectedRoute>{children}</ProtectedRoute>
    </AuthProvider>,
  );
}

describe('ProtectedRoute', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    delete window.location;
    window.location = {
      pathname: '/favoritos',
      search: '',
      replace: vi.fn(),
    };
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('renders children when user is authenticated', () => {
    renderWithAuth(<div>Contenido Protegido</div>, { isAuthenticated: true });

    expect(screen.getByText('Contenido Protegido')).toBeInTheDocument();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('redirects to /login with returnTo parameter when user is not authenticated', () => {
    renderWithAuth(<div>Contenido Protegido</div>, { isAuthenticated: false });

    expect(screen.queryByText('Contenido Protegido')).not.toBeInTheDocument();
    expect(window.location.replace).toHaveBeenCalledWith('/login?returnTo=%2Ffavoritos');
  });
});
