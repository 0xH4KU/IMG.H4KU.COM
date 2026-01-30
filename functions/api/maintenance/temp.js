import { listAllObjects, getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getShareMeta, saveShareMeta, getMaintenanceMeta, saveMaintenanceMeta } from '../../_utils/meta';
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

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const days = parseNumber(url.searchParams.get('days'), 30);
    const dryRun = url.searchParams.get('dryRun') === '1';
    const auto = url.searchParams.get('auto') === '1';
    const prefix = (url.searchParams.get('prefix') || 'temp/').replace(/^\/+/, '');
    if (prefix.startsWith('.config/')) {
      return new Response('Invalid prefix', { status: 400 });
    }

    const maintenance = await getMaintenanceMeta(env);
    const lastRun = maintenance.lastRuns?.tempCleanup ? Date.parse(maintenance.lastRuns.tempCleanup) : 0;
    if (auto && lastRun && Date.now() - lastRun < 24 * 60 * 60 * 1000) {
      return Response.json({ ok: true, skipped: true, reason: 'recently_run' });
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const objects = await listAllObjects(env, prefix.endsWith('/') ? prefix : `${prefix}/`);
    const toDelete = objects.filter(obj => obj.uploaded && obj.uploaded.getTime() < cutoff);

    if (!dryRun && toDelete.length > 0) {
      const keys = toDelete.map(obj => obj.key);
      await env.R2.delete(keys);

      const meta = await getImageMeta(env);
      let metaRemoved = 0;
      for (const key of keys) {
        if (meta.images && meta.images[key]) {
          delete meta.images[key];
          metaRemoved += 1;
        }
      }
      if (metaRemoved > 0) await saveImageMeta(env, meta);

      const hashMeta = await getHashMeta(env);
      let hashRemoved = 0;
      for (const key of keys) {
        if (hashMeta.hashes && hashMeta.hashes[key]) {
          delete hashMeta.hashes[key];
          hashRemoved += 1;
        }
      }
      if (hashRemoved > 0) await saveHashMeta(env, hashMeta);

      const shareMeta = await getShareMeta(env);
      if (Object.keys(shareMeta.shares || {}).length > 0) {
        for (const share of Object.values(shareMeta.shares)) {
          if (!Array.isArray(share.items)) continue;
          const filtered = share.items.filter(key => !keys.includes(key));
          if (filtered.length !== share.items.length) {
            share.items = filtered;
            share.updatedAt = new Date().toISOString();
          }
        }
        await saveShareMeta(env, shareMeta);
      }
    }

    maintenance.lastRuns = maintenance.lastRuns || {};
    maintenance.lastRuns.tempCleanup = new Date().toISOString();
    await saveMaintenanceMeta(env, maintenance);

    return Response.json({
      ok: true,
      scanned: objects.length,
      deleted: dryRun ? 0 : toDelete.length,
      dryRun,
      days,
      prefix,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/maintenance/temp',
      method: 'POST',
      message: 'Failed to cleanup temp files',
      detail: err,
    });
    return new Response(`Failed to cleanup temp files: ${err}`, { status: 500 });
  }
}
