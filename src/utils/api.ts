import { getAuthToken } from '../contexts/AuthContext';
import { ApiError } from './api-error.ts';

interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  responseType?: 'auto' | 'json' | 'text' | 'blob';
}

export type { ApiRequestOptions };

export { ApiError };

function shouldUseJsonBody(body: unknown): boolean {
  return body !== undefined && body !== null && !(body instanceof FormData);
}

function readMessageFallback(status: number): string {
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not found';
  if (status >= 500) return 'Server error';
  return 'Request failed';
}

async function parseApiResponse<T>(response: Response, responseType: ApiRequestOptions['responseType']): Promise<T> {
  if (response.status === 204) return undefined as T;

  if (responseType === 'blob') {
    return response.blob() as Promise<T>;
  }

  if (responseType === 'text') {
    return response.text() as Promise<T>;
  }

  if (responseType === 'json') {
    return response.json() as Promise<T>;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

export async function apiRequest<T = unknown>(
  path: string,
  { method = 'GET', body, headers, auth = true, responseType = 'auto' }: ApiRequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers || {});

  if (auth) {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError('Unauthorized', 401);
    }
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const finalBody = shouldUseJsonBody(body) ? JSON.stringify(body) : body;
  if (shouldUseJsonBody(body) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    method,
    headers: requestHeaders,
    body: finalBody as BodyInit | null | undefined,
  });

  if (!response.ok) {
    let message = '';
    try {
      message = (await response.text()).trim();
    } catch {
      message = '';
    }
    throw new ApiError(message || readMessageFallback(response.status), response.status);
  }

  return parseApiResponse<T>(response, responseType);
}
