import type { Env, AuthMetrics, LegacyAuthMetrics } from '../_types/index';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_SIGNATURE_LENGTH = 16;
const AUTH_METRICS_KEY = '.config/auth-metrics.json';

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64Url: string): string {
    const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return atob(padded);
}

function timingSafeEqual(left: string, right: string): boolean {
    const maxLength = Math.max(left.length, right.length);
    let diff = left.length === right.length ? 0 : 1;
    for (let i = 0; i < maxLength; i += 1) {
        diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
    }
    return diff === 0;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

interface TokenPayload {
    v?: number;
    iat?: number;
    exp: number;
}

function parsePayload(data: unknown): TokenPayload | null {
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

function verifyLegacyToken(token: string, secret: string): boolean {
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

async function importSigningKey(secret: string): Promise<CryptoKey> {
    const data = new TextEncoder().encode(secret);
    return crypto.subtle.importKey(
        'raw',
        data,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
}

async function signData(secret: string, data: string): Promise<string> {
    const key = await importSigningKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return toBase64Url(new Uint8Array(signature));
}

type EnvLike = Env | Record<string, unknown> | undefined | null;

function getAuthSecret(env: EnvLike): string {
    if (!env) return '';
    if (isNonEmptyString((env as Record<string, unknown>).JWT_SECRET)) return (env as Record<string, unknown>).JWT_SECRET as string;
    if (isNonEmptyString((env as Record<string, unknown>).ADMIN_PASSWORD)) return (env as Record<string, unknown>).ADMIN_PASSWORD as string;
    return '';
}

function hasR2Binding(env: EnvLike): env is Env {
    return Boolean(
        env
        && (env as Record<string, unknown>).R2
        && typeof ((env as Record<string, unknown>).R2 as any).get === 'function'
        && typeof ((env as Record<string, unknown>).R2 as any).put === 'function',
    );
}

function normalizeAuthMetrics(input: unknown): AuthMetrics {
    const data = asObject(input);
    const legacy = asObject(data.legacy);
    const byDayRaw = asObject(legacy.byDay);

    const byDay: Record<string, number> = {};
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

function dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

async function readAuthMetrics(env: EnvLike): Promise<AuthMetrics> {
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

async function writeAuthMetrics(env: EnvLike, metrics: AuthMetrics): Promise<void> {
    if (!hasR2Binding(env)) return;
    const payload = {
        ...metrics,
        updatedAt: new Date().toISOString(),
    };
    await env.R2.put(AUTH_METRICS_KEY, JSON.stringify(payload));
}

async function recordLegacyTokenUse(env: EnvLike): Promise<void> {
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

function parseLegacyUntilMs(env: EnvLike): number | null {
    const raw = (env as Record<string, unknown>)?.LEGACY_TOKEN_UNTIL;
    if (!isNonEmptyString(raw)) return null;
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return 0;
    return timestamp;
}

function isLegacyAllowed(env: EnvLike): boolean {
    const cutoff = parseLegacyUntilMs(env);
    if (cutoff === null) return true;
    return Date.now() <= cutoff;
}

export function isDevBypassEnabled(env: EnvLike): boolean {
    const e = env as Record<string, unknown> | undefined | null;
    return e?.DEV_BYPASS_AUTH === '1' || e?.DEV_BYPASS_AUTH === 'true';
}

export function getTokenTtlMs(env: EnvLike): number {
    const days = Number((env as Record<string, unknown>)?.TOKEN_TTL_DAYS || 30);
    if (!Number.isFinite(days) || days <= 0) return DEFAULT_TTL_MS;
    return Math.round(days * 24 * 60 * 60 * 1000);
}

export async function createToken(secret: string, ttlMs = DEFAULT_TTL_MS): Promise<string> {
    if (!isNonEmptyString(secret)) {
        throw new Error('Missing token secret');
    }
    const now = Date.now();
    const payload = { v: 2, iat: now, exp: now + ttlMs };
    const data = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = await signData(secret, data);
    return `${data}.${signature}`;
}

export async function issueToken(env: EnvLike, ttlMs = getTokenTtlMs(env)): Promise<string> {
    const secret = getAuthSecret(env);
    return createToken(secret, ttlMs);
}

export async function verifyToken(
    token: string,
    envOrSecret: EnvLike | string,
): Promise<boolean> {
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

export async function authenticateRequest(request: Request, env: EnvLike): Promise<boolean> {
    if (isDevBypassEnabled(env)) return true;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    return verifyToken(authHeader.slice(7), env);
}

export async function getAuthMetrics(env: EnvLike): Promise<AuthMetrics> {
    return readAuthMetrics(env);
}

export function getLegacyTokenUntil(env: EnvLike): string | null {
    const cutoff = parseLegacyUntilMs(env);
    if (cutoff === null || cutoff <= 0) return null;
    return new Date(cutoff).toISOString();
}
