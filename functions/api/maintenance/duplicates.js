import { listAllObjects, getHashMeta, saveHashMeta, getMaintenanceMeta, saveMaintenanceMeta } from '../../_utils/meta';
import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { isReservedKey } from '../../_utils/keys';

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const computeMissing = url.searchParams.get('compute') === '1';
    const limit = parseNumber(url.searchParams.get('limit'), 200);

    const hashMeta = await getHashMeta(env);
    hashMeta.hashes = hashMeta.hashes || {};
    let computed = 0;

    if (computeMissing) {
      const objects = await listAllObjects(env);
      for (const obj of objects) {
        if (computed >= limit) break;
        if (isReservedKey(obj.key)) continue;
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
