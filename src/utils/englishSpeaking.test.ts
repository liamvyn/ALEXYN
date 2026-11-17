import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyEnglishSpeakingStats,
  evaluateSpokenEnglishMatch,
  getEnglishSpeakingWordsByDifficulty,
  recordEnglishSpeakingAttempt,
} from './englishSpeaking';

test('getEnglishSpeakingWordsByDifficulty returns curated words per level', () => {
  const found = getEnglishSpeakingWordsByDifficulty('foundation');
  const inter = getEnglishSpeakingWordsByDifficulty('intermediate');
  const adv = getEnglishSpeakingWordsByDifficulty('advanced');

  assert.equal(found.length >= 5, true);
  assert.equal(inter.length >= 5, true);
  assert.equal(adv.length >= 5, true);
  assert.equal(found.every((w) => w.difficulty === 'foundation'), true);
});

test('evaluateSpokenEnglishMatch distinguishes exact match, partial match, and mismatch honestly', () => {
  const exact = evaluateSpokenEnglishMatch('Consequently', 'consequently!');
  assert.equal(exact.isMatch, true);
  assert.equal(exact.isExactMatch, true);
  assert.equal(exact.status, 'correct');

  const close = evaluateSpokenEnglishMatch('Elaborate carefully', 'elaborate');
  assert.equal(close.isMatch, false);
  assert.equal(close.status, 'close');
  assert.equal(close.feedback.includes('carefully'), true);

  const wrong = evaluateSpokenEnglishMatch('Notwithstanding', 'understanding');
  assert.equal(wrong.isMatch, false);
  assert.equal(wrong.status, 'incorrect');
});

test('recordEnglishSpeakingAttempt tracks completion IDs, accuracy, and streaks accurately', () => {
  let stats = createEmptyEnglishSpeakingStats();
  stats = recordEnglishSpeakingAttempt(stats, 'eng-f-1', true);
  stats = recordEnglishSpeakingAttempt(stats, 'eng-f-1', true);
  stats = recordEnglishSpeakingAttempt(stats, 'eng-f-2', false);

  assert.deepEqual(stats.completedIds, ['eng-f-1']);
  assert.equal(stats.attempts, 3);
  assert.equal(stats.matches, 2);
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 2);
});
