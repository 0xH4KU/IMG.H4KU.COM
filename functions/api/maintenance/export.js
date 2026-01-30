import { getImageMeta, getHashMeta, getShareMeta, getFolderMeta, getMaintenanceMeta } from '../../_utils/meta';
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

function formatDate(value) {
  return value.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const [imageMeta, hashMeta, shareMeta, folderMeta, maintenance] = await Promise.all([
      getImageMeta(env),
      getHashMeta(env),
      getShareMeta(env),
      getFolderMeta(env),
      getMaintenanceMeta(env),
    ]);

    const now = new Date();
    const payload = {
      version: 1,
      generatedAt: now.toISOString(),
      data: {
        imageMeta,
        hashMeta,
        shareMeta,
        folderMeta,
        maintenance,
      },
    };

    const filename = `img-h4ku-backup-${formatDate(now)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    await logError(env, {
      route: '/api/maintenance/export',
      method: 'GET',
      message: 'Failed to export metadata',
      detail: err,
    });
    return new Response(`Failed to export metadata: ${err}`, { status: 500 });
  }
}
