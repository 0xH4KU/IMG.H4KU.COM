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

// GET /api/metadata - Get all metadata
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const meta = await getMeta(env);
    return Response.json(meta);
  } catch (err) {
    await logError(env, {
      route: '/api/metadata',
      method: 'GET',
      message: 'Failed to get metadata',
      detail: err,
    });
    return new Response(`Failed to get metadata: ${err}`, { status: 500 });
  }
}

// PUT /api/metadata - Update single image metadata
// Body: { key: "folder/img.jpg", tags?: ["red","blue"], favorite?: boolean }
export async function onRequestPut(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, tags, favorite } = body;

    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    const meta = await getMeta(env);

    // Initialize if not exists
    if (!meta.images[key]) {
      meta.images[key] = { tags: [], favorite: false };
    }

    // Update only provided fields
    if (tags !== undefined) {
      meta.images[key].tags = tags;
    }
    if (favorite !== undefined) {
      meta.images[key].favorite = favorite;
    }

    // Clean up empty entries
    if (meta.images[key].tags.length === 0 && !meta.images[key].favorite) {
      delete meta.images[key];
    }

    await saveMeta(env, meta);

    return Response.json({
      ok: true,
      meta: meta.images[key] || { tags: [], favorite: false }
    });
  } catch (err) {
    await logError(env, {
      route: '/api/metadata',
      method: 'PUT',
      message: 'Failed to update metadata',
      detail: err,
    });
    return new Response(`Failed to update metadata: ${err}`, { status: 500 });
  }
}

// DELETE /api/metadata?key=xxx - Delete single entry
export async function onRequestDelete(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response('Missing key', { status: 400 });
  }

  try {
    const meta = await getMeta(env);

    if (meta.images[key]) {
      delete meta.images[key];
      await saveMeta(env, meta);
    }

    return Response.json({ ok: true });
  } catch (err) {
    await logError(env, {
      route: '/api/metadata',
      method: 'DELETE',
      message: 'Failed to delete metadata',
      detail: err,
    });
    return new Response(`Failed to delete metadata: ${err}`, { status: 500 });
  }
}
