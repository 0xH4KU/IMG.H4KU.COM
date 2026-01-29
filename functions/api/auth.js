// Auth utilities (inlined)
function createToken(secret) {
  const payload = { exp: Date.now() + 24 * 60 * 60 * 1000, iat: Date.now() };
  const data = btoa(JSON.stringify(payload));
  const sig = btoa(secret + data).slice(0, 16);
  return `${data}.${sig}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { password } = await request.json();
    if (password === env.ADMIN_PASSWORD) {
      const token = createToken(env.JWT_SECRET || env.ADMIN_PASSWORD);
      return Response.json({ token });
    }
    return new Response('Invalid password', { status: 401 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
}
