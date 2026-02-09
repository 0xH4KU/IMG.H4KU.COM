// @ts-check

/** @param {Record<string, unknown>} env */
function getR2(env) {
  if (!env?.R2) {
    throw new Error('R2 binding is not configured');
  }
  return env.R2;
}

/** @param {Record<string, unknown>} env @param {string} key */
export async function r2Get(env, key) {
  return getR2(env).get(key);
}

/** @param {Record<string, unknown>} env @param {string} key */
export async function r2Head(env, key) {
  return getR2(env).head(key);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {ArrayBuffer|Uint8Array|ReadableStream|Blob} body
 * @param {Record<string, unknown>} [options]
 */
export async function r2Put(env, key, body, options = {}) {
  return getR2(env).put(key, body, options);
}

/** @param {Record<string, unknown>} env @param {string | string[]} keyOrKeys */
export async function r2Delete(env, keyOrKeys) {
  return getR2(env).delete(keyOrKeys);
}

/** @param {Record<string, unknown>} env @param {Record<string, unknown>} options */
export async function r2List(env, options) {
  return getR2(env).list(options);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} from
 * @param {string} to
 */
export async function r2MoveObject(env, from, to) {
  const source = await r2Get(env, from);
  if (!source) return { ok: false, reason: 'missing' };

  await r2Put(env, to, source.body, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata,
  });

  await r2Delete(env, from);
  return { ok: true };
}

