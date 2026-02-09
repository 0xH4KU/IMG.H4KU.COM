import { getLogs, clearLogs, logError } from '../_utils/log';
import { authenticateRequest } from '../_utils/auth';

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseNumber(url.searchParams.get('limit'), 50);
    const logs = await getLogs(env, limit);
    return Response.json({ ok: true, logs });
  } catch (err) {
    await logError(env, {
      route: '/api/logs',
      method: 'GET',
      message: 'Failed to read logs',
      detail: err,
    });
    return new Response(`Failed to read logs: ${err}`, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await clearLogs(env);
    return Response.json({ ok: true });
  } catch (err) {
    await logError(env, {
      route: '/api/logs',
      method: 'DELETE',
      message: 'Failed to clear logs',
      detail: err,
    });
    return new Response(`Failed to clear logs: ${err}`, { status: 500 });
  }
}
