import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSourceDomain,
  formatFriendlyAIError,
  formatReadableProseMath,
  shouldTriggerOnlineSearch,
} from './aiHelpers';

test('formatFriendlyAIError surfaces clear OpenAI/provider key errors without leaking secrets', () => {
  const openaiErr = formatFriendlyAIError(
    'OPENAI HTTP 401: Incorrect API key provided: sk-1234567890abcdef1234'
  );
  assert.match(openaiErr, /OpenAI API key was rejected/i);
  assert.match(openaiErr, /OPENAI_API_KEY/i);
  assert.doesNotMatch(openaiErr, /sk-1234567890/);

  const missingErr = formatFriendlyAIError(
    'OpenAI / ChatGPT is not configured on the backend server (OPENAI_API_KEY).'
  );
  assert.match(missingErr, /OPENAI_API_KEY/);

  const quotaErr = formatFriendlyAIError('You exceeded your current quota, HTTP 429');
  assert.match(quotaErr, /rate limit or quota/i);
});

test('shouldTriggerOnlineSearch activates on plugin, current info, factual lookups, and syllabus queries, and skips casual/pure math', () => {
  assert.equal(shouldTriggerOnlineSearch('anything', ['Live Web Search']), true);
  assert.equal(shouldTriggerOnlineSearch('What are the latest KCSE Biology syllabus topics?'), true);
  assert.equal(shouldTriggerOnlineSearch('Search online for current Nobel Prize in Physics discoveries'), true);
  assert.equal(shouldTriggerOnlineSearch('Who is the current Prime Minister of the UK?'), true);
  assert.equal(shouldTriggerOnlineSearch('Check Wikipedia for the capital of Kenya'), true);
  assert.equal(shouldTriggerOnlineSearch('What is the population of Tokyo in 2026?'), true);
  assert.equal(shouldTriggerOnlineSearch('Cite sources on CRISPR gene editing'), true);

  assert.equal(shouldTriggerOnlineSearch('hello!'), false);
  assert.equal(shouldTriggerOnlineSearch('3x + 5 = 20'), false);
});

test('extractSourceDomain parses hostnames cleanly', () => {
  assert.equal(extractSourceDomain('https://en.wikipedia.org/wiki/Photosynthesis'), 'en.wikipedia.org');
  assert.equal(extractSourceDomain('https://www.kicd.ac.ke/curriculum/'), 'kicd.ac.ke');
  assert.equal(extractSourceDomain('not-a-url'), '');
});

test('formatReadableProseMath converts inline LaTeX formulas into readable Unicode while preserving currency', () => {
  assert.equal(
    formatReadableProseMath('JWST detected methane ($\\text{CH}_4$) and $\\text{CO}_2$.'),
    'JWST detected methane (CH₄) and CO₂.'
  );
  assert.equal(
    formatReadableProseMath('Solve $x^2 + 3 \\times 4 \\approx 16$.'),
    'Solve x² + 3 × 4 ≈ 16.'
  );
  assert.equal(
    formatReadableProseMath('The notebook costs $5 and the pen costs $2.'),
    'The notebook costs $5 and the pen costs $2.'
  );
});

