import { logError } from '../_utils/log.js';
import { authenticateRequest } from '../_utils/auth.ts';
import { getImageMeta, saveImageMeta } from '../_utils/meta.ts';
import { cleanKey } from '../_utils/keys.ts';

// GET /api/metadata - Get all metadata
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const meta = await getImageMeta(env);
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

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const key = cleanKey(body.key);
    const tags = body.tags;
    const favorite = body.favorite;

    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    const meta = await getImageMeta(env);

    // Initialize if not exists
    if (!meta.images[key]) {
      meta.images[key] = { tags: [], favorite: false };
    }

    // Update only provided fields
    if (tags !== undefined) {
      meta.images[key].tags = Array.isArray(tags)
        ? tags.filter(tag => typeof tag === 'string')
        : [];
    }
    if (favorite !== undefined) {
      meta.images[key].favorite = Boolean(favorite);
    }

    // Clean up empty entries
    if (meta.images[key].tags.length === 0 && !meta.images[key].favorite) {
      delete meta.images[key];
    }

    await saveImageMeta(env, meta);

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

  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const key = cleanKey(url.searchParams.get('key'));

  if (!key) {
    return new Response('Missing key', { status: 400 });
  }

  try {
    const meta = await getImageMeta(env);

    if (meta.images[key]) {
      delete meta.images[key];
      await saveImageMeta(env, meta);
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
