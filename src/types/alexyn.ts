export type ScreenId =
  | 'welcome'
  | 'explore'
  | 'subjects'
  | 'quizzes'
  | 'notes'
  | 'lab'
  | 'progress'
  | 'share'
  | 'setup';

export type AccountMode = 'guest' | 'signed-in';

export type SubjectWindowView = 'overview' | 'explore' | 'quizzes' | 'notes' | 'lab' | 'progress';

export type AIExplanationDepth = 'foundational' | 'balanced' | 'deep';
export type AIResponseLength = 'concise' | 'medium' | 'comprehensive';
export type AITeachingApproach =
  | 'intuitive'
  | 'step-by-step'
  | 'socratic'
  | 'exam-focused';

export interface AITutorSettings {
  explanationDepth: AIExplanationDepth;
  responseLength: AIResponseLength;
  teachingApproach: AITeachingApproach;
  useRelatableExamples: boolean;
  useHumorousExamples: boolean;
  askFollowUpQuestions: boolean;
  educationalLevel: 'auto' | 'Primary' | 'Secondary' | 'College' | 'University';
}

export interface ReminderPreferences {
  enabled: boolean;
  frequency: 'daily' | 'every-2-days' | 'study-sessions';
  preferredTime: string;
  browserNotifications: boolean;
}

export type AIProviderId =
  | 'auto'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'custom';

export interface AIModelOption {
  id: string;
  label: string;
  tier: 'free' | 'paid' | 'varies';
  notes: string;
  supportsVision?: boolean;
  supportsJson?: boolean;
}

export interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  shortName: string;
  description: string;
  configured: boolean;
  statusText: string;
  freeTierInfo: string;
  requiresPaymentOrKey: string;
  envVarHint: string;
  models: AIModelOption[];
}

export interface AISelection {
  providerId?: AIProviderId;
  modelId?: string;
}

export type VoiceEngineMode = 'auto' | 'neural' | 'browser';
export type NeuralVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface VoicePreferences {
  engine: VoiceEngineMode;
  voiceName: NeuralVoiceName;
  voiceStyle: string;
  speed: number;
  browserVoiceUri?: string;
  readLanguageCode: string;
}

export interface PrivacySettings {
  shareNotesWithAI: boolean;
  shareProgressWithAI: boolean;
  shareHistoryWithAI: boolean;
}

export type AppControlActionType =
  | 'navigate_screen'
  | 'open_practice_lab'
  | 'plot_math_graph'
  | 'open_note'
  | 'generate_notes'
  | 'create_quiz'
  | 'search_exams'
  | 'clear_chat';

export interface AppControlAction {
  id: string;
  type: AppControlActionType;
  label: string;
  requiresConfirmation?: boolean;
  payload: Record<string, unknown>;
}

export interface AppSettings {
  voiceLanguage: string;
  voicePrefs?: VoicePreferences;
  privacy?: PrivacySettings;
  defaultNoteDepth: NoteDetailLevel;
  autoScrollKeyboard: boolean;
  aiProvider?: AIProviderId;
  aiModel?: string;
  aiTutor: AITutorSettings;
  reminderPrefs?: ReminderPreferences;
}

export type LabSubjectCategory =
  | 'mathematics'
  | 'biology'
  | 'chemistry'
  | 'physics'
  | 'languages'
  | 'ict'
  | 'humanities'
  | 'custom';

export type LabModelId =
  | 'math-shapes'
  | 'math-graph'
  | 'math-working'
  | 'math-draw'
  | 'bio-cell'
  | 'bio-dna'
  | 'bio-body'
  | 'chem-atom'
  | 'chem-water'
  | 'chem-reaction'
  | 'phys-forces'
  | 'phys-wave'
  | 'phys-circuit'
  | 'phys-solar'
  | 'lang-practice'
  | 'ict-logic'
  | 'econ-supply'
  | 'geo-globe'
  | 'humanities-timeline'
  | 'humanities-practice'
  | 'custom';

export interface LabRecommendation {
  subject: string;
  modelId: LabModelId;
  label: string;
  reason: string;
}

export interface EducationProfile {
  name: string;
  email: string;
  age?: string;
  mode: AccountMode;
  guestConfirmed?: boolean;
  country: string;
  curriculum: string;
  educationLevel: 'Primary' | 'Secondary' | 'College' | 'University' | '';
  grade: string;
  universityYear?: string;
  subjects: string[];
  setupCompleted: boolean;
}

export interface AttachmentImage {
  id: string;
  name: string;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  kind?: 'past-paper' | 'educational' | 'syllabus' | 'github' | 'web';
}

export interface ExamResourceHit {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  isKenyanOfficial: boolean;
  kenyanAgency?: 'KICD' | 'Kenya Education Cloud' | 'KNEC';
  resourceType: 'pdf' | 'webpage';
  snippet: string;
  matchedCriteria: string[];
}

