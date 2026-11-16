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

export interface AppSettings {
  voiceLanguage: string;
  defaultNoteDepth: NoteDetailLevel;
  autoScrollKeyboard: boolean;
  pocketCodeServerUrl: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  images?: AttachmentImage[];
  pluginsUsed?: string[];
  recommendedLab?: LabRecommendation;
  sources?: GroundingSource[];
  error?: boolean;
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

export interface SmartNoteVisual {
  id: string;
  title: string;
  caption: string;
  kind: 'diagram' | 'chart' | 'labeled-illustration' | 'cycle' | 'comparison';
  svgMarkup: string;
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

export interface QuizQuestion {
  id: string;
  prompt: string;
  topic: string;
  options: string[];
  correctIndex: number | null;
  hasOfficialAnswerKey?: boolean;
  explanation: string;
  origin: QuizQuestionOrigin;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface QuizDefinition {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  timeLimitMinutes: number | null;
  origin: QuizQuestionOrigin;
  sourceNotice?: string;
  sources?: GroundingSource[];
  questions: QuizQuestion[];
  createdAt: number;
  updatedAt?: number;
}

export interface QuizAnswerRecord {
  questionId: string;
  topic: string;
  selectedIndex: number | null;
  correctIndex: number | null;
  isCorrect: boolean;
  ungraded?: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  assessmentType: 'quiz' | 'past-paper' | 'uploaded-exam' | 'custom';
  score: number;
  maxScore: number;
  percentage: number;
  durationSec: number;
  completedAt: number;
  answers: QuizAnswerRecord[];
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
