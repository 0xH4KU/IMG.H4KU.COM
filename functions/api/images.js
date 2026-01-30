import { getHashMeta, saveHashMeta } from '../_utils/meta';
import { moveToTrash } from '../_utils/trash';
import { logError } from '../_utils/log';

// Auth utilities (inlined)
function verifyToken(token, secret) {
  try {
    const [data, sig] = token.split('.');
    if (btoa(secret + data).slice(0, 16) !== sig) return false;
    return JSON.parse(atob(data)).exp > Date.now();
  } catch { return false; }
}

function authenticate(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') || '';
  const prefix = folder ? `${folder}/` : '';

  try {
    const listed = await env.R2.list({ prefix, limit: 1000 });
    // Filter out .config/ prefix objects
    const images = listed.objects
      .filter(obj => !obj.key.startsWith('.config/'))
      .map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }));
    return Response.json({ images });
  } catch (err) {
    await logError(env, {
      route: '/api/images',
      method: 'GET',
      message: 'Failed to list images',
      detail: err,
    });
    return new Response(`Failed to list images: ${err}`, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return new Response('Missing key', { status: 400 });

  try {
    const result = await moveToTrash(env, key);
    if (result.action === 'missing') {
      return new Response('Not found', { status: 404 });
    }

    // Cascade delete metadata
    try {
      const META_KEY = '.config/image-meta.json';
      const metaObj = await env.R2.get(META_KEY);
      if (metaObj) {
        const meta = JSON.parse(await metaObj.text());
        if (meta.images && meta.images[result.from]) {
          if (result.action === 'moved' && result.to) {
            meta.images[result.to] = meta.images[result.from];
          }
          delete meta.images[result.from];
          meta.updatedAt = new Date().toISOString();
          await env.R2.put(META_KEY, JSON.stringify(meta));
        }
      }
    } catch { /* metadata cleanup failure doesn't affect image deletion */ }

    // Cascade delete hash metadata
    try {
      const hashMeta = await getHashMeta(env);
      if (hashMeta.hashes && hashMeta.hashes[result.from]) {
        if (result.action === 'moved' && result.to) {
          hashMeta.hashes[result.to] = hashMeta.hashes[result.from];
        }
        delete hashMeta.hashes[result.from];
        await saveHashMeta(env, hashMeta);
      }
    } catch (err) {
      await logError(env, {
        route: '/api/images',
        method: 'DELETE',
        message: 'Failed to delete hash meta',
        detail: err,
      });
    }

    return Response.json({
      ok: true,
      deleted: result.action === 'deleted',
      trashed: result.action === 'moved',
      key: result.from,
      to: result.to,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images',
      method: 'DELETE',
      message: 'Failed to delete image',
      detail: err,
    });
    return new Response(`Failed to delete: ${err}`, { status: 500 });
  }
}
