import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '../utils/api';
import { getStoredValue, removeStoredValue, setStoredValue } from '../utils/storage';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = 'img_auth_token';
const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === '1'
  || import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';
const DEV_TOKEN = 'dev-local';

const getStoredToken = (): string | null => {
  return getStoredValue(AUTH_KEY);
};

const setStoredToken = (token: string) => {
  setStoredValue(AUTH_KEY, token);
};

const clearStoredToken = () => {
  removeStoredValue(AUTH_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      if (!getStoredToken()) setStoredToken(DEV_TOKEN);
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }
    const token = getStoredToken();
    if (token) {
      verifyToken(token).then(valid => {
        setIsAuthenticated(valid);
        if (!valid) clearStoredToken();
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (password: string): Promise<boolean> => {
    if (DEV_BYPASS_AUTH) {
      setStoredToken(DEV_TOKEN);
      setIsAuthenticated(true);
      return true;
    }
    try {
      const data = await apiRequest<{ token?: string }>('/api/auth', {
        method: 'POST',
        body: { password },
        auth: false,
      });

      const token = data.token;
      if (typeof token === 'string' && token.length > 0) {
        setStoredToken(token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearStoredToken();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    await apiRequest('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
      auth: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function getAuthToken(): string | null {
  if (DEV_BYPASS_AUTH) return getStoredToken() || DEV_TOKEN;
  return getStoredToken();
}
