import { CORE_SUBJECTS, LANGUAGE_SUBJECTS, NOTE_STYLE_OPTIONS } from '../data/curriculum';
import type {
  Conversation,
  EducationProfile,
  NoteDetailLevel,
  NoteStyleId,
  SharedPost,
  SmartNote,
  SubjectItem,
} from '../types/alexyn';

export function getAllSubjects(
  category: 'all' | 'core' | 'language' = 'all'
): SubjectItem[] {
  if (category === 'core') return CORE_SUBJECTS;
  if (category === 'language') return LANGUAGE_SUBJECTS;
  return [...CORE_SUBJECTS, ...LANGUAGE_SUBJECTS];
}

export function getSubjectsForProfile(
  level: EducationProfile['educationLevel'] | 'All',
  category: 'all' | 'core' | 'language' = 'all'
): SubjectItem[] {
  const pool = getAllSubjects(category);

  if (!level || level === 'All') {
    return pool;
  }

  return pool.filter((item) => item.levels.includes(level));
}

export function computeSubjectProgress(
  subjectId: string,
  completedChecklist: Record<string, string[]>,
  totalItems: number
): number {
  if (totalItems <= 0) return 0;
  const done = completedChecklist[subjectId]?.length || 0;
  return Math.min(100, Math.round((done / totalItems) * 100));
}

export function extractTaughtTopics(conversations: Conversation[]): Array<{
  topic: string;
  excerpt: string;
  conversationId: string;
}> {
  const results: Array<{ topic: string; excerpt: string; conversationId: string }> = [];
  const seen = new Set<string>();

  for (const conv of conversations) {
    const assistantMsgs = conv.messages.filter((m) => m.role === 'assistant' && !m.error);
    if (assistantMsgs.length === 0) continue;

    const firstUser = conv.messages.find((m) => m.role === 'user');
    const topicLabel = (firstUser?.text || conv.title || 'Recent Study Topic')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 56);

    const key = topicLabel.toLowerCase();
    if (!topicLabel || seen.has(key)) continue;
    seen.add(key);

    const combinedExcerpt = assistantMsgs
      .slice(-2)
      .map((m) => m.text)
      .join('\n')
      .slice(0, 600);

    results.push({
      topic: topicLabel,
      excerpt: combinedExcerpt,
      conversationId: conv.id,
    });
  }

  return results;
}

export function findTaughtContextForTopic(
  topic: string,
  conversations: Conversation[]
): { matchedTopics: string[]; contextText: string } {
  const query = topic.trim().toLowerCase();
  if (!query) return { matchedTopics: [], contextText: '' };

  const keywords = query.split(/\s+/).filter((w) => w.length > 2);
  const matchedTopics: string[] = [];
  const snippets: string[] = [];

  for (const conv of conversations) {
    const fullText = conv.messages.map((m) => m.text).join(' ').toLowerCase();
    const isMatch =
      fullText.includes(query) ||
      keywords.some((kw) => fullText.includes(kw));

    if (isMatch) {
      matchedTopics.push(conv.title);
      const lastAssistant = [...conv.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && !m.error);
      if (lastAssistant) {
        snippets.push(`[From "${conv.title}"]: ${lastAssistant.text.slice(0, 500)}`);
      }
    }
  }

  return {
    matchedTopics: matchedTopics.slice(0, 3),
    contextText: snippets.slice(0, 3).join('\n\n'),
  };
}

export function toggleNoteStyle(
  current: NoteStyleId[],
  styleId: NoteStyleId
): NoteStyleId[] {
  if (current.includes(styleId)) {
    return current.filter((id) => id !== styleId);
  }
  return [...current, styleId];
}

