import type { Env } from '../_types/index.ts';
import { getHashMeta, saveHashMeta } from '../_utils/meta.ts';
import { logError } from '../_utils/log.ts';
import { authenticateRequest } from '../_utils/auth.ts';
import { normalizeFolderPath, normalizeFileName, ensureSafeUploadKey } from '../_utils/keys.ts';
import { checkRateLimit, getClientIp, rateLimitResponse } from '../_utils/rateLimit.ts';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
const MAX_SIZE = 50 * 1024 * 1024;
const UPLOAD_RATE_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env } = context;

    const rl = checkRateLimit(`upload:${getClientIp(request)}`, UPLOAD_RATE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    if (!(await authenticateRequest(request, env))) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const folder = normalizeFolderPath(String(formData.get('folder') || ''));
        const customKey = String(formData.get('key') || '');

        if (!(file instanceof File)) {
            return new Response('No file provided', { status: 400 });
        }

        // Thumbnails have relaxed type check (allow webp from canvas)
        const isThumbnail = customKey && customKey.startsWith('.thumbs/');
        if (!isThumbnail && !ALLOWED_TYPES.includes(file.type)) {
            return new Response(`Invalid file type: ${file.type}`, { status: 400 });
        }
        if (file.size > MAX_SIZE) return new Response('File too large (max 50MB)', { status: 400 });

        let key: string;
        if (isThumbnail) {
            const keyCheck = ensureSafeUploadKey(customKey, { allowThumbs: true });
            if (!keyCheck.ok) {
                return new Response(keyCheck.reason, { status: 400 });
            }
            key = keyCheck.key!;
        } else {
            const timestamp = Date.now().toString(36);
            const safeName = normalizeFileName(file.name) || `${timestamp}.bin`;
            key = folder ? `${folder}/${timestamp}_${safeName}` : `${timestamp}_${safeName}`;
        }

        const uploadedAt = new Date().toISOString();
        const buffer = await file.arrayBuffer();

        // Skip hash for thumbnails
        if (isThumbnail) {
            await env.R2.put(key, buffer, {
                httpMetadata: { contentType: file.type || 'image/webp' },
            });
            return Response.json({ key, size: file.size, type: file.type });
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = bytesToHex(new Uint8Array(hashBuffer));

        await env.R2.put(key, buffer, {
            httpMetadata: { contentType: file.type },
            customMetadata: { originalName: file.name, uploadedAt, sha256: hash },
        });

        try {
            const hashMeta = await getHashMeta(env);
            hashMeta.hashes = hashMeta.hashes || {};
            hashMeta.hashes[key] = { hash, size: file.size, uploadedAt };
            await saveHashMeta(env, hashMeta);
        } catch (err) {
            await logError(env, {
                route: '/api/upload',
                method: 'POST',
                message: 'Failed to write hash meta',
                detail: err,
            });
        }

        return Response.json({ key, size: file.size, type: file.type });
    } catch (err) {
        await logError(env, {
            route: '/api/upload',
            method: 'POST',
            message: 'Upload failed',
            detail: err,
        });
        return new Response(`Upload failed: ${err}`, { status: 500 });
    }
}
