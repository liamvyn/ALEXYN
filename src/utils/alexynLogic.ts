import { CORE_SUBJECTS, LANGUAGE_SUBJECTS, NOTE_STYLE_OPTIONS } from '../data/curriculum';
import type {
  AITutorSettings,
  Conversation,
  EducationProfile,
  LabRecommendation,
  NoteDetailLevel,
  NoteStyleId,
  PerformanceRecommendation,
  QuizAnswerRecord,
  QuizAttempt,
  QuizDefinition,
  ReminderPreferences,
  SharedPost,
  SmartNote,
  StudyReminder,
  SubjectItem,
  SubjectPerformanceSummary,
} from '../types/alexyn';

export const DEFAULT_AI_TUTOR_SETTINGS: AITutorSettings = {
  explanationDepth: 'balanced',
  responseLength: 'medium',
  teachingApproach: 'intuitive',
  useRelatableExamples: true,
  useHumorousExamples: true,
  askFollowUpQuestions: true,
  educationalLevel: 'auto',
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: true,
  frequency: 'daily',
  preferredTime: '18:00',
  browserNotifications: false,
};

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
        ? `### What You Need To Know\n__${cleanTopic}__ in **${cleanSubject}** connects key structure, cause-and-effect, and practical problem-solving.\n\n- **Trigger / Input**: Identify what starts **${cleanTopic}**.\n- **Core Process**: __Trace each transformation step in logical sequence__.\n- **Exam Outcome**: State the exact result and units clearly.\n\nExample: Walk through a concrete ${cleanSubject} case of ${cleanTopic} and verify every condition before writing your final conclusion.${
            params.taughtContext
              ? `\n\n### From Your Explore Session\n${params.taughtContext.slice(0, 260)}`
              : ''
          }`
        : `**Key Idea**: Understand why __${cleanTopic}__ happens step by step before memorizing terms in **${cleanSubject}**.`,
    },
  ];

  if (params.styles.includes('real-world-analogy')) {
    sections.push({
      id: `sec-${Date.now()}-2`,
      heading: 'Real-World Analogy',
      kind: 'analogy',
      content: `Think of __${cleanTopic}__ like a well-organized relay team: **inputs** enter at station 1, each station transforms one step, and the final product only completes when every rule balances.`,
    });
  }

  if (params.styles.includes('quick-summary')) {
    sections.push({
      id: `sec-${Date.now()}-3`,
      heading: '60-Second Revision Bullets',
      kind: 'summary',
      content: `- Define __${cleanTopic}__ accurately in one crisp sentence.\n- Trace the **2–3 core stages** in order.\n- Double-check **units, labels, or grammar agreement** for full exam marks.`,
    });
  }

  const safeLabel = cleanTopic.replace(/[<>&"']/g, '').slice(0, 32);
  const conceptVisual = {
    id: `vis-${Date.now()}`,
    title: `${cleanTopic} · Concept Flow`,
    caption: `Key stages linking foundation, mechanism, and exam outcome for ${cleanTopic}.`,
    kind: 'diagram' as const,
    svgMarkup: `<svg viewBox='0 0 600 220' xmlns='http://www.w3.org/2000/svg'><rect width='600' height='220' rx='16' fill='#060E24'/><rect x='28' y='64' width='156' height='84' rx='14' fill='#0E1F4F' stroke='#38BDF8' stroke-width='2'/><text x='106' y='98' text-anchor='middle' fill='#7DD3FC' font-family='sans-serif' font-size='12' font-weight='bold'>1. Foundation</text><text x='106' y='122' text-anchor='middle' fill='#F8FAFC' font-family='sans-serif' font-size='11'>${safeLabel}</text><line x1='188' y1='106' x2='220' y2='106' stroke='#5EEAD4' stroke-width='2.5'/><rect x='224' y='64' width='156' height='84' rx='14' fill='#0E1F4F' stroke='#5EEAD4' stroke-width='2'/><text x='302' y='98' text-anchor='middle' fill='#5EEAD4' font-family='sans-serif' font-size='12' font-weight='bold'>2. Key Mechanism</text><text x='302' y='122' text-anchor='middle' fill='#F8FAFC' font-family='sans-serif' font-size='11'>How &amp; Why It Works</text><line x1='384' y1='106' x2='416' y2='106' stroke='#818CF8' stroke-width='2.5'/><rect x='420' y='64' width='152' height='84' rx='14' fill='#0E1F4F' stroke='#818CF8' stroke-width='2'/><text x='496' y='98' text-anchor='middle' fill='#A5B4FC' font-family='sans-serif' font-size='12' font-weight='bold'>3. Application</text><text x='496' y='122' text-anchor='middle' fill='#F8FAFC' font-family='sans-serif' font-size='11'>Examples &amp; Exams</text></svg>`,
  };

  return {
    id: `note-${Date.now()}`,
    title: cleanTopic,
    subject: cleanSubject,
    overview: isDetailed
      ? `Comprehensive __${cleanSubject}__ study notes for **${cleanTopic}** customized with ${getStyleLabels(params.styles).join(', ') || 'core clarity'}.`
      : `Quick review summary for **${cleanTopic}** (${cleanSubject}).`,
    styles: params.styles,
    detailLevel: params.detailLevel,
    sections,
    memoryTricks: params.styles.includes('memory-tricks')
      ? [`Hook the 3 stages of **${cleanTopic}** to __Start → Shift → Show__: what starts it, what shifts inside, and what result shows.`]
      : [],
    funnyExamples: params.styles.includes('funny-examples')
      ? [`Imagine **${cleanTopic}** failing dramatically on stage because someone skipped step 2—like baking bread without turning on the oven.`]
      : [],
    examTips: params.styles.includes('exam-focus')
      ? [`Examiners award marks for naming the __mechanism__ in **${cleanTopic}**, not just repeating the question wording.`]
      : [],
    readingAdvice: [`Review one worked example on **${cleanTopic}** and summarize it in 3 lines without looking.`],
    flashcards: params.styles.includes('flashcards')
      ? [
          {
            id: `fc-${Date.now()}-1`,
            q: `What is the core purpose or mechanism of ${cleanTopic}?`,
            a: `Explain the input, key transformation step, and final outcome clearly in ${cleanSubject}.`,
          },
        ]
      : [],
    visuals: [conceptVisual],
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

export function detectRecommendedLab(
  text: string,
  subjectFocus?: string
): LabRecommendation | null {
  const combined = `${subjectFocus || ''} ${text}`.toLowerCase();
  const q = text.toLowerCase();
  const hasForeignScript =
    /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0900-\u097F\u0400-\u04FF]/.test(
      text
    );
  const explicitStemFormula =
    /\b(wavelength|amplitude|transverse|longitudinal|sound waves?|speed of sound|ultrasound|doppler|ohm|circuit|voltage|quadratic|parabola|photosynthesis|mitochondria|dna|helix|covalent|ionic|bohr|newton|kinematics|trigonometry|pythagoras|sohcahtoa)\b/.test(
      q
    );

  // Language Practice Studio (check early when language context is explicit and not overridden by STEM formulas)
  if (
    !explicitStemFormula &&
    (isLanguageSubject(subjectFocus) ||
      hasForeignScript ||
      /\b(kanji|hiragana|katakana|french|spanish|japanese|chinese|mandarin|german|arabic|korean|portuguese|italian|hindi|kiswahili|swahili|pronunciation|polite ending)\b/.test(
        combined
      ))
  ) {
    return {
      subject: 'Languages',
      modelId: 'lang-practice',
      label: 'Open Language Practice in Practice Area',
      reason: 'Practise listening, speaking, reading, vocabulary & sentence building.',
    };
  }

  // Mathematics Practice
  if (
    /\b(graph|coordinate|slope|parabola|quadratic|function|y\s*=|plot|axis|cartesian)\b/.test(q) ||
    (subjectFocus?.toLowerCase().includes('math') && /\b(graph|curve|line)\b/.test(q))
  ) {
    return {
      subject: 'Mathematics',
      modelId: 'math-graph',
      label: 'Open Coordinate Graph in Practice Area',
      reason: 'Plot functions, inspect intercepts & gradients interactively.',
    };
  }

  if (
    /\b(geometry|triangle|angle|polygon|octahedron|cube|pyramid|sphere|area|perimeter|volume|pythagoras|trigonometry|sohcahtoa|shape)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('math')
  ) {
    return {
      subject: 'Mathematics',
      modelId: 'math-shapes',
      label: 'Open Geometry in Practice Area',
      reason: 'Manipulate 2D/3D shapes, measure angles, area & volume live.',
    };
  }

  // Biology Practice
  if (/\b(dna|helix|nucleotide|base pair|replication|gene|chromosome)\b/.test(q)) {
    return {
      subject: 'Biology',
      modelId: 'bio-dna',
      label: 'Open DNA Helix in Practice Area',
      reason: 'Rotate base pairs, inspect A-T & C-G bonding, and unzip DNA.',
    };
  }

  if (/\b(heart|circulat|lung|respirat|nervous|human body|organ system|blood flow)\b/.test(q)) {
    return {
      subject: 'Biology',
      modelId: 'bio-body',
      label: 'Open Body Systems in Practice Area',
      reason: 'Explore interactive circulatory & respiratory systems.',
    };
  }

  if (
    /\b(cell|organelle|chloroplast|mitochondria|nucleus|vacuole|osmosis|photosynthesis|plant cell|animal cell)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('biology')
  ) {
    return {
      subject: 'Biology',
      modelId: 'bio-cell',
      label: 'Open Cell Explorer in Practice Area',
      reason: 'Click and inspect organelles inside a living cell simulation.',
    };
  }

  // Chemistry Practice
  if (/\b(water|h2o|polar|hydrogen bond|molecule|covalent|ionic|bonding|methane|co2|molecular)\b/.test(q)) {
    return {
      subject: 'Chemistry',
      modelId: 'chem-water',
      label: 'Open Molecular Bonding in Practice Area',
      reason: 'Examine bond angles, polarity & covalent/ionic sharing.',
    };
  }

  if (/\b(reaction|neutralization|acid|base|combustion|catalyst|activation energy|equilibrium)\b/.test(q)) {
    return {
      subject: 'Chemistry',
      modelId: 'chem-reaction',
      label: 'Open Chemical Reactions in Practice Area',
      reason: 'Simulate reactant collisions and balanced product formation.',
    };
  }

  if (
    /\b(atom|bohr|electron|proton|neutron|valence|periodic|shell|orbital)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('chemistry')
  ) {
    return {
      subject: 'Chemistry',
      modelId: 'chem-atom',
      label: 'Open Bohr Atom in Practice Area',
      reason: 'Adjust atomic number and inspect electron shell configurations.',
    };
  }

  // Physics Practice
  if (/\b(circuit|ohm|voltage|current|resistance|resistor|series|parallel|electricity|ampere)\b/.test(q)) {
    return {
      subject: 'Physics',
      modelId: 'phys-circuit',
      label: 'Open Circuits Simulator in Practice Area',
      reason: 'Adjust voltage & resistance to test Ohm’s Law live.',
    };
  }

  if (
    /\b(wave|frequency|wavelength|amplitude|transverse|longitudinal|optics|refraction|sound waves?|speed of sound|ultrasound|doppler)\b/.test(
      q
    )
  ) {
    return {
      subject: 'Physics',
      modelId: 'phys-wave',
      label: 'Open Wave Simulator in Practice Area',
      reason: 'Adjust frequency & amplitude and see v = f·λ live.',
    };
  }

  if (/\b(planet|orbit|kepler|gravity|solar system|satellite)\b/.test(q)) {
    return {
      subject: 'Physics',
      modelId: 'phys-solar',
      label: 'Open Planetary Orbits in Practice Area',
      reason: 'Explore Kepler’s laws and orbital speed.',
    };
  }

  if (
    /\b(force|motion|newton|acceleration|friction|incline|gravity|velocity|momentum|kinematics)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('physics')
  ) {
    return {
      subject: 'Physics',
      modelId: 'phys-forces',
      label: 'Open Forces & Motion in Practice Area',
      reason: 'Experiment with ramp angle, mass & net force vectors.',
    };
  }

  if (
    /\b(binary|logic gate|truth table|boolean|algorithm|flowchart|programming|coding|bit|byte|python|javascript|sql)\b/.test(
      q
    ) ||
    subjectFocus?.toLowerCase().includes('ict') ||
    subjectFocus?.toLowerCase().includes('computer')
  ) {
    return {
      subject: 'ICT & Computer Science',
      modelId: 'ict-logic',
      label: 'Open Logic & Binary in Practice Area',
      reason: 'Toggle binary bits and test AND/OR/XOR logic gates interactively.',
    };
  }

  if (
    /\b(supply|demand|equilibrium|elasticity|break-even|profit|revenue|market|inflation)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('economics') ||
    subjectFocus?.toLowerCase().includes('business')
  ) {
    return {
      subject: 'Economics',
      modelId: 'econ-supply',
      label: 'Open Supply & Demand in Practice Area',
      reason: 'Shift demand & supply curves and inspect equilibrium prices live.',
    };
  }

  if (
    /\b(tectonic|earthquake|volcano|contour|grid reference|latitude|longitude|climate|earth)\b/.test(
      q
    ) ||
    subjectFocus?.toLowerCase().includes('geography')
  ) {
    return {
      subject: 'Geography',
      modelId: 'geo-globe',
      label: 'Open Earth & Grids in Practice Area',
      reason: 'Rotate the Earth globe and practise 6-figure grid references.',
    };
  }

  if (
    /\b(history|literature|poetry|metaphor|essay|peel|constitutional|source analysis|csl)\b/.test(q) ||
    subjectFocus?.toLowerCase().includes('history') ||
    subjectFocus?.toLowerCase().includes('literature') ||
    subjectFocus?.toLowerCase().includes('religious') ||
    subjectFocus?.toLowerCase().includes('csl')
  ) {
    return {
      subject: subjectFocus || 'Humanities',
      modelId: 'humanities-practice',
      label: 'Open Concept & Source Practice Area',
      reason: 'Practise evidence-based arguments, source interpretation & comprehension.',
    };
  }

  if (
    /\b(kanji|hiragana|katakana|french|spanish|japanese|chinese|german|arabic|korean|portuguese|italian|hindi|kiswahili|pronunciation|tone)\b/.test(
      combined
    )
  ) {
    return {
      subject: 'Languages',
      modelId: 'lang-practice',
      label: 'Open Language Practice in Practice Area',
      reason: 'Build sentences, practise listening/speaking & reading.',
    };
  }

  return null;
}

export function shouldRecommendPracticeLab(userMessage: string): boolean {
  const q = userMessage.trim().toLowerCase();
  if (!q) return false;
  return (
    /\b(practice area|practice lab|interactive lab|3d lab|3d model|simulation|simulator|open (the )?(lab|graph|practice|calculator|workspace)|launch (the )?(lab|practice)|plot (a |the )?(graph|equation|curve)|draw (the )?(graph|curve)|pronunciation (studio|practice)|speaking practice|practise speaking|quiz me interactively)\b/.test(
      q
    ) ||
    /\b(practise|practice)\s+(this|math|algebra|equations?|geometry|fractions?|english|french|spanish|japanese|kiswahili|biology|chemistry|physics|circuits?|waves?|cells?|atoms?)\b/.test(
      q
    )
  );
}

export type MathShapeKind = 'triangle' | 'rectangle' | 'circle' | 'cube' | 'pyramid' | 'octahedron';

export function computeGeometryMetrics(
  shape: MathShapeKind,
  size: number,
  angleDeg = 60
): {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  anglesSummary: string;
} {
  const s = Math.max(1, size);
  switch (shape) {
    case 'triangle': {
      const base = s;
      const rad = (Math.max(15, Math.min(140, angleDeg)) * Math.PI) / 180;
      const height = (base * 0.5) * Math.tan(rad);
      const side = Math.hypot(base * 0.5, height);
      const area = 0.5 * base * height;
      const perimeter = base + 2 * side;
      const topAngle = Math.max(1, 180 - 2 * angleDeg);
      return {
        primaryLabel: 'Area (½bh)',
        primaryValue: `${area.toFixed(2)} u²`,
        secondaryLabel: 'Perimeter',
        secondaryValue: `${perimeter.toFixed(2)} u`,
        anglesSummary: `Base angles: ${angleDeg.toFixed(0)}°, ${angleDeg.toFixed(0)}° · Apex: ${topAngle.toFixed(0)}° (Sum = 180°)`,
      };
    }
    case 'rectangle': {
      const width = s;
      const height = s * (0.5 + (angleDeg / 180));
      return {
        primaryLabel: 'Area (w×h)',
        primaryValue: `${(width * height).toFixed(2)} u²`,
        secondaryLabel: 'Perimeter',
        secondaryValue: `${(2 * (width + height)).toFixed(2)} u`,
        anglesSummary: '4 interior right angles: 90° × 4 = 360°',
      };
    }
    case 'circle': {
      const r = s / 2;
      return {
        primaryLabel: 'Area (πr²)',
        primaryValue: `${(Math.PI * r * r).toFixed(2)} u²`,
        secondaryLabel: 'Circumference (2πr)',
        secondaryValue: `${(2 * Math.PI * r).toFixed(2)} u`,
        anglesSummary: `Full rotation = 360° (2π rad) · Radius = ${r.toFixed(2)} u`,
      };
    }
    case 'cube': {
      return {
        primaryLabel: 'Volume (s³)',
        primaryValue: `${(s ** 3).toFixed(2)} u³`,
        secondaryLabel: 'Surface Area (6s²)',
        secondaryValue: `${(6 * s * s).toFixed(2)} u²`,
        anglesSummary: 'V = 8, E = 12, F = 6 · V − E + F = 2',
      };
    }
    case 'pyramid': {
      const h = s * (0.6 + angleDeg / 180);
      const vol = (s * s * h) / 3;
      const slant = Math.hypot(s / 2, h);
      const sa = s * s + 2 * s * slant;
      return {
        primaryLabel: 'Volume (⅓b²h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 5, E = 8, F = 5 · V − E + F = 2',
      };
    }
    case 'octahedron':
    default: {
      const vol = (Math.SQRT2 / 3) * s ** 3;
      const sa = 2 * Math.sqrt(3) * s * s;
      return {
        primaryLabel: 'Volume',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 6, E = 12, F = 8 · V − E + F = 2 (60° faces)',
      };
    }
  }
}

const ELEMENTS_1_TO_18: Array<{ symbol: string; name: string; group: string }> = [
  { symbol: 'H', name: 'Hydrogen', group: 'Reactive Nonmetal' },
  { symbol: 'He', name: 'Helium', group: 'Noble Gas' },
  { symbol: 'Li', name: 'Lithium', group: 'Alkali Metal' },
  { symbol: 'Be', name: 'Beryllium', group: 'Alkaline Earth' },
  { symbol: 'B', name: 'Boron', group: 'Metalloid' },
  { symbol: 'C', name: 'Carbon', group: 'Nonmetal (4 valence e⁻)' },
  { symbol: 'N', name: 'Nitrogen', group: 'Nonmetal' },
  { symbol: 'O', name: 'Oxygen', group: 'Nonmetal' },
  { symbol: 'F', name: 'Fluorine', group: 'Halogen' },
  { symbol: 'Ne', name: 'Neon', group: 'Noble Gas' },
  { symbol: 'Na', name: 'Sodium', group: 'Alkali Metal' },
  { symbol: 'Mg', name: 'Magnesium', group: 'Alkaline Earth' },
  { symbol: 'Al', name: 'Aluminium', group: 'Post-Transition Metal' },
  { symbol: 'Si', name: 'Silicon', group: 'Metalloid' },
  { symbol: 'P', name: 'Phosphorus', group: 'Nonmetal' },
  { symbol: 'S', name: 'Sulfur', group: 'Nonmetal' },
  { symbol: 'Cl', name: 'Chlorine', group: 'Halogen' },
  { symbol: 'Ar', name: 'Argon', group: 'Noble Gas' },
];

export function getAtomElementInfo(atomicNumber: number): {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: string;
  shells: number[];
  valence: number;
} {
  const clamped = Math.max(1, Math.min(18, Math.round(atomicNumber)));
  const el = ELEMENTS_1_TO_18[clamped - 1];
  const s1 = Math.min(2, clamped);
  const s2 = Math.min(8, Math.max(0, clamped - 2));
  const s3 = Math.max(0, clamped - 10);
  const shells = [s1, ...(s2 > 0 ? [s2] : []), ...(s3 > 0 ? [s3] : [])];
  return {
    atomicNumber: clamped,
    symbol: el.symbol,
    name: el.name,
    group: el.group,
    shells,
    valence: shells[shells.length - 1],
  };
}

export function computeCircuitMetrics(
  voltage: number,
  r1: number,
  r2: number,
  mode: 'series' | 'parallel',
  switchClosed: boolean
): {
  totalResistance: number;
  currentAmps: number;
  powerWatts: number;
} {
  const safeR1 = Math.max(1, r1);
  const safeR2 = Math.max(1, r2);
  const totalResistance =
    mode === 'series' ? safeR1 + safeR2 : (safeR1 * safeR2) / (safeR1 + safeR2);

  if (!switchClosed || voltage <= 0) {
    return {
      totalResistance: Number(totalResistance.toFixed(2)),
      currentAmps: 0,
      powerWatts: 0,
    };
  }

  const currentAmps = voltage / totalResistance;
  const powerWatts = voltage * currentAmps;
  return {
    totalResistance: Number(totalResistance.toFixed(2)),
    currentAmps: Number(currentAmps.toFixed(2)),
    powerWatts: Number(powerWatts.toFixed(2)),
  };
}

export function computeForceMotion(
  massKg: number,
  angleDeg: number,
  appliedForceN: number,
  frictionCoeff: number
): {
  gravityDownRamp: number;
  frictionForce: number;
  netForce: number;
  acceleration: number;
} {
  const g = 9.81;
  const m = Math.max(0.5, massKg);
  const rad = (Math.max(0, Math.min(60, angleDeg)) * Math.PI) / 180;
  const gravityDownRamp = m * g * Math.sin(rad);
  const normalForce = m * g * Math.cos(rad);
  const frictionForce = Math.max(0, frictionCoeff) * normalForce;
  const drive = appliedForceN - gravityDownRamp;
  const netForce =
    Math.abs(drive) <= frictionForce
      ? 0
      : drive > 0
      ? drive - frictionForce
      : drive + frictionForce;
  const acceleration = netForce / m;

  return {
    gravityDownRamp: Number(gravityDownRamp.toFixed(2)),
    frictionForce: Number(frictionForce.toFixed(2)),
    netForce: Number(netForce.toFixed(2)),
    acceleration: Number(acceleration.toFixed(2)),
  };
}

const LANGUAGE_SPEECH_CODES: Array<{ match: string; lang: string }> = [
  { match: 'french', lang: 'fr-FR' },
  { match: 'spanish', lang: 'es-ES' },
  { match: 'japanese', lang: 'ja-JP' },
  { match: 'chinese', lang: 'zh-CN' },
  { match: 'mandarin', lang: 'zh-CN' },
  { match: 'german', lang: 'de-DE' },
  { match: 'arabic', lang: 'ar-SA' },
  { match: 'korean', lang: 'ko-KR' },
  { match: 'portuguese', lang: 'pt-BR' },
  { match: 'italian', lang: 'it-IT' },
  { match: 'hindi', lang: 'hi-IN' },
  { match: 'kiswahili', lang: 'sw-KE' },
  { match: 'swahili', lang: 'sw-KE' },
  { match: 'english', lang: 'en-GB' },
];

export function isLanguageSubject(subjectName?: string): boolean {
  if (!subjectName) return false;
  const low = subjectName.toLowerCase();
  if (LANGUAGE_SUBJECTS.some((l) => low.includes(l.name.toLowerCase()))) return true;
  return low.includes('kiswahili') || low.includes('swahili') || low.includes('english');
}

export function getSpeechLangForSubject(subjectName?: string, fallback = 'en-US'): string {
  if (!subjectName) return fallback;
  const low = subjectName.toLowerCase();
  const hit = LANGUAGE_SPEECH_CODES.find((entry) => low.includes(entry.match));
  return hit ? hit.lang : fallback;
}

export function stripMarkdownForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' code snippet ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/•/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeSvgMarkup(rawSvg: string): string {
  const trimmed = rawSvg.trim();
  const match = trimmed.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return '';
  return match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export function parseGitHubUrl(rawUrl: string): {
  owner: string;
  repo: string;
  branch?: string;
  filePath?: string;
  isFileUrl: boolean;
} | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Allow shorthand owner/repo
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    return {
      owner: shorthand[1],
      repo: shorthand[2].replace(/\.git$/, ''),
      isFileUrl: false,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'raw.githubusercontent.com' && segments.length >= 4) {
    return {
      owner: segments[0],
      repo: segments[1],
      branch: segments[2],
      filePath: segments.slice(3).join('/'),
      isFileUrl: true,
    };
  }

  if ((host === 'github.com' || host === 'www.github.com') && segments.length >= 2) {
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, '');
    if ((segments[2] === 'blob' || segments[2] === 'tree') && segments.length >= 4) {
      const branch = segments[3];
      const filePath = segments.slice(4).join('/');
      return {
        owner,
        repo,
        branch,
        filePath: filePath || undefined,
        isFileUrl: segments[2] === 'blob' && Boolean(filePath),
      };
    }
    return { owner, repo, isFileUrl: false };
  }

  return null;
}

export function calculateQuizScore(
  quiz: QuizDefinition,
  selectedAnswers: Record<string, number | null>
): {
  score: number;
  maxScore: number;
  percentage: number;
  gradedAnswers: QuizAnswerRecord[];
} {
  let score = 0;
  let gradableCount = 0;

  const gradedAnswers: QuizAnswerRecord[] = quiz.questions.map((q) => {
    const selected = selectedAnswers[q.id] ?? null;
    if (q.correctIndex === null || q.correctIndex === undefined) {
      return {
        questionId: q.id,
        topic: q.topic || quiz.topic || quiz.subject,
        selectedIndex: selected,
        correctIndex: null,
        isCorrect: false,
        ungraded: true,
      };
    }
    gradableCount += 1;
    const isCorrect = selected !== null && selected === q.correctIndex;
    if (isCorrect) score += 1;
    return {
      questionId: q.id,
      topic: q.topic || quiz.topic || quiz.subject,
      selectedIndex: selected,
      correctIndex: q.correctIndex,
      isCorrect,
    };
  });

  const maxScore = gradableCount;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return { score, maxScore, percentage, gradedAnswers };
}

export function analyzePerformance(attempts: QuizAttempt[]): {
  overallAverage: number;
  totalAttempts: number;
  overallTrendDelta: number | null;
  subjectSummaries: SubjectPerformanceSummary[];
  recommendations: PerformanceRecommendation[];
} {
  const validAttempts = [...attempts]
    .filter((a) => a.maxScore > 0)
    .sort((a, b) => a.completedAt - b.completedAt);

  if (validAttempts.length === 0) {
    return {
      overallAverage: 0,
      totalAttempts: 0,
      overallTrendDelta: null,
      subjectSummaries: [],
      recommendations: [],
    };
  }

  const overallAverage = Math.round(
    validAttempts.reduce((sum, a) => sum + a.percentage, 0) / validAttempts.length
  );

  const overallTrendDelta =
    validAttempts.length >= 2
      ? validAttempts[validAttempts.length - 1].percentage -
        validAttempts[validAttempts.length - 2].percentage
      : null;

  const bySubject = new Map<string, QuizAttempt[]>();
  for (const attempt of validAttempts) {
    const key = attempt.subject || 'General';
    const list = bySubject.get(key) || [];
    list.push(attempt);
    bySubject.set(key, list);
  }

  const subjectSummaries: SubjectPerformanceSummary[] = [];
  const recommendations: PerformanceRecommendation[] = [];

  for (const [subject, list] of bySubject.entries()) {
    const currentAverage = Math.round(
      list.reduce((sum, a) => sum + a.percentage, 0) / list.length
    );
    const latest = list[list.length - 1];
    const highestScore = Math.max(...list.map((a) => a.percentage));

    const previousList = list.slice(0, -1);
    const previousAverage =
      previousList.length > 0
        ? Math.round(
            previousList.reduce((sum, a) => sum + a.percentage, 0) / previousList.length
          )
        : null;

    const stepDelta =
      list.length >= 2 ? latest.percentage - list[list.length - 2].percentage : null;

    let trendDirection: SubjectPerformanceSummary['trendDirection'] = 'insufficient';
    if (list.length >= 2 && stepDelta !== null) {
      if (stepDelta >= 3) trendDirection = 'improving';
      else if (stepDelta <= -3) trendDirection = 'declining';
      else trendDirection = 'stable';
    }

    // Topic breakdown (supports MCQ + partial-credit multi-format questions)
    const topicStats = new Map<string, { earned: number; possible: number }>();
    for (const attempt of list) {
      for (const ans of attempt.answers) {
        if (ans.ungraded) continue;
        const tName = (ans.topic || attempt.topic || subject).trim();
        const curr = topicStats.get(tName) || { earned: 0, possible: 0 };
        const maxM = typeof ans.maxMarks === 'number' && ans.maxMarks > 0 ? ans.maxMarks : 1;
        const earnedM =
          typeof ans.marksAwarded === 'number' ? ans.marksAwarded : ans.isCorrect ? maxM : 0;
        curr.possible += maxM;
        curr.earned += Math.max(0, Math.min(maxM, earnedM));
        topicStats.set(tName, curr);
      }
    }

    const topicList = Array.from(topicStats.entries()).map(([topic, stat]) => ({
      topic,
      accuracy: stat.possible > 0 ? Math.round((stat.earned / stat.possible) * 100) : 0,
      total: Math.round(stat.possible),
    }));

    const strongestTopics = [...topicList]
      .filter((t) => t.accuracy >= 70)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);

    const weakestTopics = [...topicList]
      .filter((t) => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);

    const areasNeedingRevision = weakestTopics.map(
      (t) => `${t.topic} (${t.accuracy}% accuracy)`
    );

    subjectSummaries.push({
      subject,
      attemptCount: list.length,
      currentAverage,
      previousAverage,
      latestScore: latest.percentage,
      highestScore,
      trendDelta: stepDelta,
      trendDirection,
      strongestTopics,
      weakestTopics,
      areasNeedingRevision,
    });

    const weakTopicName = weakestTopics[0]?.topic || latest.topic;
    if (list.length === 1) {
      recommendations.push({
        id: `rec-${subject}-baseline`,
        subject,
        topic: weakTopicName,
        tone: 'neutral',
        message: `You have 1 recorded quiz in ${subject} (${latest.percentage}%). Complete at least 1 more short quiz before ALEXYN draws strong trend conclusions${
          weakestTopics[0] ? `, though reviewing ${weakestTopics[0].topic} (${weakestTopics[0].accuracy}%) is a helpful next step` : ''
        }.`,
        suggestedActionLabel: `Take Follow-up ${subject} Quiz`,
        actionType: 'quiz',
      });
    } else if (stepDelta !== null && stepDelta <= -5) {
      const prevPct = list[list.length - 2].percentage;
      recommendations.push({
        id: `rec-${subject}-drop`,
        subject,
        topic: weakTopicName,
        tone: 'warning',
        message: `Your ${subject} performance dropped from ${prevPct}% to ${latest.percentage}% (${stepDelta} percentage points). ${
          weakestTopics[0]
            ? `You lost the most marks in ${weakestTopics[0].topic} (${weakestTopics[0].accuracy}%). Revise ${weakestTopics[0].topic} notes and try a short follow-up quiz.`
            : `Revise ${latest.topic} and try another short practice quiz.`
        }`,
        suggestedActionLabel: `Revise ${weakTopicName}`,
        actionType: 'notes',
      });
    } else if (stepDelta !== null && stepDelta >= 5) {
      const prevPct = list[list.length - 2].percentage;
      recommendations.push({
        id: `rec-${subject}-rise`,
        subject,
        topic: weakTopicName,
        tone: 'positive',
        message: `Your ${subject} performance improved from ${prevPct}% to ${latest.percentage}% (+${stepDelta} percentage points). ${
          weakestTopics[0]
            ? `Keep practising ${weakestTopics[0].topic} (${weakestTopics[0].accuracy}%) where marks can still grow.`
            : 'Keep up the steady practice momentum!'
        }`,
        suggestedActionLabel: weakestTopics[0]
          ? `Practise ${weakestTopics[0].topic}`
          : `Next ${subject} Challenge`,
        actionType: 'quiz',
      });
    } else if (weakestTopics[0]) {
      recommendations.push({
        id: `rec-${subject}-steady`,
        subject,
        topic: weakestTopics[0].topic,
        tone: 'neutral',
        message: `Your ${subject} average is ${currentAverage}%. Repeated mistakes appear in ${weakestTopics[0].topic} (${weakestTopics[0].accuracy}%). A quick targeted quiz will lock in those marks.`,
        suggestedActionLabel: `Practise ${weakestTopics[0].topic}`,
        actionType: 'quiz',
      });
    }
  }

  subjectSummaries.sort((a, b) => b.attemptCount - a.attemptCount);
  return {
    overallAverage,
    totalAttempts: validAttempts.length,
    overallTrendDelta,
    subjectSummaries,
    recommendations,
  };
}

export function buildSmartReminders(
  summaries: SubjectPerformanceSummary[],
  attempts: QuizAttempt[]
): StudyReminder[] {
  if (attempts.length === 0) return [];
  const reminders: StudyReminder[] = [];

  for (const s of summaries) {
    if (s.trendDirection === 'declining' && s.trendDelta !== null) {
      const focusTopic = s.weakestTopics[0]?.topic || s.subject;
      reminders.push({
        id: `rem-decline-${s.subject.toLowerCase()}`,
        subject: s.subject,
        topic: focusTopic,
        title: `Revisit ${s.subject}: ${focusTopic}`,
        reason: `Recent score dipped by ${Math.abs(s.trendDelta)} percentage points to ${s.latestScore}%. Revise Smart Notes then test yourself.`,
        priority: 'high',
        dueLabel: 'Recommended today',
        createdAt: Date.now(),
      });
    } else if (s.weakestTopics[0]) {
      reminders.push({
        id: `rem-weak-${s.subject.toLowerCase()}-${s.weakestTopics[0].topic.toLowerCase()}`,
        subject: s.subject,
        topic: s.weakestTopics[0].topic,
        title: `Practise ${s.weakestTopics[0].topic} (${s.subject})`,
        reason: `Accuracy is ${s.weakestTopics[0].accuracy}% across ${s.weakestTopics[0].total} question(s). A short 5-question quiz helps build mastery.`,
        priority: s.weakestTopics[0].accuracy < 55 ? 'high' : 'normal',
        dueLabel: 'Next study session',
        createdAt: Date.now(),
      });
    } else if (s.trendDirection === 'improving') {
      reminders.push({
        id: `rem-keepup-${s.subject.toLowerCase()}`,
        subject: s.subject,
        topic: s.strongestTopics[0]?.topic || s.subject,
        title: `Maintain momentum in ${s.subject}`,
        reason: `Great jump to ${s.latestScore}%! Try a timed or hard-difficulty quiz to lock in your gains.`,
        priority: 'normal',
        dueLabel: 'This week',
        createdAt: Date.now(),
      });
    }
  }

  return reminders.slice(0, 6);
}

export function parseAIJsonSafe<T>(raw: string): T {
  const cleaned = String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('AI returned an empty response.');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt to locate outermost balanced JSON object or array
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    let startIdx = -1;
    let openChar = '{';
    let closeChar = '}';

    if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
      startIdx = objStart;
      openChar = '{';
      closeChar = '}';
    } else if (arrStart !== -1) {
      startIdx = arrStart;
      openChar = '[';
      closeChar = ']';
    }

    if (startIdx !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = startIdx; i < cleaned.length; i += 1) {
        const ch = cleaned[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === openChar) depth += 1;
          else if (ch === closeChar) {
            depth -= 1;
            if (depth === 0) {
              const candidate = cleaned.slice(startIdx, i + 1);
              return JSON.parse(candidate) as T;
            }
          }
        }
      }
    }

    throw new Error('AI returned a non-JSON response format. Please try again.');
  }
}

const NON_LATIN_SCRIPT_REGEX =
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0900-\u097F\u0400-\u04FF]/;

export function extractPureTargetSpeechText(raw: string): string {
  let out = String(raw || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();

  // Strip trailing " — meaning" or " - meaning" if present
  const dashSplit = out.match(/^(.+?)\s+[—–-]\s+[A-Za-z0-9 ,.'"!?]+$/);
  if (dashSplit && dashSplit[1].trim().length >= 2) {
    out = dashSplit[1].trim();
  }

  // If phrase contains native non-Latin script (Japanese, Chinese, Arabic, Hindi, Korean),
  // strip parenthetical Latin romanization e.g. "こんにちは (konnichiwa)" -> "こんにちは"
  if (NON_LATIN_SCRIPT_REGEX.test(out)) {
    out = out.replace(/\([A-Za-z0-9āēīōūĀĒĪŌŪ\s,'’./-]+\)/g, ' ');
  } else {
    // Strip explanatory parenthetical glosses like "(Good morning)" when preceded by target text
    out = out.replace(/\(\s*(?:meaning|literally|formal|informal|singular|plural|lit\.|e\.g\.)[^)]*\)/gi, ' ');
  }

  return out.replace(/\s+/g, ' ').trim();
}

export function extractLanguagePracticePhrases(
  text: string,
  subjectHint?: string
): Array<{ targetText: string; meaning?: string }> {
  const isLangTopic =
    isLanguageSubject(subjectHint) ||
    NON_LATIN_SCRIPT_REGEX.test(text) ||
    /\b(translate|pronounce|pronunciation|say in|means in|french|spanish|japanese|chinese|mandarin|kiswahili|swahili|german|korean|arabic|italian|portuguese)\b/i.test(
      `${subjectHint || ''} ${text.slice(0, 250)}`
    );

  if (!isLangTopic || !text.trim()) return [];

  const results: Array<{ targetText: string; meaning?: string }> = [];
  const seen = new Set<string>();

  const pushPhrase = (rawTarget: string, rawMeaning?: string) => {
    const cleanTarget = extractPureTargetSpeechText(rawTarget)
      .replace(/^["""'«»]+|["""'«»]+$/g, '')
      .trim();
    if (!cleanTarget || cleanTarget.length < 2 || cleanTarget.length > 72) return;
    // Skip pure English UI/grammar labels unless English IS the target subject
    const low = cleanTarget.toLowerCase();
    if (
      !subjectHint?.toLowerCase().includes('english') &&
      /^(step|tip|note|example|rule|grammar|summary|answer|correct|wrong|practice|alexyn|quiz|try|how|why)\b/i.test(
        low
      )
    ) {
      return;
    }
    if (seen.has(low)) return;
    seen.add(low);
    results.push({
      targetText: cleanTarget,
      meaning: rawMeaning?.trim() || undefined,
    });
  };

  // 1. Marked phrases paired with bracketed English meanings: **Bonjour** [Hello] or "Gracias" [Thank you]
  const bracketPairs = text.matchAll(
    /(?:\*\*([^*\n]{2,64})\*\*|`([^`\n]{2,64})`|["«]([^"»\n]{2,64})["»])\s*\[([^\]\n]{1,60})\]/g
  );
  for (const m of bracketPairs) {
    const candidate = m[1] || m[2] || m[3] || '';
    const meaning = m[4] || '';
    pushPhrase(candidate, meaning);
  }

  // 2. Standalone phrases with non-Latin scripts inside bold/backticks/quotes (e.g., **おはようございます**)
  const nonLatinMarked = text.matchAll(/(?:\*\*([^*\n]{2,60})\*\*|`([^`\n]{2,60})`)/g);
  for (const m of nonLatinMarked) {
    const candidate = (m[1] || m[2] || '').trim();
    if (NON_LATIN_SCRIPT_REGEX.test(candidate)) {
      pushPhrase(candidate);
    }
  }

  // 3. When subjectHint is an explicit foreign language, capture bold/quoted foreign phrases followed by "—" or "=" or "(English)"
  if (isLanguageSubject(subjectHint) && !subjectHint?.toLowerCase().includes('english')) {
    const glossPairs = text.matchAll(
      /(?:\*\*([^*\n]{2,60})\*\*|`([^`\n]{2,60})`)\s*(?:—|-|=|\()\s*([A-Za-z][^.\n)]{1,50})\)?/g
    );
    for (const m of glossPairs) {
      const candidate = m[1] || m[2] || '';
      const gloss = m[3] || '';
      pushPhrase(candidate, gloss);
    }
  }

  return results.slice(0, 6);
}

