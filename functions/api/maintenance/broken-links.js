import { listAllObjects, getImageMeta, getHashMeta, getShareMeta } from '../../_utils/meta';
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
  if (env?.DEV_BYPASS_AUTH === '1' || env?.DEV_BYPASS_AUTH === 'true') return true;
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

export async function onRequestGet(context) {
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
