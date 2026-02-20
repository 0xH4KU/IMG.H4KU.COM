import type { Env } from '../_types/index';

function getR2(env: Env): R2Bucket {
    if (!env?.R2) {
        throw new Error('R2 binding is not configured');
    }
    return env.R2;
}

export async function r2Get(env: Env, key: string): Promise<R2ObjectBody | null> {
    return getR2(env).get(key);
}

export async function r2Head(env: Env, key: string): Promise<R2Object | null> {
    return getR2(env).head(key);
}

export async function r2Put(
    env: Env,
    key: string,
    body: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options: R2PutOptions = {},
): Promise<R2Object | null> {
    return getR2(env).put(key, body, options);
}

export async function r2Delete(env: Env, keyOrKeys: string | string[]): Promise<void> {
    await getR2(env).delete(keyOrKeys);
}

export async function r2List(env: Env, options: R2ListOptions): Promise<R2Objects> {
    return getR2(env).list(options);
}

export async function r2MoveObject(
    env: Env,
    from: string,
    to: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const source = await r2Get(env, from);
    if (!source) return { ok: false, reason: 'missing' };

    await r2Put(env, to, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
    });

    await r2Delete(env, from);
    return { ok: true };
}