export function splitSpeechChunks(text: string, maxChunkLen = 180): string[] {
  const normalized = stripMarkdownForSpeech(text);
  if (!normalized) return [];
  if (normalized.length <= maxChunkLen) return [normalized];

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const sent of sentences) {
    if (sent.length > maxChunkLen) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      const words = sent.split(/\s+/);
      let part = '';
      for (const word of words) {
        if ((part ? `${part} ${word}` : word).length > maxChunkLen) {
          if (part) chunks.push(part);
          part = word;
        } else {
          part = part ? `${part} ${word}` : word;
        }
      }
      if (part) chunks.push(part);
      continue;
    }

    const combined = buffer ? `${buffer} ${sent}` : sent;
    if (combined.length > maxChunkLen) {
      if (buffer) chunks.push(buffer);
      buffer = sent;
    } else {
      buffer = combined;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

let activeSpeechSessionId = 0;

export function stopBrowserTTS(): void {
  activeSpeechSessionId += 1;
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore browser speech cancel errors
  }
}

export function speakWithBrowserTTS(params: {
  text: string;
  lang?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}): boolean {
  if (!isSpeechSynthesisSupported()) {
    params.onError?.('Spoken audio is not supported in this browser.');
    return false;
  }

  const chunks = splitSpeechChunks(params.text, 180);
  if (chunks.length === 0) {
    params.onError?.('Nothing readable to speak.');
    return false;
  }

  try {
    activeSpeechSessionId += 1;
    const sessionId = activeSpeechSessionId;
    window.speechSynthesis.cancel();

    const targetLang = params.lang || 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const base = targetLang.split('-')[0].toLowerCase();
    const matchedVoice =
      voices.length > 0
        ? voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(base))
        : undefined;

    let chunkIdx = 0;
    let startedCalled = false;

    const speakNext = () => {
      if (sessionId !== activeSpeechSessionId) return;
      if (chunkIdx >= chunks.length) {
        params.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIdx]);
      utterance.lang = targetLang;
      utterance.rate = params.rate ?? 1.15;
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onstart = () => {
        if (sessionId !== activeSpeechSessionId) return;
        if (!startedCalled) {
          startedCalled = true;
          params.onStart?.();
        }
      };

      utterance.onend = () => {
        if (sessionId !== activeSpeechSessionId) return;
        chunkIdx += 1;
        speakNext();
      };

      utterance.onerror = (ev) => {
        if (sessionId !== activeSpeechSessionId) return;
        const errCode = (ev as { error?: string })?.error;
        if (errCode === 'canceled' || errCode === 'interrupted') {
          params.onEnd?.();
          return;
        }
        params.onError?.('Voice playback stopped or was blocked by browser audio.');
      };

      window.speechSynthesis.speak(utterance);
    };

    params.onStart?.();
    startedCalled = true;
    speakNext();
    return true;
  } catch {
    params.onError?.('Could not start spoken audio in this browser.');
    return false;
  }
}


