import { listAllObjects } from '../_utils/meta';
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
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), env.JWT_SECRET || env.ADMIN_PASSWORD);
}

const SHARE_KEY = '.config/share-meta.json';

async function getShareMeta(env) {
  try {
    const obj = await env.R2.get(SHARE_KEY);
    if (!obj) return { version: 1, updatedAt: new Date().toISOString(), shares: {} };
    return JSON.parse(await obj.text());
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), shares: {} };
  }
}

async function saveShareMeta(env, meta) {
  meta.updatedAt = new Date().toISOString();
  await env.R2.put(SHARE_KEY, JSON.stringify(meta));
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function randomId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64(new Uint8Array(hash));
}

function publicShare(share) {
  const { passwordHash, passwordSalt, ...rest } = share;
  return rest;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const meta = await getShareMeta(env);
    const shares = Object.values(meta.shares || {}).map(share => ({
      id: share.id,
      title: share.title,
      description: share.description,
      count: Array.isArray(share.items) ? share.items.length : 0,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      hasPassword: Boolean(share.passwordHash),
      domain: share.domain || 'h4ku',
    }));
    return Response.json({ shares });
  } catch (err) {
    await logError(env, {
      route: '/api/shares',
      method: 'GET',
      message: 'Failed to list shares',
      detail: err,
    });
    return new Response(`Failed to list shares: ${err}`, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    const items = Array.isArray(body.items)
      ? Array.from(new Set(body.items.filter(k => typeof k === 'string')))
      : [];
    const folder = typeof body.folder === 'string' ? body.folder.trim().replace(/[^a-zA-Z0-9-_]/g, '-') : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const domain = body.domain === 'lum' ? 'lum' : 'h4ku';

    let resolvedItems = items;
    if (resolvedItems.length === 0 && folder) {
      const prefix = `${folder}/`;
      const objects = await listAllObjects(env, prefix);
      resolvedItems = objects
        .filter(obj => !obj.key.startsWith('.config/'))
        .map(obj => obj.key);
    }
    resolvedItems = Array.from(new Set(resolvedItems));

    if (resolvedItems.length === 0) {
      return new Response('Missing items', { status: 400 });
    }

    const id = randomId();
    const now = new Date().toISOString();
    const share = {
      id,
      title: title || `Delivery ${id}`,
      description,
      items: resolvedItems,
      createdAt: now,
      updatedAt: now,
      domain,
      folder: folder || undefined,
    };

    if (password) {
      const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(12)));
      share.passwordSalt = salt;
      share.passwordHash = await hashPassword(password, salt);
    }

    const meta = await getShareMeta(env);
    meta.shares = meta.shares || {};
    meta.shares[id] = share;
    await saveShareMeta(env, meta);

    const origin = new URL(request.url).origin;
    return Response.json({ ok: true, share: publicShare(share), url: `${origin}/share/${id}` });
  } catch (err) {
    await logError(env, {
      route: '/api/shares',
      method: 'POST',
      message: 'Failed to create share',
      detail: err,
    });
    return new Response(`Failed to create share: ${err}`, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  try {
    const meta = await getShareMeta(env);
    if (meta.shares && meta.shares[id]) {
      delete meta.shares[id];
      await saveShareMeta(env, meta);
    }
    return Response.json({ ok: true });
  } catch (err) {
    await logError(env, {
      route: '/api/shares',
      method: 'DELETE',
      message: 'Failed to delete share',
      detail: err,
    });
    return new Response(`Failed to delete share: ${err}`, { status: 500 });
  }
}
