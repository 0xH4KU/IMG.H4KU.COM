import type { Env } from '../_types/index.ts';
import { getHashMeta, saveHashMeta, getShareMeta, saveShareMeta, listAllObjects, getFolderMeta, saveFolderMeta, getImageMeta, saveImageMeta } from '../_utils/meta.ts';
import { moveToTrash } from '../_utils/trash.js';
import { logError } from '../_utils/log.ts';
import { authenticateRequest } from '../_utils/auth.ts';
import { normalizeFolderSegment, isValidFolderSegment, isHiddenObjectKey } from '../_utils/keys.ts';

function normalizeFolder(name: string): string {
    return normalizeFolderSegment(name);
}

function isValidFolder(name: string): boolean {
    return isValidFolderSegment(name);
}

export async function onRequestGet(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env } = context;

    if (!(await authenticateRequest(request, env))) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const includeStats = url.searchParams.get('stats') === '1';

        const listed = await env.R2.list({ limit: 1000, delimiter: '/' });
        const folderSet = new Set<string>();

        if (listed.delimitedPrefixes) {
            for (const prefix of listed.delimitedPrefixes) {
                folderSet.add(prefix.replace(/\/$/, ''));
            }
        }

        for (const obj of listed.objects) {
            const parts = obj.key.split('/');
            if (parts.length > 1) folderSet.add(parts[0]);
        }

        const folderMeta = await getFolderMeta(env);
        for (const folder of folderMeta.folders) {
            folderSet.add(folder);
        }

        const folders = Array.from(folderSet).filter(f => f && !f.startsWith('.')).sort();

        if (!includeStats) {
            return Response.json({ folders });
        }

        const stats: Record<string, { count: number; size: number }> = {};
        const total = { count: 0, size: 0 };
        const objects = await listAllObjects(env);

        for (const obj of objects) {
            if (isHiddenObjectKey(obj.key)) continue;
            const isTrash = obj.key.startsWith('trash/');
            if (!isTrash) {
                total.count += 1;
                total.size += obj.size;
            }
            const parts = obj.key.split('/');
            if (parts.length > 1) {
                const folder = parts[0];
                if (!stats[folder]) stats[folder] = { count: 0, size: 0 };
                stats[folder].count += 1;
                stats[folder].size += obj.size;
            }
        }

        return Response.json({ folders, stats, total });
    } catch (err) {
        await logError(env, {
            route: '/api/folders',
            method: 'GET',
            message: 'Failed to list folders',
            detail: err,
        });
        return new Response(`Failed to list folders: ${err}`, { status: 500 });
    }
}

export async function onRequestPost(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env } = context;
    if (!(await authenticateRequest(request, env))) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json() as { name?: string };
        const name = normalizeFolder(body.name || '');
        if (!name || !isValidFolder(name)) {
            return new Response('Invalid folder name', { status: 400 });
        }

        const meta = await getFolderMeta(env);
        if (!meta.folders.includes(name)) {
            meta.folders.push(name);
            meta.folders.sort();
            await saveFolderMeta(env, meta);
        }

        return Response.json({ ok: true, folder: name });
    } catch (err) {
        await logError(env, {
            route: '/api/folders',
            method: 'POST',
            message: 'Failed to create folder',
            detail: err,
        });
        return new Response(`Failed to create folder: ${err}`, { status: 500 });
    }
}

