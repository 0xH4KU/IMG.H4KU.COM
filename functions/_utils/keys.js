const RESERVED_PREFIXES = ['.config/'];

function asString(value) {
  return typeof value === 'string' ? value : '';
}

export function cleanKey(value) {
  return asString(value).trim().replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

export function isReservedKey(key) {
  if (key === '.config') return true;
  return RESERVED_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function isHiddenObjectKey(key) {
  return key === '.config'
    || key === '.thumbs'
    || key.startsWith('.config/')
    || key.startsWith('.thumbs/');
}

export function isTrashKey(key) {
  return key.startsWith('trash/');
}

export function normalizeFolderSegment(value) {
  return asString(value).trim().replace(/[^a-zA-Z0-9-_]/g, '-');
}

export function isValidFolderSegment(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(value);
}

export function normalizeFolderPath(value) {
  const raw = asString(value).trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return '';
  const segments = raw.split('/').map(normalizeFolderSegment).filter(Boolean);
  return segments.join('/');
}

export function isValidFolderPath(value) {
  if (value === '') return true;
  return value.split('/').every(isValidFolderSegment);
}

export function normalizeFileName(value) {
  const sanitized = asString(value).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.replace(/^_+/, '').slice(0, 255);
}

export function ensureSafeObjectKey(value) {
  const key = cleanKey(value);
  if (!key) return { ok: false, reason: 'Missing key' };
  if (key.includes('..')) return { ok: false, reason: 'Invalid key path' };
  if (isReservedKey(key)) return { ok: false, reason: 'Invalid key path' };
  return { ok: true, key };
}

export function ensureSafeUploadKey(value, { allowThumbs = false } = {}) {
  const key = cleanKey(value);
  if (!key) return { ok: false, reason: 'Missing key' };
  if (key.includes('..')) return { ok: false, reason: 'Invalid key path' };
  if (key.startsWith('.thumbs/')) {
    if (!allowThumbs) return { ok: false, reason: 'Invalid key path' };
    return { ok: true, key };
  }
  if (isReservedKey(key)) return { ok: false, reason: 'Invalid key path' };
  return { ok: true, key };
}

export function fileExtFromKey(key) {
  const name = key.split('/').pop() || key;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
