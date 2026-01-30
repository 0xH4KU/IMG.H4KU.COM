import { listAllObjects } from '../../_utils/meta';
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

function parseNumber(value) {
  if (!value && value !== 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function statusFor(value, warn, alert) {
  if (alert !== null && value >= alert) return 'alert';
  if (warn !== null && value >= warn) return 'warn';
  return 'ok';
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const objects = await listAllObjects(env);
    let count = 0;
    let size = 0;
    for (const obj of objects) {
      if (obj.key.startsWith('.config/')) continue;
      count += 1;
      size += obj.size;
    }

    const maxBytes = parseNumber(env.R2_MAX_BYTES);
    const warnBytes = parseNumber(env.R2_WARN_BYTES);
    const alertBytes = parseNumber(env.R2_ALERT_BYTES);
    const maxCount = parseNumber(env.R2_MAX_COUNT);
    const warnCount = parseNumber(env.R2_WARN_COUNT);
    const alertCount = parseNumber(env.R2_ALERT_COUNT);

    const bytesStatus = statusFor(size, warnBytes, alertBytes);
    const countStatus = statusFor(count, warnCount, alertCount);

    return Response.json({
      ok: true,
      total: { count, size },
      thresholds: {
        maxBytes,
        warnBytes,
        alertBytes,
        maxCount,
        warnCount,
        alertCount,
      },
      status: {
        bytes: bytesStatus,
        count: countStatus,
      },
      percent: {
        bytes: maxBytes ? size / maxBytes : null,
        count: maxCount ? count / maxCount : null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    await logError(env, {
      route: '/api/monitoring/r2',
      method: 'GET',
      message: 'Failed to compute R2 usage',
      detail: err,
    });
    return new Response(`Failed to compute R2 usage: ${err}`, { status: 500 });
  }
}
