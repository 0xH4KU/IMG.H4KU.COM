import { getLogs, clearLogs, logError } from '../_utils/log';

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

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
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
  if (!authenticate(request, env)) {
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
