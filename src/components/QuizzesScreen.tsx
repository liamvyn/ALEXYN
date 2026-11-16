import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import { calculateQuizScore } from '../utils/alexynLogic';
import type {
  EducationProfile,
  GroundingSource,
  QuizAttempt,
  QuizDefinition,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionOrigin,
  SubjectItem,
} from '../types/alexyn';

interface QuizzesScreenProps {
  profile: EducationProfile;
  savedQuizzes: QuizDefinition[];
  onSaveQuiz: (quiz: QuizDefinition) => void;
  onDeleteQuiz: (quizId: string) => void;
  onRecordAttempt: (attempt: QuizAttempt) => void;
  recentAttempts: QuizAttempt[];
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  initialTopic?: string;
  initialSubject?: string;
  onMakeSmartNotes?: (topic: string, subject?: string) => void;
}

type QuizTab = 'generate' | 'create' | 'upload' | 'research' | 'saved';

function originBadge(origin: QuizQuestionOrigin): { label: string; cls: string } {
  switch (origin) {
    case 'past-paper':
      return {
        label: 'Past Paper Reference',
        cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      };
    case 'educational-practice':
      return {
        label: 'Online Practice Source',
        cls: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
      };
    case 'uploaded-document':
      return {
        label: 'Uploaded Document',
        cls: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
      };
    case 'user-created':
      return {
        label: 'Learner Created',
        cls: 'border-purple-400/40 bg-purple-500/15 text-purple-200',
      };
    default:
      return {
        label: 'AI-Generated Practice',
        cls: 'border-[#2E8BFF]/40 bg-[#122658] text-[#7DD3FC]',
      };
  }
}

