export type ScreenId =
  | 'welcome'
  | 'explore'
  | 'subjects'
  | 'notes'
  | 'lab'
  | 'share'
  | 'setup';

export type AccountMode = 'guest' | 'signed-in';

export type SubjectWindowView = 'overview' | 'explore' | 'notes' | 'lab';

export interface AppSettings {
  voiceLanguage: string;
  defaultNoteDepth: NoteDetailLevel;
  autoScrollKeyboard: boolean;
  pocketCodeServerUrl: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  images?: AttachmentImage[];
  pluginsUsed?: string[];
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

export interface SmartNote {
  id: string;
  title: string;
  subject: string;
  overview: string;
  styles: NoteStyleId[];
  detailLevel: NoteDetailLevel;
  sections: SmartNoteSection[];
  memoryTricks: string[];
  funnyExamples: string[];
  examTips: string[];
  readingAdvice: string[];
  flashcards: SmartNoteFlashcard[];
  createdAt: number;
  fromTaughtTopics?: string[];
  savedToLibrary: boolean;
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
