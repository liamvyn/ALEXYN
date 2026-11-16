import type {
  ExamDraftState,
  QuizAnswerRecord,
  QuizAttempt,
  QuizDefinition,
  QuizQuestion,
  QuizQuestionType,
} from '../types/alexyn';

const EXAM_DRAFTS_STORAGE_KEY = 'alexyn_exam_drafts_v1';

export function inferQuestionType(q: Partial<QuizQuestion>): QuizQuestionType {
  if (
    q.questionType &&
    ['mcq', 'short-answer', 'structured', 'essay', 'calculation', 'diagram'].includes(q.questionType)
  ) {
    return q.questionType;
  }
  if (Array.isArray(q.subParts) && q.subParts.length > 0) return 'structured';
  if (q.diagramSpec) return 'diagram';
  if (Array.isArray(q.options) && q.options.length >= 2) return 'mcq';
  const promptLower = (q.prompt || '').toLowerCase();
  if (/\b(calculate|solve|evaluate|find the value|simplify|differentiate|integrate|factori[sz]e)\b/.test(promptLower)) {
    return 'calculation';
  }
  if (/\b(essay|discuss|evaluate the extent|insha|composition|write a letter|argue)\b/.test(promptLower)) {
    return 'essay';
  }
  return 'short-answer';
}

export function normalizeQuizQuestions(rawQuestions: Array<Partial<QuizQuestion>>): QuizQuestion[] {
  return (rawQuestions || [])
    .filter((q) => Boolean(q && (q.prompt?.trim() || (q.subParts && q.subParts.length > 0))))
    .map((q, idx) => {
      const qType = inferQuestionType(q);
      const options =
        qType === 'mcq' && Array.isArray(q.options) && q.options.length >= 2
          ? q.options.slice(0, 6)
          : [];
      const subParts = Array.isArray(q.subParts)
        ? q.subParts.map((sp, spIdx) => ({
            id: sp.id || `sp-${idx}-${spIdx}`,
            label: sp.label || `(${String.fromCharCode(97 + spIdx)})`,
            prompt: sp.prompt || '',
            marks: Math.max(1, Number(sp.marks) || 1),
            markingScheme: sp.markingScheme,
          }))
        : undefined;

      const subPartTotal = subParts?.reduce((sum, sp) => sum + sp.marks, 0) || 0;
      const defaultMarks =
        qType === 'mcq'
          ? 1
          : qType === 'essay'
          ? 10
          : qType === 'structured'
          ? subPartTotal || 4
          : qType === 'calculation'
          ? 3
          : 2;

      return {
        id: q.id || `q-${Date.now()}-${idx}`,
        questionType: qType,
        questionNumber: q.questionNumber || String(idx + 1),
        marks: Math.max(1, Number(q.marks) || defaultMarks),
        prompt: String(q.prompt || '').trim(),
        topic: String(q.topic || 'General').trim(),
        options,
        correctIndex:
          qType === 'mcq' && typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < options.length
            ? q.correctIndex
            : null,
        hasOfficialAnswerKey: Boolean(q.hasOfficialAnswerKey),
        explanation: String(q.explanation || '').trim(),
        markingScheme: q.markingScheme,
        sampleAnswer: q.sampleAnswer,
        expectedSteps: Array.isArray(q.expectedSteps) ? q.expectedSteps : undefined,
        subParts,
        diagramSpec: q.diagramSpec,
        origin: q.origin || 'ai-generated',
        sourceTitle: q.sourceTitle,
        sourceUrl: q.sourceUrl,
      };
    });
}

export function computeQuizTotalMarks(quiz: QuizDefinition): number {
  if (typeof quiz.totalMarks === 'number' && quiz.totalMarks > 0) {
    return quiz.totalMarks;
  }
  return quiz.questions.reduce((sum, q) => sum + Math.max(1, q.marks || 1), 0);
}

/**
 * Computes score across mixed question formats using MCQ deterministic grading
 * plus any AI/rubric-graded records already produced for open/calculation/essay questions.
 */
