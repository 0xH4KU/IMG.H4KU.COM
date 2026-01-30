import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

const getLocalStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getSessionStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  const local = getLocalStorage();
  const localToken = local?.getItem(AUTH_KEY);
  if (localToken) return localToken;
  const session = getSessionStorage();
  const sessionToken = session?.getItem(AUTH_KEY);
  if (sessionToken && local) {
    local.setItem(AUTH_KEY, sessionToken);
    session?.removeItem(AUTH_KEY);
  }
  return sessionToken || null;
};

const setStoredToken = (token: string) => {
  const local = getLocalStorage();
  if (local) {
    local.setItem(AUTH_KEY, token);
    return;
  }
  getSessionStorage()?.setItem(AUTH_KEY, token);
};

const clearStoredToken = () => {
  getLocalStorage()?.removeItem(AUTH_KEY);
  getSessionStorage()?.removeItem(AUTH_KEY);
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
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const { token } = await res.json();
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
    const res = await fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getAuthToken(): string | null {
  if (DEV_BYPASS_AUTH) return getStoredToken() || DEV_TOKEN;
  return getStoredToken();
}
