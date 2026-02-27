import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * End-to-end smoke test exercising the full lifecycle:
 * upload → list → delete (trash) → list trash → restore → verify restored
 *
 * Uses the actual route handlers with a mock R2 layer.
 */

import { onRequestPost as uploadHandler } from '../functions/api/upload.ts';
import { onRequestGet as listHandler, onRequestDelete as deleteHandler, onRequestPost as restoreHandler } from '../functions/api/images.ts';

// ─── Mock R2 ───────────────────────────────────────────────────────────

function createMockR2(objects = {}) {
    const store = { ...objects };
    return {
        _store: store,
        async get(key) {
            const obj = store[key];
            if (!obj) return null;
            const body = typeof obj.body === 'string' ? obj.body : (obj.body instanceof ArrayBuffer ? obj.body : JSON.stringify(obj.body ?? ''));
            const textBody = typeof body === 'string' ? body : new TextDecoder().decode(body);
            return {
                body: new ReadableStream({
                    start(c) {
                        c.enqueue(typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body));
                        c.close();
                    }
                }),
                text: async () => textBody,
                arrayBuffer: async () => typeof body === 'string' ? new TextEncoder().encode(body).buffer : body,
                httpMetadata: obj.httpMetadata || {},
                customMetadata: obj.customMetadata || {},
                key,
                size: obj.size || textBody.length,
                uploaded: obj.uploaded || new Date(),
            };
        },
        async head(key) {
            return store[key] ? { key, size: store[key].size || 0 } : null;
        },
        async put(key, body, options = {}) {
            let size = 0;
            if (body instanceof ArrayBuffer) size = body.byteLength;
            else if (typeof body === 'string') size = body.length;
            else size = 0;
            store[key] = { body, size, ...options, uploaded: new Date() };
        },
        async delete(keyOrKeys) {
            const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
            for (const k of keys) delete store[k];
        },
        async list({ prefix = '', cursor, limit = 50 } = {}) {
            const allKeys = Object.keys(store).filter(k => k.startsWith(prefix)).sort();
            const objects = allKeys.slice(0, limit).map(key => ({
                key,
                size: store[key].size || 0,
                uploaded: store[key].uploaded || new Date(),
            }));
            return { objects, truncated: allKeys.length > limit, cursor: null };
        },
    };
}

function createMockEnv() {
    return {
        ADMIN_PASSWORD: 'test-secret',
        DEV_BYPASS_AUTH: '1',
        R2: createMockR2({
            '.config/image-meta.json': { body: JSON.stringify({ version: 1, images: {} }) },
            '.config/image-hashes.json': { body: JSON.stringify({ version: 1, hashes: {} }) },
        }),
    };
}

function makeRequest(url, options = {}) {
    const { method = 'GET', headers = {}, body } = options;
    return new Request(`https://img.h4ku.com${url}`, {
        method,
        headers: { Authorization: 'Bearer dev-local', ...headers },
        body,
    });
}

// ─── E2E Smoke Test ────────────────────────────────────────────────────

test('E2E smoke: list → delete → list trash → restore → verify', async () => {
    const env = createMockEnv();

    // Seed an image directly in R2 (simulating a previous upload)
    await env.R2.put('photos/demo.png', new ArrayBuffer(128), {
        httpMetadata: { contentType: 'image/png' },
        customMetadata: { originalName: 'demo.png', uploadedAt: new Date().toISOString() },
    });

    // 1️⃣ List images — should see the demo image
    const listRes1 = await listHandler({ request: makeRequest('/api/images?folder=photos'), env });
    const list1 = await listRes1.json();
    assert.equal(list1.images.length, 1);
    assert.equal(list1.images[0].key, 'photos/demo.png');

    // 2️⃣ Delete (trash) the image
    const deleteRes = await deleteHandler({
        request: makeRequest('/api/images?key=photos/demo.png', { method: 'DELETE' }),
        env,
    });
    const deleteData = await deleteRes.json();
    assert.equal(deleteData.ok, true);
    assert.equal(deleteData.trashed, true);
    const trashKey = deleteData.to;
    assert.ok(trashKey.startsWith('trash/'), `trash key should start with trash/, got: ${trashKey}`);

    // 3️⃣ List original folder — should be empty
    const listRes2 = await listHandler({ request: makeRequest('/api/images?folder=photos'), env });
    const list2 = await listRes2.json();
    assert.equal(list2.images.length, 0);

    // 4️⃣ List trash — should see the trashed image
    const listRes3 = await listHandler({ request: makeRequest('/api/images?folder=trash'), env });
    const list3 = await listRes3.json();
    assert.ok(list3.images.length >= 1, 'trash should contain the deleted image');
    assert.ok(list3.images.some(i => i.key === trashKey));

    // 5️⃣ Restore from trash
    const restoreRes = await restoreHandler({
        request: makeRequest('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: trashKey }),
        }),
        env,
    });
    const restoreData = await restoreRes.json();
    assert.equal(restoreData.ok, true);
    assert.equal(restoreData.restored, true);

    // 6️⃣ List original folder — should see the restored image
    const listRes4 = await listHandler({ request: makeRequest('/api/images?folder=photos'), env });
    const list4 = await listRes4.json();
    assert.equal(list4.images.length, 1);
    assert.ok(list4.images[0].key.startsWith('photos/'));

    // 7️⃣ Trash should be empty again
    const listRes5 = await listHandler({ request: makeRequest('/api/images?folder=trash'), env });
    const list5 = await listRes5.json();
    const trashImages = list5.images.filter(i => i.key === trashKey);
    assert.equal(trashImages.length, 0, 'trash key should no longer exist after restore');
});
