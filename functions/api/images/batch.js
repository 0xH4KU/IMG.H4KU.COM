import { getHashMeta, saveHashMeta } from '../../_utils/meta';
import { moveToTrash, restoreFromTrash } from '../../_utils/trash';
import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { cleanKey } from '../../_utils/keys';
import { getImageMeta, saveImageMeta } from '../../_utils/meta';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys)
      ? body.keys.map(cleanKey).filter(Boolean)
      : [];
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

    const meta = await getImageMeta(env);
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
    if (removed > 0 || moved > 0) await saveImageMeta(env, meta);

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
