import { listAllObjects } from '../../_utils/meta.ts';
import { logError } from '../../_utils/log.ts';
import { authenticateRequest } from '../../_utils/auth.ts';
import { isReservedKey } from '../../_utils/keys.ts';

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

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const objects = await listAllObjects(env);
    let count = 0;
    let size = 0;
    for (const obj of objects) {
      if (isReservedKey(obj.key)) continue;
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
