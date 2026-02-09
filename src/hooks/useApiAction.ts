import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAuthError } from '../utils/errors';

interface UseApiActionOptions {
  onAuthError?: () => void;
}

export function useApiAction({ onAuthError }: UseApiActionOptions = {}) {
  const { logout } = useAuth();

  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      if (isAuthError(error)) {
        logout();
        onAuthError?.();
      }
      throw error;
    }
  }, [logout, onAuthError]);

  return { run };
}
