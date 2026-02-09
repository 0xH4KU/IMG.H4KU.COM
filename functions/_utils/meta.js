// @ts-check

import { r2Get, r2List, r2Put } from './r2';

export const IMAGE_META_KEY = '.config/image-meta.json';
export const HASH_META_KEY = '.config/image-hashes.json';
export const SHARE_META_KEY = '.config/share-meta.json';
export const FOLDER_META_KEY = '.config/folders.json';
export const MAINT_META_KEY = '.config/maintenance.json';

/**
 * @typedef {{ tags?: string[]; favorite?: boolean }} ImageMetaEntry
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   images: Record<string, ImageMetaEntry>;
 * }} ImageMeta
 */

/**
 * @typedef {{ hash?: string; size?: number | null; uploadedAt?: string | null }} HashMetaEntry
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   hashes: Record<string, HashMetaEntry>;
 * }} HashMeta
 */

/**
 * @typedef {{
 *   id?: string;
 *   title?: string;
 *   description?: string;
 *   items?: string[];
 *   createdAt?: string;
 *   updatedAt?: string;
 *   passwordHash?: string;
 *   passwordSalt?: string;
 *   domain?: 'h4ku' | 'lum';
 *   folder?: string;
 * }} ShareMetaEntry
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   shares: Record<string, ShareMetaEntry>;
 * }} ShareMeta
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   folders: string[];
 * }} FolderMeta
 */

/**
 * @typedef {{
 *   version: number;
 *   updatedAt: string;
 *   lastRuns: Record<string, string>;
 * }} MaintenanceMeta
 */

function nowIso() {
  return new Date().toISOString();
}

/** @param {unknown} value */
function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

/** @param {unknown} value */
function asString(value) {
  return typeof value === 'string' ? value : '';
}

/** @param {unknown} value */
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === 'string');
}

/** @param {unknown} value */
function asFiniteNumberOrNull(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

/** @param {unknown} input @returns {ImageMeta} */
function normalizeImageMeta(input) {
  const data = asObject(input);
  const rawImages = asObject(data.images);
  /** @type {Record<string, ImageMetaEntry>} */
  const images = {};

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

/** @param {unknown} input @returns {HashMeta} */
function normalizeHashMeta(input) {
  const data = asObject(input);
  const rawHashes = asObject(data.hashes);
  /** @type {Record<string, HashMetaEntry>} */
  const hashes = {};

  for (const [key, raw] of Object.entries(rawHashes)) {
    const entry = asObject(raw);
    const size = asFiniteNumberOrNull(entry.size);
    const uploadedAt = asString(entry.uploadedAt) || null;
    const hash = asString(entry.hash);
    hashes[key] = {
      hash,
      size,
      uploadedAt,
    };
  }

  const version = asFiniteNumberOrNull(data.version);
  return {
    version: version === null ? 1 : version,
    updatedAt: asString(data.updatedAt) || nowIso(),
    hashes,
  };
}

/** @param {unknown} input @returns {ShareMeta} */
function normalizeShareMeta(input) {
  const data = asObject(input);
  const rawShares = asObject(data.shares);
  /** @type {Record<string, ShareMetaEntry>} */
  const shares = {};

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

/** @param {unknown} input @returns {FolderMeta} */
function normalizeFolderMeta(input) {
  const data = asObject(input);
  const version = asFiniteNumberOrNull(data.version);
  return {
    version: version === null ? 1 : version,
    updatedAt: asString(data.updatedAt) || nowIso(),
    folders: asStringArray(data.folders),
  };
}

/** @param {unknown} input @returns {MaintenanceMeta} */
function normalizeMaintenanceMeta(input) {
  const data = asObject(input);
  const rawLastRuns = asObject(data.lastRuns);
  /** @type {Record<string, string>} */
  const lastRuns = {};
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

/** @param {Record<string, unknown>} env @param {string} key @param {() => unknown} fallback */
async function readJson(env, key, fallback) {
  try {
    const obj = await r2Get(env, key);
    if (!obj) return fallback();
    return JSON.parse(await obj.text());
  } catch {
    return fallback();
  }
}

/** @param {Record<string, unknown>} env @param {string} key @param {Record<string, unknown>} data */
async function writeJson(env, key, data) {
  data.updatedAt = nowIso();
  await r2Put(env, key, JSON.stringify(data));
}

/** @param {Record<string, unknown>} env @returns {Promise<ImageMeta>} */
export async function getImageMeta(env) {
  return normalizeImageMeta(await readJson(env, IMAGE_META_KEY, () => ({ images: {} })));
}

/** @param {Record<string, unknown>} env @param {ImageMeta} meta */
export async function saveImageMeta(env, meta) {
  await writeJson(env, IMAGE_META_KEY, meta);
}

/** @param {Record<string, unknown>} env @returns {Promise<HashMeta>} */
export async function getHashMeta(env) {
  return normalizeHashMeta(await readJson(env, HASH_META_KEY, () => ({ hashes: {} })));
}

/** @param {Record<string, unknown>} env @param {HashMeta} meta */
export async function saveHashMeta(env, meta) {
  await writeJson(env, HASH_META_KEY, meta);
}

/** @param {Record<string, unknown>} env @returns {Promise<ShareMeta>} */
export async function getShareMeta(env) {
  return normalizeShareMeta(await readJson(env, SHARE_META_KEY, () => ({ shares: {} })));
}

/** @param {Record<string, unknown>} env @param {ShareMeta} meta */
export async function saveShareMeta(env, meta) {
  await writeJson(env, SHARE_META_KEY, meta);
}

/** @param {Record<string, unknown>} env @returns {Promise<FolderMeta>} */
export async function getFolderMeta(env) {
  return normalizeFolderMeta(await readJson(env, FOLDER_META_KEY, () => ({ folders: [] })));
}

/** @param {Record<string, unknown>} env @param {FolderMeta} meta */
export async function saveFolderMeta(env, meta) {
  await writeJson(env, FOLDER_META_KEY, meta);
}

/** @param {Record<string, unknown>} env @returns {Promise<MaintenanceMeta>} */
export async function getMaintenanceMeta(env) {
  return normalizeMaintenanceMeta(await readJson(env, MAINT_META_KEY, () => ({ lastRuns: {} })));
}

/** @param {Record<string, unknown>} env @param {MaintenanceMeta} meta */
export async function saveMaintenanceMeta(env, meta) {
  await writeJson(env, MAINT_META_KEY, meta);
}

/** @param {Record<string, unknown>} env @param {string} [prefix] */
export async function listAllObjects(env, prefix = '') {
  const objects = [];
  let cursor;
  do {
    const listed = await r2List(env, { prefix, cursor, limit: 1000 });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return objects;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ prefix?: string; cursor?: string; limit?: number }} [options]
 */
export async function listObjectsPage(env, { prefix = '', cursor, limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const listed = await r2List(env, { prefix, cursor, limit: safeLimit });
  return {
    objects: listed.objects || [],
    cursor: listed.truncated ? listed.cursor : null,
    hasMore: Boolean(listed.truncated),
  };
}
