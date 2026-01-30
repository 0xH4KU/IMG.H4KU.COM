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
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

function cleanKey(key) {
  return (key || '').trim().replace(/^\/+/, '');
}

function getFolderName(key) {
  const parts = key.split('/');
  return parts.length > 1 ? parts[0] : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const renames = Array.isArray(body.renames) ? body.renames : [];
    const pairs = renames
      .filter(item => item && typeof item.from === 'string' && typeof item.to === 'string')
      .map(item => ({ from: cleanKey(item.from), to: cleanKey(item.to) }))
      .filter(item => item.from && item.to);

    if (pairs.length === 0) {
      return new Response('Missing renames', { status: 400 });
    }

    const seenTargets = new Set();
    const errors = [];
    const valid = [];

    for (const pair of pairs) {
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

      const nextFolders = new Set(folderMeta.folders || []);
      for (const pair of moved) {
        const folder = getFolderName(pair.to);
        if (folder) nextFolders.add(folder);
      }
      folderMeta.folders = Array.from(nextFolders).sort();
      await saveFolderMeta(env, folderMeta);
    }

    return Response.json({
      ok: true,
      renamed: moved.length,
      skipped: errors.length,
      errors,
    });
  } catch (err) {
    await logError(env, {
      route: '/api/images/rename',
      method: 'POST',
      message: 'Failed to rename images',
      detail: err,
    });
    return new Response(`Failed to rename images: ${err}`, { status: 500 });
  }
}
