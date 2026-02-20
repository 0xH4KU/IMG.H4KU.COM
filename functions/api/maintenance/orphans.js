import { listAllObjects, getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getMaintenanceMeta, saveMaintenanceMeta } from '../../_utils/meta.ts';
import { logError } from '../../_utils/log.js';
import { authenticateRequest } from '../../_utils/auth.ts';
import { isReservedKey } from '../../_utils/keys.ts';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const objects = await listAllObjects(env);
    const keySet = new Set();
    for (const obj of objects) {
      if (!isReservedKey(obj.key)) keySet.add(obj.key);
    }

    const meta = await getImageMeta(env);
    let metaRemoved = 0;
    for (const key of Object.keys(meta.images || {})) {
      if (!keySet.has(key)) {
        delete meta.images[key];
        metaRemoved += 1;
      }
    }
    if (metaRemoved > 0) await saveImageMeta(env, meta);

    const hashMeta = await getHashMeta(env);
    let hashRemoved = 0;
    for (const key of Object.keys(hashMeta.hashes || {})) {
      if (!keySet.has(key)) {
        delete hashMeta.hashes[key];
        hashRemoved += 1;
      }
    }
    if (hashRemoved > 0) await saveHashMeta(env, hashMeta);

    const maintenance = await getMaintenanceMeta(env);
    maintenance.lastRuns = maintenance.lastRuns || {};
    maintenance.lastRuns.orphanCleanup = new Date().toISOString();
    await saveMaintenanceMeta(env, maintenance);

    return Response.json({
      ok: true,
      scanned: keySet.size,
      removed: {
        meta: metaRemoved,
        hashes: hashRemoved,
      },
    });
  } catch (err) {
    await logError(env, {
      route: '/api/maintenance/orphans',
      method: 'POST',
      message: 'Failed to cleanup orphan metadata',
      detail: err,
    });
    return new Response(`Failed to cleanup orphan metadata: ${err}`, { status: 500 });
  }
}
