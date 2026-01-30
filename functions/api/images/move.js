import { getImageMeta, saveImageMeta, getHashMeta, saveHashMeta, getShareMeta, saveShareMeta, getFolderMeta, saveFolderMeta } from '../../_utils/meta';
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

function cleanKey(key) {
  return (key || '').trim().replace(/^\/+/, '');
}

function normalizeFolder(name) {
  if (!name) return '';
  return name.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
}

function getBaseName(key) {
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys.filter(k => typeof k === 'string') : [];
    const targetFolder = normalizeFolder(body.targetFolder || '');

    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const renames = keys.map(key => {
      const from = cleanKey(key);
      const base = getBaseName(from);
      const to = targetFolder ? `${targetFolder}/${base}` : base;
      return { from, to };
    });

    const seenTargets = new Set();
    const errors = [];
    const valid = [];

    for (const pair of renames) {
      if (!pair.from || !pair.to) continue;
      if (pair.from === pair.to) {
        errors.push({ from: pair.from, to: pair.to, error: 'Same source and target' });
        continue;
      }
      if (pair.from.startsWith('.config/') || pair.to.startsWith('.config/')) {
        errors.push({ from: pair.from, to: pair.to, error: 'Invalid target' });
        continue;
      }
      if (seenTargets.has(pair.to)) {
        errors.push({ from: pair.from, to: pair.to, error: 'Duplicate target' });
        continue;
      }
      seenTargets.add(pair.to);
      valid.push(pair);
    }

    const meta = await getImageMeta(env);
    const hashMeta = await getHashMeta(env);
    const shareMeta = await getShareMeta(env);
    const folderMeta = await getFolderMeta(env);
    const moved = [];

    for (const pair of valid) {
      const exists = await env.R2.head(pair.to);
      if (exists) {
        errors.push({ from: pair.from, to: pair.to, error: 'Target exists' });
        continue;
      }
      const source = await env.R2.get(pair.from);
      if (!source) {
        errors.push({ from: pair.from, to: pair.to, error: 'Source missing' });
        continue;
      }

      await env.R2.put(pair.to, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
      await env.R2.delete(pair.from);
      moved.push(pair);

      if (meta.images && meta.images[pair.from]) {
        meta.images[pair.to] = meta.images[pair.from];
        delete meta.images[pair.from];
      }
      if (hashMeta.hashes && hashMeta.hashes[pair.from]) {
        hashMeta.hashes[pair.to] = hashMeta.hashes[pair.from];
        delete hashMeta.hashes[pair.from];
      }
    }

    if (moved.length > 0) {
      await saveImageMeta(env, meta);
      await saveHashMeta(env, hashMeta);

      const keyMap = new Map(moved.map(item => [item.from, item.to]));
      if (Object.keys(shareMeta.shares || {}).length > 0) {
        for (const share of Object.values(shareMeta.shares)) {
          if (!Array.isArray(share.items)) continue;
          const mapped = share.items.map(key => keyMap.get(key) || key);
          share.items = Array.from(new Set(mapped));
          share.updatedAt = new Date().toISOString();
        }
        await saveShareMeta(env, shareMeta);
      }

      if (targetFolder) {
        const nextFolders = new Set(folderMeta.folders || []);
        nextFolders.add(targetFolder);
        folderMeta.folders = Array.from(nextFolders).sort();
        await saveFolderMeta(env, folderMeta);
      }
    }

    return Response.json({
      ok: true,
      moved: moved.length,
      skipped: errors.length,
      errors,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/move',
      method: 'POST',
      message: 'Failed to move images',
      detail: err,
    });
    return new Response(`Failed to move images: ${err}`, { status: 500 });
  }
}
