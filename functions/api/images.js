import { getHashMeta, saveHashMeta } from '../_utils/meta';
import { moveToTrash, restoreFromTrash } from '../_utils/trash';
import { logError } from '../_utils/log';
import { authenticateRequest } from '../_utils/auth';
import { cleanKey, isHiddenObjectKey, isTrashKey, ensureSafeObjectKey } from '../_utils/keys';

const META_KEY = '.config/image-meta.json';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const folder = cleanKey(url.searchParams.get('folder'));
  const cursor = url.searchParams.get('cursor') || undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  const prefix = folder ? `${folder}/` : '';
  const includeTrash = folder.toLowerCase() === 'trash';

  try {
    const listed = await env.R2.list({ prefix, cursor, limit: limit + 20 });

    // Filter out hidden objects and trash/ (unless viewing trash)
    const filtered = listed.objects
      .filter(obj => !isHiddenObjectKey(obj.key))
      .filter(obj => includeTrash || !isTrashKey(obj.key));

    // Take only the requested limit
    const images = filtered.slice(0, limit).map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    }));

    // Determine if there are more results
    const hasMore = filtered.length > limit || listed.truncated;
    const nextCursor = hasMore ? listed.cursor : null;

    return Response.json({ images, cursor: nextCursor, hasMore });
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

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const key = cleanKey(url.searchParams.get('key'));
  if (!key) return new Response('Missing key', { status: 400 });

  const keyValidity = ensureSafeObjectKey(key);
  if (!keyValidity.ok) {
    return new Response(keyValidity.reason, { status: 400 });
  }

  try {
    const result = await moveToTrash(env, key);
    if (result.action === 'missing') {
      return new Response('Not found', { status: 404 });
    }

    // Cascade delete metadata
    try {
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

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  let key = '';
  try {
    const body = await request.json();
    key = cleanKey(body.key);
  } catch {
    // ignore body parse error
  }

  if (!key) {
    const url = new URL(request.url);
    key = cleanKey(url.searchParams.get('key'));
  }
  if (!key) return new Response('Missing key', { status: 400 });

  const keyValidity = ensureSafeObjectKey(key);
  if (!keyValidity.ok) {
    return new Response(keyValidity.reason, { status: 400 });
  }

  try {
    const result = await restoreFromTrash(env, key);
    if (result.action === 'not_trash') {
      return new Response('Not in trash', { status: 400 });
    }
    if (result.action === 'missing') {
      return new Response('Not found', { status: 404 });
    }

    // Cascade restore metadata
    try {
      const metaObj = await env.R2.get(META_KEY);
      if (metaObj) {
        const meta = JSON.parse(await metaObj.text());
        if (meta.images && meta.images[result.from]) {
          meta.images[result.to] = meta.images[result.from];
          delete meta.images[result.from];
          meta.updatedAt = new Date().toISOString();
          await env.R2.put(META_KEY, JSON.stringify(meta));
        }
      }
    } catch { /* metadata cleanup failure doesn't affect restore */ }

    try {
      const hashMeta = await getHashMeta(env);
      if (hashMeta.hashes && hashMeta.hashes[result.from]) {
        hashMeta.hashes[result.to] = hashMeta.hashes[result.from];
        delete hashMeta.hashes[result.from];
        await saveHashMeta(env, hashMeta);
      }
    } catch (err) {
      await logError(env, {
        route: '/api/images',
        method: 'POST',
        message: 'Failed to restore hash meta',
        detail: err,
      });
    }

    return Response.json({
      ok: true,
      restored: true,
      key: result.from,
      to: result.to,
      original: result.original,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images',
      method: 'POST',
      message: 'Failed to restore image',
      detail: err,
    });
    return new Response(`Failed to restore: ${err}`, { status: 500 });
  }
}
