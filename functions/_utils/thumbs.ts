import type { Env } from '../_types/index';
import { r2Get, r2Put, r2Delete } from './r2.ts';

const THUMBS_PREFIX = '.thumbs/';

function thumbKey(imageKey: string): string {
    return `${THUMBS_PREFIX}${imageKey}`;
}

/**
 * Delete the thumbnail associated with an image key.
 * Fire-and-forget: errors are silently swallowed.
 */
export async function deleteThumb(env: Env, imageKey: string): Promise<void> {
    try {
        await r2Delete(env, thumbKey(imageKey));
    } catch {
        // Thumbnail cleanup is best-effort
    }
}

/**
 * Move (rename) the thumbnail from one image key to another.
 * Fire-and-forget: errors are silently swallowed.
 */
export async function moveThumb(env: Env, fromKey: string, toKey: string): Promise<void> {
    try {
        const source = await r2Get(env, thumbKey(fromKey));
        if (!source) return;
        await r2Put(env, thumbKey(toKey), source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
        });
        await r2Delete(env, thumbKey(fromKey));
    } catch {
        // Thumbnail cleanup is best-effort
    }
}
