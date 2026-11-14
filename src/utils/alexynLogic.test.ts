import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSubjectProgress,
  detectDifferentSubjectWarning,
  extractTaughtTopics,
  filterCommunityPosts,
  findTaughtContextForTopic,
  getAllSubjects,
  getDefaultGradeForLevel,
  getSubjectsForProfile,
  removeNoteSection,
  toggleNoteStyle,
  validateCreateAccount,
  validateEducationSetup,
} from './alexynLogic';
import type { Conversation, SharedPost, SmartNote } from '../types/alexyn';

test('English and Kiswahili live in core subjects while Japanese, Spanish, French, Chinese live in languages', () => {
  const core = getAllSubjects('core');
  assert.equal(core.some((s) => s.id === 'english'), true);
  assert.equal(core.some((s) => s.id === 'kiswahili'), true);
  assert.equal(core.some((s) => s.id === 'csl'), true);
  assert.equal(core.some((s) => s.id === 'ict'), true);

  const langs = getAllSubjects('language');
  assert.equal(langs.some((s) => s.id === 'english'), false);
  assert.equal(langs.some((s) => s.id === 'kiswahili'), false);
  assert.equal(langs.some((s) => s.id === 'japanese'), true);
  assert.equal(langs.some((s) => s.id === 'spanish'), true);
  assert.equal(langs.some((s) => s.id === 'french'), true);
  assert.equal(langs.some((s) => s.id === 'chinese'), true);
});

test('getDefaultGradeForLevel shifts default class when education level changes', () => {
  assert.equal(getDefaultGradeForLevel('Primary').includes('Grade 4'), true);
  assert.equal(getDefaultGradeForLevel('Secondary').includes('Grade 10'), true);
  assert.equal(getDefaultGradeForLevel('College').includes('Diploma'), true);
  assert.equal(getDefaultGradeForLevel('University').includes('Year 1'), true);
});

test('detectDifferentSubjectWarning catches cross-subject questions inside a scoped subject teacher', () => {
  const cross = detectDifferentSubjectWarning('Explain titration and molarity', 'Biology');
  assert.notEqual(cross, null);
  assert.equal(cross?.recommendedSubject, 'Chemistry');

  const same = detectDifferentSubjectWarning('Explain photosynthesis and chloroplasts', 'Biology');
  assert.equal(same, null);
});

test('getSubjectsForProfile filters Primary vs Secondary subjects', () => {
  const primaryCore = getSubjectsForProfile('Primary', 'core');
  assert.equal(primaryCore.some((s) => s.id === 'science-tech'), true);
  assert.equal(primaryCore.some((s) => s.id === 'physics'), false);
});

test('computeSubjectProgress calculates percentage accurately', () => {
  const progress = computeSubjectProgress('french', { french: ['t1', 't2'] }, 4);
  assert.equal(progress, 50);
  assert.equal(computeSubjectProgress('biology', {}, 4), 0);
});

test('toggleNoteStyle supports multi-select and removing individual styles', () => {
  let styles = toggleNoteStyle([], 'memory-tricks');
  styles = toggleNoteStyle(styles, 'funny-examples');
  assert.deepEqual(styles, ['memory-tricks', 'funny-examples']);

  styles = toggleNoteStyle(styles, 'memory-tricks');
  assert.deepEqual(styles, ['funny-examples']);
});

test('extractTaughtTopics & findTaughtContextForTopic pull context from Explore history', () => {
  const conversations: Conversation[] = [
    {
      id: 'c1',
      title: 'Photosynthesis stages',
      updatedAt: 100,
      messages: [
        { id: 'm1', role: 'user', text: 'Explain photosynthesis simply', createdAt: 100 },
        {
          id: 'm2',
          role: 'assistant',
          text: 'Photosynthesis converts sunlight, water, and CO2 into glucose and oxygen in chloroplasts.',
          createdAt: 101,
        },
      ],
    },
  ];

  const topics = extractTaughtTopics(conversations);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].topic, 'Explain photosynthesis simply');

  const match = findTaughtContextForTopic('photosynthesis', conversations);
  assert.equal(match.matchedTopics.includes('Photosynthesis stages'), true);
  assert.equal(match.contextText.includes('chloroplasts'), true);
});

test('removeNoteSection deletes unwanted sections cleanly', () => {
  const note: SmartNote = {
    id: 'n1',
    title: 'Osmosis',
    subject: 'Biology',
    overview: 'Test',
    styles: ['memory-tricks'],
    detailLevel: 'detailed',
    sections: [
      { id: 's1', heading: 'Intro', content: 'A', kind: 'core' },
      { id: 's2', heading: 'Extra', content: 'B', kind: 'extra' },
    ],
    memoryTricks: [],
    funnyExamples: [],
    examTips: [],
    readingAdvice: [],
    flashcards: [],
    createdAt: 1,
    savedToLibrary: true,
  };

  const updated = removeNoteSection(note, 's2');
  assert.equal(updated.sections.length, 1);
  assert.equal(updated.sections[0].id, 's1');
});

test('validateCreateAccount and validateEducationSetup enforce required inputs', () => {
  assert.equal(
    validateCreateAccount({
      name: 'Ada',
      email: 'ada@example.com',
      age: '16',
      password: 'secretpassword',
      confirmPassword: 'secretpassword',
    }),
    null
  );

  assert.notEqual(
    validateCreateAccount({
      name: 'Ada',
      email: 'ada@example.com',
      age: '16',
      password: 'secret1',
      confirmPassword: 'secret2',
    }),
    null
  );

  assert.equal(
    validateEducationSetup({
      country: 'United Kingdom',
      curriculum: 'Cambridge IGCSE / A-Level',
      educationLevel: 'University',
      grade: 'Year 2 (Sophomore)',
      subjects: ['Biology'],
    }),
    null
  );
});

test('filterCommunityPosts filters by subject and search query', () => {
  const posts: SharedPost[] = [
    {
      id: '1',
      author: 'Ali',
      authorRole: 'Grade 10',
      subject: 'French',
      kind: 'Memory Trick',
      title: 'Passé composé trick',
      body: 'Use être for movement verbs.',
      likes: 10,
      createdAt: 1,
    },
    {
      id: '2',
      author: 'Zara',
      authorRole: 'Grade 11',
      subject: 'Physics',
      kind: 'Quick Note',
      title: 'Ohm law triangle',
      body: 'V = IR.',
      likes: 5,
      createdAt: 2,
    },
  ];

  assert.equal(filterCommunityPosts(posts, 'French', '').length, 1);
  assert.equal(filterCommunityPosts(posts, 'All', 'ohm').length, 1);
});
