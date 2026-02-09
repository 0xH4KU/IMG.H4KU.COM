import { logError } from '../../_utils/log';
import { authenticateRequest } from '../../_utils/auth';
import { getImageMeta, saveImageMeta } from '../../_utils/meta';
import { cleanKey } from '../../_utils/keys';

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authenticateRequest(request, env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys.map(cleanKey).filter(Boolean) : [];
    if (keys.length === 0) {
      return new Response('Missing keys', { status: 400 });
    }

    const addTags = normalizeTags(body.addTags);
    const removeTags = normalizeTags(body.removeTags);

    const meta = await getImageMeta(env);
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

    await saveImageMeta(env, meta);
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
