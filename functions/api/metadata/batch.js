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

const META_KEY = '.config/image-meta.json';

async function getMeta(env) {
  try {
    const obj = await env.R2.get(META_KEY);
    if (!obj) return { version: 1, updatedAt: new Date().toISOString(), images: {} };
    return JSON.parse(await obj.text());
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), images: {} };
  }
}

async function saveMeta(env, meta) {
  meta.updatedAt = new Date().toISOString();
  await env.R2.put(META_KEY, JSON.stringify(meta));
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys.filter(k => typeof k === 'string') : [];
    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const addTags = normalizeTags(body.addTags);
    const removeTags = normalizeTags(body.removeTags);

    const meta = await getMeta(env);
    let updated = 0;

    for (const key of keys) {
      const current = meta.images[key] || { tags: [], favorite: false };
      const tagSet = new Set(current.tags);
      for (const tag of addTags) tagSet.add(tag);
      for (const tag of removeTags) tagSet.delete(tag);
      const nextTags = Array.from(tagSet);

      if (nextTags.length === 0 && !current.favorite) {
        if (meta.images[key]) {
          delete meta.images[key];
          updated += 1;
        }
      } else {
        meta.images[key] = { ...current, tags: nextTags };
        updated += 1;
      }
    }

    await saveMeta(env, meta);
    return Response.json({ ok: true, updated });
  } catch (err) {
    await logError(env, {
      route: '/api/metadata/batch',
      method: 'POST',
      message: 'Failed to update metadata in batch',
      detail: err,
    });
    return new Response(`Failed to update metadata: ${err}`, { status: 500 });
  }
}
