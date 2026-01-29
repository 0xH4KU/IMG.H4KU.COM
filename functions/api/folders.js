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

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authenticate(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const listed = await env.R2.list({ limit: 1000, delimiter: '/' });
    const folders = new Set();

    if (listed.delimitedPrefixes) {
      for (const prefix of listed.delimitedPrefixes) {
        folders.add(prefix.replace(/\/$/, ''));
      }
    }

    for (const obj of listed.objects) {
      const parts = obj.key.split('/');
      if (parts.length > 1) folders.add(parts[0]);
    }

    // Filter out folders starting with '.' (like .config)
    return Response.json({ folders: Array.from(folders).filter(f => !f.startsWith('.')).sort() });
  } catch (err) {
    return new Response(`Failed to list folders: ${err}`, { status: 500 });
  }
}
