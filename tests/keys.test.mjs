import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanKey,
  ensureSafeObjectKey,
  ensureSafeUploadKey,
  normalizeFileName,
  normalizeFolderPath,
} from '../functions/_utils/keys.js';

test('cleanKey: trims and deduplicates slashes', () => {
  assert.equal(cleanKey(' /folder//child///file.png '), 'folder/child/file.png');
});

test('normalizeFolderPath: normalizes unsafe segments', () => {
  assert.equal(normalizeFolderPath(' /a b//../ok/ '), 'a-b/--/ok');
  assert.equal(normalizeFolderPath(''), '');
});

test('normalizeFileName: strips invalid chars and limits length', () => {
  assert.equal(normalizeFileName('  !@#$image name?.png  '), 'image_name_.png');
  assert.equal(normalizeFileName('___unsafe.txt'), 'unsafe.txt');
  assert.equal(normalizeFileName('a'.repeat(300)).length, 255);
});

test('ensureSafeObjectKey: rejects hidden/reserved and traversal keys', () => {
  assert.deepEqual(ensureSafeObjectKey(''), { ok: false, reason: 'Missing key' });
  assert.deepEqual(ensureSafeObjectKey('../a.png'), { ok: false, reason: 'Invalid key path' });
  assert.deepEqual(ensureSafeObjectKey('.config/meta.json'), { ok: false, reason: 'Invalid key path' });
  assert.deepEqual(ensureSafeObjectKey('.thumbs/a.webp'), { ok: false, reason: 'Invalid key path' });

  const valid = ensureSafeObjectKey('folder/image.png');
  assert.equal(valid.ok, true);
  assert.equal(valid.key, 'folder/image.png');
});

test('ensureSafeUploadKey: allows .thumbs only with explicit flag', () => {
  assert.deepEqual(ensureSafeUploadKey('.thumbs/folder/a.webp'), { ok: false, reason: 'Invalid key path' });
  assert.deepEqual(ensureSafeUploadKey('.thumbs/folder/a.webp', { allowThumbs: true }), {
    ok: true,
    key: '.thumbs/folder/a.webp',
  });
  assert.deepEqual(ensureSafeUploadKey('.config/secrets.json', { allowThumbs: true }), {
    ok: false,
    reason: 'Invalid key path',
  });
});

