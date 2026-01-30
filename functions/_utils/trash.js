const TRASH_PREFIX = 'trash/';
const ORIGINAL_KEY_META = 'trash-original-key';
const DELETED_AT_META = 'trash-deleted-at';

function normalizeKey(key) {
  return (key || '').replace(/^\/+/, '');
}

function buildTrashKey(key, suffix) {
  const normalized = normalizeKey(key);
  const slashIndex = normalized.lastIndexOf('/');
  const dir = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : '';
  const name = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  if (!suffix) {
    return `${TRASH_PREFIX}${normalized}`;
  }
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return `${TRASH_PREFIX}${dir}${name.slice(0, dot)}__deleted_${suffix}${name.slice(dot)}`;
  }
  return `${TRASH_PREFIX}${dir}${name}__deleted_${suffix}`;
}

async function resolveTrashKey(env, key) {
  const primary = buildTrashKey(key);
  const existing = await env.R2.head(primary);
  if (!existing) return primary;
  const suffix = new Date().toISOString().replace(/[:.]/g, '');
  return buildTrashKey(key, suffix);
}

function buildRestoreKey(key, suffix) {
  const normalized = normalizeKey(key);
  const slashIndex = normalized.lastIndexOf('/');
  const dir = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : '';
  const name = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  if (!suffix) {
    return normalized;
  }
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return `${dir}${name.slice(0, dot)}__restored_${suffix}${name.slice(dot)}`;
  }
  return `${dir}${name}__restored_${suffix}`;
}

async function resolveRestoreKey(env, key) {
  const primary = buildRestoreKey(key);
  const existing = await env.R2.head(primary);
  if (!existing) return primary;
  const suffix = new Date().toISOString().replace(/[:.]/g, '');
  return buildRestoreKey(key, suffix);
}

function stripDeletedSuffix(name) {
  return name.replace(/__deleted_[A-Za-z0-9TZ\-]+$/, '');
}

function deriveOriginalKey(trashKey) {
  const normalized = normalizeKey(trashKey);
  if (!normalized.startsWith(TRASH_PREFIX)) return normalized;
  const rest = normalized.slice(TRASH_PREFIX.length);
  const slashIndex = rest.lastIndexOf('/');
  const dir = slashIndex >= 0 ? rest.slice(0, slashIndex + 1) : '';
  const name = slashIndex >= 0 ? rest.slice(slashIndex + 1) : rest;
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return `${dir}${stripDeletedSuffix(name.slice(0, dot))}${name.slice(dot)}`;
  }
  return `${dir}${stripDeletedSuffix(name)}`;
}

function withTrashMeta(customMetadata, originalKey) {
  return {
    ...(customMetadata || {}),
    [ORIGINAL_KEY_META]: originalKey,
    [DELETED_AT_META]: new Date().toISOString(),
  };
}

function stripTrashMeta(customMetadata) {
  if (!customMetadata) return undefined;
  const next = { ...customMetadata };
  delete next[ORIGINAL_KEY_META];
  delete next[DELETED_AT_META];
  return next;
}

export async function moveToTrash(env, key) {
  const normalized = normalizeKey(key);
  if (!normalized) return { action: 'missing', from: normalized };
  if (normalized.startsWith(TRASH_PREFIX)) {
    await env.R2.delete(normalized);
    return { action: 'deleted', from: normalized };
  }
  const object = await env.R2.get(normalized);
  if (!object) return { action: 'missing', from: normalized };
  const target = await resolveTrashKey(env, normalized);
  await env.R2.put(target, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: withTrashMeta(object.customMetadata, normalized),
  });
  await env.R2.delete(normalized);
  return { action: 'moved', from: normalized, to: target };
}

export async function restoreFromTrash(env, key) {
  const normalized = normalizeKey(key);
  if (!normalized) return { action: 'missing', from: normalized };
  if (!normalized.startsWith(TRASH_PREFIX)) {
    return { action: 'not_trash', from: normalized };
  }
  const object = await env.R2.get(normalized);
  if (!object) return { action: 'missing', from: normalized };
  const originalKey = object.customMetadata?.[ORIGINAL_KEY_META] || deriveOriginalKey(normalized);
  const target = await resolveRestoreKey(env, originalKey);
  await env.R2.put(target, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: stripTrashMeta(object.customMetadata),
  });
  await env.R2.delete(normalized);
  return { action: 'restored', from: normalized, to: target, original: originalKey };
}
