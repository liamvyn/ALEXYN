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

import {
  computeCircuitMetrics,
  computeForceMotion,
  computeGeometryMetrics,
  detectRecommendedLab,
  getAtomElementInfo,
} from './alexynLogic';

test('detectRecommendedLab connects subject questions to matching interactive 3D labs', () => {
  const mathGeo = detectRecommendedLab('How do I calculate the area of a triangle and angles?');
  assert.equal(mathGeo?.subject, 'Mathematics');
  assert.equal(mathGeo?.modelId, 'math-shapes');

  const mathGraph = detectRecommendedLab('Can you plot a quadratic parabola graph y = x^2?');
  assert.equal(mathGraph?.modelId, 'math-graph');

  const bioCell = detectRecommendedLab('What do chloroplasts do in a plant cell?');
  assert.equal(bioCell?.subject, 'Biology');
  assert.equal(bioCell?.modelId, 'bio-cell');

  const chemBond = detectRecommendedLab('Why is a water molecule H2O polar with covalent bonds?');
  assert.equal(chemBond?.subject, 'Chemistry');
  assert.equal(chemBond?.modelId, 'chem-water');

  const physCircuit = detectRecommendedLab('How does Ohm law work in a series circuit?');
  assert.equal(physCircuit?.subject, 'Physics');
  assert.equal(physCircuit?.modelId, 'phys-circuit');
});

test('computeGeometryMetrics computes accurate 2D/3D measurements', () => {
  const cube = computeGeometryMetrics('cube', 3);
  assert.equal(cube.primaryValue, '27.00 u³');
  assert.equal(cube.secondaryValue, '54.00 u²');

  const tri = computeGeometryMetrics('triangle', 10, 45);
  assert.equal(tri.primaryValue, '25.00 u²');
});

test('getAtomElementInfo resolves element symbol, name, and shell configuration', () => {
  const carbon = getAtomElementInfo(6);
  assert.equal(carbon.symbol, 'C');
  assert.equal(carbon.name, 'Carbon');
  assert.deepEqual(carbon.shells, [2, 4]);
  assert.equal(carbon.valence, 4);

  const sodium = getAtomElementInfo(11);
  assert.equal(sodium.symbol, 'Na');
  assert.deepEqual(sodium.shells, [2, 8, 1]);
});

test('computeCircuitMetrics calculates series and parallel Ohm law values', () => {
  const series = computeCircuitMetrics(12, 4, 2, 'series', true);
  assert.equal(series.totalResistance, 6);
  assert.equal(series.currentAmps, 2);
  assert.equal(series.powerWatts, 24);

  const parallel = computeCircuitMetrics(12, 6, 6, 'parallel', true);
  assert.equal(parallel.totalResistance, 3);
  assert.equal(parallel.currentAmps, 4);

  const openCircuit = computeCircuitMetrics(12, 6, 6, 'series', false);
  assert.equal(openCircuit.currentAmps, 0);
});

test('computeForceMotion computes net force and acceleration on inclined plane', () => {
  const flatPush = computeForceMotion(2, 0, 10, 0);
  assert.equal(flatPush.netForce, 10);
  assert.equal(flatPush.acceleration, 5);
});

import {
  analyzePerformance,
  buildSmartReminders,
  calculateQuizScore,
  getSpeechLangForSubject,
  isLanguageSubject,
  parseGitHubUrl,
  sanitizeSvgMarkup,
  stripMarkdownForSpeech,
} from './alexynLogic';
import type { QuizAttempt, QuizDefinition } from '../types/alexyn';

