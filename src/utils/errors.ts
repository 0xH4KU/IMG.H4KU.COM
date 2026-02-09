import { ApiError } from './api-error';

function asApiError(error: unknown): ApiError | null {
  if (!(error instanceof Error)) return null;
  if (typeof (error as { name?: unknown }).name !== 'string') return null;
  if ((error as { name: string }).name !== 'ApiError') return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') return null;
  return error as ApiError;
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const apiError = asApiError(error);
  if (apiError) {
    if (apiError.status === 401) return 'Session expired. Please sign in again.';
    if (apiError.status === 403) return 'You do not have permission to do this.';
    if (apiError.status === 404) return 'Resource not found.';
    if (apiError.status >= 500) return 'Server is temporarily unavailable.';
    return apiError.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function isAuthError(error: unknown): boolean {
  const apiError = asApiError(error);
  return Boolean(apiError && apiError.status === 401);
}
