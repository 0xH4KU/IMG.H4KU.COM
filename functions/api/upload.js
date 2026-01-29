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

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
const MAX_SIZE = 20 * 1024 * 1024;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || '';

    if (!file) return new Response('No file provided', { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return new Response(`Invalid file type: ${file.type}`, { status: 400 });
    if (file.size > MAX_SIZE) return new Response('File too large (max 20MB)', { status: 400 });

    const timestamp = Date.now().toString(36);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = folder ? `${folder}/${timestamp}-${safeName}` : `${timestamp}-${safeName}`;

    await env.R2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
    });

    return Response.json({ key, size: file.size, type: file.type });
  } catch (err) {
    return new Response(`Upload failed: ${err}`, { status: 500 });
  }
}
