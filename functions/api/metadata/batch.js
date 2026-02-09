import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { getImageMeta, saveImageMeta } from '../../_utils/meta';
import { cleanKey } from '../../_utils/keys';
import { createOperationTracker } from '../../_utils/operation';

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const tracker = createOperationTracker();

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys.map(cleanKey).filter(Boolean) : [];
    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const addTags = normalizeTags(body.addTags);
    const removeTags = normalizeTags(body.removeTags);

    const meta = await getImageMeta(env);

    for (const key of keys) {
      try {
        const current = meta.images[key] || { tags: [], favorite: false };
        const tagSet = new Set(current.tags);
        for (const tag of addTags) tagSet.add(tag);
        for (const tag of removeTags) tagSet.delete(tag);
        const nextTags = Array.from(tagSet);

        if (nextTags.length === 0 && !current.favorite) {
          if (meta.images[key]) {
            delete meta.images[key];
            tracker.addSuccess(key, { action: 'removed' });
          } else {
            tracker.addSkipped(key, 'No metadata to update');
          }
        } else {
          meta.images[key] = { ...current, tags: nextTags };
          tracker.addSuccess(key, { action: 'updated', tags: nextTags });
        }
      } catch (err) {
        tracker.addFailed(key, err instanceof Error ? err.message : String(err));
      }
    }

    await saveImageMeta(env, meta);

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
      // Legacy field for backward compatibility
      updated: opResult.succeeded,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/metadata/batch',
      method: 'POST',
      message: 'Failed to update metadata in batch',
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
