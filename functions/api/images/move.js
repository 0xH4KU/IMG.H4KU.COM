import { getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getShareMeta, saveShareMeta, getFolderMeta, saveFolderMeta } from '../../_utils/meta';
import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { cleanKey, normalizeFolderPath, ensureSafeObjectKey } from '../../_utils/keys';
import { r2Head, r2MoveObject } from '../../_utils/r2';
import { createOperationTracker } from '../../_utils/operation';

function getBaseName(key) {
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
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
    const targetFolder = normalizeFolderPath(body.targetFolder || '');

    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const renames = keys.map(key => {
      const from = cleanKey(key);
      const base = getBaseName(from);
      const to = targetFolder ? `${targetFolder}/${base}` : base;
      return { from, to };
    });

    const seenTargets = new Set();
    const valid = [];

    for (const pair of renames) {
      if (!pair.from || !pair.to) continue;
      const fromValidity = ensureSafeObjectKey(pair.from);
      const toValidity = ensureSafeObjectKey(pair.to);
      if (!fromValidity.ok || !toValidity.ok) {
        tracker.addSkipped(pair.from, 'Invalid key path');
        continue;
      }
      if (pair.from === pair.to) {
        tracker.addSkipped(pair.from, 'Same source and target');
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

      if (targetFolder) {
        const nextFolders = new Set(folderMeta.folders || []);
        nextFolders.add(targetFolder);
        folderMeta.folders = Array.from(nextFolders).sort();
        await saveFolderMeta(env, folderMeta);
      }
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
      moved: moved.length,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/move',
      method: 'POST',
      message: 'Failed to move images',
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
