/**
 * Frontend key/path utilities
 * Keep in sync with functions/_utils/keys.js
 */

const RESERVED_PREFIXES = ['.config/'];

export function cleanKey(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

export function isReservedKey(key: string): boolean {
  if (key === '.config') return true;
  return RESERVED_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function isHiddenObjectKey(key: string): boolean {
  return key === '.config'
    || key === '.thumbs'
    || key.startsWith('.config/')
    || key.startsWith('.thumbs/');
}

export function isTrashKey(key: string): boolean {
  return key.startsWith('trash/');
}

export function normalizeFolderSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
}

export function isValidFolderSegment(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(value);
}

export function normalizeFolderPath(value: string): string {
  const raw = value.trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return '';
  const segments = raw.split('/').map(normalizeFolderSegment).filter(Boolean);
  return segments.join('/');
}

export function isValidFolderPath(value: string): boolean {
  if (value === '') return true;
  return value.split('/').every(isValidFolderSegment);
}

export function normalizeFileName(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.replace(/^_+/, '').slice(0, 255);
}

export function fileExtFromKey(key: string): string {
  const name = key.split('/').pop() || key;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