export function computeMultiFormatScore(
  quiz: QuizDefinition,
  selectedMcq: Record<string, number | null>,
  aiGradedByQuestion: Record<string, QuizAnswerRecord> = {}
): {
  score: number;
  maxScore: number;
  percentage: number;
  records: QuizAnswerRecord[];
} {
  let score = 0;
  let maxScore = 0;

  const records: QuizAnswerRecord[] = quiz.questions.map((q) => {
    const qType = inferQuestionType(q);
    const qMarks = Math.max(1, q.marks || 1);
    const aiRec = aiGradedByQuestion[q.id];

    if (aiRec && typeof aiRec.marksAwarded === 'number' && !aiRec.ungraded) {
      const recMax = Math.max(1, aiRec.maxMarks || qMarks);
      const awarded = Math.max(0, Math.min(recMax, aiRec.marksAwarded));
      score += awarded;
      maxScore += recMax;
      return {
        ...aiRec,
        questionNumber: q.questionNumber,
        questionType: qType,
        marksAwarded: awarded,
        maxMarks: recMax,
        isCorrect: awarded >= recMax * 0.6,
      };
    }

    if (qType === 'mcq') {
      const selected = selectedMcq[q.id] ?? null;
      if (q.correctIndex === null || q.correctIndex === undefined) {
        return {
          questionId: q.id,
          questionNumber: q.questionNumber,
          questionType: 'mcq',
          topic: q.topic || quiz.topic || quiz.subject,
          selectedIndex: selected,
          correctIndex: null,
          marksAwarded: 0,
          maxMarks: qMarks,
          isCorrect: false,
          ungraded: true,
        };
      }
      maxScore += qMarks;
      const right = selected !== null && selected === q.correctIndex;
      const awarded = right ? qMarks : 0;
      score += awarded;
      return {
        questionId: q.id,
        questionNumber: q.questionNumber,
        questionType: 'mcq',
        topic: q.topic || quiz.topic || quiz.subject,
        selectedIndex: selected,
        correctIndex: q.correctIndex,
        marksAwarded: awarded,
        maxMarks: qMarks,
        isCorrect: right,
      };
    }

    // Non-MCQ without AI marking yet
    return {
      questionId: q.id,
      questionNumber: q.questionNumber,
      questionType: qType,
      topic: q.topic || quiz.topic || quiz.subject,
      selectedIndex: null,
      correctIndex: null,
      marksAwarded: 0,
      maxMarks: qMarks,
      isCorrect: false,
      ungraded: true,
    };
  });

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    score: Number(score.toFixed(1)),
    maxScore: Number(maxScore.toFixed(1)),
    percentage,
    records,
  };
}

export function loadExamDrafts(): Record<string, ExamDraftState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(EXAM_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ExamDraftState>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveExamDraft(draft: ExamDraftState): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadExamDrafts();
    current[draft.quizId] = { ...draft, updatedAt: Date.now() };
    window.localStorage.setItem(EXAM_DRAFTS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota failures
  }
}

