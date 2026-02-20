import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestDelete, onRequestPost } from '../functions/api/images.js';

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
            return { objects: allKeys.map(key => ({ key, size: store[key].size || 0, uploaded: new Date() })), truncated: false, cursor: null };
        },
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

// ─── Metadata cascade on delete ────────────────────────────────────────

test('delete cascade: image metadata moves from original to trash key', async () => {
    const imageMeta = {
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        images: { 'photos/cat.png': { tags: ['red'], favorite: true } },
    };

    const env = {
        ADMIN_PASSWORD: 'test',
        DEV_BYPASS_AUTH: '1',
        R2: createMockR2({
            'photos/cat.png': { size: 100, httpMetadata: { contentType: 'image/png' } },
            '.config/image-meta.json': { body: JSON.stringify(imageMeta) },
            '.config/image-hashes.json': { body: JSON.stringify({ hashes: { 'photos/cat.png': { hash: 'abc123', size: 100 } } }) },
        }),
    };

    const request = createRequest('/api/images?key=photos/cat.png', { method: 'DELETE' });
    const response = await onRequestDelete({ request, env });
    const data = await response.json();

    assert.equal(data.ok, true);
    assert.equal(data.trashed, true);

    // Check image metadata was cascaded
    const updatedMeta = JSON.parse(await (await env.R2.get('.config/image-meta.json')).text());
    assert.equal(updatedMeta.images['photos/cat.png'], undefined, 'original key should be removed from meta');
    assert.ok(
        Object.keys(updatedMeta.images).some(k => k.startsWith('trash/')),
        'trash key should exist in meta',
    );

    // Check hash metadata was cascaded
    const updatedHash = JSON.parse(await (await env.R2.get('.config/image-hashes.json')).text());
    assert.equal(updatedHash.hashes['photos/cat.png'], undefined, 'original key should be removed from hash meta');
    assert.ok(
        Object.keys(updatedHash.hashes).some(k => k.startsWith('trash/')),
        'trash key should exist in hash meta',
    );
});

test('delete cascade: metadata unchanged when image has no metadata', async () => {
    const imageMeta = {
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        images: { 'other.png': { tags: ['blue'] } },
    };

    const env = {
        ADMIN_PASSWORD: 'test',
        DEV_BYPASS_AUTH: '1',
        R2: createMockR2({
            'no-meta.png': { size: 50, httpMetadata: { contentType: 'image/png' } },
            '.config/image-meta.json': { body: JSON.stringify(imageMeta) },
            '.config/image-hashes.json': { body: JSON.stringify({ hashes: {} }) },
        }),
    };

    const request = createRequest('/api/images?key=no-meta.png', { method: 'DELETE' });
    await onRequestDelete({ request, env });

    // Other metadata should be untouched
    const updatedMeta = JSON.parse(await (await env.R2.get('.config/image-meta.json')).text());
    assert.deepEqual(updatedMeta.images['other.png'], { tags: ['blue'] });
});

// ─── Metadata cascade on restore ───────────────────────────────────────

test('restore cascade: metadata moves from trash key back to original', async () => {
    const imageMeta = {
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        images: { 'trash/cat.png': { tags: ['red'], favorite: true } },
    };

    const env = {
        ADMIN_PASSWORD: 'test',
        DEV_BYPASS_AUTH: '1',
        R2: createMockR2({
            'trash/cat.png': {
                size: 100,
                httpMetadata: { contentType: 'image/png' },
                customMetadata: { 'trash-original-key': 'photos/cat.png' },
            },
            '.config/image-meta.json': { body: JSON.stringify(imageMeta) },
            '.config/image-hashes.json': {
                body: JSON.stringify({
                    hashes: { 'trash/cat.png': { hash: 'abc123', size: 100 } },
                })
            },
        }),
    };

    const request = createRequest('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'trash/cat.png' }),
    });
    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.equal(data.ok, true);
    assert.equal(data.restored, true);

    // Check image metadata was cascaded to restored key
    const updatedMeta = JSON.parse(await (await env.R2.get('.config/image-meta.json')).text());
    assert.equal(updatedMeta.images['trash/cat.png'], undefined, 'trash key should be removed');

    // Check hash metadata was cascaded
    const updatedHash = JSON.parse(await (await env.R2.get('.config/image-hashes.json')).text());
    assert.equal(updatedHash.hashes['trash/cat.png'], undefined, 'trash key should be removed from hashes');
});
