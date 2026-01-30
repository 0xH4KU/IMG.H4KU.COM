import { getHashMeta, saveHashMeta } from '../../_utils/meta';
import { moveToTrash, restoreFromTrash } from '../../_utils/trash';
import { logError } from '../../_utils/log';

// Auth utilities (inlined)
function verifyToken(token, secret) {
  try {
    const [data, sig] = token.split('.');
    if (btoa(secret + data).slice(0, 16) !== sig) return false;
    return JSON.parse(atob(data)).exp > Date.now();
  } catch { return false; }
}

function authenticate(request, env) {
  if (env?.DEV_BYPASS_AUTH === '1' || env?.DEV_BYPASS_AUTH === 'true') return true;
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

const META_KEY = '.config/image-meta.json';

async function getMeta(env) {
  try {
    const obj = await env.R2.get(META_KEY);
    if (!obj) return { version: 1, updatedAt: new Date().toISOString(), images: {} };
    return JSON.parse(await obj.text());
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), images: {} };
  }
}

async function saveMeta(env, meta) {
  meta.updatedAt = new Date().toISOString();
  await env.R2.put(META_KEY, JSON.stringify(meta));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys.filter(k => typeof k === 'string') : [];
    const action = body.action === 'restore' ? 'restore' : 'delete';
    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const results = [];
    let missing = 0;
    for (const key of keys) {
      const result = action === 'restore'
        ? await restoreFromTrash(env, key)
        : await moveToTrash(env, key);
      if (result.action === 'missing' || result.action === 'not_trash') {
        missing += 1;
        continue;
      }
      results.push(result);
    }

    const meta = await getMeta(env);
    let removed = 0;
    let moved = 0;
    for (const result of results) {
      if (!meta.images[result.from]) continue;
      if ((result.action === 'moved' || result.action === 'restored') && result.to) {
        meta.images[result.to] = meta.images[result.from];
        moved += 1;
      } else {
        removed += 1;
      }
      delete meta.images[result.from];
    }
    if (removed > 0 || moved > 0) await saveMeta(env, meta);

    try {
      const hashMeta = await getHashMeta(env);
      let hashRemoved = 0;
      let hashMoved = 0;
      for (const result of results) {
        if (!hashMeta.hashes || !hashMeta.hashes[result.from]) continue;
        if ((result.action === 'moved' || result.action === 'restored') && result.to) {
          hashMeta.hashes[result.to] = hashMeta.hashes[result.from];
          hashMoved += 1;
        } else {
          hashRemoved += 1;
        }
        delete hashMeta.hashes[result.from];
      }
      if (hashRemoved > 0 || hashMoved > 0) await saveHashMeta(env, hashMeta);
    } catch (err) {
      await logError(env, {
        route: '/api/images/batch',
        method: 'POST',
        message: 'Failed to delete hash meta in batch',
        detail: err,
      });
    }

    return Response.json({
      ok: true,
      trashed: results.filter(r => r.action === 'moved').length,
      restored: results.filter(r => r.action === 'restored').length,
      deleted: results.filter(r => r.action === 'deleted').length,
      missing,
      metaRemoved: removed,
      metaMoved: moved,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/batch',
      method: 'POST',
      message: 'Failed to delete images in batch',
      detail: err,
    });
    return new Response(`Failed to delete images: ${err}`, { status: 500 });
  }
}
