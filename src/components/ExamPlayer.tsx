import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  NotebookPen,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AISelection,
  EducationProfile,
  ExamDraftState,
  ExamMarkingMode,
  QuizAnswerRecord,
  QuizAttempt,
  QuizDefinition,
  QuizQuestion,
  VoicePreferences,
} from '../types/alexyn';
import { sanitizeSvgMarkup } from '../utils/alexynLogic';
import {
  buildExamQuestionSpeechText,
  clearExamDraft,
  computeMultiFormatScore,
  computeQuizTotalMarks,
  inferQuestionType,
  saveExamDraft,
} from '../utils/examEngine';
import { MathEquationWorkspace } from './MathEquationWorkspace';
import {
  INITIAL_CALCULATOR_STATE,
  type ScientificCalculatorState,
} from './ScientificCalculatorPanel';
import { VoiceControlBar } from './VoiceControlBar';
import {
  apiUrl,
  formatConnectionError,
  parseJsonResponseSafe,
} from '../utils/apiBase';
import { buildSvgFromVisualSpec } from '../utils/quizVisuals';

interface ExamPlayerProps {
  quiz: QuizDefinition;
  initialDraft?: ExamDraftState | null;
  profile: EducationProfile;
  aiSelection: AISelection;
  voicePrefs?: VoicePreferences;
  onCompleteAttempt: (attempt: QuizAttempt) => void;
  onReviseTopicInNotes: (subject: string, topic: string) => void;
  onRequestAdaptiveRetry?: (subject: string, weakTopics: string[]) => void;
  onExit: () => void;
}

