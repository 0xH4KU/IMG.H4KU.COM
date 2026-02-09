import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError } from '../src/utils/api-error.ts';

function parseMessageFallback(status) {
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not found';
  if (status >= 500) return 'Server error';
  return 'Request failed';
}

async function request(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const message = (await response.text()).trim() || parseMessageFallback(response.status);
    throw new ApiError(message, response.status);
  }
  return response.json();
}

test('api client: maps 500 response to ApiError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('Server exploded', { status: 500 });

  try {
    await assert.rejects(
      () => request('/api/example'),
      (error) => error instanceof ApiError && error.status === 500,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('api client: parses json response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const result = await request('/api/example');
    assert.deepEqual(result, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
