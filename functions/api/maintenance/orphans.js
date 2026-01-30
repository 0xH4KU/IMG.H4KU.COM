import { listAllObjects, getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getMaintenanceMeta, saveMaintenanceMeta } from '../../_utils/meta';
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
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const objects = await listAllObjects(env);
    const keySet = new Set();
    for (const obj of objects) {
      if (!obj.key.startsWith('.config/')) keySet.add(obj.key);
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
