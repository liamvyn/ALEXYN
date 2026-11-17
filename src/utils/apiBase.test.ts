import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiUrl,
  formatConnectionError,
  normalizeApiBaseUrl,
  parseJsonResponseSafe,
} from './apiBase';

test('normalizeApiBaseUrl handles empty, trailing slashes, and non-http values', () => {
  assert.equal(normalizeApiBaseUrl(''), '');
  assert.equal(normalizeApiBaseUrl('   '), '');
  assert.equal(normalizeApiBaseUrl('ftp://example.com'), '');
  assert.equal(normalizeApiBaseUrl('https://alexyn.example.com/'), 'https://alexyn.example.com');
  assert.equal(normalizeApiBaseUrl('http://localhost:3000///'), 'http://localhost:3000');
});

test('apiUrl returns clean relative path when running without a custom base URL', () => {
  assert.equal(apiUrl('/api/chat'), '/api/chat');
  assert.equal(apiUrl('api/health'), '/api/health');
});

test('formatConnectionError translates network errors cleanly without hiding backend issues', () => {
  assert.match(
    formatConnectionError(new TypeError('Failed to fetch')),
    /Cannot reach the ALEXYN backend server/
  );
  assert.equal(
    formatConnectionError(new Error('Gemini API quota exceeded')),
    'Gemini API quota exceeded'
  );
  assert.equal(formatConnectionError(null, 'Fallback message'), 'Fallback message');
});

test('parseJsonResponseSafe handles valid JSON, text-wrapped JSON, and non-JSON HTML error pages', async () => {
  const okJson = new Response(JSON.stringify({ reply: 'Hello' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.deepEqual(await parseJsonResponseSafe<{ reply?: string }>(okJson), { reply: 'Hello' });

  const htmlErr = new Response('<html><body>Bad Gateway</body></html>', {
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'Content-Type': 'text/html' },
  });
  const parsedErr = await parseJsonResponseSafe(htmlErr);
  assert.match(parsedErr.error || '', /HTTP 502/);
});