export const ExamPlayer: React.FC<ExamPlayerProps> = ({
  quiz,
  initialDraft,
  profile,
  aiSelection,
  voicePrefs,
  onCompleteAttempt,
  onReviseTopicInNotes,
  onRequestAdaptiveRetry,
  onExit,
}) => {
  const [markingMode, setMarkingMode] = useState<ExamMarkingMode>(
    initialDraft?.markingMode || quiz.defaultMarkingMode || 'per-question'
  );
  const [currentIdx, setCurrentIdx] = useState<number>(initialDraft?.currentIdx || 0);
  const [flaggedIds, setFlaggedIds] = useState<string[]>(initialDraft?.flaggedIds || []);
  const [selectedMcq, setSelectedMcq] = useState<Record<string, number | null>>(
    initialDraft?.selectedMcq || {}
  );
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(
    initialDraft?.textAnswers || {}
  );
  const [mathStepsByQ, setMathStepsByQ] = useState<Record<string, string[]>>(
    initialDraft?.mathStepsByQuestion || {}
  );
  const [subPartAnswersByQ, setSubPartAnswersByQ] = useState<
    Record<string, Record<string, string>>
  >(initialDraft?.subPartAnswersByQuestion || {});
  const [diagramAnswersByQ, setDiagramAnswersByQ] = useState<Record<string, string>>(
    initialDraft?.diagramAnswersByQuestion || {}
  );
  const [perQFeedback, setPerQFeedback] = useState<Record<string, QuizAnswerRecord>>(
    initialDraft?.perQuestionFeedback || {}
  );

  const [elapsedSec, setElapsedSec] = useState<number>(initialDraft?.elapsedSec || 0);
  const [checkingSingleId, setCheckingSingleId] = useState<string | null>(null);
  const [submittingPaper, setSubmittingPaper] = useState(false);
  const [markError, setMarkError] = useState('');
  const [completedAttempt, setCompletedAttempt] = useState<QuizAttempt | null>(null);
  const [showMathRoughPad, setShowMathRoughPad] = useState(false);
  const [calcState, setCalcState] = useState<ScientificCalculatorState>(INITIAL_CALCULATOR_STATE);

  const timerRef = useRef<number | null>(null);
  const totalMarks = useMemo(() => computeQuizTotalMarks(quiz), [quiz]);
  const isMathSubjectQuiz = useMemo(
    () => /\b(math|algebra|geometry|calculus|trigonometry|arithmetic|statistics)\b/i.test(`${quiz.subject} ${quiz.topic}`),
    [quiz.subject, quiz.topic]
  );

  // Countdown / Elapsed Timer
  useEffect(() => {
    if (completedAttempt) return;
    timerRef.current = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [completedAttempt]);

  // Persist exam draft in localStorage continuously while unfinished
  useEffect(() => {
    if (completedAttempt) return;
    saveExamDraft({
      quizId: quiz.id,
      quizTitle: quiz.title,
      subject: quiz.subject,
      markingMode,
      currentIdx,
      flaggedIds,
      selectedMcq,
      textAnswers,
      mathStepsByQuestion: mathStepsByQ,
      subPartAnswersByQuestion: subPartAnswersByQ,
      diagramAnswersByQuestion: diagramAnswersByQ,
      perQuestionFeedback: perQFeedback,
      elapsedSec,
      updatedAt: Date.now(),
    });
  }, [
    quiz.id,
    quiz.title,
    quiz.subject,
    markingMode,
    currentIdx,
    flaggedIds,
    selectedMcq,
    textAnswers,
    mathStepsByQ,
    subPartAnswersByQ,
    diagramAnswersByQ,
    perQFeedback,
    elapsedSec,
    completedAttempt,
  ]);

  const activeQuestion: QuizQuestion | undefined = quiz.questions[currentIdx];

  const isQuestionAnswered = (q: QuizQuestion): boolean => {
    const qType = inferQuestionType(q);
    if (qType === 'mcq') {
      return selectedMcq[q.id] !== undefined && selectedMcq[q.id] !== null;
    }
    if (qType === 'calculation') {
      const steps = mathStepsByQ[q.id] || [];
      return steps.some((s) => s.trim().length > 0) || Boolean(textAnswers[q.id]?.trim());
    }
    if (qType === 'structured' && q.subParts?.length) {
      const spMap = subPartAnswersByQ[q.id] || {};
      return q.subParts.some((sp) => Boolean(spMap[sp.id]?.trim()));
    }
    if (qType === 'diagram') {
      return Boolean(diagramAnswersByQ[q.id]?.trim());
    }
    return Boolean(textAnswers[q.id]?.trim());
  };

  const toggleFlag = (qId: string) => {
    setFlaggedIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const buildSubmissionItem = (q: QuizQuestion) => {
    const qType = inferQuestionType(q);
    return {
      questionId: q.id,
      questionNumber: q.questionNumber,
      questionType: qType,
      prompt: q.prompt,
      topic: q.topic || quiz.topic || quiz.subject,
      marks: q.marks || 1,
      markingScheme: q.markingScheme,
      sampleAnswer: q.sampleAnswer,
      options: q.options,
      correctIndex: q.correctIndex,
      selectedIndex: selectedMcq[q.id] ?? null,
      textAnswer: textAnswers[q.id] || '',
      mathSteps: (mathStepsByQ[q.id] || []).filter((s) => s.trim()),
      subParts: q.subParts,
      subPartAnswers: subPartAnswersByQ[q.id] || {},
      diagramAnswer: diagramAnswersByQ[q.id] || '',
    };
  };

  // Mode A: Mark single question immediately
  const handleCheckSingleQuestion = async (q: QuizQuestion) => {
    const qType = inferQuestionType(q);
    setMarkError('');

    // Fast deterministic path for MCQ with official key
    if (qType === 'mcq' && q.correctIndex !== null && q.correctIndex !== undefined) {
      const sel = selectedMcq[q.id] ?? null;
      const maxM = Math.max(1, q.marks || 1);
      const right = sel !== null && sel === q.correctIndex;
      setPerQFeedback((prev) => ({
        ...prev,
        [q.id]: {
          questionId: q.id,
          questionNumber: q.questionNumber,
          questionType: 'mcq',
          topic: q.topic || quiz.topic,
          selectedIndex: sel,
          correctIndex: q.correctIndex,
          marksAwarded: right ? maxM : 0,
          maxMarks: maxM,
          isCorrect: right,
          aiFeedback:
            q.explanation ||
            (right
              ? 'Correct choice selected.'
              : `Correct answer is option ${String.fromCharCode(65 + (q.correctIndex || 0))}.`),
          modelAnswer:
            typeof q.correctIndex === 'number' ? q.options[q.correctIndex] || '' : '',
        },
      }));
      return;
    }

    setCheckingSingleId(q.id);
    try {
      const resp = await fetch(apiUrl('/api/quizzes/mark'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55000),
        body: JSON.stringify({
          mode: 'single-question',
          subject: quiz.subject,
          profile,
          items: [buildSubmissionItem(q)],
          aiSelection,
        }),
      });
      const data = await parseJsonResponseSafe<{
        results?: Array<{
          questionId: string;
          marksAwarded: number;
          maxMarks: number;
          isCorrect: boolean;
          aiFeedback: string;
          modelAnswer?: string;
          stepDiagnostics?: QuizAnswerRecord['stepDiagnostics'];
        }>;
      }>(resp);
      if (!resp.ok) {
        throw new Error(data.error || 'Could not mark this question right now.');
      }
      const hit = data.results?.[0];
      if (hit) {
        setPerQFeedback((prev) => ({
          ...prev,
          [q.id]: {
            questionId: q.id,
            questionNumber: q.questionNumber,
            questionType: qType,
            topic: q.topic || quiz.topic,
            selectedIndex: selectedMcq[q.id] ?? null,
            correctIndex: q.correctIndex ?? null,
            textAnswer: textAnswers[q.id],
            mathSteps: mathStepsByQ[q.id],
            subPartAnswers: subPartAnswersByQ[q.id],
            diagramAnswer: diagramAnswersByQ[q.id],
            marksAwarded: hit.marksAwarded,
            maxMarks: hit.maxMarks || q.marks || 1,
            isCorrect: hit.isCorrect,
            aiFeedback: hit.aiFeedback,
            modelAnswer: hit.modelAnswer || q.sampleAnswer,
            stepDiagnostics: hit.stepDiagnostics,
          },
        }));
      }
    } catch (err) {
      setMarkError(formatConnectionError(err, 'Unable to check question right now.'));
    } finally {
      setCheckingSingleId(null);
    }
  };

  // Mode B (or finish Mode A): Mark entire paper and record final QuizAttempt
  const handleSubmitPaper = async () => {
    setMarkError('');
    setSubmittingPaper(true);

    try {
      const aiMap: Record<string, QuizAnswerRecord> = { ...perQFeedback };
      const itemsNeedingAIMark = quiz.questions.filter((q) => {
        const qType = inferQuestionType(q);
        // Deterministic MCQ with key does not need AI call
        if (qType === 'mcq' && q.correctIndex !== null && q.correctIndex !== undefined) {
          return false;
        }
        // In per-question mode, skip ones already marked unless empty
        if (markingMode === 'per-question' && aiMap[q.id] && !aiMap[q.id].ungraded) {
          return false;
        }
        return true;
      });

      let weakTopicsIdentified: string[] = [];
      let mistakeNotes: string[] = [];
      let improvementAdvice = '';

      if (itemsNeedingAIMark.length > 0) {
        const resp = await fetch(apiUrl('/api/quizzes/mark'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(75000),
          body: JSON.stringify({
            mode: 'full-paper',
            subject: quiz.subject,
            profile,
            items: itemsNeedingAIMark.map(buildSubmissionItem),
            aiSelection,
          }),
        });
        const data = await parseJsonResponseSafe<{
          results?: Array<{
            questionId: string;
            marksAwarded: number;
            maxMarks: number;
            isCorrect: boolean;
            aiFeedback: string;
            modelAnswer?: string;
            stepDiagnostics?: QuizAnswerRecord['stepDiagnostics'];
          }>;
          weakTopicsIdentified?: string[];
          mistakeNotes?: string[];
          improvementAdvice?: string;
        }>(resp);
        if (!resp.ok) {
          throw new Error(data.error || 'Could not mark the full paper right now.');
        }

        for (const hit of data.results || []) {
          const origQ = quiz.questions.find((q) => q.id === hit.questionId);
          if (!origQ) continue;
          const qType = inferQuestionType(origQ);
          aiMap[hit.questionId] = {
            questionId: hit.questionId,
            questionNumber: origQ.questionNumber,
            questionType: qType,
            topic: origQ.topic || quiz.topic,
            selectedIndex: selectedMcq[hit.questionId] ?? null,
            correctIndex: origQ.correctIndex ?? null,
            textAnswer: textAnswers[hit.questionId],
            mathSteps: mathStepsByQ[hit.questionId],
            subPartAnswers: subPartAnswersByQ[hit.questionId],
            diagramAnswer: diagramAnswersByQ[hit.questionId],
            marksAwarded: hit.marksAwarded,
            maxMarks: hit.maxMarks || origQ.marks || 1,
            isCorrect: hit.isCorrect,
            aiFeedback: hit.aiFeedback,
            modelAnswer: hit.modelAnswer || origQ.sampleAnswer,
            stepDiagnostics: hit.stepDiagnostics,
          };
        }
        weakTopicsIdentified = data.weakTopicsIdentified || [];
        mistakeNotes = data.mistakeNotes || [];
        improvementAdvice = data.improvementAdvice || '';
      }

      const scored = computeMultiFormatScore(quiz, selectedMcq, aiMap);

      // Compute fallback weak topics if MCQ-only
      if (weakTopicsIdentified.length === 0) {
        const missedTopics = new Set<string>();
        for (const r of scored.records) {
          if (!r.isCorrect && !r.ungraded && r.topic) {
            missedTopics.add(r.topic);
          }
        }
        weakTopicsIdentified = Array.from(missedTopics);
      }

      const assessmentType =
        quiz.origin === 'past-paper'
          ? 'past-paper'
          : quiz.origin === 'uploaded-document'
          ? 'uploaded-exam'
          : quiz.origin === 'user-created'
          ? 'custom'
          : 'quiz';

      const attempt: QuizAttempt = {
        id: `att-${Date.now()}`,
        quizId: quiz.id,
        quizTitle: quiz.title,
        subject: quiz.subject,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        assessmentType,
        markingMode,
        score: scored.score,
        maxScore: scored.maxScore,
        percentage: scored.percentage,
        durationSec: elapsedSec,
        weakTopicsIdentified,
        mistakeNotes,
        improvementAdvice:
          improvementAdvice ||
          (scored.percentage >= 80
            ? 'Strong performance! Challenge yourself with timed past papers or harder application problems.'
            : 'Focus revision on the missed topics highlighted below before retaking.'),
        completedAt: Date.now(),
        answers: scored.records,
      };

      clearExamDraft(quiz.id);
      setCompletedAttempt(attempt);
      onCompleteAttempt(attempt);
    } catch (err) {
      setMarkError(formatConnectionError(err, 'Unable to finish marking paper.'));
    } finally {
      setSubmittingPaper(false);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  const timeLimitSec = quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null;
  const remainingSec = timeLimitSec !== null ? Math.max(0, timeLimitSec - elapsedSec) : null;

  // COMPLETED EXAM REPORT SCREEN
  if (completedAttempt) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="rounded-3xl border border-white/10 bg-[#07112B]/90 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 uppercase tracking-wider">
                <Award className="w-4 h-4" /> Examination Report · {completedAttempt.subject}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {completedAttempt.quizTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Marked via{' '}
                {markingMode === 'per-question'
                  ? 'Question-by-Question Review'
                  : 'Complete Paper Examination Marking'}{' '}
                · Time: {formatDuration(completedAttempt.durationSec)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-sky-300">
                {completedAttempt.percentage}%
              </div>
              <div className="text-xs text-slate-300 font-medium">
                {completedAttempt.score} / {completedAttempt.maxScore} marks
              </div>
            </div>
          </div>

          {completedAttempt.improvementAdvice && (
            <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2">
              <p>
                <strong className="text-sky-300">Examiner &amp; Study Advice:</strong>{' '}
                {completedAttempt.improvementAdvice}
              </p>
              <VoiceControlBar
                playbackId="exam-report-advice"
                text={`Examination report for ${completedAttempt.quizTitle}. Score: ${completedAttempt.score} out of ${completedAttempt.maxScore}, ${completedAttempt.percentage} percent. Examiner advice: ${completedAttempt.improvementAdvice}`}
                voicePrefs={voicePrefs}
                subjectHint={completedAttempt.subject}
                compact
                label="Listen to Summary"
              />
            </div>
          )}

          {completedAttempt.weakTopicsIdentified &&
            completedAttempt.weakTopicsIdentified.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-amber-300">
                  Focus Topics to Strengthen:
                </span>
                {completedAttempt.weakTopicsIdentified.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => onReviseTopicInNotes(quiz.subject, wt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-400/35 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20 transition"
                  >
                    <NotebookPen className="w-3 h-3" />
                    Revise {wt}
                  </button>
                ))}
              </div>
            )}

          <div className="flex flex-wrap gap-2 pt-2">
            {onRequestAdaptiveRetry && (
              <button
                type="button"
                onClick={() =>
                  onRequestAdaptiveRetry(
                    quiz.subject,
                    completedAttempt.weakTopicsIdentified || []
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-semibold text-white hover:opacity-95 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Practise Weak Topics (Adaptive)
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-white transition"
            >
              Back to Assessments
            </button>
          </div>
        </div>

        {/* Question-by-Question Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200 px-1">
            Detailed Question Breakdown ({quiz.questions.length} questions)
          </h3>
          {quiz.questions.map((q, idx) => {
            const ans = completedAttempt.answers.find((a) => a.questionId === q.id);
            const qMarks = ans?.maxMarks || q.marks || 1;
            const awarded = ans?.marksAwarded ?? (ans?.isCorrect ? qMarks : 0);
            const isFullOrGood = awarded >= qMarks * 0.7;

            return (
              <div
                key={q.id}
                className="rounded-2xl border border-white/10 bg-[#060E24] p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-bold text-white">
                      Q{q.questionNumber || idx + 1}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">
                      {inferQuestionType(q).replace('-', ' ')} · {q.topic}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                      ans?.ungraded
                        ? 'bg-slate-500/20 text-slate-300'
                        : isFullOrGood
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {ans?.ungraded ? 'Ungraded (no key)' : `${awarded} / ${qMarks} marks`}
                  </span>
                </div>

                <p className="text-sm text-white leading-relaxed">{q.prompt}</p>

                {ans?.aiFeedback && (
                  <p className="text-xs text-slate-200 bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
                    <strong className="text-sky-300">Feedback:</strong> {ans.aiFeedback}
                  </p>
                )}

                {ans?.stepDiagnostics && ans.stepDiagnostics.length > 0 && (
                  <div className="space-y-1 pl-2 border-l-2 border-sky-400/35">
                    {ans.stepDiagnostics.map((sd, i) => (
                      <p
                        key={i}
                        className={`text-xs ${
                          sd.status === 'error'
                            ? 'text-rose-300'
                            : sd.status === 'correct'
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        Step {sd.stepIndex + 1} ({sd.expression}): {sd.note}
                      </p>
                    ))}
                  </div>
                )}

                {(ans?.modelAnswer || q.explanation) && (
                  <p className="text-xs text-teal-200/90">
                    <strong>Model Answer / Guide:</strong>{' '}
                    {ans?.modelAnswer || q.explanation}
                  </p>
                )}

                {(ans?.aiFeedback || ans?.modelAnswer || q.explanation) && (
                  <div className="pt-1">
                    <VoiceControlBar
                      playbackId={`exam-review-${q.id}`}
                      text={[
                        `Question ${q.questionNumber || idx + 1}.`,
                        q.prompt,
                        ans?.aiFeedback ? `Feedback: ${ans.aiFeedback}` : '',
                        ans?.modelAnswer || q.explanation
                          ? `Model answer and explanation: ${ans?.modelAnswer || q.explanation}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      voicePrefs={voicePrefs}
                      subjectHint={quiz.subject}
                      compact
                      label="Read Explanation"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!activeQuestion) {
    return null;
  }

  const qType = inferQuestionType(activeQuestion);
  const currentFeedback = perQFeedback[activeQuestion.id];
  const isFlagged = flaggedIds.includes(activeQuestion.id);

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4">
      {/* Top Exam Paper Header */}
      <div className="rounded-3xl border border-white/10 bg-[#07112B]/95 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-semibold">
              <span>{quiz.subject}</span>
              {quiz.grade && <span>· {quiz.grade}</span>}
              <span>· {totalMarks} {totalMarks === 1 ? 'Mark' : 'Marks'}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5 truncate">
              {quiz.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                remainingSec !== null && remainingSec < 120
                  ? 'border-rose-400/45 bg-rose-500/15 text-rose-200'
                  : 'border-white/10 bg-white/[0.05] text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              {remainingSec !== null
                ? `Remaining ${formatDuration(remainingSec)}`
                : `Elapsed ${formatDuration(elapsedSec)}`}
            </div>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-200"
              title="Your progress is saved as a draft automatically"
            >
              <X className="w-3.5 h-3.5" /> Save Draft &amp; Exit
            </button>
          </div>
        </div>

        {/* Instructions + Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <p className="text-xs text-slate-300 flex-1 min-w-[220px]">
            {quiz.instructions ||
              'Answer every question clearly. Show mathematical steps for full method marks.'}
          </p>
          <div className="inline-flex rounded-xl border border-white/10 bg-[#040A19] p-1 gap-1">
            <button
              type="button"
              onClick={() => setMarkingMode('per-question')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                markingMode === 'per-question'
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode A: Question-by-Question
            </button>
            <button
              type="button"
              onClick={() => setMarkingMode('full-paper')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                markingMode === 'full-paper'
                  ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode B: Mark Entire Paper
            </button>
          </div>
        </div>

        {/* Question Navigator Grid */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {quiz.questions.map((q, idx) => {
            const answered = isQuestionAnswered(q);
            const flagged = flaggedIds.includes(q.id);
            const marked = Boolean(perQFeedback[q.id]);
            const active = idx === currentIdx;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`relative min-w-[34px] h-8 px-2 rounded-lg text-xs font-semibold border transition ${
                  active
                    ? 'border-sky-400 bg-sky-500/25 text-white ring-2 ring-sky-400/30'
                    : marked
                    ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                    : answered
                    ? 'border-teal-400/35 bg-teal-500/10 text-teal-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                }`}
              >
                {q.questionNumber || idx + 1}
                {flagged && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Card */}
      <div className="rounded-3xl border border-white/10 bg-[#060E24] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/35 text-xs font-bold text-sky-200">
              Question {activeQuestion.questionNumber || currentIdx + 1}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] uppercase tracking-wider text-slate-300">
              {qType.replace('-', ' ')}
            </span>
            <span className="text-xs font-semibold text-teal-300">
              [{activeQuestion.marks || 1} mark{(activeQuestion.marks || 1) === 1 ? '' : 's'}]
            </span>
            <span className="text-xs text-slate-400">· {activeQuestion.topic}</span>
          </div>

          <div className="flex items-center gap-2">
            <VoiceControlBar
              playbackId={`exam-q-${activeQuestion.id}`}
              text={buildExamQuestionSpeechText(activeQuestion, currentIdx)}
              voicePrefs={voicePrefs}
              subjectHint={quiz.subject}
              compact
              label="Read Question"
            />
            <button
              type="button"
              onClick={() => toggleFlag(activeQuestion.id)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                isFlagged
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'
              }`}
            >
              <Flag className="w-3 h-3" />
              {isFlagged ? 'Flagged' : 'Flag'}
            </button>
          </div>
        </div>

        <div className="text-sm sm:text-base text-white leading-relaxed whitespace-pre-wrap">
          {activeQuestion.prompt}
        </div>

        {/* Visual / Geometric / Graph / Science Diagram (rendered cleanly on ANY relevant question type) */}
        {(() => {
          const resolvedSvg =
            activeQuestion.diagramSpec?.svgMarkup?.trim() ||
            (activeQuestion.visualSpec ? buildSvgFromVisualSpec(activeQuestion.visualSpec) : '');
          if (!resolvedSvg) return null;
          return (
            <div className="rounded-2xl border border-[#38BDF8]/30 bg-[#040A19] p-3">
              {activeQuestion.diagramSpec?.title && (
                <p className="mb-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                  {activeQuestion.diagramSpec.title}
                </p>
              )}
              <div
                className="[&_svg]:mx-auto [&_svg]:max-h-[260px] [&_svg]:w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{
                  __html: sanitizeSvgMarkup(resolvedSvg),
                }}
              />
            </div>
          );
        })()}

        {/* TYPE 1: MCQ */}
        {qType === 'mcq' && (
          <div className="space-y-2">
            {activeQuestion.options.map((opt, optIdx) => {
              const selected = selectedMcq[activeQuestion.id] === optIdx;
              const letter = String.fromCharCode(65 + optIdx);
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() =>
                    setSelectedMcq((prev) => ({
                      ...prev,
                      [activeQuestion.id]: optIdx,
                    }))
                  }
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition flex items-start gap-3 ${
                    selected
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      selected
                        ? 'bg-sky-500 text-white'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="pt-0.5">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* TYPE 2 & 4: Short-Answer / Essay */}
        {(qType === 'short-answer' || qType === 'essay') && (
          <div className="space-y-1.5">
            <textarea
              rows={qType === 'essay' ? 8 : 4}
              value={textAnswers[activeQuestion.id] || ''}
              onChange={(e) =>
                setTextAnswers((prev) => ({
                  ...prev,
                  [activeQuestion.id]: e.target.value,
                }))
              }
              placeholder={
                qType === 'essay'
                  ? 'Write a structured response with clear paragraphs, examples, and key terminology...'
                  : 'Write your concise answer clearly...'
              }
              className="w-full rounded-2xl border border-white/15 bg-[#040A19] p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
            />
            {qType === 'essay' && (
              <p className="text-[11px] text-slate-400 text-right">
                Word count:{' '}
                {(textAnswers[activeQuestion.id] || '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean).length}{' '}
                words
              </p>
            )}
          </div>
        )}

        {/* TYPE 3: Structured Multi-Part Question */}
        {qType === 'structured' && (
          <div className="space-y-3">
            {(activeQuestion.subParts && activeQuestion.subParts.length > 0
              ? activeQuestion.subParts
              : [
                  {
                    id: 'main',
                    label: '(a)',
                    prompt: 'Write your structured response:',
                    marks: activeQuestion.marks || 2,
                  },
                ]
            ).map((sp) => (
              <div
                key={sp.id}
                className="rounded-2xl border border-white/10 bg-[#050C20] p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-sky-200">
                    {sp.label} {sp.prompt}
                  </span>
                  <span className="text-[11px] text-teal-300 shrink-0">
                    [{sp.marks} mk{sp.marks === 1 ? '' : 's'}]
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={subPartAnswersByQ[activeQuestion.id]?.[sp.id] || ''}
                  onChange={(e) =>
                    setSubPartAnswersByQ((prev) => ({
                      ...prev,
                      [activeQuestion.id]: {
                        ...(prev[activeQuestion.id] || {}),
                        [sp.id]: e.target.value,
                      },
                    }))
                  }
                  placeholder={`Answer for part ${sp.label}...`}
                  className="w-full rounded-xl border border-white/10 bg-[#040A19] p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
                />
              </div>
            ))}
          </div>
        )}

        {/* TYPE 5: Calculation with Embedded Step-by-Step Equation Editor + Scientific Calc + Math Keyboard */}
        {qType === 'calculation' && (
          <MathEquationWorkspace
            problemStatement={activeQuestion.prompt}
            readOnlyProblem
            hideAICheckButton
            steps={mathStepsByQ[activeQuestion.id] || ['']}
            onChangeSteps={(next) =>
              setMathStepsByQ((prev) => ({
                ...prev,
                [activeQuestion.id]: next,
              }))
            }
            finalAnswer={textAnswers[activeQuestion.id] || ''}
            onChangeFinalAnswer={(val) =>
              setTextAnswers((prev) => ({
                ...prev,
                [activeQuestion.id]: val,
              }))
            }
            maxMarks={activeQuestion.marks || 3}
            profile={profile}
            aiSelection={aiSelection}
            externalDiagnostics={currentFeedback?.stepDiagnostics}
            externalCalcState={calcState}
            onChangeCalcState={setCalcState}
          />
        )}

        {/* TYPE 6: Diagram / Labelled Illustration Answer */}
        {qType === 'diagram' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-[#050C20] p-3.5 space-y-2">
              <p className="text-xs font-semibold text-teal-300">
                {activeQuestion.diagramSpec?.title || 'Diagram & Labelling Task'}
              </p>
              <p className="text-xs text-slate-300">
                {activeQuestion.diagramSpec?.instructions ||
                  'List all required labels (A, B, C...) or describe your labelled sketch clearly.'}
              </p>
              <textarea
                rows={4}
                value={diagramAnswersByQ[activeQuestion.id] || ''}
                onChange={(e) =>
                  setDiagramAnswersByQ((prev) => ({
                    ...prev,
                    [activeQuestion.id]: e.target.value,
                  }))
                }
                placeholder="e.g. A = Chloroplast (site of photosynthesis), B = Guard cell (controls stomata opening)..."
                className="w-full rounded-xl border border-white/10 bg-[#040A19] p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
              />
            </div>
          </div>
        )}

        {/* Embedded Math Working Notebook, Calculator & Symbol Keyboard for non-calculation Math quiz questions */}
        {isMathSubjectQuiz && qType !== 'calculation' && (
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowMathRoughPad((prev) => !prev)}
              aria-expanded={showMathRoughPad}
              className="inline-flex items-center gap-2 rounded-xl border border-[#38BDF8]/35 bg-[#09173B] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:border-[#38BDF8] hover:text-white transition"
            >
              <NotebookPen className="h-3.5 w-3.5 text-[#5EEAD4]" />
              <span>
                {showMathRoughPad
                  ? 'Hide Math Working, Calculator & Symbols'
                  : 'Open Math Working, Calculator & Symbols'}
              </span>
            </button>
            {showMathRoughPad && (
              <MathEquationWorkspace
                problemStatement={activeQuestion.prompt}
                readOnlyProblem
                hideAICheckButton
                steps={mathStepsByQ[activeQuestion.id] || ['']}
                onChangeSteps={(next) =>
                  setMathStepsByQ((prev) => ({
                    ...prev,
                    [activeQuestion.id]: next,
                  }))
                }
                finalAnswer={qType === 'short-answer' ? textAnswers[activeQuestion.id] || '' : undefined}
                onChangeFinalAnswer={
                  qType === 'short-answer'
                    ? (val) =>
                        setTextAnswers((prev) => ({
                          ...prev,
                          [activeQuestion.id]: val,
                        }))
                    : undefined
                }
                maxMarks={activeQuestion.marks || 2}
                profile={profile}
                aiSelection={aiSelection}
                externalCalcState={calcState}
                onChangeCalcState={setCalcState}
              />
            )}
          </div>
        )}

        {markError && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{markError}</span>
          </div>
        )}

        {/* Mode A Instant Per-Question Feedback Panel */}
        {markingMode === 'per-question' && currentFeedback && (
          <div
            className={`rounded-2xl border p-4 space-y-2 text-xs sm:text-sm ${
              currentFeedback.isCorrect
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : 'border-amber-400/40 bg-amber-500/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 font-bold ${
                  currentFeedback.isCorrect ? 'text-emerald-200' : 'text-amber-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {currentFeedback.isCorrect ? 'Well Answered!' : 'Review Marking Feedback'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-black/30 text-white font-semibold text-xs">
                {currentFeedback.marksAwarded} / {currentFeedback.maxMarks} marks
              </span>
            </div>
            {currentFeedback.aiFeedback && (
              <p className="text-slate-100 leading-relaxed">{currentFeedback.aiFeedback}</p>
            )}
            {currentFeedback.modelAnswer && (
              <p className="text-xs text-teal-200">
                <strong>Model Answer:</strong> {currentFeedback.modelAnswer}
              </p>
            )}
            {(currentFeedback.aiFeedback || currentFeedback.modelAnswer) && (
              <div className="pt-1">
                <VoiceControlBar
                  playbackId={`exam-feedback-${activeQuestion.id}`}
                  text={[
                    currentFeedback.isCorrect ? 'Well answered.' : 'Review marking feedback.',
                    currentFeedback.aiFeedback || '',
                    currentFeedback.modelAnswer
                      ? `Model answer: ${currentFeedback.modelAnswer}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  voicePrefs={voicePrefs}
                  subjectHint={quiz.subject}
                  compact
                  label="Read Feedback"
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation & Marking Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-35 px-3 py-2 text-xs font-semibold text-white transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              type="button"
              disabled={currentIdx >= quiz.questions.length - 1}
              onClick={() =>
                setCurrentIdx((i) => Math.min(quiz.questions.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-35 px-3 py-2 text-xs font-semibold text-white transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {markingMode === 'per-question' && (
              <button
                type="button"
                disabled={checkingSingleId === activeQuestion.id}
                onClick={() => handleCheckSingleQuestion(activeQuestion)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 hover:bg-sky-500/25 px-3.5 py-2 text-xs font-semibold text-sky-200 transition"
              >
                {checkingSingleId === activeQuestion.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Marking Q{activeQuestion.questionNumber || currentIdx + 1}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Mark This Question
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={submittingPaper}
              onClick={handleSubmitPaper}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] hover:opacity-95 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition"
            >
              {submittingPaper ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Marking Full Paper...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit &amp; Finish Paper
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
