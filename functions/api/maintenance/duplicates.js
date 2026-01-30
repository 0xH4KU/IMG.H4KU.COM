import { listAllObjects, getHashMeta, saveHashMeta, getMaintenanceMeta, saveMaintenanceMeta } from '../../_utils/meta';
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

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
    const computeMissing = url.searchParams.get('compute') === '1';
    const limit = parseNumber(url.searchParams.get('limit'), 200);

    const hashMeta = await getHashMeta(env);
    hashMeta.hashes = hashMeta.hashes || {};
    let computed = 0;

    if (computeMissing) {
      const objects = await listAllObjects(env);
      for (const obj of objects) {
        if (computed >= limit) break;
        if (obj.key.startsWith('.config/')) continue;
        if (hashMeta.hashes[obj.key]) continue;
        const source = await env.R2.get(obj.key);
        if (!source) continue;
        const buffer = await source.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = bytesToHex(new Uint8Array(hashBuffer));
        hashMeta.hashes[obj.key] = {
          hash,
          size: obj.size,
          uploadedAt: obj.uploaded ? obj.uploaded.toISOString() : null,
        };
        computed += 1;
      }
      if (computed > 0) {
        await saveHashMeta(env, hashMeta);
      }
    }

    const groups = new Map();
    for (const [key, info] of Object.entries(hashMeta.hashes)) {
      if (!info || !info.hash) continue;
      const entry = groups.get(info.hash) || { hash: info.hash, size: info.size || null, keys: [] };
      entry.keys.push(key);
      if (!entry.size && info.size) entry.size = info.size;
      groups.set(info.hash, entry);
    }

    const duplicates = Array.from(groups.values()).filter(group => group.keys.length > 1);

    const maintenance = await getMaintenanceMeta(env);
    maintenance.lastRuns = maintenance.lastRuns || {};
    maintenance.lastRuns.duplicateScan = new Date().toISOString();
    await saveMaintenanceMeta(env, maintenance);

    return Response.json({
      ok: true,
      computed,
      totalHashes: Object.keys(hashMeta.hashes).length,
      duplicates,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/maintenance/duplicates',
      method: 'GET',
      message: 'Failed to scan duplicates',
      detail: err,
    });
    return new Response(`Failed to scan duplicates: ${err}`, { status: 500 });
  }
}
