import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

type ProtectedRouteProps = {
  children: ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [isAuthenticated]);

  return isAuthenticated ? children : null;
}

export default ProtectedRoute;
