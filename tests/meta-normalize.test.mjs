import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeImageMeta,
    normalizeHashMeta,
    normalizeShareMeta,
    normalizeFolderMeta,
    normalizeMaintenanceMeta,
} from '../functions/_utils/meta.ts';

// ─── normalizeImageMeta ─────────────────────────────────────────────

test('normalizeImageMeta: normalizes valid data', () => {
    const meta = normalizeImageMeta({
        version: 3,
        updatedAt: '2024-01-01T00:00:00Z',
        images: {
            'folder/img.png': { tags: ['red', 'blue'], favorite: true },
            'other.jpg': { tags: [], favorite: false },
        },
    });

    assert.equal(meta.version, 3);
    assert.equal(meta.updatedAt, '2024-01-01T00:00:00Z');
    assert.deepEqual(meta.images['folder/img.png'].tags, ['red', 'blue']);
    assert.equal(meta.images['folder/img.png'].favorite, true);
    assert.equal(meta.images['other.jpg'].favorite, false);
});

test('normalizeImageMeta: handles null/undefined/empty input', () => {
    const meta = normalizeImageMeta(null);
    assert.equal(meta.version, 1);
    assert.deepEqual(meta.images, {});

    const meta2 = normalizeImageMeta(undefined);
    assert.equal(meta2.version, 1);

    const meta3 = normalizeImageMeta({});
    assert.equal(meta3.version, 1);
    assert.deepEqual(meta3.images, {});
});

test('normalizeImageMeta: strips non-string tags', () => {
    const meta = normalizeImageMeta({
        images: {
            'a.png': { tags: ['red', 123, null, 'blue'], favorite: 0 },
        },
    });
    assert.deepEqual(meta.images['a.png'].tags, ['red', 'blue']);
    assert.equal(meta.images['a.png'].favorite, false);
});

// ─── normalizeHashMeta ──────────────────────────────────────────────

test('normalizeHashMeta: normalizes valid data', () => {
    const meta = normalizeHashMeta({
        version: 2,
        hashes: {
            'img.png': { hash: 'abc123', size: 1024, uploadedAt: '2024-01-01' },
        },
    });

    assert.equal(meta.version, 2);
    assert.equal(meta.hashes['img.png'].hash, 'abc123');
    assert.equal(meta.hashes['img.png'].size, 1024);
});

test('normalizeHashMeta: handles missing/invalid sizes', () => {
    const meta = normalizeHashMeta({
        hashes: {
            'a.png': { hash: 'abc', size: 'invalid' },
            'b.png': { hash: 'def' },
        },
    });

    assert.equal(meta.hashes['a.png'].size, null);
    assert.equal(meta.hashes['b.png'].size, null);
});

// ─── normalizeShareMeta ─────────────────────────────────────────────

test('normalizeShareMeta: normalizes share entries', () => {
    const meta = normalizeShareMeta({
        version: 1,
        shares: {
            abc123: {
                id: 'abc123',
                title: 'Test Share',
                items: ['img1.png', 'img2.png'],
                domain: 'lum',
            },
        },
    });

    assert.equal(meta.shares.abc123.title, 'Test Share');
    assert.equal(meta.shares.abc123.domain, 'lum');
    assert.deepEqual(meta.shares.abc123.items, ['img1.png', 'img2.png']);
});

test('normalizeShareMeta: defaults domain to h4ku', () => {
    const meta = normalizeShareMeta({
        shares: {
            x: { id: 'x' },
        },
    });

    assert.equal(meta.shares.x.domain, 'h4ku');
});

// ─── normalizeFolderMeta ────────────────────────────────────────────

test('normalizeFolderMeta: normalizes folder list', () => {
    const meta = normalizeFolderMeta({
        version: 1,
        folders: ['photos', 'docs', 123],
    });

    assert.deepEqual(meta.folders, ['photos', 'docs']);
});

test('normalizeFolderMeta: handles empty input', () => {
    const meta = normalizeFolderMeta(null);
    assert.equal(meta.version, 1);
    assert.deepEqual(meta.folders, []);
});

// ─── normalizeMaintenanceMeta ───────────────────────────────────────

test('normalizeMaintenanceMeta: normalizes last run timestamps', () => {
    const meta = normalizeMaintenanceMeta({
        version: 1,
        lastRuns: {
            cleanup: '2024-01-01T00:00:00Z',
            orphans: '2024-02-01T00:00:00Z',
        },
    });

    assert.equal(meta.lastRuns.cleanup, '2024-01-01T00:00:00Z');
    assert.equal(meta.lastRuns.orphans, '2024-02-01T00:00:00Z');
});

test('normalizeMaintenanceMeta: skips non-string values', () => {
    const meta = normalizeMaintenanceMeta({
        lastRuns: { a: '2024-01-01', b: 123, c: null, d: '' },
    });

    assert.equal(meta.lastRuns.a, '2024-01-01');
    assert.equal(meta.lastRuns.b, undefined);
    assert.equal(meta.lastRuns.c, undefined);
    assert.equal(meta.lastRuns.d, undefined);
});