export interface ImportedMaterialItem {
  id: string;
  title: string;
  sourceType: 'file' | 'url';
  fileName?: string;
  url?: string;
  detailLabel?: string;
  pageCount?: number;
  pages?: Array<{ pageNumber: number; text: string }>;
  text: string;
  charCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  images?: AttachmentImage[];
  materials?: Array<{
    id: string;
    title: string;
    sourceType: 'file' | 'url';
    pageCount?: number;
    detailLabel?: string;
    url?: string;
  }>;
  pluginsUsed?: string[];
  providerUsed?: string;
  modelUsed?: string;
  visionNote?: string;
  recommendedLab?: LabRecommendation;
  appActions?: AppControlAction[];
  sources?: GroundingSource[];
  error?: boolean;
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  subjectFocus?: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export type NoteStyleId =
  | 'memory-tricks'
  | 'funny-examples'
  | 'exam-focus'
  | 'real-world-analogy'
  | 'quick-summary'
  | 'flashcards';

export type NoteDetailLevel = 'short' | 'detailed';

export interface SmartNoteSection {
  id: string;
  heading: string;
  content: string;
  kind: string;
}

export interface SmartNoteFlashcard {
  id: string;
  q: string;
  a: string;
}

export type SmartNoteAnimationKind =
  | 'photosynthesis'
  | 'cell-division'
  | 'circulation'
  | 'reaction'
  | 'wave'
  | 'orbit'
  | 'timeline'
  | 'custom';

export interface SmartNoteInteractiveStage {
  id: string;
  title: string;
  description: string;
  highlightHint?: string;
}

export interface SmartNoteVisual {
  id: string;
  title: string;
  caption: string;
  kind: 'diagram' | 'chart' | 'labeled-illustration' | 'cycle' | 'comparison' | 'timeline';
  svgMarkup: string;
  animationKind?: SmartNoteAnimationKind;
  interactiveStages?: SmartNoteInteractiveStage[];
}

export interface SmartNoteMediaPhoto {
  id: string;
  title: string;
  imageUrl: string;
  caption: string;
  sourceUrl?: string;
}

export interface NoteImportedSource {
  id: string;
  title: string;
  kind: 'file' | 'url' | 'github';
  url?: string;
  fileName?: string;
  detailLabel?: string;
  pageCount?: number;
  excerpt: string;
}

export interface SmartNoteBilingualVocab {
  term: string;
  english: string;
  pronunciationGuide: string;
  usageNote: string;
}

export interface SmartNoteBilingualSentence {
  targetText: string;
  englishTranslation: string;
  grammarBreakdown: string;
  register?: string;
}

export interface SmartNoteBilingualData {
  targetLanguage: string;
  languageCode: string;
  vocabulary: SmartNoteBilingualVocab[];
  exampleSentences: SmartNoteBilingualSentence[];
  grammarNotes: string[];
}

export interface SmartNote {
  id: string;
  title: string;
  subject: string;
  topic?: string;
  overview: string;
  styles: NoteStyleId[];
  detailLevel: NoteDetailLevel;
  sections: SmartNoteSection[];
  memoryTricks: string[];
  funnyExamples: string[];
  examTips: string[];
  readingAdvice: string[];
  flashcards: SmartNoteFlashcard[];
  visuals?: SmartNoteVisual[];
  mediaPhotos?: SmartNoteMediaPhoto[];
  images?: AttachmentImage[];
  importedSources?: NoteImportedSource[];
  bilingual?: SmartNoteBilingualData;
  createdAt: number;
  updatedAt?: number;
  lastStudiedSectionIndex?: number;
  studiedSectionIds?: string[];
  fromTaughtTopics?: string[];
  savedToLibrary: boolean;
}

export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizQuestionOrigin =
  | 'ai-generated'
  | 'uploaded-document'
  | 'past-paper'
  | 'educational-practice'
  | 'user-created';

export type QuizQuestionType =
  | 'mcq'
  | 'short-answer'
  | 'structured'
  | 'essay'
  | 'calculation'
  | 'diagram';

export type ExamMarkingMode = 'per-question' | 'full-paper';

export interface QuizSubPart {
  id: string;
  label: string;
  prompt: string;
  marks: number;
  markingScheme?: string;
}

export interface QuizVisualSpec {
  kind:
    | 'solid-3d'
    | 'coordinate-graph'
    | 'triangle-2d'
    | 'circle-2d'
    | 'science-circuit'
    | 'science-cell';
  title?: string;
  shapeId?: string;
  dimensions?: {
    radius?: number;
    topRadius?: number;
    height?: number;
    width?: number;
    length?: number;
    slant?: number;
    angleDeg?: number;
    unit?: string;
    a?: number;
    b?: number;
    c?: number;
  };
  equations?: string[];
  points?: Array<{ x: number; y: number; label?: string }>;
  labels?: string[];
  circuit?: { voltage?: number; r1?: number; r2?: number; mode?: 'series' | 'parallel' };
  cellType?: 'plant' | 'animal';
}

export interface QuizQuestion {
  id: string;
  questionType?: QuizQuestionType;
  questionNumber?: string;
  marks?: number;
  prompt: string;
  topic: string;
  options: string[];
  correctIndex: number | null;
  hasOfficialAnswerKey?: boolean;
  explanation: string;
  markingScheme?: string;
  sampleAnswer?: string;
  expectedSteps?: string[];
  subParts?: QuizSubPart[];
  visualSpec?: QuizVisualSpec;
  diagramSpec?: {
    title: string;
    instructions: string;
    expectedLabels?: string[];
    svgMarkup?: string;
  };
  origin: QuizQuestionOrigin;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface QuizDefinition {
  id: string;
  title: string;
  subject: string;
  topic: string;
  grade?: string;
  curriculum?: string;
  instructions?: string;
  totalMarks?: number;
  defaultMarkingMode?: ExamMarkingMode;
  difficulty: QuizDifficulty;
  timeLimitMinutes: number | null;
  origin: QuizQuestionOrigin;
  sourceNotice?: string;
  sources?: GroundingSource[];
  questions: QuizQuestion[];
  createdAt: number;
  updatedAt?: number;
}

export interface MathStepDiagnostic {
  stepIndex: number;
  expression: string;
  status: 'correct' | 'error' | 'unclear';
  note: string;
}

export interface MathWorkingEvaluation {
  overallCorrect: boolean;
  scoreAwarded: number;
  maxMarks: number;
  firstErrorStepIndex: number | null;
  stepDiagnostics: MathStepDiagnostic[];
  correctNextSteps: string[];
  conceptualTip: string;
}

export interface QuizStepDiagnostic {
  stepIndex: number;
  expression: string;
  status: 'correct' | 'error' | 'unclear';
  note: string;
}

export interface QuizAnswerRecord {
  questionId: string;
  questionNumber?: string;
  questionType?: QuizQuestionType;
  topic: string;
  selectedIndex: number | null;
  correctIndex: number | null;
  textAnswer?: string;
  mathSteps?: string[];
  subPartAnswers?: Record<string, string>;
  diagramAnswer?: string;
  marksAwarded?: number;
  maxMarks?: number;
  aiFeedback?: string;
  modelAnswer?: string;
  stepDiagnostics?: QuizStepDiagnostic[];
  isCorrect: boolean;
  ungraded?: boolean;
}

export interface ExamDraftState {
  quizId: string;
  quizTitle: string;
  subject: string;
  markingMode: ExamMarkingMode;
  currentIdx: number;
  flaggedIds: string[];
  selectedMcq: Record<string, number | null>;
  textAnswers: Record<string, string>;
  mathStepsByQuestion: Record<string, string[]>;
  subPartAnswersByQuestion: Record<string, Record<string, string>>;
  diagramAnswersByQuestion: Record<string, string>;
  perQuestionFeedback: Record<string, QuizAnswerRecord>;
  elapsedSec: number;
  updatedAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  assessmentType: 'quiz' | 'past-paper' | 'uploaded-exam' | 'custom';
  markingMode?: ExamMarkingMode;
  score: number;
  maxScore: number;
  percentage: number;
  durationSec: number;
  weakTopicsIdentified?: string[];
  mistakeNotes?: string[];
  improvementAdvice?: string;
  completedAt: number;
  answers: QuizAnswerRecord[];
}

export interface LanguageAssessmentResult {
  transcript: string;
  analysisMode: 'audio-gemini' | 'transcript-only';
  clarityScore: number;
  accuracyScore: number;
  overallNote: string;
  wordFeedback: Array<{
    target: string;
    heard: string;
    status: 'good' | 'practice' | 'missing';
    tip: string;
  }>;
  pronunciationTips: string[];
  suggestedRetryPhrase: string;
}

export interface SubjectPerformanceSummary {
  subject: string;
  attemptCount: number;
  currentAverage: number;
  previousAverage: number | null;
  latestScore: number;
  highestScore: number;
  trendDelta: number | null;
  trendDirection: 'improving' | 'declining' | 'stable' | 'insufficient';
  strongestTopics: Array<{ topic: string; accuracy: number; total: number }>;
  weakestTopics: Array<{ topic: string; accuracy: number; total: number }>;
  areasNeedingRevision: string[];
}

export interface PerformanceRecommendation {
  id: string;
  subject: string;
  topic?: string;
  tone: 'warning' | 'positive' | 'neutral';
  message: string;
  suggestedActionLabel: string;
  actionType: 'quiz' | 'notes';
}

export interface StudyReminder {
  id: string;
  subject: string;
  topic: string;
  title: string;
  reason: string;
  priority: 'high' | 'normal';
  dueLabel: string;
  completed?: boolean;
  dismissed?: boolean;
  isCustom?: boolean;
  createdAt: number;
}

export interface SubjectItem {
  id: string;
  name: string;
  category: 'core' | 'language';
  levels: Array<'Primary' | 'Secondary' | 'College' | 'University'>;
  flag?: string;
  examHotTopics: string[];
  readingAdvice: string[];
  accentColor: string;
}

export interface SharedPost {
  id: string;
  author: string;
  authorRole: string;
  subject: string;
  kind: 'Memory Trick' | 'Quick Note' | 'Exam Tip' | 'Sketch / Formula';
  title: string;
  body: string;
  imagePreview?: string;
  likes: number;
  likedByMe?: boolean;
  bookmarked?: boolean;
  createdAt: number;
}