test('calculateQuizScore grades official keys accurately and marks missing keys ungraded', () => {
  const quiz: QuizDefinition = {
    id: 'q1',
    title: 'Algebra Quick Check',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'medium',
    timeLimitMinutes: 5,
    origin: 'ai-generated',
    createdAt: 1,
    questions: [
      {
        id: 'qu1',
        prompt: '2x = 10',
        topic: 'Algebra',
        options: ['3', '5', '10', '2'],
        correctIndex: 1,
        explanation: 'Divide by 2.',
        origin: 'ai-generated',
      },
      {
        id: 'qu2',
        prompt: 'x + 4 = 9',
        topic: 'Algebra',
        options: ['4', '5', '6', '7'],
        correctIndex: 1,
        explanation: '9 - 4 = 5.',
        origin: 'ai-generated',
      },
      {
        id: 'qu3',
        prompt: 'Uploaded Q without key',
        topic: 'Quadratics',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: null,
        hasOfficialAnswerKey: false,
        explanation: '',
        origin: 'uploaded-document',
      },
    ],
  };

  const graded = calculateQuizScore(quiz, { qu1: 1, qu2: 0, qu3: 2 });
  assert.equal(graded.score, 1);
  assert.equal(graded.maxScore, 2);
  assert.equal(graded.percentage, 50);
  assert.equal(graded.gradedAnswers[2].ungraded, true);
});

test('analyzePerformance tracks improvements, declines, weak topics, and insufficient evidence', () => {
  const attempts: QuizAttempt[] = [
    {
      id: 'a1',
      quizId: 'q1',
      quizTitle: 'Math 1',
      subject: 'Mathematics',
      topic: 'Algebra',
      difficulty: 'medium',
      assessmentType: 'quiz',
      score: 4,
      maxScore: 5,
      percentage: 80,
      durationSec: 120,
      completedAt: 1000,
      answers: [
        { questionId: '1', topic: 'Algebra', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: '2', topic: 'Algebra', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: '3', topic: 'Algebra', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: '4', topic: 'Algebra', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: '5', topic: 'Geometry', selectedIndex: 1, correctIndex: 0, isCorrect: false },
      ],
    },
    {
      id: 'a2',
      quizId: 'q2',
      quizTitle: 'Math 2',
      subject: 'Mathematics',
      topic: 'Algebra',
      difficulty: 'medium',
      assessmentType: 'quiz',
      score: 3,
      maxScore: 5,
      percentage: 60,
      durationSec: 110,
      completedAt: 2000,
      answers: [
        { questionId: '1', topic: 'Algebra', selectedIndex: 1, correctIndex: 0, isCorrect: false },
        { questionId: '2', topic: 'Algebra', selectedIndex: 1, correctIndex: 0, isCorrect: false },
        { questionId: '3', topic: 'Algebra', selectedIndex: 1, correctIndex: 0, isCorrect: false },
        { questionId: '4', topic: 'Geometry', selectedIndex: 0, correctIndex: 0, isCorrect: true },
        { questionId: '5', topic: 'Geometry', selectedIndex: 0, correctIndex: 0, isCorrect: true },
      ],
    },
    {
      id: 'a3',
      quizId: 'q3',
      quizTitle: 'Bio 1',
      subject: 'Biology',
      topic: 'Genetics',
      difficulty: 'easy',
      assessmentType: 'quiz',
      score: 4,
      maxScore: 5,
      percentage: 80,
      durationSec: 90,
      completedAt: 3000,
      answers: [
        { questionId: '1', topic: 'Genetics', selectedIndex: 0, correctIndex: 0, isCorrect: true },
      ],
    },
  ];

  const report = analyzePerformance(attempts);
  assert.equal(report.totalAttempts, 3);
  const math = report.subjectSummaries.find((s) => s.subject === 'Mathematics');
  assert.equal(math?.trendDirection, 'declining');
  assert.equal(math?.trendDelta, -20);
  assert.equal(math?.previousAverage, 80);
  assert.equal(math?.currentAverage, 70);

  const bio = report.subjectSummaries.find((s) => s.subject === 'Biology');
  assert.equal(bio?.trendDirection, 'insufficient');
  const bioRec = report.recommendations.find((r) => r.subject === 'Biology');
  assert.equal(bioRec?.message.includes('1 recorded quiz'), true);

  const reminders = buildSmartReminders(report.subjectSummaries, attempts);
  assert.equal(reminders.some((r) => r.subject === 'Mathematics' && r.priority === 'high'), true);
});

