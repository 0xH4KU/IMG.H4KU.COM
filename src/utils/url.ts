export const DELIVERY_HOSTS = {
  h4ku: 'https://img.h4ku.com',
  lum: 'https://img.lum.bio',
};

const SHARE_ORIGINS = {
  h4ku: 'https://delivery.h4ku.com',
  lum: 'https://delivery.lum.bio',
};

function isLocalLikeHost(host: string) {
  return host === 'localhost' || host.endsWith('.pages.dev');
}

export function shouldUseFileProxy(host = window.location.hostname): boolean {
  return isLocalLikeHost(host);
}

export function shouldUseDownloadProxy(host = window.location.hostname): boolean {
  return shouldUseFileProxy(host) || host.startsWith('admin.');
}

export function resolveShareOrigin(domain: 'h4ku' | 'lum', location = window.location): string {
  const host = location.hostname;
  const origin = location.origin;

  if (isLocalLikeHost(host)) return origin;

  return SHARE_ORIGINS[domain] || SHARE_ORIGINS.h4ku;
}
