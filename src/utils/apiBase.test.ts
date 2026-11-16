import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, normalizeApiBaseUrl } from './apiBase';

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
