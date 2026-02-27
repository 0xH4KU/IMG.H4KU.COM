import assert from 'node:assert/strict';
import test from 'node:test';

import { checkRateLimit } from '../functions/_utils/rateLimit.ts';

test('checkRateLimit: allows requests within limit', () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const r1 = checkRateLimit('test-allow-1', opts);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);

    const r2 = checkRateLimit('test-allow-1', opts);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 1);

    const r3 = checkRateLimit('test-allow-1', opts);
    assert.equal(r3.allowed, true);
    assert.equal(r3.remaining, 0);
});

test('checkRateLimit: blocks requests over limit', () => {
    const opts = { limit: 2, windowMs: 60_000 };
    checkRateLimit('test-block-1', opts);
    checkRateLimit('test-block-1', opts);

    const r3 = checkRateLimit('test-block-1', opts);
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
    assert.ok(r3.retryAfterMs > 0);
});

test('checkRateLimit: different identifiers are independent', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const r1 = checkRateLimit('test-indep-a', opts);
    assert.equal(r1.allowed, true);

    const r2 = checkRateLimit('test-indep-b', opts);
    assert.equal(r2.allowed, true);
});

test('checkRateLimit: expired window resets counter', () => {
    const opts = { limit: 1, windowMs: 1 }; // 1ms window
    checkRateLimit('test-expire-1', opts);

    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }

    const r2 = checkRateLimit('test-expire-1', opts);
    assert.equal(r2.allowed, true);
});
