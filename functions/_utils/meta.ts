import type {
    Env,
    ImageMeta,
    ImageMetaEntry,
    HashMeta,
    HashMetaEntry,
    ShareMeta,
    ShareMetaEntry,
    FolderMeta,
    MaintenanceMeta,
} from '../_types/index';
import { r2Get, r2List, r2Put } from './r2.ts';

export const IMAGE_META_KEY = '.config/image-meta.json';
export const HASH_META_KEY = '.config/image-hashes.json';
export const SHARE_META_KEY = '.config/share-meta.json';
export const FOLDER_META_KEY = '.config/folders.json';
export const MAINT_META_KEY = '.config/maintenance.json';

function nowIso(): string {
    return new Date().toISOString();
}

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function asFiniteNumberOrNull(value: unknown): number | null {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number;
}

export function normalizeImageMeta(input: unknown): ImageMeta {
    const data = asObject(input);
    const rawImages = asObject(data.images);
    const images: Record<string, ImageMetaEntry> = {};

    for (const [key, raw] of Object.entries(rawImages)) {
        const entry = asObject(raw);
        images[key] = {
            tags: asStringArray(entry.tags),
            favorite: Boolean(entry.favorite),
        };
    }

    const version = asFiniteNumberOrNull(data.version);
    return {
        version: version === null ? 1 : version,
        updatedAt: asString(data.updatedAt) || nowIso(),
        images,
    };
}

export function normalizeHashMeta(input: unknown): HashMeta {
    const data = asObject(input);
    const rawHashes = asObject(data.hashes);
    const hashes: Record<string, HashMetaEntry> = {};

    for (const [key, raw] of Object.entries(rawHashes)) {
        const entry = asObject(raw);
        const size = asFiniteNumberOrNull(entry.size);
        const uploadedAt = asString(entry.uploadedAt) || null;
        const hash = asString(entry.hash);
        hashes[key] = { hash, size, uploadedAt };
    }

    const version = asFiniteNumberOrNull(data.version);
    return {
        version: version === null ? 1 : version,
        updatedAt: asString(data.updatedAt) || nowIso(),
        hashes,
    };
}

export function normalizeShareMeta(input: unknown): ShareMeta {
    const data = asObject(input);
    const rawShares = asObject(data.shares);
    const shares: Record<string, ShareMetaEntry> = {};

    for (const [id, raw] of Object.entries(rawShares)) {
        const entry = asObject(raw);
        shares[id] = {
            id: asString(entry.id) || id,
            title: asString(entry.title),
            description: asString(entry.description),
            items: asStringArray(entry.items),
            createdAt: asString(entry.createdAt),
            updatedAt: asString(entry.updatedAt),
            passwordHash: asString(entry.passwordHash),
            passwordSalt: asString(entry.passwordSalt),
            domain: entry.domain === 'lum' ? 'lum' : 'h4ku',
            folder: asString(entry.folder),
        };
    }

    const version = asFiniteNumberOrNull(data.version);
    return {
        version: version === null ? 1 : version,
        updatedAt: asString(data.updatedAt) || nowIso(),
        shares,
    };
}

export function normalizeFolderMeta(input: unknown): FolderMeta {
    const data = asObject(input);
    const version = asFiniteNumberOrNull(data.version);
    return {
        version: version === null ? 1 : version,
        updatedAt: asString(data.updatedAt) || nowIso(),
        folders: asStringArray(data.folders),
    };
}

export function normalizeMaintenanceMeta(input: unknown): MaintenanceMeta {
    const data = asObject(input);
    const rawLastRuns = asObject(data.lastRuns);
    const lastRuns: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawLastRuns)) {
        const parsed = asString(value);
        if (!parsed) continue;
        lastRuns[key] = parsed;
    }

    const version = asFiniteNumberOrNull(data.version);
    return {
        version: version === null ? 1 : version,
        updatedAt: asString(data.updatedAt) || nowIso(),
        lastRuns,
    };
}