export function getStyleLabels(styles: NoteStyleId[]): string[] {
  return styles
    .map((id) => NOTE_STYLE_OPTIONS.find((opt) => opt.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}

export function removeNoteSection(note: SmartNote, sectionId: string): SmartNote {
  return {
    ...note,
    sections: note.sections.filter((sec) => sec.id !== sectionId),
  };
}

export function validateCreateAccount(input: {
  name: string;
  email: string;
  age: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!input.name.trim()) return 'Please enter your name.';
  if (!input.email.trim() || !input.email.includes('@')) {
    return 'Please enter a valid email address.';
  }
  const ageNum = Number(input.age);
  if (!input.age.trim() || Number.isNaN(ageNum) || ageNum < 6 || ageNum > 110) {
    return 'Please enter a valid age.';
  }
  if (input.password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Your passwords do not match.';
  }
  return null;
}

export function validateEducationSetup(input: {
  country: string;
  curriculum: string;
  educationLevel: string;
  grade: string;
  subjects: string[];
}): string | null {
  if (!input.country) return 'Please choose your country.';
  if (!input.curriculum) return 'Please choose your curriculum.';
  if (!input.educationLevel) return 'Please choose your education level.';
  if (!input.grade.trim()) return 'Please enter your class, grade, or university year.';
  if (input.subjects.length === 0) return 'Please select at least one subject.';
  return null;
}

export function filterCommunityPosts(
  posts: SharedPost[],
  subjectFilter: string,
  searchQuery: string
): SharedPost[] {
  const q = searchQuery.trim().toLowerCase();
  return posts.filter((post) => {
    const matchesSubject =
      subjectFilter === 'All' ||
      post.subject.toLowerCase() === subjectFilter.toLowerCase();
    const matchesQuery =
      !q ||
      post.title.toLowerCase().includes(q) ||
      post.body.toLowerCase().includes(q) ||
      post.subject.toLowerCase().includes(q) ||
      post.author.toLowerCase().includes(q);
    return matchesSubject && matchesQuery;
  });
}

export function buildFallbackNote(params: {
  topic: string;
  subject: string;
  styles: NoteStyleId[];
  detailLevel: NoteDetailLevel;
  taughtContext?: string;
}): SmartNote {
  const cleanTopic = params.topic.trim() || 'Study Topic';
  const cleanSubject = params.subject.trim() || 'General Studies';
  const isDetailed = params.detailLevel === 'detailed';

  const sections = [
    {
      id: `sec-${Date.now()}-1`,
      heading: `Core Understanding: ${cleanTopic}`,
      kind: 'core',
      content: isDetailed
        ? `${cleanTopic} in ${cleanSubject} connects structure, cause-and-effect, and practical application. Break it into three mental pillars: (1) what triggers the process, (2) what transforms step-by-step, and (3) what outcome examiners expect you to explain clearly.${
            params.taughtContext
              ? `\n\nLinked from your earlier ALEXYN chat:\n${params.taughtContext.slice(0, 260)}`
              : ''
          }`
        : `Key idea: Understand why ${cleanTopic} happens before memorizing definitions in ${cleanSubject}.`,
    },
  ];

  if (params.styles.includes('real-world-analogy')) {
    sections.push({
      id: `sec-${Date.now()}-2`,
      heading: 'Real-World Analogy',
      kind: 'analogy',
      content: `Think of ${cleanTopic} like a well-organized delivery kitchen: raw inputs enter on one side, each station transforms one step, and the final product only leaves when every requirement is balanced.`,
    });
  }

  if (params.styles.includes('quick-summary')) {
    sections.push({
      id: `sec-${Date.now()}-3`,
      heading: '60-Second Revision Bullets',
      kind: 'summary',
      content: `• Identify the main definition of ${cleanTopic}.\n• Trace the 2–3 core stages in sequence.\n• Watch out for units, labels, or grammar agreement in exams.`,
    });
  }

  return {
    id: `note-${Date.now()}`,
    title: cleanTopic,
    subject: cleanSubject,
    overview: isDetailed
      ? `Comprehensive ${cleanSubject} study notes customized with ${getStyleLabels(params.styles).join(', ') || 'core clarity'}.`
      : `Quick review summary for ${cleanTopic} (${cleanSubject}).`,
    styles: params.styles,
    detailLevel: params.detailLevel,
    sections,
    memoryTricks: params.styles.includes('memory-tricks')
      ? [`Hook the 3 stages of ${cleanTopic} to "Start → Shift → Show": what starts it, what shifts inside, and what result shows.`]
      : [],
    funnyExamples: params.styles.includes('funny-examples')
      ? [`Imagine ${cleanTopic} failing dramatically on stage because someone skipped step 2—like baking bread without turning on the oven and wondering why it's still soup.`]
      : [],
    examTips: params.styles.includes('exam-focus')
      ? [`Examiners award marks for naming the mechanism in ${cleanTopic}, not just repeating the question wording.`]
      : [],
    readingAdvice: [`Review one worked example on ${cleanTopic} and summarize it in 3 lines without looking.`],
    flashcards: params.styles.includes('flashcards')
      ? [
          {
            id: `fc-${Date.now()}-1`,
            q: `What is the core purpose or mechanism of ${cleanTopic}?`,
            a: `Explain the input, key transformation step, and final outcome clearly in ${cleanSubject}.`,
          },
        ]
      : [],
    createdAt: Date.now(),
    savedToLibrary: true,
  };
}

export function getDefaultGradeForLevel(
  level: EducationProfile['educationLevel']
): string {
  switch (level) {
    case 'Primary':
      return 'Grade 4 / Standard 4';
    case 'Secondary':
      return 'Grade 10 / Form 4 / Year 10';
    case 'College':
      return 'Diploma Year 1';
    case 'University':
      return 'Year 1 (Freshman)';
    default:
      return 'Grade 10 / Form 4 / Year 10';
  }
}

const SUBJECT_KEYWORD_MAP: Array<{ subject: string; keywords: string[] }> = [
  {
    subject: 'Chemistry',
    keywords: ['chemistry', 'titration', 'stoichiometry', 'molarity', 'alkane', 'alkene', 'periodic table', 'valence bond', 'ionic bond', 'covalent bond', 'ph scale', 'chemical equation', 'mole concept'],
  },
  {
    subject: 'Biology',
    keywords: ['biology', 'photosynthesis', 'mitosis', 'meiosis', 'osmosis', 'chloroplast', 'mitochondria', 'ribosome', 'genetics', 'punnett', 'dna replication', 'enzyme', 'nephron'],
  },
  {
    subject: 'Physics',
    keywords: ['physics', 'newton law', 'ohm law', 'momentum', 'projectile', 'refraction', 'electromagnetic induction', 'capacitor', 'kinematics', 'kinetic energy', 'terminal velocity'],
  },
  {
    subject: 'Mathematics',
    keywords: ['mathematics', 'quadratic', 'calculus', 'differentiation', 'integration', 'logarithm', 'trigonometry', 'matrix', 'determinant', 'sohcahtoa', 'pythagoras'],
  },
  {
    subject: 'History',
    keywords: ['history', 'world war', 'colonialism', 'independence movement', 'industrial revolution', 'scramble for africa'],
  },
  {
    subject: 'Geography',
    keywords: ['geography', 'plate tectonics', 'contour lines', 'grid reference', 'oxbow lake', 'weathering', 'monsoon'],
  },
  {
    subject: 'French',
    keywords: ['french', 'passé composé', 'passe compose', 'imparfait', 'bonjour', 'subjonctif'],
  },
  {
    subject: 'Japanese',
    keywords: ['japanese', 'hiragana', 'katakana', 'kanji', 'romaji'],
  },
  {
    subject: 'Spanish',
    keywords: ['spanish', 'ser vs estar', 'preterite', 'hola'],
  },
  {
    subject: 'Chinese',
    keywords: ['chinese', 'mandarin', 'pinyin', 'hanzi'],
  },
  {
    subject: 'Kiswahili',
    keywords: ['kiswahili', 'swahili', 'ngeli', 'insha', 'methali', 'tashbihi', 'sitiari'],
  },
  {
    subject: 'ICT & Computer Science',
    keywords: ['binary conversion', 'logic gate', 'flowchart', 'algorithm', 'sql database', 'python code', 'javascript', 'html'],
  },
];

export function detectDifferentSubjectWarning(
  input: string,
  scopedSubjectName?: string
): { recommendedSubject: string; message: string } | null {
  if (!scopedSubjectName) return null;
  const q = input.trim().toLowerCase();
  if (!q) return null;

  const currentLower = scopedSubjectName.toLowerCase();
  for (const entry of SUBJECT_KEYWORD_MAP) {
    if (currentLower.includes(entry.subject.toLowerCase()) || entry.subject.toLowerCase().includes(currentLower)) {
      continue;
    }
    const matched = entry.keywords.some((kw) => q.includes(kw));
    if (matched) {
      return {
        recommendedSubject: entry.subject,
        message: `You are currently inside the ${scopedSubjectName} workspace, so your ${scopedSubjectName} tutor focuses strictly on ${scopedSubjectName}. For "${input.trim()}", switch to ${entry.subject} for dedicated help.`,
      };
    }
  }
  return null;
}
