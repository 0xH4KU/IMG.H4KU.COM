import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError } from '../src/utils/api-error.ts';
import { loadShareData } from '../src/utils/shareApi.ts';

test('loadShareData: password required returns ApiError(401)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'password_required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    await assert.rejects(
      () => loadShareData({ shareId: 'abc' }),
      (error) => error instanceof ApiError && error.status === 401,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loadShareData: successful response parses payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    share: { id: 'id-1', title: 'Delivery' },
    items: [{ key: 'a.png' }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const result = await loadShareData({ shareId: 'id-1' });
    assert.equal(result.share?.id, 'id-1');
    assert.equal(result.items?.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
