export function getBrandDomainLabel() {
  if (typeof window === 'undefined') return 'IMG.H4KU.COM';
  const host = window.location.hostname.toLowerCase();
  if (host.includes('lum.bio')) return 'IMG.LUM.BIO';
  if (host.includes('h4ku.com')) return 'IMG.H4KU.COM';
  return 'IMG.H4KU.COM';
}
