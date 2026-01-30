const TRASH_PREFIX = 'trash/';

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
    customMetadata: object.customMetadata,
  });
  await env.R2.delete(normalized);
  return { action: 'moved', from: normalized, to: target };
}