test('parseGitHubUrl parses repo, file blob, and shorthand links cleanly', () => {
  const repo = parseGitHubUrl('https://github.com/facebook/react');
  assert.equal(repo?.owner, 'facebook');
  assert.equal(repo?.repo, 'react');
  assert.equal(repo?.isFileUrl, false);

  const file = parseGitHubUrl('https://github.com/user/notes/blob/main/bio/cells.md');
  assert.equal(file?.branch, 'main');
  assert.equal(file?.filePath, 'bio/cells.md');
  assert.equal(file?.isFileUrl, true);

  const invalid = parseGitHubUrl('https://example.com/page');
  assert.equal(invalid, null);
});

test('sanitizeSvgMarkup strips scripts/events and speech helpers detect language codes', () => {
  const clean = sanitizeSvgMarkup('<svg viewBox="0 0 100 100"><script>alert(1)</script><circle cx="50" cy="50" r="20" onclick="hack()"/></svg>');
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(clean.includes('<circle'), true);

  assert.equal(isLanguageSubject('French'), true);
  assert.equal(isLanguageSubject('Physics'), false);
  assert.equal(getSpeechLangForSubject('Japanese'), 'ja-JP');
  assert.equal(stripMarkdownForSpeech('**Bonjour** `world`'), 'Bonjour world');
});

import {
  extractLanguagePracticePhrases,
  extractPureTargetSpeechText,
  parseAIJsonSafe,
  splitSpeechChunks,
} from './alexynLogic';

test('parseAIJsonSafe handles markdown fences, surrounding prose, and nested braces in strings', () => {
  const fenced = parseAIJsonSafe<{ ok: boolean; note: string }>(
    'Here is your response:\n```json\n{"ok": true, "note": "Keep {braces} intact"}\n```\nHope that helps!'
  );
  assert.equal(fenced.ok, true);
  assert.equal(fenced.note, 'Keep {braces} intact');

  assert.throws(() => parseAIJsonSafe('not valid json anywhere'));
});

test('extractPureTargetSpeechText removes English glosses and non-Latin romanizations cleanly', () => {
  assert.equal(
    extractPureTargetSpeechText('**Bonjour** [Hello]'),
    'Bonjour'
  );
  assert.equal(
    extractPureTargetSpeechText('おはようございます (ohayō gozaimasu) [Good morning]'),
    'おはようございます'
  );
  assert.equal(
    extractPureTargetSpeechText('Habari za asubuhi — Good morning'),
    'Habari za asubuhi'
  );
});

test('extractLanguagePracticePhrases isolates target phrases for pronunciation buttons', () => {
  const reply =
    'Great question! In Japanese, you can say **おはようございます** [Good morning] politely, or **おはよう** [Morning] with friends.';
  const phrases = extractLanguagePracticePhrases(reply, 'Japanese');
  assert.equal(phrases.length, 2);
  assert.equal(phrases[0].targetText, 'おはようございます');
  assert.equal(phrases[0].meaning, 'Good morning');
  assert.equal(phrases[1].targetText, 'おはよう');
  assert.equal(phrases[1].meaning, 'Morning');

  const physicsReply = 'Newton’s second law states **F = ma** [Force equals mass times acceleration].';
  assert.equal(extractLanguagePracticePhrases(physicsReply, 'Physics').length, 0);
});

test('splitSpeechChunks breaks long tutor explanations into short speakable chunks', () => {
  const longText =
    'First sentence explains osmosis carefully across a semi-permeable membrane. ' +
    'Second sentence describes water potential moving from high concentration to low concentration. ' +
    'Third sentence gives a practical potato strip laboratory example for exam mastery.';
  const chunks = splitSpeechChunks(longText, 120);
  assert.equal(chunks.length >= 2, true);
  assert.equal(chunks.every((c) => c.length <= 120), true);
});

test('detectRecommendedLab recommends Language Practice Lab for Japanese replies containing "sound"', () => {
  const langLab = detectRecommendedLab(
    'In Japanese, say おはようございます politely, and hear how these sound in real-life pronunciation practice.'
  );
  assert.equal(langLab?.modelId, 'lang-practice');
  assert.equal(langLab?.subject, 'Languages');

  const physicsWave = detectRecommendedLab('Calculate frequency and wavelength of a sound wave.');
  assert.equal(physicsWave?.modelId, 'phys-wave');
});




