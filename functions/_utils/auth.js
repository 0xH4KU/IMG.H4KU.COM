const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_SIGNATURE_LENGTH = 16;

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64Url) {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function timingSafeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function parsePayload(data) {
  try {
    const parsed = JSON.parse(fromBase64Url(data));
    if (!parsed || typeof parsed !== 'object') return null;
    const exp = Number(parsed.exp);
    if (!Number.isFinite(exp)) return null;
    return { ...parsed, exp };
  } catch {
    return null;
  }
}

function verifyLegacyToken(token, secret) {
  try {
    const [data, signature] = token.split('.');
    if (!isNonEmptyString(data) || !isNonEmptyString(signature)) return false;
    if (signature.length !== LEGACY_SIGNATURE_LENGTH) return false;
    const expected = btoa(secret + data).slice(0, LEGACY_SIGNATURE_LENGTH);
    if (!timingSafeEqual(expected, signature)) return false;
    const payload = parsePayload(data);
    return Boolean(payload && payload.exp > Date.now());
  } catch {
    return false;
  }
}

async function importSigningKey(secret) {
  const data = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    data,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signData(secret, data) {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

function getAuthSecret(env) {
  if (!env) return '';
  if (isNonEmptyString(env.JWT_SECRET)) return env.JWT_SECRET;
  if (isNonEmptyString(env.ADMIN_PASSWORD)) return env.ADMIN_PASSWORD;
  return '';
}

export function isDevBypassEnabled(env) {
  return env?.DEV_BYPASS_AUTH === '1' || env?.DEV_BYPASS_AUTH === 'true';
}

export function getTokenTtlMs(env) {
  const days = Number(env?.TOKEN_TTL_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_TTL_MS;
  return Math.round(days * 24 * 60 * 60 * 1000);
}

export async function createToken(secret, ttlMs = DEFAULT_TTL_MS) {
  if (!isNonEmptyString(secret)) {
    throw new Error('Missing token secret');
  }
  const now = Date.now();
  const payload = { v: 2, iat: now, exp: now + ttlMs };
  const data = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signData(secret, data);
  return `${data}.${signature}`;
}

export async function issueToken(env, ttlMs = getTokenTtlMs(env)) {
  const secret = getAuthSecret(env);
  return createToken(secret, ttlMs);
}

export async function verifyToken(token, envOrSecret) {
  const secret = typeof envOrSecret === 'string' ? envOrSecret : getAuthSecret(envOrSecret);
  if (!isNonEmptyString(secret) || !isNonEmptyString(token)) return false;

  const [data, signature] = token.split('.');
  if (!isNonEmptyString(data) || !isNonEmptyString(signature)) return false;

  const payload = parsePayload(data);
  if (!payload || payload.exp <= Date.now()) return false;

  try {
    const expected = await signData(secret, data);
    if (timingSafeEqual(expected, signature)) return true;
  } catch {
    return false;
  }

  return verifyLegacyToken(token, secret);
}

export async function authenticateRequest(request, env) {
  if (isDevBypassEnabled(env)) return true;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  return verifyToken(authHeader.slice(7), env);
}
