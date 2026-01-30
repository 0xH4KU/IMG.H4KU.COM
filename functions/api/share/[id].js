import { logError } from '../../_utils/log';

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

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
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

async function buildItems(env, keys) {
  const results = await Promise.all(keys.map(async key => {
    const head = await env.R2.head(key);
    if (!head) {
      return { key, missing: true };
    }
    return {
      key,
      size: head.size,
      uploaded: head.uploaded ? head.uploaded.toISOString() : null,
      type: head.httpMetadata?.contentType || null,
    };
  }));
  return results;
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    const meta = await getShareMeta(env);
    const share = meta.shares?.[id];
    if (!share) return new Response('Not found', { status: 404 });

    if (share.passwordHash) {
      return Response.json({ error: 'password_required' }, { status: 401 });
    }

    const items = await buildItems(env, share.items || []);
    return Response.json({ share: publicShare(share), items });
  } catch (err) {
    await logError(env, {
      route: `/api/share/${id}`,
      method: 'GET',
      message: 'Failed to load share',
      detail: err,
    });
    return new Response(`Failed to load share: ${err}`, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const id = params.id;

  try {
    const meta = await getShareMeta(env);
    const share = meta.shares?.[id];
    if (!share) return new Response('Not found', { status: 404 });

    if (!share.passwordHash) {
      const items = await buildItems(env, share.items || []);
      return Response.json({ share: publicShare(share), items });
    }

    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) return new Response('Password required', { status: 401 });

    const hash = await hashPassword(password, share.passwordSalt || '');
    if (hash !== share.passwordHash) {
      return new Response('Invalid password', { status: 401 });
    }

    const items = await buildItems(env, share.items || []);
    return Response.json({ share: publicShare(share), items });
  } catch (err) {
    await logError(env, {
      route: `/api/share/${id}`,
      method: 'POST',
      message: 'Failed to load share',
      detail: err,
    });
    return new Response(`Failed to load share: ${err}`, { status: 500 });
  }
}