export function clearExamDraft(quizId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadExamDrafts();
    delete current[quizId];
    window.localStorage.setItem(EXAM_DRAFTS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export interface AdaptiveQuizBlueprint {
  hasEnoughHistory: boolean;
  recommendedSubject: string;
  weakTopics: Array<{ topic: string; accuracy: number; attempts: number }>;
  improvedTopics: string[];
  repeatedMistakes: string[];
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  summaryText: string;
}

export function buildAdaptiveQuizBlueprint(
  attempts: QuizAttempt[],
  preferredSubject?: string
): AdaptiveQuizBlueprint {
  const scoped = preferredSubject
    ? attempts.filter((a) => a.subject.toLowerCase() === preferredSubject.toLowerCase())
    : attempts;
  const pool = scoped.length > 0 ? scoped : attempts;

  if (pool.length === 0) {
    return {
      hasEnoughHistory: false,
      recommendedSubject: preferredSubject || 'Mathematics',
      weakTopics: [],
      improvedTopics: [],
      repeatedMistakes: [],
      suggestedDifficulty: 'medium',
      summaryText: 'Complete at least one quiz so ALEXYN can adapt questions to your weak topics and mistakes.',
    };
  }

  const subjectCounts = new Map<string, number>();
  const topicStats = new Map<string, { earned: number; possible: number; count: number }>();
  const mistakeNotes: string[] = [];

  for (const att of pool) {
    subjectCounts.set(att.subject, (subjectCounts.get(att.subject) || 0) + 1);
    for (const m of att.mistakeNotes || []) {
      if (m && !mistakeNotes.includes(m)) mistakeNotes.push(m);
    }
    for (const wt of att.weakTopicsIdentified || []) {
      const curr = topicStats.get(wt) || { earned: 0, possible: 0, count: 0 };
      curr.possible += 1;
      curr.count += 1;
      topicStats.set(wt, curr);
    }
    for (const ans of att.answers) {
      if (ans.ungraded) continue;
      const topicKey = (ans.topic || att.topic || att.subject).trim();
      const curr = topicStats.get(topicKey) || { earned: 0, possible: 0, count: 0 };
      const qMax = typeof ans.maxMarks === 'number' && ans.maxMarks > 0 ? ans.maxMarks : 1;
      const qEarned =
        typeof ans.marksAwarded === 'number' ? ans.marksAwarded : ans.isCorrect ? qMax : 0;
      curr.earned += qEarned;
      curr.possible += qMax;
      curr.count += 1;
      topicStats.set(topicKey, curr);
      if (!ans.isCorrect && ans.aiFeedback) {
        mistakeNotes.push(`${topicKey}: ${ans.aiFeedback.slice(0, 110)}`);
      }
    }
  }

  const weakTopics = Array.from(topicStats.entries())
    .map(([topic, s]) => ({
      topic,
      accuracy: s.possible > 0 ? Math.round((s.earned / s.possible) * 100) : 0,
      attempts: s.count,
    }))
    .filter((t) => t.accuracy < 75)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const improvedTopics = Array.from(topicStats.entries())
    .filter(([, s]) => s.possible > 0 && s.earned / s.possible >= 0.8)
    .map(([topic]) => topic)
    .slice(0, 4);

  const topSubject =
    preferredSubject ||
    Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Mathematics';

  const avgPct = Math.round(pool.reduce((s, a) => s + a.percentage, 0) / pool.length);
  const suggestedDifficulty: 'easy' | 'medium' | 'hard' =
    avgPct < 50 ? 'easy' : avgPct > 80 ? 'hard' : 'medium';

  const summaryText =
    weakTopics.length > 0
      ? `Focusing on ${weakTopics.map((w) => `${w.topic} (${w.accuracy}%)`).join(', ')} at ${suggestedDifficulty} difficulty.`
      : `Solid scores (${avgPct}% avg) — stepping up to ${suggestedDifficulty} mixed-format challenge.`;

  return {
    hasEnoughHistory: true,
    recommendedSubject: topSubject,
    weakTopics,
    improvedTopics,
    repeatedMistakes: mistakeNotes.slice(0, 4),
    suggestedDifficulty,
    summaryText,
  };
}

/**
 * Deterministic token comparison used strictly when audio was transcribed into text
 * without direct acoustic scoring. Never claims acoustic phoneme scoring.
 */
export function compareSpokenTokens(
  targetPhrase: string,
  spokenTranscript: string
): {
  matchPercentage: number;
  wordResults: Array<{ target: string; heard: string; matched: boolean }>;
} {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"'()[\]【】]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const targetWords = clean(targetPhrase);
  const spokenWords = clean(spokenTranscript);

  if (targetWords.length === 0) {
    return { matchPercentage: 0, wordResults: [] };
  }

  const remainingSpoken = [...spokenWords];
  const wordResults = targetWords.map((tWord, idx) => {
    if (spokenWords[idx] === tWord) {
      return { target: tWord, heard: spokenWords[idx], matched: true };
    }
    const matchIdx = remainingSpoken.indexOf(tWord);
    if (matchIdx !== -1) {
      const heard = remainingSpoken[matchIdx];
      remainingSpoken.splice(matchIdx, 1);
      return { target: tWord, heard, matched: true };
    }
    return {
      target: tWord,
      heard: spokenWords[idx] || '(missing)',
      matched: false,
    };
  });

  const matchedCount = wordResults.filter((w) => w.matched).length;
  return {
    matchPercentage: Math.round((matchedCount / targetWords.length) * 100),
    wordResults,
  };
}
