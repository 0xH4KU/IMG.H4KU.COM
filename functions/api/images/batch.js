import { getHashMeta, saveHashMeta } from '../../_utils/meta.ts';
import { moveToTrash, restoreFromTrash } from '../../_utils/trash.js';
import { logError } from '../../_utils/log.ts';
import { authenticateRequest } from '../../_utils/auth.ts';
import { cleanKey, ensureSafeObjectKey } from '../../_utils/keys.ts';
import { getImageMeta, saveImageMeta } from '../../_utils/meta.ts';
import { createOperationTracker } from '../../_utils/operation.js';
import { deleteThumb } from '../../_utils/thumbs.ts';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const tracker = createOperationTracker();

  try {
    const body = await request.json();
    const rawKeys = Array.isArray(body.keys)
      ? body.keys.map(cleanKey).filter(Boolean)
      : [];

    const keys = [];
    for (const key of rawKeys) {
      const validity = ensureSafeObjectKey(key);
      if (validity.ok) {
        keys.push(validity.key);
      } else {
        tracker.addSkipped(key, validity.reason || 'Invalid key');
      }
    }
    const action = body.action === 'restore' ? 'restore' : 'delete';
    if (keys.length === 0 && tracker.getResult().skipped === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const results = [];
    for (const key of keys) {
      try {
        const result = action === 'restore'
          ? await restoreFromTrash(env, key)
          : await moveToTrash(env, key);

        if (result.action === 'missing') {
          tracker.addSkipped(key, 'Object not found');
        } else if (result.action === 'not_trash') {
          tracker.addSkipped(key, 'Not in trash');
        } else {
          tracker.addSuccess(key, { action: result.action, to: result.to });
          results.push(result);

          // Cascade delete thumbnail for trashed/deleted images
          if (action === 'delete') {
            await deleteThumb(env, key);
          }
        }
      } catch (err) {
        tracker.addFailed(key, err instanceof Error ? err.message : String(err));
      }
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
        message: 'Failed to update hash meta in batch',
        detail: err,
        operationId: tracker.id,
      });
    }

    const opResult = tracker.getResult();
    return Response.json({
      ok: opResult.ok,
      operationId: opResult.operationId,
      total: opResult.total,
      succeeded: opResult.succeeded,
      failed: opResult.failed,
      skipped: opResult.skipped,
      retryable: opResult.retryable,
      durationMs: opResult.durationMs,
      details: opResult.details,
      // Legacy fields for backward compatibility
      trashed: results.filter(r => r.action === 'moved').length,
      restored: results.filter(r => r.action === 'restored').length,
      deleted: results.filter(r => r.action === 'deleted').length,
      missing: opResult.skipped,
      metaRemoved: removed,
      metaMoved: moved,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/batch',
      method: 'POST',
      message: 'Failed to process batch operation',
      detail: err,
      operationId: tracker.id,
    });
    const opResult = tracker.getResult();
    return Response.json({
      ok: false,
      operationId: opResult.operationId,
      error: err instanceof Error ? err.message : String(err),
      total: opResult.total,
      succeeded: opResult.succeeded,
      failed: opResult.failed,
      skipped: opResult.skipped,
      retryable: opResult.retryable,
      durationMs: opResult.durationMs,
      details: opResult.details,
    }, { status: 500 });
  }
}
