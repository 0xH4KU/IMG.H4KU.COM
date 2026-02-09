// @ts-check

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_SIGNATURE_LENGTH = 16;
const AUTH_METRICS_KEY = '.config/auth-metrics.json';

/**
 * @typedef {{
 *   count: number;
 *   lastUsedAt: string | null;
 *   byDay: Record<string, number>;
 * }} LegacyAuthMetrics
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   legacy: LegacyAuthMetrics;
 * }} AuthMetrics
 */

/** @param {Uint8Array} bytes */
function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** @param {string} base64Url */
function fromBase64Url(base64Url) {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

/** @param {string} left @param {string} right */
function timingSafeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** @param {unknown} value */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/** @param {unknown} value */
function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

/** @param {unknown} data */
function parsePayload(data) {
  try {
    const parsed = JSON.parse(fromBase64Url(String(data)));
    if (!parsed || typeof parsed !== 'object') return null;
    const exp = Number(parsed.exp);
    if (!Number.isFinite(exp)) return null;
    return { ...parsed, exp };
  } catch {
    return null;
  }
}

/** @param {string} token @param {string} secret */
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

/** @param {string} secret */
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

/** @param {string} secret @param {string} data */
async function signData(secret, data) {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

/** @param {Record<string, unknown> | undefined | null} env */
function getAuthSecret(env) {
  if (!env) return '';
  if (isNonEmptyString(env.JWT_SECRET)) return env.JWT_SECRET;
  if (isNonEmptyString(env.ADMIN_PASSWORD)) return env.ADMIN_PASSWORD;
  return '';
}

/** @param {Record<string, unknown> | undefined | null} env */
function hasR2Binding(env) {
  return Boolean(
    env
    && env.R2
    && typeof env.R2.get === 'function'
    && typeof env.R2.put === 'function',
  );
}

/** @param {unknown} input @returns {AuthMetrics} */
function normalizeAuthMetrics(input) {
  const data = asObject(input);
  const legacy = asObject(data.legacy);
  const byDayRaw = asObject(legacy.byDay);

  /** @type {Record<string, number>} */
  const byDay = {};
  for (const [day, value] of Object.entries(byDayRaw)) {
    const count = Number(value);
    if (!day || !Number.isFinite(count) || count <= 0) continue;
    byDay[day] = Math.round(count);
  }

  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString();
  const count = Number(legacy.count);
  const lastUsedAt = typeof legacy.lastUsedAt === 'string' ? legacy.lastUsedAt : null;

  return {
    version: Number.isFinite(Number(data.version)) ? Number(data.version) : 1,
    updatedAt,
    legacy: {
      count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
      lastUsedAt,
      byDay,
    },
  };
}

/** @param {Date} date */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/** @param {Record<string, unknown> | undefined | null} env */
async function readAuthMetrics(env) {
  if (!hasR2Binding(env)) {
    return normalizeAuthMetrics(undefined);
  }
  try {
    const object = await env.R2.get(AUTH_METRICS_KEY);
    if (!object) return normalizeAuthMetrics(undefined);
    return normalizeAuthMetrics(JSON.parse(await object.text()));
  } catch {
    return normalizeAuthMetrics(undefined);
  }
}

/** @param {Record<string, unknown> | undefined | null} env @param {AuthMetrics} metrics */
async function writeAuthMetrics(env, metrics) {
  if (!hasR2Binding(env)) return;
  const payload = {
    ...metrics,
    updatedAt: new Date().toISOString(),
  };
  await env.R2.put(AUTH_METRICS_KEY, JSON.stringify(payload));
}

/** @param {Record<string, unknown> | undefined | null} env */
async function recordLegacyTokenUse(env) {
  if (!hasR2Binding(env)) return;
  try {
    const metrics = await readAuthMetrics(env);
    const now = new Date();
    const key = dayKey(now);
    metrics.legacy.count += 1;
    metrics.legacy.lastUsedAt = now.toISOString();
    metrics.legacy.byDay[key] = (metrics.legacy.byDay[key] || 0) + 1;
    await writeAuthMetrics(env, metrics);
  } catch {
    // Swallow metrics errors to avoid affecting auth flow.
  }
}

/** @param {Record<string, unknown> | undefined | null} env */
function parseLegacyUntilMs(env) {
  const raw = env?.LEGACY_TOKEN_UNTIL;
  if (!isNonEmptyString(raw)) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return 0;
  return timestamp;
}

/** @param {Record<string, unknown> | undefined | null} env */
function isLegacyAllowed(env) {
  const cutoff = parseLegacyUntilMs(env);
  if (cutoff === null) return true;
  return Date.now() <= cutoff;
}

/** @param {Record<string, unknown> | undefined | null} env */
export function isDevBypassEnabled(env) {
  return env?.DEV_BYPASS_AUTH === '1' || env?.DEV_BYPASS_AUTH === 'true';
}

/** @param {Record<string, unknown> | undefined | null} env */
export function getTokenTtlMs(env) {
  const days = Number(env?.TOKEN_TTL_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_TTL_MS;
  return Math.round(days * 24 * 60 * 60 * 1000);
}

/** @param {string} secret @param {number} [ttlMs] */
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

/** @param {Record<string, unknown> | undefined | null} env @param {number} [ttlMs] */
export async function issueToken(env, ttlMs = getTokenTtlMs(env)) {
  const secret = getAuthSecret(env);
  return createToken(secret, ttlMs);
}

/**
 * @param {string} token
 * @param {Record<string, unknown> | string | undefined | null} envOrSecret
 */
export async function verifyToken(token, envOrSecret) {
  const env = typeof envOrSecret === 'object' && envOrSecret ? envOrSecret : null;
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

  if (env && !isLegacyAllowed(env)) {
    return false;
  }

  const isLegacyValid = verifyLegacyToken(token, secret);
  if (isLegacyValid && env) {
    await recordLegacyTokenUse(env);
  }
  return isLegacyValid;
}

/** @param {Request} request @param {Record<string, unknown> | undefined | null} env */
export async function authenticateRequest(request, env) {
  if (isDevBypassEnabled(env)) return true;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  return verifyToken(authHeader.slice(7), env);
}

/** @param {Record<string, unknown> | undefined | null} env */
export async function getAuthMetrics(env) {
  return readAuthMetrics(env);
}

/** @param {Record<string, unknown> | undefined | null} env */
export function getLegacyTokenUntil(env) {
  const cutoff = parseLegacyUntilMs(env);
  if (cutoff === null || cutoff <= 0) return null;
  return new Date(cutoff).toISOString();
}

