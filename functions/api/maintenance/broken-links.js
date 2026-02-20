import { listAllObjects, getImageMeta, getHashMeta, getShareMeta } from '../../_utils/meta.ts';
import { logError } from '../../_utils/log.js';
import { authenticateRequest } from '../../_utils/auth.ts';
import { isReservedKey } from '../../_utils/keys.ts';

export async function onRequestGet(context) {
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
    const metaMissing = Object.keys(meta.images || {}).filter(key => !keySet.has(key));

    const hashMeta = await getHashMeta(env);
    const hashMissing = Object.keys(hashMeta.hashes || {}).filter(key => !keySet.has(key));

    const shareMeta = await getShareMeta(env);
    const shareMissing = {};
    for (const share of Object.values(shareMeta.shares || {})) {
      if (!Array.isArray(share.items)) continue;
      const missing = share.items.filter(key => !keySet.has(key));
      if (missing.length > 0) {
        shareMissing[share.id] = missing;
      }
    }

    return Response.json({
      ok: true,
      missing: {
        meta: metaMissing,
        hashes: hashMissing,
        shares: shareMissing,
      },
      counts: {
        meta: metaMissing.length,
        hashes: hashMissing.length,
        shares: Object.keys(shareMissing).length,
      },
    });
  } catch (err) {
    await logError(env, {
      route: '/api/maintenance/broken-links',
      method: 'GET',
      message: 'Failed to check broken links',
      detail: err,
    });
    return new Response(`Failed to check broken links: ${err}`, { status: 500 });
  }
}
