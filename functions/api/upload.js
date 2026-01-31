import { getHashMeta, saveHashMeta } from '../_utils/meta';
import { logError } from '../_utils/log';

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

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
const MAX_SIZE = 50 * 1024 * 1024;

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || '';
    const customKey = formData.get('key') || '';

    if (!file) return new Response('No file provided', { status: 400 });

    // Thumbnails have relaxed type check (allow webp from canvas)
    const isThumbnail = customKey && customKey.startsWith('.thumbs/');
    if (!isThumbnail && !ALLOWED_TYPES.includes(file.type)) {
      return new Response(`Invalid file type: ${file.type}`, { status: 400 });
    }
    if (file.size > MAX_SIZE) return new Response('File too large (max 50MB)', { status: 400 });

    let key;
    if (isThumbnail) {
      key = customKey;
    } else {
      const timestamp = Date.now().toString(36);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      key = folder ? `${folder}/${timestamp}-${safeName}` : `${timestamp}-${safeName}`;
    }

    const uploadedAt = new Date().toISOString();
    const buffer = await file.arrayBuffer();

    // Skip hash for thumbnails
    if (isThumbnail) {
      await env.R2.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'image/webp' },
      });
      return Response.json({ key, size: file.size, type: file.type });
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hash = bytesToHex(new Uint8Array(hashBuffer));

    await env.R2.put(key, buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name, uploadedAt, sha256: hash },
    });

    try {
      const hashMeta = await getHashMeta(env);
      hashMeta.hashes = hashMeta.hashes || {};
      hashMeta.hashes[key] = { hash, size: file.size, uploadedAt };
      await saveHashMeta(env, hashMeta);
    } catch (err) {
      await logError(env, {
        route: '/api/upload',
        method: 'POST',
        message: 'Failed to write hash meta',
        detail: err,
      });
    }

    return Response.json({ key, size: file.size, type: file.type });
  } catch (err) {
    await logError(env, {
      route: '/api/upload',
      method: 'POST',
      message: 'Upload failed',
      detail: err,
    });
    return new Response(`Upload failed: ${err}`, { status: 500 });
  }
}
