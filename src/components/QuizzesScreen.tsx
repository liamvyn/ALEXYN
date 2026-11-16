import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Loader2,
  Play,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import {
  buildAdaptiveQuizBlueprint,
  clearExamDraft,
  loadExamDrafts,
  normalizeQuizQuestions,
} from '../utils/examEngine';
import { ExamPlayer } from './ExamPlayer';
import type {
  AISelection,
  EducationProfile,
  ExamDraftState,
  ExamResourceHit,
  GroundingSource,
  QuizAttempt,
  QuizDefinition,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionOrigin,
  SubjectItem,
  VoicePreferences,
} from '../types/alexyn';

interface QuizzesScreenProps {
  profile: EducationProfile;
  aiSelection?: AISelection;
  voicePrefs?: VoicePreferences;
  savedQuizzes: QuizDefinition[];
  onSaveQuiz: (quiz: QuizDefinition) => void;
  onDeleteQuiz: (quizId: string) => void;
  onRecordAttempt: (attempt: QuizAttempt) => void;
  recentAttempts: QuizAttempt[];
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  initialTopic?: string;
  initialSubject?: string;
  initialTab?: QuizTab;
  adaptivePrefill?: {
    id: string;
    subject: string;
    weakTopics: string[];
  } | null;
  onConsumeAdaptivePrefill?: () => void;
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
  aiSelection,
  voicePrefs,
  savedQuizzes,
  onSaveQuiz,
  onDeleteQuiz,
  onRecordAttempt,
  recentAttempts,
  scopedSubject,
  onBackFromScoped,
  initialTopic = '',
  initialSubject = '',
  initialTab,
  adaptivePrefill,
  onConsumeAdaptivePrefill,
  onMakeSmartNotes,
}: QuizzesScreenProps) {
  const [activeTab, setActiveTab] = useState<QuizTab>(initialTab || 'generate');

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

  // Online Research state (Grade, Subject, Topic, Exam Year + Kenyan portals & PDF Viewer)
  const [researchGrade, setResearchGrade] = useState(profile.grade || 'Grade 10 / Form 4');
  const [researchSubject, setResearchSubject] = useState(
    scopedSubject?.name || initialSubject || profile.subjects[0] || 'Biology'
  );
  const [researchTopic, setResearchTopic] = useState(initialTopic || '');
  const [researchYear, setResearchYear] = useState('');
  const [researchCountry, setResearchCountry] = useState(profile.country || '');
  const [researchResourceType, setResearchResourceType] = useState<
    '' | 'past-paper' | 'marking-scheme' | 'syllabus' | 'curriculum-notes'
  >('');
  const [researchQuery, setResearchQuery] = useState('');
  const [researchExamType, setResearchExamType] = useState('KCSE / CBC / National Exam');
  const [prioritizeKenya, setPrioritizeKenya] = useState(
    !profile.country ||
      profile.country.toLowerCase().includes('kenya') ||
      profile.curriculum.toLowerCase().includes('cbc') ||
      profile.curriculum.toLowerCase().includes('kcse')
  );
  const [searchingResources, setSearchingResources] = useState(false);
  const [researchResources, setResearchResources] = useState<ExamResourceHit[]>([]);
  const [resourceSearchStatus, setResourceSearchStatus] = useState<string | null>(null);
  const [officialPortals, setOfficialPortals] = useState<Array<{ name: string; url: string }>>([
    { name: 'KICD', url: 'https://kicd.ac.ke/' },
    { name: 'Kenya Education Cloud', url: 'https://lms.kec.ac.ke/' },
    { name: 'KNEC', url: 'https://knec.ac.ke/' },
  ]);
  const [fetchingPdfId, setFetchingPdfId] = useState<string | null>(null);
  const [pdfFetchErrors, setPdfFetchErrors] = useState<Record<string, string>>({});
  const [openedPdfDoc, setOpenedPdfDoc] = useState<{
    fileName: string;
    sourceUrl: string;
    title: string;
    byteLength: number;
    pageCount: number | null;
    pages: Array<{ pageNumber: number; text: string }>;
    extractedText: string;
    blobUrl: string;
    base64Data: string;
  } | null>(null);
  const [pdfViewTab, setPdfViewTab] = useState<'document' | 'text'>('document');
  const [selectedPdfPage, setSelectedPdfPage] = useState<'all' | number>('all');
  const [extractingFromPdf, setExtractingFromPdf] = useState(false);

  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchSources, setResearchSources] = useState<GroundingSource[]>([]);
  const [researchNotes, setResearchNotes] = useState<string | null>(null);
  const [researchExactPaperFound, setResearchExactPaperFound] = useState<boolean | null>(null);

  // Active Interactive ExamPlayer & Draft state
  const [playingQuiz, setPlayingQuiz] = useState<QuizDefinition | null>(null);
  const [resumedDraft, setResumedDraft] = useState<ExamDraftState | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<Record<string, ExamDraftState>>(() =>
    loadExamDrafts()
  );
  const [generatingAdaptive, setGeneratingAdaptive] = useState(false);

  const adaptiveBlueprint = useMemo(
    () => buildAdaptiveQuizBlueprint(recentAttempts, scopedSubject?.name || genSubject),
    [recentAttempts, scopedSubject?.name, genSubject]
  );

  useEffect(() => {
    if (scopedSubject) {
      setGenSubject(scopedSubject.name);
      setUploadSubject(scopedSubject.name);
      setResearchSubject(scopedSubject.name);
      if (!genTopic && scopedSubject.examHotTopics[0]) {
        setGenTopic(scopedSubject.examHotTopics[0]);
      }
    }
  }, [scopedSubject?.id]);

  // Revoke any active ObjectURL when openedPdfDoc changes or component unmounts
  useEffect(() => {
    const currentUrl = openedPdfDoc?.blobUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [openedPdfDoc?.blobUrl]);

  const startQuizPlayer = (quiz: QuizDefinition, draftToResume: ExamDraftState | null = null) => {
    const cleanQuestions = normalizeQuizQuestions(quiz.questions);
    if (cleanQuestions.length === 0) {
      setBuilderError('Add at least one complete question before starting.');
      setGenError('Add at least one complete question before starting.');
      return;
    }
    setBuilderError(null);
    const normalizedQuiz: QuizDefinition = { ...quiz, questions: cleanQuestions };
    setResumedDraft(draftToResume);
    setPlayingQuiz(normalizedQuiz);
  };

  const openQuizInEditor = (quiz: QuizDefinition) => {
    setDraftQuiz({
      ...quiz,
      updatedAt: Date.now(),
      questions: quiz.questions.map((q) => ({ ...q, options: [...(q.options || [])] })),
    });
    setPlayingQuiz(null);
    setResumedDraft(null);
    setBuilderSavedNotice(null);
    setActiveTab('create');
  };

  const handleGenerateQuiz = async () => {
    const activeTopic = genTopic.trim() || `${genSubject} Core Concepts`;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(70000),
        body: JSON.stringify({
          topic: activeTopic,
          subject: scopedSubject?.name || genSubject,
          difficulty,
          count: questionCount,
          timeLimitMinutes: useTimer ? timerMinutes : undefined,
          questionTypes: ['mcq', 'short-answer', 'calculation', 'structured'],
          profile,
          aiSelection,
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
        topic: data.topic || activeTopic,
        instructions: data.instructions,
        totalMarks: data.totalMarks,
        difficulty,
        timeLimitMinutes: useTimer ? timerMinutes : null,
        origin: 'ai-generated',
        sourceNotice: 'AI-Generated Practice Paper (not an official national exam paper).',
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

  const handleGenerateAdaptiveQuiz = async (
    subjectOverride?: string,
    weakTopicsOverride?: string[]
  ) => {
    const targetSubj =
      scopedSubject?.name ||
      subjectOverride ||
      adaptiveBlueprint.recommendedSubject ||
      genSubject;
    const weakTopics =
      weakTopicsOverride && weakTopicsOverride.length > 0
        ? weakTopicsOverride
        : adaptiveBlueprint.weakTopics.map((w) => w.topic);
    const activeTopic =
      weakTopics.length > 0
        ? weakTopics.slice(0, 3).join(', ')
        : genTopic.trim() || `${targetSubj} Weak Areas`;

    setGeneratingAdaptive(true);
    setGenError(null);
    try {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(70000),
        body: JSON.stringify({
          adaptiveMode: true,
          subject: targetSubj,
          topic: activeTopic,
          difficulty: adaptiveBlueprint.suggestedDifficulty,
          count: Math.max(4, questionCount),
          weakTopics,
          repeatedMistakes: adaptiveBlueprint.repeatedMistakes,
          improvedTopics: adaptiveBlueprint.improvedTopics,
          questionTypes: ['mcq', 'short-answer', 'calculation', 'structured'],
          profile,
          aiSelection,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate adaptive quiz.');
      }
      const quiz: QuizDefinition = {
        id: `quiz-adap-${Date.now()}`,
        title: data.title || `${targetSubj} · Adaptive Practice`,
        subject: targetSubj,
        topic: activeTopic,
        instructions: data.instructions,
        totalMarks: data.totalMarks,
        difficulty: adaptiveBlueprint.suggestedDifficulty,
        timeLimitMinutes: useTimer ? timerMinutes : null,
        origin: 'ai-generated',
        sourceNotice:
          'AI-Generated Adaptive Practice targeting your recent weak topics and repeated mistakes.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: Array.isArray(data.questions) ? data.questions : [],
      };
      onSaveQuiz(quiz);
      startQuizPlayer(quiz);
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : 'Unable to generate adaptive quiz right now.'
      );
    } finally {
      setGeneratingAdaptive(false);
    }
  };

  useEffect(() => {
    if (!adaptivePrefill) return;
    setActiveTab('generate');
    if (!scopedSubject && adaptivePrefill.subject) {
      setGenSubject(adaptivePrefill.subject);
    }
    if (adaptivePrefill.weakTopics.length > 0) {
      setGenTopic(adaptivePrefill.weakTopics.slice(0, 3).join(', '));
    }
    void handleGenerateAdaptiveQuiz(adaptivePrefill.subject, adaptivePrefill.weakTopics);
    onConsumeAdaptivePrefill?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaptivePrefill?.id]);

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
          aiSelection,
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

  const handleFindEducationalResources = async () => {
    const activeSubj = scopedSubject?.name || researchSubject.trim();
    if (!activeSubj && !researchTopic.trim() && !researchQuery.trim()) {
      setResearchError('Enter a subject, topic, or search query to search online resources.');
      return;
    }
    setSearchingResources(true);
    setResearchError(null);
    setResourceSearchStatus(null);
    setPdfFetchErrors({});
    try {
      const res = await fetch('/api/quizzes/search-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          grade: researchGrade.trim(),
          subject: activeSubj,
          topic: researchTopic.trim(),
          year: researchYear.trim(),
          country: researchCountry.trim(),
          resourceType: researchResourceType || undefined,
          examType: researchExamType.trim(),
          query: researchQuery.trim(),
          prioritizeKenya,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Resource search failed.');
      }
      setResearchResources(Array.isArray(data.resources) ? data.resources : []);
      setResourceSearchStatus(data.searchStatus || null);
      if (Array.isArray(data.officialPortals) && data.officialPortals.length > 0) {
        setOfficialPortals(data.officialPortals);
      }
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : 'Could not search online curriculum & exam portals.'
      );
    } finally {
      setSearchingResources(false);
    }
  };

  const handleOpenPdfInAlexyn = async (resource: ExamResourceHit) => {
    setFetchingPdfId(resource.id);
    setPdfFetchErrors((prev) => {
      const next = { ...prev };
      delete next[resource.id];
      return next;
    });
    try {
      const res = await fetch('/api/quizzes/fetch-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({ url: resource.url }),
      });
      const data = await res.json();
      if (!res.ok || !data.downloaded || !data.pdfBase64) {
        setPdfFetchErrors((prev) => ({
          ...prev,
          [resource.id]:
            data.error ||
            'Document could not be downloaded directly (blocked or non-PDF page). Open the official source link instead.',
        }));
        return;
      }

      const bin = atob(String(data.pdfBase64));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      setPdfViewTab('document');
      setSelectedPdfPage('all');
      setOpenedPdfDoc({
        fileName: data.fileName || 'exam-resource.pdf',
        sourceUrl: resource.url,
        title: resource.title,
        byteLength: Number(data.byteLength || bytes.byteLength),
        pageCount: typeof data.pageCount === 'number' ? data.pageCount : null,
        pages: Array.isArray(data.pages) ? data.pages : [],
        extractedText: String(data.extractedText || ''),
        blobUrl,
        base64Data: String(data.pdfBase64),
      });
    } catch (err) {
      setPdfFetchErrors((prev) => ({
        ...prev,
        [resource.id]:
          err instanceof Error
            ? err.message
            : 'Unable to retrieve this PDF right now.',
      }));
    } finally {
      setFetchingPdfId(null);
    }
  };

  const handleExtractQuizFromOpenedPdf = async () => {
    if (!openedPdfDoc) return;
    setExtractingFromPdf(true);
    setResearchError(null);
    try {
      const res = await fetch('/api/quizzes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          fileName: openedPdfDoc.fileName,
          mimeType: 'application/pdf',
          base64Data: openedPdfDoc.base64Data,
          rawText: openedPdfDoc.extractedText || undefined,
          subject: scopedSubject?.name || researchSubject,
          aiSelection,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not extract questions from PDF.');
      }
      const quiz: QuizDefinition = {
        id: `quiz-${Date.now()}`,
        title: data.title || openedPdfDoc.title,
        subject: data.subject || scopedSubject?.name || researchSubject,
        topic: researchTopic || openedPdfDoc.title,
        difficulty: 'medium',
        timeLimitMinutes: null,
        origin: 'past-paper',
        sources: [{ title: openedPdfDoc.title, url: openedPdfDoc.sourceUrl, kind: 'past-paper' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: Array.isArray(data.questions)
          ? data.questions.map((q: QuizQuestion) => ({
              ...q,
              origin: 'past-paper',
              sourceTitle: openedPdfDoc.title,
              sourceUrl: openedPdfDoc.sourceUrl,
            }))
          : [],
      };
      setOpenedPdfDoc(null);
      openQuizInEditor(quiz);
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : 'Unable to extract quiz questions from PDF.'
      );
    } finally {
      setExtractingFromPdf(false);
    }
  };

  const handleResearchOnline = async () => {
    const activeSubj = scopedSubject?.name || researchSubject.trim();
    const combinedTopic = researchTopic.trim() || researchQuery.trim();
    if (!activeSubj && !combinedTopic) {
      setResearchError('Enter the subject, topic, or exam query you want to search.');
      return;
    }
    setResearching(true);
    setResearchError(null);
    setResearchNotes(null);
    setResearchSources([]);
    setResearchExactPaperFound(null);

    try {
      const res = await fetch('/api/quizzes/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(48000),
        body: JSON.stringify({
          query: researchQuery.trim() || `${researchGrade} ${activeSubj} ${combinedTopic} ${researchYear}`.trim(),
          grade: researchGrade.trim(),
          subject: activeSubj,
          topic: combinedTopic,
          year: researchYear.trim(),
          examType: researchExamType,
          prioritizeKenya,
          profile,
          aiSelection,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Online quiz research failed.');
      }

      const sources: GroundingSource[] = Array.isArray(data.sources) ? data.sources : [];
      const extractedQs: QuizQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      const foundResources: ExamResourceHit[] = Array.isArray(data.resources) ? data.resources : [];
      if (foundResources.length > 0) {
        setResearchResources(foundResources);
      }
      if (Array.isArray(data.officialPortals) && data.officialPortals.length > 0) {
        setOfficialPortals(data.officialPortals);
      }
      setResearchExactPaperFound(Boolean(data.exactPaperFound));
      const primaryOrigin: QuizQuestionOrigin =
        extractedQs[0]?.origin || (data.exactPaperFound ? 'educational-practice' : 'ai-generated');
      setResearchSources(sources);
      setResearchNotes(data.summaryNote || data.researchNotes || null);

      const quiz: QuizDefinition = {
        id: `quiz-${Date.now()}`,
        title: data.title || `${combinedTopic || activeSubj} Practice`,
        subject: data.subject || activeSubj,
        topic: data.topic || combinedTopic,
        difficulty: 'medium',
        timeLimitMinutes: null,
        origin: primaryOrigin,
        sourceNotice: data.summaryNote || undefined,
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

  const visibleDrafts = Object.values(savedDrafts).filter((d) => {
    const existsInSaved = savedQuizzes.some((q) => q.id === d.quizId);
    if (!existsInSaved) return false;
    if (scopedSubject && d.subject.toLowerCase() !== scopedSubject.name.toLowerCase()) {
      return false;
    }
    return true;
  });

  // INTERACTIVE MULTI-FORMAT EXAM PLAYER VIEW
  if (playingQuiz) {
    return (
      <ExamPlayer
        quiz={playingQuiz}
        initialDraft={resumedDraft}
        profile={profile}
        aiSelection={aiSelection || {}}
        voicePrefs={voicePrefs}
        onCompleteAttempt={(attempt) => {
          onRecordAttempt(attempt);
          setSavedDrafts(loadExamDrafts());
        }}
        onReviseTopicInNotes={(subj, top) => onMakeSmartNotes?.(top, subj)}
        onRequestAdaptiveRetry={(subj, weak) => {
          setPlayingQuiz(null);
          setResumedDraft(null);
          void handleGenerateAdaptiveQuiz(subj, weak);
        }}
        onExit={() => {
          setPlayingQuiz(null);
          setResumedDraft(null);
          setSavedDrafts(loadExamDrafts());
        }}
      />
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

      {/* UNFINISHED EXAM DRAFTS BANNER */}
      {visibleDrafts.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-[#38BDF8]/40 bg-[#0B1B42] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7DD3FC]">
            <Clock className="h-4 w-4" />
            <span>Unfinished Exam Drafts Saved Locally</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleDrafts.map((draft) => {
              const matchingQuiz = savedQuizzes.find((q) => q.id === draft.quizId);
              if (!matchingQuiz) return null;
              return (
                <div
                  key={draft.quizId}
                  className="flex items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{draft.quizTitle}</p>
                    <p className="text-[11px] text-slate-400">
                      {draft.subject} · Q{draft.currentIdx + 1} · {Math.floor(draft.elapsedSec / 60)}m {draft.elapsedSec % 60}s elapsed
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startQuizPlayer(matchingQuiz, draft)}
                    className="rounded-lg bg-[#2E8BFF] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#1E75EA]"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearExamDraft(draft.quizId);
                      setSavedDrafts(loadExamDrafts());
                    }}
                    aria-label={`Discard draft ${draft.quizTitle}`}
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-slate-400 hover:text-rose-300"
                  >
                    Discard
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 1: GENERATE QUIZ */}
      {activeTab === 'generate' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          {/* ADAPTIVE SMART PRACTICE CARD */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5EEAD4]/30 bg-gradient-to-r from-[#071B30] to-[#0C1D42] p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#5EEAD4]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Adaptive Weak-Topic Practice</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {adaptiveBlueprint.summaryText}
              </p>
            </div>
            <button
              type="button"
              disabled={generatingAdaptive || generating}
              onClick={() => handleGenerateAdaptiveQuiz()}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-[#5EEAD4]/50 bg-[#0D2E42] px-4 py-2 text-xs font-bold text-[#5EEAD4] hover:bg-[#14405A] disabled:opacity-50"
            >
              {generatingAdaptive ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Building Adaptive Paper...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Practise Weak Topics</span>
                </>
              )}
            </button>
          </div>
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

      {/* TAB 4: ONLINE QUIZ & EXAM PAPER RESEARCH */}
      {activeTab === 'research' && (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Online Exam &amp; Curriculum Search</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Search official examination and curriculum portals by grade, subject, topic, and year. Open accessible PDFs directly inside ALEXYN or generate a clearly labeled curriculum practice paper when exact papers are unavailable.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#5EEAD4]/35 bg-[#061528] px-3 py-2 text-xs font-semibold text-[#5EEAD4]">
              <input
                type="checkbox"
                checked={prioritizeKenya}
                onChange={(e) => setPrioritizeKenya(e.target.checked)}
                className="h-4 w-4 accent-[#5EEAD4]"
              />
              <span>Prioritize Kenyan Portals (KICD · KEC · KNEC)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="researchGrade" className="mb-1 block text-xs font-semibold text-slate-300">
                Grade / Class / Form
              </label>
              <input
                id="researchGrade"
                type="text"
                value={researchGrade}
                onChange={(e) => setResearchGrade(e.target.value)}
                placeholder="e.g. Grade 8, Form 4, Grade 10"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="researchSubject" className="mb-1 block text-xs font-semibold text-slate-300">
                Subject
              </label>
              <input
                id="researchSubject"
                type="text"
                value={scopedSubject?.name || researchSubject}
                disabled={Boolean(scopedSubject)}
                onChange={(e) => setResearchSubject(e.target.value)}
                placeholder="e.g. Mathematics, Biology"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none disabled:opacity-70"
              />
            </div>

            <div>
              <label htmlFor="researchTopic" className="mb-1 block text-xs font-semibold text-slate-300">
                Topic
              </label>
              <input
                id="researchTopic"
                type="text"
                value={researchTopic}
                onChange={(e) => setResearchTopic(e.target.value)}
                placeholder="e.g. Quadratic Equations, Genetics"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="researchYear" className="mb-1 block text-xs font-semibold text-slate-300">
                Examination Year
              </label>
              <input
                id="researchYear"
                type="text"
                value={researchYear}
                onChange={(e) => setResearchYear(e.target.value)}
                placeholder="e.g. 2024, 2023"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label htmlFor="researchQuizInput" className="mb-1 block text-xs font-semibold text-slate-300">
                Extra Search Keywords (optional)
              </label>
              <input
                id="researchQuizInput"
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="e.g. KCSE Paper 2 marking scheme, CBC assessment rubric..."
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="researchExamType" className="mb-1 block text-xs font-semibold text-slate-300">
                Exam System / Curriculum
              </label>
              <input
                id="researchExamType"
                type="text"
                value={researchExamType}
                onChange={(e) => setResearchExamType(e.target.value)}
                placeholder="KCSE, CBC, KPSEA, IGCSE..."
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="researchCountry" className="mb-1 block text-xs font-semibold text-slate-300">
                Country
              </label>
              <input
                id="researchCountry"
                type="text"
                value={researchCountry}
                onChange={(e) => setResearchCountry(e.target.value)}
                placeholder="e.g. Kenya"
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="researchResourceType" className="mb-1 block text-xs font-semibold text-slate-300">
                Material Type
              </label>
              <select
                id="researchResourceType"
                value={researchResourceType}
                onChange={(e) =>
                  setResearchResourceType(
                    e.target.value as '' | 'past-paper' | 'marking-scheme' | 'syllabus' | 'curriculum-notes'
                  )
                }
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-2.5 text-sm text-white"
              >
                <option value="">All Types</option>
                <option value="past-paper">Past Paper</option>
                <option value="marking-scheme">Marking Scheme</option>
                <option value="syllabus">Syllabus</option>
                <option value="curriculum-notes">Curriculum Notes</option>
              </select>
            </div>
          </div>

          {/* OFFICIAL PORTALS QUICK LINKS */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span className="font-semibold text-[#7DD3FC]">Official Kenyan Portals:</span>
            {officialPortals.map((portal) => (
              <a
                key={portal.url}
                href={portal.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/35 bg-[#060E24] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-[#5EEAD4] hover:text-white"
              >
                <span>{portal.name}</span>
                <ExternalLink className="h-3 w-3 text-[#5EEAD4]" />
              </a>
            ))}
          </div>

          {researchError && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {researchError}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleFindEducationalResources}
              disabled={searchingResources || researching}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#38BDF8]/50 bg-[#122658] px-4 py-2 text-xs font-bold text-[#7DD3FC] hover:bg-[#193372] disabled:opacity-60"
            >
              {searchingResources ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching official portals...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Find Papers &amp; Resources</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResearchOnline}
              disabled={researching || searchingResources}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {researching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching &amp; building exam...</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  <span>Search &amp; Build Practice Exam</span>
                </>
              )}
            </button>
          </div>

          {resourceSearchStatus && (
            <div className="rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2 text-xs text-slate-300">
              {resourceSearchStatus}
            </div>
          )}

          {/* DISCOVERED RESOURCE RESULTS WITH HONEST IN-APP PDF RETRIEVAL */}
          {researchResources.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7DD3FC]">
                Matching Papers &amp; Curriculum Resources ({researchResources.length})
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {researchResources.map((res) => {
                  const isBusy = fetchingPdfId === res.id;
                  const errText = pdfFetchErrors[res.id];
                  return (
                    <div
                      key={res.id}
                      className="flex flex-col justify-between gap-2.5 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {res.isKenyanOfficial && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                              <ShieldCheck className="h-3 w-3" />
                              <span>{res.kenyanAgency || res.sourceName}</span>
                            </span>
                          )}
                          <span className="rounded-md border border-[#2E8BFF]/35 bg-[#0E1E46] px-2 py-0.5 text-[10px] font-semibold text-[#7DD3FC]">
                            {res.sourceDomain}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              res.resourceType === 'pdf'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-slate-700/60 text-slate-300'
                            }`}
                          >
                            {res.resourceType}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white">{res.title}</h3>
                        <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">
                          {res.snippet}
                        </p>

                        {res.matchedCriteria.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {res.matchedCriteria.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-[#0A1532] px-1.5 py-0.5 text-[10px] text-slate-400"
                              >
                                Match: {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {errText && (
                        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                          {errText}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5">
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#38BDF8] hover:text-white"
                        >
                          <span>Open Source</span>
                          <ExternalLink className="h-3.5 w-3.5 text-[#38BDF8]" />
                        </a>

                        {res.resourceType === 'pdf' && (
                          <button
                            type="button"
                            onClick={() => handleOpenPdfInAlexyn(res)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E75EA] disabled:opacity-55"
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Retrieving PDF...</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                <span>Open PDF in ALEXYN</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {researchNotes && (
            <div className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
              {/* CLEAR PROVENANCE BANNER: OFFICIAL / SOURCED VS AI-GENERATED CURRICULUM PRACTICE */}
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  researchExactPaperFound
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                }`}
              >
                {researchExactPaperFound
                  ? 'Official / Online Educational Source Match — inspect links & citations below.'
                  : 'AI-Generated Curriculum Practice Exam — exact official paper was unavailable or restricted; ALEXYN generated curriculum-aligned practice questions (distinct from official KNEC/KICD past papers).'}
              </div>

              <p className="text-xs leading-relaxed text-slate-200">{researchNotes}</p>

              {researchSources.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                    Source Citations:
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
                  <span>Take Practice Exam ({draftQuiz.questions.length} Qs)</span>
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

          {/* IN-APP PDF VIEWER MODAL */}
          {openedPdfDoc && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-5"
              role="dialog"
              aria-modal="true"
              aria-label={`PDF Viewer: ${openedPdfDoc.title}`}
            >
              <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--alexyn-border)] bg-[#081129] shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--alexyn-border)] bg-[#0B1739] px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">{openedPdfDoc.title}</h3>
                    <p className="truncate text-[11px] text-[#7DD3FC]">
                      {openedPdfDoc.fileName} · {Math.round(openedPdfDoc.byteLength / 1024)} KB
                      {openedPdfDoc.pageCount ? ` · ${openedPdfDoc.pageCount} page(s)` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={openedPdfDoc.blobUrl}
                      download={openedPdfDoc.fileName}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#5EEAD4]/40 bg-[#0D2A3F] px-3 py-1.5 text-xs font-semibold text-[#5EEAD4] hover:bg-[#143955]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleExtractQuizFromOpenedPdf}
                      disabled={extractingFromPdf}
                      className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-55"
                    >
                      {extractingFromPdf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>Extract Questions into Quiz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenedPdfDoc(null)}
                      aria-label="Close PDF viewer"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-b border-[var(--alexyn-border)] bg-[#060E24] px-4 py-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPdfViewTab('document')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        pdfViewTab === 'document'
                          ? 'bg-[#2E8BFF] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      PDF Document View
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfViewTab('text')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        pdfViewTab === 'text'
                          ? 'bg-[#2E8BFF] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Extracted Text View
                    </button>
                  </div>
                  <a
                    href={openedPdfDoc.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7DD3FC] hover:underline"
                  >
                    <span>Original Source</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="flex-1 overflow-hidden bg-[#040A1A]">
                  {pdfViewTab === 'document' ? (
                    <iframe
                      title={openedPdfDoc.title}
                      src={openedPdfDoc.blobUrl}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full flex-col overflow-hidden">
                      {openedPdfDoc.pages.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--alexyn-border)] bg-[#07112B] px-4 py-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPdfPage('all')}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                              selectedPdfPage === 'all'
                                ? 'bg-[#2E8BFF] text-white'
                                : 'bg-[#0E1E46] text-slate-300 hover:text-white'
                            }`}
                          >
                            All Pages ({openedPdfDoc.pages.length})
                          </button>
                          {openedPdfDoc.pages.map((p) => (
                            <button
                              key={p.pageNumber}
                              type="button"
                              onClick={() => setSelectedPdfPage(p.pageNumber)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                                selectedPdfPage === p.pageNumber
                                  ? 'bg-[#5EEAD4] text-[#040A1A]'
                                  : 'bg-[#0E1E46] text-slate-300 hover:text-white'
                              }`}
                            >
                              Page {p.pageNumber}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto p-5">
                        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-200">
                          {selectedPdfPage === 'all'
                            ? openedPdfDoc.extractedText ||
                              'No selectable text could be extracted from this PDF; use PDF Document View above.'
                            : openedPdfDoc.pages.find((p) => p.pageNumber === selectedPdfPage)?.text ||
                              'No selectable text found on this page.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
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
