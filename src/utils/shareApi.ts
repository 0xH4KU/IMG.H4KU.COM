import { ApiError } from './api-error.ts';

export interface ShareInfo {
  id: string;
  title: string;
  description?: string;
  domain?: 'h4ku' | 'lum';
  createdAt?: string;
  updatedAt?: string;
}

export interface ShareItem {
  key: string;
  size?: number;
  uploaded?: string | null;
  type?: string | null;
  missing?: boolean;
}

export interface ShareResponse {
  share?: ShareInfo;
  items?: ShareItem[];
  error?: string;
}

interface LoadShareOptions {
  shareId: string;
  password?: string;
}

export async function loadShareData({ shareId, password }: LoadShareOptions): Promise<ShareResponse> {
  const response = await fetch(`/api/share/${shareId}`, {
    method: password ? 'POST' : 'GET',
    headers: password ? { 'Content-Type': 'application/json' } : undefined,
    body: password ? JSON.stringify({ password }) : undefined,
  });

  if (response.status === 401) {
    const text = (await response.text()).trim();
    if (text.includes('password_required') || !text) {
      throw new ApiError('password_required', 401);
    }
    throw new ApiError(text, 401);
  }

  if (!response.ok) {
    const message = (await response.text()).trim() || 'Failed to load delivery.';
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<ShareResponse>;
}
