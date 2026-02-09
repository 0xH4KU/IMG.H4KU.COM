export const IMAGE_META_KEY = '.config/image-meta.json';
export const HASH_META_KEY = '.config/image-hashes.json';
export const SHARE_META_KEY = '.config/share-meta.json';
export const FOLDER_META_KEY = '.config/folders.json';
export const MAINT_META_KEY = '.config/maintenance.json';

function nowIso() {
  return new Date().toISOString();
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === 'string');
}

function normalizeImageMeta(input) {
  const data = asObject(input);
  return {
    version: Number.isFinite(data.version) ? Number(data.version) : 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
    images: asObject(data.images),
  };
}

function normalizeHashMeta(input) {
  const data = asObject(input);
  return {
    version: Number.isFinite(data.version) ? Number(data.version) : 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
    hashes: asObject(data.hashes),
  };
}

function normalizeShareMeta(input) {
  const data = asObject(input);
  return {
    version: Number.isFinite(data.version) ? Number(data.version) : 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
    shares: asObject(data.shares),
  };
}

function normalizeFolderMeta(input) {
  const data = asObject(input);
  return {
    version: Number.isFinite(data.version) ? Number(data.version) : 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
    folders: asStringArray(data.folders),
  };
}

function normalizeMaintenanceMeta(input) {
  const data = asObject(input);
  return {
    version: Number.isFinite(data.version) ? Number(data.version) : 1,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso(),
    lastRuns: asObject(data.lastRuns),
  };
}

async function readJson(env, key, fallback) {
  try {
    const obj = await env.R2.get(key);
    if (!obj) return fallback();
    return JSON.parse(await obj.text());
  } catch {
    return fallback();
  }
}

async function writeJson(env, key, data) {
  data.updatedAt = nowIso();
  await env.R2.put(key, JSON.stringify(data));
}

export async function getImageMeta(env) {
  return normalizeImageMeta(await readJson(env, IMAGE_META_KEY, () => ({ images: {} })));
}

export async function saveImageMeta(env, meta) {
  await writeJson(env, IMAGE_META_KEY, meta);
}

export async function getHashMeta(env) {
  return normalizeHashMeta(await readJson(env, HASH_META_KEY, () => ({ hashes: {} })));
}

export async function saveHashMeta(env, meta) {
  await writeJson(env, HASH_META_KEY, meta);
}

export async function getShareMeta(env) {
  return normalizeShareMeta(await readJson(env, SHARE_META_KEY, () => ({ shares: {} })));
}

export async function saveShareMeta(env, meta) {
  await writeJson(env, SHARE_META_KEY, meta);
}

export async function getFolderMeta(env) {
  return normalizeFolderMeta(await readJson(env, FOLDER_META_KEY, () => ({ folders: [] })));
}

export async function saveFolderMeta(env, meta) {
  await writeJson(env, FOLDER_META_KEY, meta);
}

export async function getMaintenanceMeta(env) {
  return normalizeMaintenanceMeta(await readJson(env, MAINT_META_KEY, () => ({ lastRuns: {} })));
}

export async function saveMaintenanceMeta(env, meta) {
  await writeJson(env, MAINT_META_KEY, meta);
}

export async function listAllObjects(env, prefix = '') {
  const objects = [];
  let cursor;
  do {
    const listed = await env.R2.list({ prefix, cursor, limit: 1000 });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return objects;
}

export async function listObjectsPage(env, { prefix = '', cursor, limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const listed = await env.R2.list({ prefix, cursor, limit: safeLimit });
  return {
    objects: listed.objects || [],
    cursor: listed.truncated ? listed.cursor : null,
    hasMore: Boolean(listed.truncated),
  };
}
