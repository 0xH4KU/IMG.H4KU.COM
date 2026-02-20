import { cleanKey, isReservedKey } from '../_utils/keys.ts';

// Serve images from R2 (for local dev)
export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = cleanKey(url.searchParams.get('key'));

  if (!key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  if (key.includes('..') || isReservedKey(key)) {
    return new Response('Invalid key', { status: 400 });
  }

  try {
    const object = await env.R2.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response(`Error: ${err}`, { status: 500 });
  }
}
