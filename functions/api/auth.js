// Auth utilities (inlined)
function getTtlMs(env) {
  const days = Number(env.TOKEN_TTL_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return 30 * 24 * 60 * 60 * 1000;
  return Math.round(days * 24 * 60 * 60 * 1000);
}

function createToken(secret, ttlMs) {
  const now = Date.now();
  const payload = { exp: now + ttlMs, iat: now };
  const data = btoa(JSON.stringify(payload));
  const sig = btoa(secret + data).slice(0, 16);
  return `${data}.${sig}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { password } = await request.json();
    if (password === env.ADMIN_PASSWORD) {
      const token = createToken(env.JWT_SECRET || env.ADMIN_PASSWORD, getTtlMs(env));
      return Response.json({ token });
    }
    return new Response('Invalid password', { status: 401 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
}
