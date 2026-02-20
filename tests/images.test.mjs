import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet, onRequestDelete, onRequestPost } from '../functions/api/images.js';

// ─── Mock helpers ──────────────────────────────────────────────────────

function createMockR2(objects = {}) {
    const store = { ...objects };

    return {
        _store: store,
        async get(key) {
            const obj = store[key];
            if (!obj) return null;
            const body = typeof obj.body === 'string' ? obj.body : JSON.stringify(obj.body ?? '');
            return {
                body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close(); } }),
                text: async () => body,
                httpMetadata: obj.httpMetadata || {},
                customMetadata: obj.customMetadata || {},
                key,
                size: obj.size || body.length,
                uploaded: obj.uploaded || new Date(),
            };
        },
        async head(key) {
            return store[key] ? { key, size: store[key].size || 0 } : null;
        },
        async put(key, body, options = {}) {
            store[key] = { body, size: body?.length || 0, ...options, uploaded: new Date() };
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

function createMockEnv(r2Objects = {}) {
    return {
        ADMIN_PASSWORD: 'test-secret',
        DEV_BYPASS_AUTH: '1',
        R2: createMockR2(r2Objects),
    };
}

function createRequest(url, options = {}) {
    const { method = 'GET', headers = {}, body } = options;
    return new Request(`https://img.h4ku.com${url}`, {
        method,
        headers: { Authorization: 'Bearer dev-local', ...headers },
        body,
    });
}

// ─── GET /api/images ───────────────────────────────────────────────────

test('images GET: returns images list with metadata', async () => {
    const env = createMockEnv({
        'photos/a.png': { size: 1024 },
        'photos/b.jpg': { size: 2048 },
        '.config/image-meta.json': { body: '{}' },
    });

    const request = createRequest('/api/images?folder=photos');
    const response = await onRequestGet({ request, env });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.images.length, 2);
    assert.ok(data.images.some(i => i.key === 'photos/a.png'));
});

test('images GET: filters out hidden objects', async () => {
    const env = createMockEnv({
        'a.png': { size: 100 },
        '.config/meta.json': { body: '{}' },
        '.thumbs/a.webp': { size: 50 },
    });

    const request = createRequest('/api/images?folder=');
    const response = await onRequestGet({ request, env });
    const data = await response.json();

    assert.equal(data.images.length, 1);
    assert.equal(data.images[0].key, 'a.png');
});

test('images GET: filters out trash keys by default', async () => {
    const env = createMockEnv({
        'a.png': { size: 100 },
        'trash/b.png': { size: 200 },
    });

    const request = createRequest('/api/images?folder=');
    const response = await onRequestGet({ request, env });
    const data = await response.json();

    assert.equal(data.images.length, 1);
    assert.equal(data.images[0].key, 'a.png');
});

test('images GET: includes trash keys when folder=trash', async () => {
    const env = createMockEnv({
        'trash/b.png': { size: 200 },
    });

    const request = createRequest('/api/images?folder=trash');
    const response = await onRequestGet({ request, env });
    const data = await response.json();

    assert.equal(data.images.length, 1);
    assert.equal(data.images[0].key, 'trash/b.png');
});

// ─── DELETE /api/images ────────────────────────────────────────────────

test('images DELETE: moves image to trash', async () => {
    const env = createMockEnv({
        'folder/img.png': { size: 1024, httpMetadata: { contentType: 'image/png' } },
        '.config/image-meta.json': { body: JSON.stringify({ images: {} }) },
        '.config/image-hashes.json': { body: JSON.stringify({ hashes: {} }) },
    });

    const request = createRequest('/api/images?key=folder/img.png', { method: 'DELETE' });
    const response = await onRequestDelete({ request, env });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.trashed, true);
    // Original should be gone, should be in trash/
    assert.equal(env.R2._store['folder/img.png'], undefined);
    assert.ok(Object.keys(env.R2._store).some(k => k.startsWith('trash/')));
});

test('images DELETE: rejects missing key', async () => {
    const env = createMockEnv();
    const request = createRequest('/api/images?key=', { method: 'DELETE' });
    const response = await onRequestDelete({ request, env });

    assert.equal(response.status, 400);
});

test('images DELETE: rejects reserved keys', async () => {
    const env = createMockEnv();
    const request = createRequest('/api/images?key=.config/meta.json', { method: 'DELETE' });
    const response = await onRequestDelete({ request, env });

    assert.equal(response.status, 400);
});

test('images DELETE: returns 404 for non-existent image', async () => {
    const env = createMockEnv();
    const request = createRequest('/api/images?key=nonexistent.png', { method: 'DELETE' });
    const response = await onRequestDelete({ request, env });

    assert.equal(response.status, 404);
});

// ─── POST /api/images (restore) ────────────────────────────────────────

test('images POST: restores image from trash', async () => {
    const env = createMockEnv({
        'trash/img.png': {
            size: 512,
            httpMetadata: { contentType: 'image/png' },
            customMetadata: { 'trash-original-key': 'folder/img.png' },
        },
        '.config/image-meta.json': { body: JSON.stringify({ images: {} }) },
        '.config/image-hashes.json': { body: JSON.stringify({ hashes: {} }) },
    });

    const request = createRequest('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'trash/img.png' }),
    });
    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.restored, true);
});

test('images POST: rejects non-trash key', async () => {
    const env = createMockEnv({
        'folder/img.png': { size: 100 },
    });

    const request = createRequest('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'folder/img.png' }),
    });
    const response = await onRequestPost({ request, env });

    assert.equal(response.status, 400);
});

test('images POST: returns 404 for missing trash item', async () => {
    const env = createMockEnv();

    const request = createRequest('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'trash/gone.png' }),
    });
    const response = await onRequestPost({ request, env });

    assert.equal(response.status, 404);
});
