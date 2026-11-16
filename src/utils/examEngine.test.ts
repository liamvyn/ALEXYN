import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdaptiveQuizBlueprint,
  compareSpokenTokens,
  computeMultiFormatScore,
  normalizeQuizQuestions,
} from './examEngine';
import type { QuizAttempt, QuizDefinition } from '../types/alexyn';

test('normalizeQuizQuestions preserves all 6 question formats and original numbering', () => {
  const normalized = normalizeQuizQuestions([
    {
      questionNumber: '1a',
      questionType: 'calculation',
      marks: 4,
      prompt: 'Solve for x: 2x^2 - 8 = 0',
      topic: 'Quadratics',
      expectedSteps: ['2x^2 = 8', 'x^2 = 4', 'x = ±2'],
    },
    {
      questionNumber: '2',
      questionType: 'structured',
      prompt: 'Photosynthesis stages',
      topic: 'Plant Nutrition',
      subParts: [
        { id: 'sp1', label: '(a)', prompt: 'Name the site of light stage.', marks: 1 },
        { id: 'sp2', label: '(b)', prompt: 'State two products.', marks: 2 },
      ],
    },
    {
      questionNumber: '3',
      questionType: 'essay',
      marks: 10,
      prompt: 'Discuss causes of Industrial Revolution.',
      topic: 'Industrialization',
    },
    {
      questionNumber: '4',
      questionType: 'mcq',
      marks: 1,
      prompt: 'Unit of force?',
      options: ['Joule', 'Newton', 'Watt', 'Pascal'],
      correctIndex: 1,
    },
  ]);

  assert.equal(normalized.length, 4);
  assert.equal(normalized[0].questionType, 'calculation');
  assert.equal(normalized[0].questionNumber, '1a');
  assert.equal(normalized[1].questionType, 'structured');
  assert.equal(normalized[1].marks, 3);
  assert.equal(normalized[2].questionType, 'essay');
  assert.equal(normalized[3].questionType, 'mcq');
});

test('computeMultiFormatScore combines deterministic MCQ marks and AI rubric marks accurately', () => {
  const quiz: QuizDefinition = {
    id: 'ex1',
    title: 'Mixed Exam',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'medium',
    timeLimitMinutes: 20,
    origin: 'ai-generated',
    createdAt: 1,
    questions: [
      {
        id: 'q1',
        questionType: 'mcq',
        questionNumber: '1',
        marks: 2,
        prompt: '2+2?',
        topic: 'Arithmetic',
        options: ['3', '4', '5', '6'],
        correctIndex: 1,
        explanation: '4',
        origin: 'ai-generated',
      },
      {
        id: 'q2',
        questionType: 'calculation',
        questionNumber: '2',
        marks: 4,
        prompt: 'Solve 2x + 4 = 10',
        topic: 'Linear Equations',
        options: [],
        correctIndex: null,
        explanation: 'x = 3',
        origin: 'ai-generated',
      },
    ],
  };

  const score = computeMultiFormatScore(
    quiz,
    { q1: 1 },
    {
      q2: {
        questionId: 'q2',
        topic: 'Linear Equations',
        selectedIndex: null,
        correctIndex: null,
        marksAwarded: 3,
        maxMarks: 4,
        isCorrect: true,
        aiFeedback: 'Method step right; minor arithmetic slip on check.',
      },
    }
  );

  assert.equal(score.score, 5);
  assert.equal(score.maxScore, 6);
  assert.equal(score.percentage, 83);
});

test('buildAdaptiveQuizBlueprint extracts weak topics and mistake notes from attempt history', () => {
  const attempts: QuizAttempt[] = [
    {
      id: 'att1',
      quizId: 'q1',
      quizTitle: 'Bio Paper',
      subject: 'Biology',
      topic: 'Cell Division',
      difficulty: 'medium',
      assessmentType: 'past-paper',
      score: 4,
      maxScore: 10,
      percentage: 40,
      durationSec: 200,
      completedAt: 1000,
      weakTopicsIdentified: ['Mitosis Metaphase'],
      mistakeNotes: ['Confused chromatid alignment in metaphase with anaphase separation'],
      answers: [
        {
          questionId: 'q1',
          topic: 'Mitosis Metaphase',
          selectedIndex: null,
          correctIndex: null,
          marksAwarded: 1,
          maxMarks: 5,
          isCorrect: false,
          aiFeedback: 'Missed spindle fiber attachment point.',
        },
        {
          questionId: 'q2',
          topic: 'Osmosis',
          selectedIndex: 0,
          correctIndex: 0,
          marksAwarded: 4,
          maxMarks: 5,
          isCorrect: true,
        },
      ],
    },
  ];

  const blueprint = buildAdaptiveQuizBlueprint(attempts, 'Biology');
  assert.equal(blueprint.hasEnoughHistory, true);
  assert.equal(blueprint.recommendedSubject, 'Biology');
  assert.equal(blueprint.suggestedDifficulty, 'easy');
  assert.equal(blueprint.weakTopics.some((w) => w.topic === 'Mitosis Metaphase'), true);
  assert.equal(blueprint.improvedTopics.includes('Osmosis'), true);
  assert.equal(blueprint.repeatedMistakes.length >= 1, true);
});

test('compareSpokenTokens provides honest word-by-word match diagnostics', () => {
  const res = compareSpokenTokens('Bonjour comment allez vous', 'bonjour comment vous');
  assert.equal(res.matchPercentage, 75);
  assert.equal(res.wordResults.filter((w) => !w.matched).length, 1);
});
