import { getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getShareMeta, saveShareMeta, getFolderMeta, saveFolderMeta } from '../../_utils/meta';
import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { cleanKey, ensureSafeObjectKey } from '../../_utils/keys';
import { r2Head, r2MoveObject } from '../../_utils/r2';
import { createOperationTracker } from '../../_utils/operation';

function getFolderName(key) {
  const parts = key.split('/');
  return parts.length > 1 ? parts[0] : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const tracker = createOperationTracker();

  try {
    const body = await request.json();
    const renames = Array.isArray(body.renames) ? body.renames : [];
    const pairs = renames
      .filter(item => item && typeof item.from === 'string' && typeof item.to === 'string')
      .map(item => ({ from: cleanKey(item.from), to: cleanKey(item.to) }))
      .filter(item => item.from && item.to);

    if (pairs.length === 0) {
      return new Response('Missing renames', { status: 400 });
    }

    const seenTargets = new Set();
    const valid = [];

    for (const pair of pairs) {
      if (pair.from === pair.to) {
        tracker.addSkipped(pair.from, 'Same source and target');
        continue;
      }
      const fromValidity = ensureSafeObjectKey(pair.from);
      const toValidity = ensureSafeObjectKey(pair.to);
      if (!fromValidity.ok || !toValidity.ok) {
        tracker.addSkipped(pair.from, 'Invalid key path');
        continue;
      }
      if (seenTargets.has(pair.to)) {
        tracker.addSkipped(pair.from, 'Duplicate target');
        continue;
      }
      seenTargets.add(pair.to);
      valid.push(pair);
    }

    const meta = await getImageMeta(env);
    const hashMeta = await getHashMeta(env);
    const shareMeta = await getShareMeta(env);
    const folderMeta = await getFolderMeta(env);
    const moved = [];

    for (const pair of valid) {
      try {
        const exists = await r2Head(env, pair.to);
        if (exists) {
          tracker.addFailed(pair.from, 'Target exists', false);
          continue;
        }

        const movedResult = await r2MoveObject(env, pair.from, pair.to);
        if (!movedResult.ok) {
          tracker.addFailed(pair.from, 'Source missing', false);
          continue;
        }

        moved.push(pair);
        tracker.addSuccess(pair.from, { to: pair.to });

        if (meta.images && meta.images[pair.from]) {
          meta.images[pair.to] = meta.images[pair.from];
          delete meta.images[pair.from];
        }
        if (hashMeta.hashes && hashMeta.hashes[pair.from]) {
          hashMeta.hashes[pair.to] = hashMeta.hashes[pair.from];
          delete hashMeta.hashes[pair.from];
        }
      } catch (err) {
        tracker.addFailed(pair.from, err instanceof Error ? err.message : String(err));
      }
    }

    if (moved.length > 0) {
      await saveImageMeta(env, meta);
      await saveHashMeta(env, hashMeta);

      const keyMap = new Map(moved.map(item => [item.from, item.to]));
      if (Object.keys(shareMeta.shares || {}).length > 0) {
        for (const share of Object.values(shareMeta.shares)) {
          if (!Array.isArray(share.items)) continue;
          const mapped = share.items.map(key => keyMap.get(key) || key);
          share.items = Array.from(new Set(mapped));
          share.updatedAt = new Date().toISOString();
        }
        await saveShareMeta(env, shareMeta);
      }

      const nextFolders = new Set(folderMeta.folders || []);
      for (const pair of moved) {
        const folder = getFolderName(pair.to);
        if (folder) nextFolders.add(folder);
      }
      folderMeta.folders = Array.from(nextFolders).sort();
      await saveFolderMeta(env, folderMeta);
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
      // Legacy field for backward compatibility
      renamed: moved.length,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/rename',
      method: 'POST',
      message: 'Failed to rename images',
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