function makeEmptyQuestion(idx: number, origin: QuizQuestionOrigin = 'user-created'): QuizQuestion {
  return {
    id: `qq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    origin,
    topic: '',
  };
}

export function QuizzesScreen({
  profile,
  savedQuizzes,
  onSaveQuiz,
  onDeleteQuiz,
  onRecordAttempt,
  recentAttempts,
  scopedSubject,
  onBackFromScoped,
  initialTopic = '',
  initialSubject = '',
  onMakeSmartNotes,
}: QuizzesScreenProps) {
  const [activeTab, setActiveTab] = useState<QuizTab>('generate');

  // Generate Quiz state
  const [genTopic, setGenTopic] = useState(
    initialTopic || scopedSubject?.examHotTopics[0] || ''
  );
  const [genSubject, setGenSubject] = useState(
    scopedSubject?.name || initialSubject || profile.subjects[0] || 'Biology'
  );
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Create / Edit Builder state
  const [draftQuiz, setDraftQuiz] = useState<QuizDefinition>(() => ({
    id: `quiz-${Date.now()}`,
    title: initialTopic ? `${initialTopic} Quiz` : 'Custom Practice Quiz',
    subject: scopedSubject?.name || initialSubject || profile.subjects[0] || 'Biology',
    topic: initialTopic || '',
    difficulty: 'medium',
    timeLimitMinutes: null,
    origin: 'user-created',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions: [makeEmptyQuestion(1, 'user-created')],
  }));
  const [builderSavedNotice, setBuilderSavedNotice] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // Upload Document Exam state
  const [uploadSubject, setUploadSubject] = useState(
    scopedSubject?.name || profile.subjects[0] || 'Biology'
  );
  const [uploadHint, setUploadHint] = useState('');
  const [extractingUpload, setExtractingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  // Online Research state
  const [researchQuery, setResearchQuery] = useState('');
  const [researchExamType, setResearchExamType] = useState('KCSE / National Exam');
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchSources, setResearchSources] = useState<GroundingSource[]>([]);
  const [researchNotes, setResearchNotes] = useState<string | null>(null);

  // Active Interactive Quiz Player state
  const [playingQuiz, setPlayingQuiz] = useState<QuizDefinition | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number | null>>({});
  const [instantFeedback, setInstantFeedback] = useState(true);
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const quizStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (scopedSubject) {
      setGenSubject(scopedSubject.name);
      setUploadSubject(scopedSubject.name);
      if (!genTopic && scopedSubject.examHotTopics[0]) {
        setGenTopic(scopedSubject.examHotTopics[0]);
      }
    }
  }, [scopedSubject?.id]);

  // Countdown timer when playing timed quiz
  useEffect(() => {
    if (!playingQuiz || submittedAttempt || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      handleSubmitQuiz();
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playingQuiz, submittedAttempt, secondsLeft]);

  const normalizeQuizQuestions = (questions: QuizQuestion[]): QuizQuestion[] =>
    questions
      .filter((q) => q.prompt.trim().length > 0)
      .map((q) => {
        const mapped = q.options
          .map((opt, origIdx) => ({ text: opt.trim(), origIdx }))
          .filter((entry) => entry.text.length > 0);
        const nextCorrect =
          q.correctIndex === null
            ? null
            : (() => {
                const found = mapped.findIndex((e) => e.origIdx === q.correctIndex);
                return found >= 0 ? found : 0;
              })();
        return {
          ...q,
          prompt: q.prompt.trim(),
          options: mapped.map((e) => e.text),
          correctIndex: nextCorrect,
        };
      })
      .filter((q) => q.options.length >= 2);

  const startQuizPlayer = (quiz: QuizDefinition) => {
    const cleanQuestions = normalizeQuizQuestions(quiz.questions);
    if (cleanQuestions.length === 0) {
      setBuilderError('Each question needs a prompt and at least 2 non-empty answer options.');
      setGenError('Add at least one complete question with 2+ options before starting.');
      return;
    }
    setBuilderError(null);
    const normalizedQuiz: QuizDefinition = { ...quiz, questions: cleanQuestions };
    setPlayingQuiz(normalizedQuiz);
    setCurrentIdx(0);
    setSelectedAnswers({});
    setSubmittedAttempt(null);
    quizStartRef.current = Date.now();
    setSecondsLeft(
      normalizedQuiz.timeLimitMinutes && normalizedQuiz.timeLimitMinutes > 0
        ? normalizedQuiz.timeLimitMinutes * 60
        : null
    );
  };

  const openQuizInEditor = (quiz: QuizDefinition) => {
    setDraftQuiz({
      ...quiz,
      updatedAt: Date.now(),
      questions: quiz.questions.map((q) => ({ ...q, options: [...q.options] })),
    });
    setPlayingQuiz(null);
    setBuilderSavedNotice(null);
    setActiveTab('create');
  };

  const handleSubmitQuiz = () => {
    if (!playingQuiz || submittedAttempt) return;
    const result = calculateQuizScore(playingQuiz, selectedAnswers);
    const attempt: QuizAttempt = {
      id: `att-${Date.now()}`,
      quizId: playingQuiz.id,
      quizTitle: playingQuiz.title,
      subject: playingQuiz.subject,
      topic: playingQuiz.topic || playingQuiz.title,
      difficulty: playingQuiz.difficulty,
      assessmentType:
        playingQuiz.origin === 'past-paper'
          ? 'past-paper'
          : playingQuiz.origin === 'uploaded-document'
          ? 'uploaded-exam'
          : playingQuiz.origin === 'user-created'
          ? 'custom'
          : 'quiz',
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      completedAt: Date.now(),
      durationSec: Math.max(1, Math.round((Date.now() - quizStartRef.current) / 1000)),
      answers: result.gradedAnswers,
    };
    setSubmittedAttempt(attempt);
    if (attempt.maxScore > 0) {
      onRecordAttempt(attempt);
    }
  };

  const handleGenerateQuiz = async () => {
    const activeTopic = genTopic.trim() || `${genSubject} Core Concepts`;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          topic: activeTopic,
          subject: scopedSubject?.name || genSubject,
          difficulty,
          count: questionCount,
          timeLimitMinutes: useTimer ? timerMinutes : undefined,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate quiz.');
      }
      const quiz: QuizDefinition = {
        id: `quiz-${Date.now()}`,
        title: data.title || `${activeTopic} Quiz`,
        subject: data.subject || scopedSubject?.name || genSubject,
        topic: activeTopic,
        difficulty,
        timeLimitMinutes: useTimer ? timerMinutes : null,
        origin: 'ai-generated',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: Array.isArray(data.questions) ? data.questions : [],
      };
      onSaveQuiz(quiz);
      startQuizPlayer(quiz);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unable to generate quiz right now.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadExamFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setExtractingUpload(true);
    setUploadError(null);
    setUploadNotice(null);

    try {
      const isImage = file.type.startsWith('image/');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';

      const res = await fetch('/api/quizzes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data: isImage ? undefined : base64Data,
          images: isImage ? [{ mimeType: file.type, base64Data }] : undefined,
          subject: scopedSubject?.name || uploadSubject,
          rawText: uploadHint.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not extract questions from that document.');
      }

      const extractedQuiz: QuizDefinition = {
        id: `quiz-${Date.now()}`,
        title: data.title || file.name.replace(/\.[^.]+$/, ''),
        subject: data.subject || scopedSubject?.name || uploadSubject,
        topic: file.name.replace(/\.[^.]+$/, ''),
        difficulty: 'medium',
        timeLimitMinutes: null,
        origin: 'uploaded-document',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: Array.isArray(data.questions) ? data.questions : [],
      };

      const missingKeys = extractedQuiz.questions.filter(
        (q) => q.correctIndex === null || q.correctIndex === undefined
      ).length;

      setUploadNotice(
        missingKeys > 0
          ? `Extracted ${extractedQuiz.questions.length} question(s). ${missingKeys} question(s) have no official answer key in the document — ALEXYN did not invent one. Review or add keys below before grading.`
          : `Extracted ${extractedQuiz.questions.length} question(s) with detected answer keys.`
      );
      openQuizInEditor(extractedQuiz);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to parse uploaded document.');
    } finally {
      setExtractingUpload(false);
    }
  };

  const handleResearchOnline = async () => {
    const q = researchQuery.trim();
    if (!q) {
      setResearchError('Enter the subject, exam style, or topic you want to research.');
      return;
    }
    setResearching(true);
    setResearchError(null);
    setResearchNotes(null);
    setResearchSources([]);

    try {
      const res = await fetch('/api/quizzes/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          query: q,
          subject: scopedSubject?.name || genSubject,
          examType: researchExamType,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Online quiz research failed.');
      }

      const sources: GroundingSource[] = Array.isArray(data.sources) ? data.sources : [];
      const extractedQs: QuizQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      const primaryOrigin: QuizQuestionOrigin =
        extractedQs[0]?.origin || (sources.length > 0 ? 'educational-practice' : 'ai-generated');
      setResearchSources(sources);
      setResearchNotes(data.summaryNote || data.researchNotes || null);

      const quiz: QuizDefinition = {
        id: `quiz-${Date.now()}`,
        title: data.title || `${q} Practice`,
        subject: data.subject || scopedSubject?.name || genSubject,
        topic: data.topic || q,
        difficulty: 'medium',
        timeLimitMinutes: null,
        origin: primaryOrigin,
        sources: sources.length > 0 ? sources : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: extractedQs,
      };

      onSaveQuiz(quiz);
      setDraftQuiz(quiz);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : 'Could not research online quizzes.');
    } finally {
      setResearching(false);
    }
  };

  const visibleQuizzes = scopedSubject
    ? savedQuizzes.filter(
        (q) => q.subject.toLowerCase() === scopedSubject.name.toLowerCase()
      )
    : savedQuizzes;

  // INTERACTIVE QUIZ PLAYER VIEW
  if (playingQuiz) {
    const total = playingQuiz.questions.length;
    const currentQ = playingQuiz.questions[currentIdx];
    const picked = selectedAnswers[currentQ.id] ?? null;
    const hasOfficialKey =
      currentQ.correctIndex !== null && currentQ.correctIndex !== undefined;
    const badge = originBadge(currentQ.origin);
    const formattedClock =
      secondsLeft !== null
        ? `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
            secondsLeft % 60
          ).padStart(2, '0')}`
        : null;

    if (submittedAttempt) {
      return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPlayingQuiz(null)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Quizzes</span>
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openQuizInEditor(playingQuiz)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#38BDF8]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Quiz</span>
              </button>
              <button
                type="button"
                onClick={() => startQuizPlayer(playingQuiz)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-bold text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retake Quiz</span>
              </button>
            </div>
          </div>

          <section className="rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1E46] to-[#081129] p-6">
            <p className="text-xs font-semibold text-[#7DD3FC]">
              {playingQuiz.subject} · {playingQuiz.difficulty.toUpperCase()}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">{playingQuiz.title}</h1>

            {submittedAttempt.maxScore > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <p className="text-xs text-slate-400">Final Score</p>
                  <p className="mt-1 font-mono text-2xl font-extrabold text-[#5EEAD4]">
                    {submittedAttempt.score}/{submittedAttempt.maxScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <p className="text-xs text-slate-400">Percentage</p>
                  <p
                    className={`mt-1 font-mono text-2xl font-extrabold ${
                      submittedAttempt.percentage >= 70
                        ? 'text-emerald-400'
                        : submittedAttempt.percentage >= 50
                        ? 'text-amber-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {submittedAttempt.percentage}%
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <p className="text-xs text-slate-400">Time Used</p>
                  <p className="mt-1 font-mono text-xl font-bold text-white">
                    {submittedAttempt.durationSec}s
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <p className="text-xs text-slate-400">Progress Sync</p>
                  <p className="mt-1 text-xs font-semibold text-[#7DD3FC]">
                    Recorded in Progress ✓
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
                This quiz had no official answer keys provided, so it was not scored into your academic percentage. Edit the quiz to add answer keys if you want graded tracking.
              </div>
            )}

            {onMakeSmartNotes && (
              <button
                type="button"
                onClick={() => onMakeSmartNotes(playingQuiz.topic || playingQuiz.title, playingQuiz.subject)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-4 py-2 text-xs font-bold text-[#7DD3FC] hover:bg-[#193272]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Revise {playingQuiz.topic || playingQuiz.subject} in Smart Notes →</span>
              </button>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Answer Review & Explanations</h2>
            {playingQuiz.questions.map((q, idx) => {
              const userPick = selectedAnswers[q.id] ?? null;
              const qBadge = originBadge(q.origin);
              const qHasKey = q.correctIndex !== null && q.correctIndex !== undefined;
              const isRight = qHasKey && userPick === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1430] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-400">Question {idx + 1}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${qBadge.cls}`}>
                        {qBadge.label}
                      </span>
                      {!qHasKey ? (
                        <span className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          No Official Key (Ungraded)
                        </span>
                      ) : isRight ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                          <XCircle className="h-4 w-4" />
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-white">{q.prompt}</p>

                  <div className="mt-3 space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrectOpt = qHasKey && optIdx === q.correctIndex;
                      const isUserOpt = userPick === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                            isCorrectOpt
                              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                              : isUserOpt
                              ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                              : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                          }`}
                        >
                          <span>
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </span>
                          <span className="text-[11px] font-semibold">
                            {isCorrectOpt ? '✓ Correct Answer' : isUserOpt ? 'Your Pick' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <p className="mt-3 rounded-xl bg-[#060E24] px-3 py-2.5 text-xs leading-relaxed text-slate-300">
                      <span className="font-bold text-[#7DD3FC]">Explanation: </span>
                      {q.explanation}
                    </p>
                  )}

                  {q.sourceUrl && (
                    <a
                      href={q.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#38BDF8] hover:underline"
                    >
                      <span>{q.sourceTitle || 'Original Educational Source'}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      );
    }

    const showFeedbackNow = instantFeedback && picked !== null;
    const progressPct = Math.round(((currentIdx + 1) / total) * 100);

    return (
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPlayingQuiz(null)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit Quiz</span>
          </button>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={instantFeedback}
                onChange={(e) => setInstantFeedback(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#2E8BFF]"
              />
              <span>Instant feedback</span>
            </label>
            {formattedClock && (
              <span
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold ${
                  secondsLeft !== null && secondsLeft <= 30
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                    : 'border-[#38BDF8]/40 bg-[#0E1D45] text-[#7DD3FC]'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {formattedClock}
              </span>
            )}
          </div>
        </div>

        <section className="rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#7DD3FC]">
                {playingQuiz.subject} · {playingQuiz.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Question {currentIdx + 1} of {total}
              </p>
            </div>
            <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#132550]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2E8BFF] to-[#5EEAD4] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <h2 className="mt-5 text-lg font-bold leading-snug text-white sm:text-xl">
            {currentQ.prompt}
          </h2>

          {!hasOfficialKey && (
            <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              No official answer key was found in the source document for this question. Select an option or edit this quiz to assign an answer key.
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {currentQ.options.map((opt, optIdx) => {
              const selected = picked === optIdx;
              const isCorrect = hasOfficialKey && optIdx === currentQ.correctIndex;
              let cardStyle = 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-200 hover:border-[#2E8BFF]';

              if (showFeedbackNow && hasOfficialKey) {
                if (isCorrect) {
                  cardStyle = 'border-emerald-400 bg-emerald-500/15 text-emerald-100';
                } else if (selected) {
                  cardStyle = 'border-rose-400 bg-rose-500/15 text-rose-100';
                }
              } else if (selected) {
                cardStyle = 'border-[#38BDF8] bg-[#142A5E] text-white';
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() =>
                    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }))
                  }
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${cardStyle}`}
                >
                  <span>
                    <strong className="mr-2 font-mono text-[#7DD3FC]">
                      {String.fromCharCode(65 + optIdx)}.
                    </strong>
                    {opt}
                  </span>
                  {showFeedbackNow && hasOfficialKey && isCorrect && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  )}
                  {showFeedbackNow && hasOfficialKey && selected && !isCorrect && (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  )}
                </button>
              );
            })}
          </div>

          {showFeedbackNow && (
            <div className="mt-4 rounded-2xl border border-[#2E8BFF]/35 bg-[#081538] p-3.5 text-xs leading-relaxed text-slate-200">
              {hasOfficialKey ? (
                <p className="mb-1 font-bold text-[#5EEAD4]">
                  {picked === currentQ.correctIndex
                    ? '✓ Correct answer!'
                    : `Correct choice: ${String.fromCharCode(65 + (currentQ.correctIndex ?? 0))}`}
                </p>
              ) : null}
              <p>{currentQ.explanation || 'Review the core principle behind this concept.'}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1A3D] px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {currentIdx < total - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-5 py-2 text-xs font-bold text-white hover:bg-[#1E75EA]"
              >
                <span>Next Question</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-2 text-xs font-bold text-white"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Submit & Grade Quiz</span>
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 md:px-8">
      {scopedSubject && onBackFromScoped && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#08122E] px-4 py-2.5">
          <button
            type="button"
            onClick={onBackFromScoped}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-[#2E8BFF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {scopedSubject.name}</span>
          </button>
          <span className="text-xs font-semibold text-[#7DD3FC]">
            Dedicated {scopedSubject.name} Quizzes
          </span>
        </div>
      )}

      {/* HEADER */}
      <section className="rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0B1739] via-[#08122E] to-[#050C20] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#132960] text-[#38BDF8]">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                {scopedSubject ? `${scopedSubject.name} Quizzes` : 'ALEXYN Quizzes'}
              </h1>
              <p className="text-xs text-slate-400">
                Interactive assessments, custom builder, exam document extraction & online research
              </p>
            </div>
          </div>

          {recentAttempts.length > 0 && (
            <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-2.5 text-right">
              <p className="text-[11px] text-slate-400">Recent Attempts</p>
              <p className="font-mono text-sm font-bold text-[#5EEAD4]">
                {recentAttempts.length} completed
              </p>
            </div>
          )}
        </div>

        {/* MODE NAVIGATION */}
        <div
          role="tablist"
          aria-label="Quiz studio modes"
          className="mt-5 flex flex-wrap gap-2"
        >
          {[
            { id: 'generate', label: 'Generate Quiz', icon: Sparkles },
            { id: 'create', label: 'Create / Edit Quiz', icon: Edit3 },
            { id: 'upload', label: 'Upload Exam Doc', icon: Upload },
            { id: 'research', label: 'Online Quiz Research', icon: Globe },
            { id: 'saved', label: `Saved Quizzes (${visibleQuizzes.length})`, icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id as QuizTab)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? 'border-[#38BDF8] bg-[#2E8BFF] text-white'
                    : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: GENERATE QUIZ */}
      {activeTab === 'generate' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-7">
              <label htmlFor="quizGenTopic" className="mb-1.5 block text-xs font-semibold text-slate-300">
                Quiz topic
              </label>
              <input
                id="quizGenTopic"
                type="text"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. Genetics & Punnett Squares, Quadratic Equations, French Tenses..."
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div className="md:col-span-5">
              <label htmlFor="quizGenSubject" className="mb-1.5 block text-xs font-semibold text-slate-300">
                Subject
              </label>
              {scopedSubject ? (
                <div className="flex min-h-[46px] items-center rounded-xl border border-[#38BDF8]/40 bg-[#0D1E45] px-4 text-sm font-semibold text-white">
                  {scopedSubject.name}
                </div>
              ) : (
                <select
                  id="quizGenSubject"
                  value={genSubject}
                  onChange={(e) => setGenSubject(e.target.value)}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-3 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <optgroup label="Core Subjects">
                    {CORE_SUBJECTS.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="World Languages">
                    {LANGUAGE_SUBJECTS.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-300">Difficulty</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['easy', 'medium', 'hard'] as QuizDifficulty[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`min-h-[40px] rounded-xl border text-xs font-bold capitalize ${
                      difficulty === lvl
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="quizCountRange" className="mb-1.5 flex justify-between text-xs font-semibold text-slate-300">
                <span>Questions</span>
                <span className="font-mono text-[#5EEAD4]">{questionCount}</span>
              </label>
              <input
                id="quizCountRange"
                type="range"
                min="3"
                max="12"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="mt-2 w-full accent-[#2E8BFF]"
              />
            </div>

            <div className="flex flex-col justify-center rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Timed mode</p>
                  <p className="text-[11px] text-slate-400">
                    {useTimer ? 'Countdown enabled' : 'Practice at your own pace'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useTimer}
                  aria-label="Toggle timed mode"
                  onClick={() => setUseTimer((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                    useTimer
                      ? 'border-[#38BDF8] bg-[#2E8BFF]'
                      : 'border-[var(--alexyn-border)] bg-[#0E1B3E]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useTimer ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {useTimer && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-xs text-slate-300">
                  <span>Minutes:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2 py-1 text-center font-mono text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {genError && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {genError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Interactive Quiz...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate & Start AI Quiz</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* TAB 2: CREATE / EDIT QUIZ */}
      {activeTab === 'create' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Create or Edit Quiz</h2>
              <p className="text-xs text-slate-400">
                Edit questions, options, answer keys, explanations, or build your own quiz from scratch.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const clean = normalizeQuizQuestions(draftQuiz.questions);
                  if (clean.length === 0) {
                    setBuilderError('Add at least one question with a prompt and 2+ non-empty options before saving.');
                    setBuilderSavedNotice(null);
                    return;
                  }
                  setBuilderError(null);
                  const toSave = { ...draftQuiz, questions: clean, updatedAt: Date.now() };
                  onSaveQuiz(toSave);
                  setBuilderSavedNotice('Quiz saved to My Saved Quizzes ✓');
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#5EEAD4]/40 bg-[#0D263C] px-3.5 py-2 text-xs font-bold text-[#5EEAD4]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Quiz</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = normalizeQuizQuestions(draftQuiz.questions);
                  if (clean.length === 0) {
                    setBuilderError('Add at least one question with a prompt and 2+ non-empty options before starting.');
                    setBuilderSavedNotice(null);
                    return;
                  }
                  setBuilderError(null);
                  const toSave = { ...draftQuiz, questions: clean, updatedAt: Date.now() };
                  onSaveQuiz(toSave);
                  startQuizPlayer(toSave);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-bold text-white"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Quiz</span>
              </button>
            </div>
          </div>

          {uploadNotice && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              {uploadNotice}
            </div>
          )}
          {builderError && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
              {builderError}
            </div>
          )}
          {builderSavedNotice && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
              {builderSavedNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Quiz Title</label>
              <input
                type="text"
                value={draftQuiz.title}
                onChange={(e) => setDraftQuiz((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Subject</label>
              <input
                type="text"
                value={draftQuiz.subject}
                disabled={Boolean(scopedSubject)}
                onChange={(e) => setDraftQuiz((p) => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-sm text-white disabled:opacity-70"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Topic</label>
              <input
                type="text"
                value={draftQuiz.topic}
                onChange={(e) => setDraftQuiz((p) => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Electrolysis"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-4">
            {draftQuiz.questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#7DD3FC]">Question {qIdx + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Origin: {originBadge(q.origin).label}
                    </span>
                    {draftQuiz.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftQuiz((prev) => ({
                            ...prev,
                            questions: prev.questions.filter((item) => item.id !== q.id),
                          }))
                        }
                        className="text-xs text-rose-300 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={q.prompt}
                  placeholder="Enter question text..."
                  onChange={(e) =>
                    setDraftQuiz((prev) => ({
                      ...prev,
                      questions: prev.questions.map((item) =>
                        item.id === q.id ? { ...item, prompt: e.target.value } : item
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === optIdx}
                        onChange={() =>
                          setDraftQuiz((prev) => ({
                            ...prev,
                            questions: prev.questions.map((item) =>
                              item.id === q.id ? { ...item, correctIndex: optIdx } : item
                            ),
                          }))
                        }
                        aria-label={`Mark option ${String.fromCharCode(65 + optIdx)} correct`}
                        className="h-4 w-4 accent-[#5EEAD4]"
                      />
                      <input
                        type="text"
                        value={opt}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        onChange={(e) =>
                          setDraftQuiz((prev) => ({
                            ...prev,
                            questions: prev.questions.map((item) =>
                              item.id === q.id
                                ? {
                                    ...item,
                                    options: item.options.map((o, oi) =>
                                      oi === optIdx ? e.target.value : o
                                    ),
                                  }
                                : item
                            ),
                          }))
                        }
                        className="flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftQuiz((prev) => ({
                        ...prev,
                        questions: prev.questions.map((item) =>
                          item.id === q.id ? { ...item, correctIndex: null } : item
                        ),
                      }))
                    }
                    className={`text-[11px] font-semibold ${
                      q.correctIndex === null ? 'text-amber-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {q.correctIndex === null ? '✓ No official key assigned' : 'Mark as no official key'}
                  </button>
                </div>

                <input
                  type="text"
                  value={q.explanation}
                  placeholder="Optional explanation shown after answering..."
                  onChange={(e) =>
                    setDraftQuiz((prev) => ({
                      ...prev,
                      questions: prev.questions.map((item) =>
                        item.id === q.id ? { ...item, explanation: e.target.value } : item
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setDraftQuiz((prev) => ({
                ...prev,
                questions: [
                  ...prev.questions,
                  makeEmptyQuestion(prev.questions.length + 1, 'user-created'),
                ],
              }))
            }
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-dashed border-[#2E8BFF]/60 bg-[#07112B] px-4 py-2 text-xs font-bold text-[#7DD3FC] hover:bg-[#0D1E45]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Question</span>
          </button>
        </section>
      )}

      {/* TAB 3: UPLOAD PERSONAL EXAM DOCUMENT */}
      {activeTab === 'upload' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-white">Upload Personal Quiz or Exam Paper</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Upload a PDF, Word (.docx), PowerPoint (.pptx), text file, or exam page image. ALEXYN preserves original wording and extracts answer keys only when actually provided (never inventing missing keys).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="uploadQuizSubject" className="mb-1 block text-xs font-semibold text-slate-300">
                Subject Hint
              </label>
              <input
                id="uploadQuizSubject"
                type="text"
                value={scopedSubject?.name || uploadSubject}
                disabled={Boolean(scopedSubject)}
                onChange={(e) => setUploadSubject(e.target.value)}
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="uploadQuizNotes" className="mb-1 block text-xs font-semibold text-slate-300">
                Optional extra instructions / pasted text
              </label>
              <input
                id="uploadQuizNotes"
                type="text"
                value={uploadHint}
                onChange={(e) => setUploadHint(e.target.value)}
                placeholder="e.g. Extract Section A multiple-choice questions"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <input
            ref={uploadFileRef}
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md,.csv,image/*"
            className="hidden"
            onChange={handleUploadExamFile}
          />

          <button
            type="button"
            onClick={() => uploadFileRef.current?.click()}
            disabled={extractingUpload}
            className="flex min-h-[110px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2E8BFF]/45 bg-[#060E24] p-6 text-center transition-colors hover:border-[#38BDF8] hover:bg-[#0B1739] disabled:opacity-60"
          >
            {extractingUpload ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-[#38BDF8]" />
                <span className="text-sm font-bold text-white">
                  Extracting exam questions faithfully...
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-[#5EEAD4]" />
                <span className="text-sm font-bold text-white">
                  Choose PDF, Word, PowerPoint, Text, or Exam Photo
                </span>
                <span className="text-xs text-slate-400">
                  Extracted questions open in the Editor so you can review before starting
                </span>
              </>
            )}
          </button>
        </section>
      )}

      {/* TAB 4: ONLINE QUIZ RESEARCH */}
      {activeTab === 'research' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-white">Online Exam & Quiz Research</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Search online educational sources for past-paper style or practice questions with source citations and honest provenance labels.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-8">
              <label htmlFor="researchQuizInput" className="mb-1 block text-xs font-semibold text-slate-300">
                What exam questions should ALEXYN find?
              </label>
              <input
                id="researchQuizInput"
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="e.g. Find me KCSE-style Biology questions on genetics"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>
            <div className="md:col-span-4">
              <label htmlFor="researchExamType" className="mb-1 block text-xs font-semibold text-slate-300">
                Exam System / Level
              </label>
              <input
                id="researchExamType"
                type="text"
                value={researchExamType}
                onChange={(e) => setResearchExamType(e.target.value)}
                placeholder="KCSE, GCSE, SAT, University..."
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-3 text-sm text-white"
              />
            </div>
          </div>

          {researchError && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {researchError}
            </div>
          )}

          <button
            type="button"
            onClick={handleResearchOnline}
            disabled={researching}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching educational sources...</span>
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" />
                <span>Search & Build Interactive Quiz</span>
              </>
            )}
          </button>

          {researchNotes && (
            <div className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
              <p className="text-xs leading-relaxed text-slate-200">{researchNotes}</p>
              {researchSources.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                    Discovered Source Links:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {researchSources.map((src, idx) => (
                      <a
                        key={`${src.url}-${idx}`}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/35 bg-[#0D1E45] px-2.5 py-1 text-[11px] text-slate-200 hover:text-white"
                      >
                        <span className="max-w-[200px] truncate">{src.title}</span>
                        <ExternalLink className="h-3 w-3 text-[#38BDF8]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startQuizPlayer(draftQuiz)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-4 py-2 text-xs font-bold text-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Take Researched Quiz ({draftQuiz.questions.length} Qs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-4 py-2 text-xs font-semibold text-slate-200"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Review / Edit Questions</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 5: SAVED QUIZZES */}
      {activeTab === 'saved' && (
        <section className="space-y-3 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {scopedSubject ? `${scopedSubject.name} Saved Quizzes` : 'My Saved Quizzes'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setDraftQuiz({
                  id: `quiz-${Date.now()}`,
                  title: 'New Custom Quiz',
                  subject: scopedSubject?.name || profile.subjects[0] || 'Biology',
                  topic: '',
                  difficulty: 'medium',
                  timeLimitMinutes: null,
                  origin: 'user-created',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  questions: [makeEmptyQuestion(1, 'user-created')],
                });
                setActiveTab('create');
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#5EEAD4] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New</span>
            </button>
          </div>

          {visibleQuizzes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--alexyn-border)] bg-[#060E24] p-6 text-center text-sm text-slate-400">
              No saved quizzes yet. Generate an AI quiz, research past-paper questions, upload an exam, or create your own.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {visibleQuizzes.map((qz) => (
                <div
                  key={qz.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#7DD3FC]">
                        {qz.subject} · {qz.difficulty}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {qz.questions.length} question(s)
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-white">{qz.title}</h3>
                    {qz.topic && <p className="mt-0.5 text-xs text-slate-400">{qz.topic}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => startQuizPlayer(qz)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E75EA]"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Start</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuizInEditor(qz)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#38BDF8]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteQuiz(qz.id)}
                      aria-label={`Delete quiz ${qz.title}`}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
