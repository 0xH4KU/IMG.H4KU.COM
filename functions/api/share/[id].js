import { logError } from '../../_utils/log.ts';
import { listAllObjects, getShareMeta } from '../../_utils/meta.ts';
import { cleanKey, isHiddenObjectKey } from '../../_utils/keys.ts';
import { checkRateLimit, getClientIp, rateLimitResponse } from '../../_utils/rateLimit.ts';

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

async function resolveShareKeys(env, share) {
  if (share?.folder) {
    const prefix = `${share.folder}/`;
    const objects = await listAllObjects(env, prefix);
    const keys = objects
      .map(obj => obj.key)
      .filter(key => !isHiddenObjectKey(key));
    return Array.from(new Set(keys));
  }
  if (!Array.isArray(share?.items)) return [];
  return Array.from(new Set(share.items.map(cleanKey).filter(Boolean)));
}

const SHARE_PASSWORD_RATE_LIMIT = { limit: 10, windowMs: 5 * 60 * 1000 }; // 10 attempts per 5 min

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = cleanKey(params.id);

  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const meta = await getShareMeta(env);
    const share = meta.shares?.[id];
    if (!share) return new Response('Not found', { status: 404 });

    if (share.passwordHash) {
      return Response.json({ error: 'password_required' }, { status: 401 });
    }

    const keys = await resolveShareKeys(env, share);
    const items = await buildItems(env, keys);
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
  const id = cleanKey(params.id);

  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const meta = await getShareMeta(env);
    const share = meta.shares?.[id];
    if (!share) return new Response('Not found', { status: 404 });

    if (!share.passwordHash) {
      const keys = await resolveShareKeys(env, share);
      const items = await buildItems(env, keys);
      return Response.json({ share: publicShare(share), items });
    }

    // Rate-limit password attempts per IP + share combo
    const ip = getClientIp(request);
    const rl = checkRateLimit(`share-pwd:${ip}:${id}`, SHARE_PASSWORD_RATE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) return new Response('Password required', { status: 401 });

    const hash = await hashPassword(password, share.passwordSalt || '');
    if (hash !== share.passwordHash) {
      return new Response('Invalid password', { status: 401 });
    }

    const keys = await resolveShareKeys(env, share);
    const items = await buildItems(env, keys);
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
