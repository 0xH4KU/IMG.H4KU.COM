import assert from 'node:assert/strict';
import test from 'node:test';

import { createToken, getAuthMetrics, getTokenTtlMs, issueToken, verifyToken } from '../functions/_utils/auth.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

async function withMockNow(now, callback) {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

test('createToken + verifyToken: valid token passes verification', async () => {
  const token = await createToken('unit-test-secret', 5 * 60 * 1000);
  const verified = await verifyToken(token, 'unit-test-secret');

  assert.equal(verified, true);
});

test('verifyToken: tampered signature is rejected', async () => {
  const token = await createToken('unit-test-secret', 5 * 60 * 1000);
  const [payload, signature] = token.split('.');
  const replacementChar = signature.endsWith('A') ? 'B' : 'A';
  const tamperedToken = `${payload}.${signature.slice(0, -1)}${replacementChar}`;

  const verified = await verifyToken(tamperedToken, 'unit-test-secret');

  assert.equal(verified, false);
});

test('verifyToken: expired token is rejected', async () => {
  const token = await withMockNow(1_700_000_000_000, async () => {
    return createToken('unit-test-secret', 1_000);
  });

  const verified = await withMockNow(1_700_000_000_000 + 2_000, async () => {
    return verifyToken(token, 'unit-test-secret');
  });

  assert.equal(verified, false);
});

test('getTokenTtlMs: parses valid env and falls back on invalid values', () => {
  assert.equal(getTokenTtlMs({ TOKEN_TTL_DAYS: '7' }), 7 * DAY_MS);
  assert.equal(getTokenTtlMs({ TOKEN_TTL_DAYS: '0' }), 30 * DAY_MS);
  assert.equal(getTokenTtlMs({ TOKEN_TTL_DAYS: '-1' }), 30 * DAY_MS);
  assert.equal(getTokenTtlMs({ TOKEN_TTL_DAYS: 'invalid' }), 30 * DAY_MS);
});

test('issueToken: uses env secret and default TTL', async () => {
  const env = { ADMIN_PASSWORD: 'from-env-secret' };
  const token = await issueToken(env);

  const verified = await verifyToken(token, env);
  assert.equal(verified, true);
});

test('verifyToken: legacy token is blocked after LEGACY_TOKEN_UNTIL', async () => {
  const payload = btoa(JSON.stringify({ exp: 1_700_000_100_000, iat: 1_700_000_000_000 }));
  const signature = btoa(`legacy-secret${payload}`).slice(0, 16);
  const token = `${payload}.${signature}`;

  const verified = await withMockNow(1_700_000_000_500, async () => {
    return verifyToken(token, {
      ADMIN_PASSWORD: 'legacy-secret',
      LEGACY_TOKEN_UNTIL: '2023-11-14T22:13:19.000Z',
    });
  });

  assert.equal(verified, false);
});

test('verifyToken: legacy token use updates metrics when allowed', async () => {
  const payload = btoa(JSON.stringify({ exp: 1_700_000_200_000, iat: 1_700_000_000_000 }));
  const signature = btoa(`legacy-secret${payload}`).slice(0, 16);
  const token = `${payload}.${signature}`;

  const writes = [];
  let savedPayload = null;
  const env = {
    ADMIN_PASSWORD: 'legacy-secret',
    LEGACY_TOKEN_UNTIL: '2099-01-01T00:00:00.000Z',
    R2: {
      get: async () => {
        if (!savedPayload) return null;
        return {
          text: async () => JSON.stringify(savedPayload),
        };
      },
      put: async (_key, value) => {
        const parsed = JSON.parse(value);
        writes.push(parsed);
        savedPayload = parsed;
      },
    },
  };

  const verified = await withMockNow(1_700_000_000_000, async () => {
    return verifyToken(token, env);
  });

  assert.equal(verified, true);
  assert.ok(writes.length >= 1);
  const latest = writes[writes.length - 1];
  assert.equal(typeof latest.legacy.count, 'number');
  assert.equal(latest.legacy.count >= 1, true);
  assert.equal(typeof latest.legacy.lastUsedAt, 'string');

  const metrics = await withMockNow(1_700_000_000_000, async () => {
    return getAuthMetrics(env);
  });
  assert.equal(metrics.legacy.count >= 1, true);
});