async function readJson<T>(env: Env, key: string, fallback: () => T): Promise<T> {
    try {
        const obj = await r2Get(env, key);
        if (!obj) return fallback();
        return JSON.parse(await obj.text()) as T;
    } catch {
        return fallback();
    }
}

export class MetaVersionConflictError extends Error {
    constructor(key: string) {
        super(`Version conflict writing ${key}`);
        this.name = 'MetaVersionConflictError';
    }
}

interface VersionedMeta {
    version: number;
    updatedAt: string;
    [key: string]: unknown;
}

async function writeJsonWithVersion(
    env: Env,
    key: string,
    data: VersionedMeta,
): Promise<void> {
    // Read current version from R2
    const current = await readJson<{ version?: number }>(env, key, () => ({ version: 0 }));
    const currentVersion = current.version ?? 0;

    // If someone else bumped the version since we read, reject
    if (data.version < currentVersion) {
        throw new MetaVersionConflictError(key);
    }

    data.version = currentVersion + 1;
    data.updatedAt = nowIso();
    await r2Put(env, key, JSON.stringify(data));
}

async function writeJson(env: Env, key: string, data: Record<string, unknown>): Promise<void> {
    if (typeof data.version === 'number') {
        await writeJsonWithVersion(env, key, data as VersionedMeta);
    } else {
        data.updatedAt = nowIso();
        await r2Put(env, key, JSON.stringify(data));
    }
}

export async function getImageMeta(env: Env): Promise<ImageMeta> {
    return normalizeImageMeta(await readJson(env, IMAGE_META_KEY, () => ({ images: {} })));
}

export async function saveImageMeta(env: Env, meta: ImageMeta): Promise<void> {
    await writeJson(env, IMAGE_META_KEY, meta as unknown as Record<string, unknown>);
}

export async function getHashMeta(env: Env): Promise<HashMeta> {
    return normalizeHashMeta(await readJson(env, HASH_META_KEY, () => ({ hashes: {} })));
}

export async function saveHashMeta(env: Env, meta: HashMeta): Promise<void> {
    await writeJson(env, HASH_META_KEY, meta as unknown as Record<string, unknown>);
}

export async function getShareMeta(env: Env): Promise<ShareMeta> {
    return normalizeShareMeta(await readJson(env, SHARE_META_KEY, () => ({ shares: {} })));
}

export async function saveShareMeta(env: Env, meta: ShareMeta): Promise<void> {
    await writeJson(env, SHARE_META_KEY, meta as unknown as Record<string, unknown>);
}

export async function getFolderMeta(env: Env): Promise<FolderMeta> {
    return normalizeFolderMeta(await readJson(env, FOLDER_META_KEY, () => ({ folders: [] })));
}

export async function saveFolderMeta(env: Env, meta: FolderMeta): Promise<void> {
    await writeJson(env, FOLDER_META_KEY, meta as unknown as Record<string, unknown>);
}

export async function getMaintenanceMeta(env: Env): Promise<MaintenanceMeta> {
    return normalizeMaintenanceMeta(await readJson(env, MAINT_META_KEY, () => ({ lastRuns: {} })));
}

export async function saveMaintenanceMeta(env: Env, meta: MaintenanceMeta): Promise<void> {
    await writeJson(env, MAINT_META_KEY, meta as unknown as Record<string, unknown>);
}

export async function listAllObjects(env: Env, prefix = ''): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let cursor: string | undefined;
    do {
        const listed = await r2List(env, { prefix, cursor, limit: 1000 });
        objects.push(...listed.objects);
        cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return objects;
}

export async function listObjectsPage(
    env: Env,
    { prefix = '', cursor, limit = 100 }: { prefix?: string; cursor?: string; limit?: number } = {},
): Promise<{ objects: R2Object[]; cursor: string | null; hasMore: boolean }> {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    const listed = await r2List(env, { prefix, cursor, limit: safeLimit });
    return {
        objects: listed.objects || [],
        cursor: listed.truncated ? listed.cursor : null,
        hasMore: Boolean(listed.truncated),
    };
}
