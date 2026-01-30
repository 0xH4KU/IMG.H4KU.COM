export const IMAGE_META_KEY = '.config/image-meta.json';
export const HASH_META_KEY = '.config/image-hashes.json';
export const SHARE_META_KEY = '.config/share-meta.json';
export const FOLDER_META_KEY = '.config/folders.json';
export const MAINT_META_KEY = '.config/maintenance.json';

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
  data.updatedAt = new Date().toISOString();
  await env.R2.put(key, JSON.stringify(data));
}

export async function getImageMeta(env) {
  return readJson(env, IMAGE_META_KEY, () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    images: {},
  }));
}

export async function saveImageMeta(env, meta) {
  await writeJson(env, IMAGE_META_KEY, meta);
}

export async function getHashMeta(env) {
  return readJson(env, HASH_META_KEY, () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    hashes: {},
  }));
}

export async function saveHashMeta(env, meta) {
  await writeJson(env, HASH_META_KEY, meta);
}

export async function getShareMeta(env) {
  return readJson(env, SHARE_META_KEY, () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    shares: {},
  }));
}

export async function saveShareMeta(env, meta) {
  await writeJson(env, SHARE_META_KEY, meta);
}

export async function getFolderMeta(env) {
  return readJson(env, FOLDER_META_KEY, () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    folders: [],
  }));
}

export async function saveFolderMeta(env, meta) {
  await writeJson(env, FOLDER_META_KEY, meta);
}

export async function getMaintenanceMeta(env) {
  return readJson(env, MAINT_META_KEY, () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    lastRuns: {},
  }));
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
