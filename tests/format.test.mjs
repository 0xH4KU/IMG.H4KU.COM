import assert from 'node:assert/strict';
import test from 'node:test';

import { formatBytes, normalizeDownloadName, formatDateShort } from '../src/utils/format.ts';

test('formatBytes: returns empty string for null/undefined', () => {
    assert.equal(formatBytes(null), '');
    assert.equal(formatBytes(undefined), '');
});

test('formatBytes: formats bytes correctly', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1024), '1.0 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(1024 * 1024), '1.0 MB');
    assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
    assert.equal(formatBytes(1024 * 1024 * 1024), '1.00 GB');
});

test('normalizeDownloadName: normalizes names correctly', () => {
    assert.equal(normalizeDownloadName('Hello World!'), 'Hello-World');
    assert.equal(normalizeDownloadName('  ---  '), 'download'); // fallback because result is empty
    assert.equal(normalizeDownloadName('  ---  ', 'fallback'), 'fallback');
    assert.equal(normalizeDownloadName('my_file-2024'), 'my_file-2024');
    assert.equal(normalizeDownloadName('日本語テスト'), 'download'); // non-ASCII → dashes → stripped → fallback
});

test('formatDateShort: handles valid and invalid dates', () => {
    assert.equal(formatDateShort('invalid-date'), '');
    const result = formatDateShort('2024-06-15T12:00:00Z', 'en-US');
    assert.ok(result.includes('15'), `Expected "15" in "${result}"`);
});