export async function onRequestPut(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env } = context;
    if (!(await authenticateRequest(request, env))) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json() as { from?: string; to?: string; mode?: string };
        const from = normalizeFolder(body.from || '');
        const to = normalizeFolder(body.to || '');
        const mode = body.mode === 'merge' ? 'merge' : 'rename';

        if (!from || !to || !isValidFolder(from) || !isValidFolder(to)) {
            return new Response('Invalid folder name', { status: 400 });
        }
        if (from === to) {
            return new Response('Source and target folders are the same', { status: 400 });
        }

        const allObjects = await listAllObjects(env, `${from}/`);
        if (mode === 'rename' && allObjects.length === 0) {
            // allow renaming empty folder from meta
        } else if (mode === 'rename') {
            const targetObjects = await listAllObjects(env, `${to}/`);
            if (targetObjects.length > 0) {
                return new Response('Target folder is not empty', { status: 409 });
            }
        }

        const meta = await getImageMeta(env);
        const updatedImages = { ...meta.images };
        const hashMeta = await getHashMeta(env);
        const updatedHashes = { ...hashMeta.hashes };
        const shareMeta = await getShareMeta(env);
        const shareKeyMap = new Map<string, string>();

        for (const obj of allObjects) {
            const newKey = obj.key.replace(`${from}/`, `${to}/`);
            const source = await env.R2.get(obj.key);
            if (!source) continue;
            await env.R2.put(newKey, source.body, {
                httpMetadata: source.httpMetadata,
                customMetadata: source.customMetadata,
            });
            await env.R2.delete(obj.key);

            if (updatedImages[obj.key]) {
                updatedImages[newKey] = updatedImages[obj.key];
                delete updatedImages[obj.key];
            }

            if (updatedHashes[obj.key]) {
                updatedHashes[newKey] = updatedHashes[obj.key];
                delete updatedHashes[obj.key];
            }
            shareKeyMap.set(obj.key, newKey);
        }

        meta.images = updatedImages;
        await saveImageMeta(env, meta);

        hashMeta.hashes = updatedHashes;
        await saveHashMeta(env, hashMeta);

        if (Object.keys(shareMeta.shares || {}).length > 0 && shareKeyMap.size > 0) {
            for (const share of Object.values(shareMeta.shares)) {
                if (!Array.isArray(share.items)) continue;
                const mapped = share.items.map(key => shareKeyMap.get(key) || key);
                share.items = Array.from(new Set(mapped));
                share.updatedAt = new Date().toISOString();
            }
            await saveShareMeta(env, shareMeta);
        }

        const folderMeta = await getFolderMeta(env);
        const nextFolders = new Set(folderMeta.folders);
        if (nextFolders.has(from)) nextFolders.delete(from);
        nextFolders.add(to);
        folderMeta.folders = Array.from(nextFolders).sort();
        await saveFolderMeta(env, folderMeta);

        return Response.json({ ok: true, moved: allObjects.length, mode });
    } catch (err) {
        await logError(env, {
            route: '/api/folders',
            method: 'PUT',
            message: 'Failed to update folder',
            detail: err,
        });
        return new Response(`Failed to update folder: ${err}`, { status: 500 });
    }
}

export async function onRequestDelete(context: EventContext<Env, string, unknown>): Promise<Response> {
    const { request, env } = context;
    if (!(await authenticateRequest(request, env))) {
        return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const name = normalizeFolder(url.searchParams.get('name') || '');
    if (!name || !isValidFolder(name)) {
        return new Response('Invalid folder name', { status: 400 });
    }

    try {
        const objects = await listAllObjects(env, `${name}/`);
        if (objects.length > 0) {
            const results: Array<{ action: string; from: string; to?: string }> = [];
            for (const obj of objects) {
                const result = await moveToTrash(env, obj.key);
                if (result.action !== 'missing') results.push(result);
            }

            const meta = await getImageMeta(env);
            const hashMeta = await getHashMeta(env);
            let changed = false;
            let hashChanged = false;
            for (const result of results) {
                if (meta.images[result.from]) {
                    if (result.action === 'moved' && result.to) {
                        meta.images[result.to] = meta.images[result.from];
                    }
                    delete meta.images[result.from];
                    changed = true;
                }
                if (hashMeta.hashes && hashMeta.hashes[result.from]) {
                    if (result.action === 'moved' && result.to) {
                        hashMeta.hashes[result.to] = hashMeta.hashes[result.from];
                    }
                    delete hashMeta.hashes[result.from];
                    hashChanged = true;
                }
            }
            if (changed) await saveImageMeta(env, meta);
            if (hashChanged) await saveHashMeta(env, hashMeta);
        }

        const folderMeta = await getFolderMeta(env);
        if (folderMeta.folders.includes(name)) {
            folderMeta.folders = folderMeta.folders.filter(f => f !== name);
            await saveFolderMeta(env, folderMeta);
        }

        return Response.json({ ok: true, deleted: objects.length });
    } catch (err) {
        await logError(env, {
            route: '/api/folders',
            method: 'DELETE',
            message: 'Failed to delete folder',
            detail: err,
        });
        return new Response(`Failed to delete folder: ${err}`, { status: 500 });
    }
}
