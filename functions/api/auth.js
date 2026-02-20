import { getTokenTtlMs, isDevBypassEnabled, issueToken } from '../_utils/auth.ts';
import { checkEnvOrFail } from '../_utils/env.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function hashIp(ip) {
  const data = new TextEncoder().encode(ip || 'unknown');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function checkRateLimit(env, ip) {
  const key = `.ratelimit/${await hashIp(ip)}`;
  try {
    const obj = await env.R2.get(key);
    if (!obj) return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    const data = JSON.parse(await obj.text());
    const now = Date.now();
    if (now - data.windowStart > WINDOW_MS) {
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }
    if (data.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((data.windowStart + WINDOW_MS - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }
    return { allowed: true, remaining: MAX_ATTEMPTS - data.count - 1, existing: data };
  } catch {
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
}

async function recordAttempt(env, ip) {
  const key = `.ratelimit/${await hashIp(ip)}`;
  const now = Date.now();
  try {
    const obj = await env.R2.get(key);
    let data = obj ? JSON.parse(await obj.text()) : null;
    if (!data || now - data.windowStart > WINDOW_MS) {
      data = { windowStart: now, count: 1 };
    } else {
      data.count += 1;
    }
    await env.R2.put(key, JSON.stringify(data));
  } catch {
    // Best-effort
  }
}

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

    // Rate limit check
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
    const limit = await checkRateLimit(env, clientIp);
    if (!limit.allowed) {
      return new Response('Too many login attempts. Try again later.', {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter || 900) },
      });
    }

    const { password } = await request.json();
    if (password === env.ADMIN_PASSWORD) {
      const token = await issueToken(env, getTokenTtlMs(env));
      return Response.json({ token });
    }

    // Record failed attempt
    context.waitUntil(recordAttempt(env, clientIp));
    return new Response('Invalid password', { status: 401 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
}

