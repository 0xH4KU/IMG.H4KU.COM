import { getTokenTtlMs, isDevBypassEnabled, issueToken } from '../_utils/auth';
import { checkEnvOrFail } from '../_utils/env';

export async function onRequestPost(context) {
  const { request, env } = context;

  const envError = checkEnvOrFail(env);
  if (envError) return envError;

  try {
    if (isDevBypassEnabled(env)) {
      const hasSecret = Boolean(env?.JWT_SECRET || env?.ADMIN_PASSWORD);
      const token = hasSecret
        ? await issueToken(env, getTokenTtlMs(env))
        : 'dev-local';
      return Response.json({ token });
    }

    const { password } = await request.json();
    if (password === env.ADMIN_PASSWORD) {
      const token = await issueToken(env, getTokenTtlMs(env));
      return Response.json({ token });
    }
    return new Response('Invalid password', { status: 401 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
}
