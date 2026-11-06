import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type AuthUser = {
  id: number;
  email: string;
  full_name: string | null;
};

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState(
    () => window.localStorage.getItem('access_token') || null,
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  const setSession = (token: string, authenticatedUser: AuthUser) => {
    window.localStorage.setItem('access_token', token);
    setAccessToken(token);
    setUser(authenticatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        isAuthenticated: accessToken !== null,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}
