import type { NoteStyleId, SharedPost, SubjectItem } from '../types/alexyn';

export const COUNTRIES = [
  'Kenya',
  'Uganda',
  'Tanzania',
  'Nigeria',
  'Ghana',
  'South Africa',
  'Egypt',
  'United Kingdom',
  'United States',
  'Canada',
  'India',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'China',
  'Singapore',
  'United Arab Emirates',
  'Brazil',
  'Other',
];

export const CURRICULA = [
  'CBC (Kenya)',
  '8-4-4 / KCSE',
  'Cambridge IGCSE / A-Level',
  'British National Curriculum (GCSE)',
  'American (Common Core / AP)',
  'International Baccalaureate (IB)',
  'WAEC / West African',
  'CBSE / ICSE (India)',
  'CAPS (South Africa)',
  'Australian Curriculum (ACARA)',
  'European (Baccalauréat / Abitur)',
  'University / College Syllabus',
  'National curriculum',
  'Other',
];

export const EDUCATION_LEVELS: Array<'Primary' | 'Secondary' | 'College' | 'University'> = [
  'Primary',
  'Secondary',
  'College',
  'University',
];

export const UNIVERSITY_YEARS = [
  'Year 1 (Freshman)',
  'Year 2 (Sophomore)',
  'Year 3 (Junior)',
  'Year 4 (Senior)',
  'Year 5+ / Postgraduate',
];

export const GRADE_OPTIONS_BY_LEVEL: Record<'Primary' | 'Secondary' | 'College' | 'University', string[]> = {
  Primary: [
    'Grade 1 / Standard 1',
    'Grade 2 / Standard 2',
    'Grade 3 / Standard 3',
    'Grade 4 / Standard 4',
    'Grade 5 / Standard 5',
    'Grade 6 / Standard 6',
    'Standard 7',
    'Standard 8',
  ],
  Secondary: [
    'Grade 7 / Form 1 / Year 7',
    'Grade 8 / Form 2 / Year 8',
    'Grade 9 / Form 3 / Year 9',
    'Grade 10 / Form 4 / Year 10',
    'Grade 11 / Year 11',
    'Grade 12 / Year 12',
  ],
  College: [
    'Certificate Year 1',
    'Diploma Year 1',
    'Diploma Year 2',
    'Diploma Year 3',
    'Higher National Diploma',
  ],
  University: [
    'Year 1 (Freshman)',
    'Year 2 (Sophomore)',
    'Year 3 (Junior)',
    'Year 4 (Senior)',
    'Year 5+ / Postgraduate',
  ],
};

export const CORE_SUBJECTS: SubjectItem[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    accentColor: '#3b82f6',
    examHotTopics: [
      'Quadratic equations, factorisation & graph turning points',
      'Trigonometry (SOHCAHTOA, sine/cosine rules, bearings)',
      'Probability trees, Venn diagrams & cumulative frequency',
      'Vectors, matrices & calculus differentiation rates',
    ],
    readingAdvice: [
      'Show every intermediate step clearly—method marks count heavily in exams.',
      'Check answers by substituting solutions back into the original equation.',
    ],
  },
  {
    id: 'english',
    name: 'English',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    accentColor: '#38bdf8',
    examHotTopics: [
      'Functional writing: formal letters, memos, reports & speeches',
      'Cloze tests, active/passive voice & reported speech',
      'Comprehension inference & literary devices (metaphor, irony, tone)',
      'Oral skills: stress, intonation & etiquette in dialogues',
    ],
    readingAdvice: [
      'Read 1 editorial article or short story excerpt daily and underline linking words (however, consequently, although).',
      'Practice functional writing formats—layout and register alone earn rapid exam marks.',
    ],
  },
  {
    id: 'kiswahili',
    name: 'Kiswahili',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    accentColor: '#22c55e',
    examHotTopics: [
      'Ngeli za nomino (noun classes) & upatanisho wa kisarufi',
      'Insha za kiuamilifu (barua rasmi, hotuba, ripoti, tahakiki)',
      'Tamathali za usemi (tashbihi, sitiari, chuku, tashihisi)',
      'Ufahamu, ufupisho & fasihi simulizi',
    ],
    readingAdvice: [
      'Soma makala fupi ya Kiswahili sanifu kila siku na uandike methali 3 pamoja na matumizi yake.',
      'Hakikisha unajua muundo kamili wa insha za kiuamilifu zinazotahiniwa mara kwa mara.',
    ],
  },
  {
    id: 'biology',
    name: 'Biology',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#22c55e',
    examHotTopics: [
      'Cell organelle functions & osmosis vs active transport',
      'Photosynthesis light & dark stages + limiting factors',
      'Gaseous exchange, respiration & Bohr effect in mammals',
      'Genetics, Punnett squares & mitosis vs meiosis',
    ],
    readingAdvice: [
      'Compare structure vs function tables for every organelle before memorizing names.',
      'Practice drawing and labeling leaf cross-sections and nephrons from memory.',
    ],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#38bdf8',
    examHotTopics: [
      'Mole concept, stoichiometry & titration calculations',
      'Chemical bonding (ionic, covalent, metallic) & lattice properties',
      'Rates of reaction, Le Chatelier equilibrium & energy diagrams',
      'Organic chemistry functional groups & isomer naming',
    ],
    readingAdvice: [
      'Always write balanced state-symbol equations first in calculation questions.',
      'Group periodic trends by atomic radius, ionization energy, and reactivity.',
    ],
  },
  {
    id: 'physics',
    name: 'Physics',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#818cf8',
    examHotTopics: [
      'Newtonian motion graphs (velocity-time area & gradient)',
      'Ohm’s Law, series/parallel circuits & internal resistance',
      'Wave refraction, Snell’s law & electromagnetic spectrum',
      'Radioactivity half-life & nuclear equations',
    ],
    readingAdvice: [
      'Convert all units to SI (m, kg, s) before substituting into formulas.',
      'Sketch free-body force diagrams on every mechanics problem.',
    ],
  },
  {
    id: 'science-tech',
    name: 'Science and Technology',
    category: 'core',
    levels: ['Primary'],
    accentColor: '#06b6d4',
    examHotTopics: [
      'Living vs non-living things & plant classification',
      'States of matter, mixtures & simple separation methods',
      'Human digestive & breathing systems basics',
      'Simple machines, levers & digital device safety',
    ],
    readingAdvice: [
      'Relate every topic to things you observe at home or in the school garden.',
      'Use labelled quick sketches to remember how simple tools reduce effort.',
    ],
  },
  {
    id: 'geography',
    name: 'Geography',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    accentColor: '#10b981',
    examHotTopics: [
      'Map reading: 6-figure grid references, scale & contours',
      'River erosion/deposition landforms & coastal processes',
      'Climate zones, rainfall types & plate tectonics',
      'Sustainable agriculture, forestry & urbanization case studies',
    ],
    readingAdvice: [
      'Always pair every physical geography process with one named real-world example.',
      'Practice interpreting relief cross-sections from contour maps.',
    ],
  },
  {
    id: 'history',
    name: 'History & Government',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    accentColor: '#f97316',
    examHotTopics: [
      'Constitutional rights, governance & civic responsibility',
      'Pre-colonial trade routes, independence movements & nation building',
      'World wars, international organizations & decolonization',
    ],
    readingAdvice: [
      'Build timeline anchors (cause -> key event -> outcome) instead of cramming dates.',
      'Use PEEL (Point, Evidence, Explain, Link) for essay paragraphs.',
    ],
  },
  {
    id: 'business',
    name: 'Business Studies',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#f59e0b',
    examHotTopics: [
      'Sole traders vs partnerships vs limited companies',
      'Break-even analysis, cash flow & profit/loss statements',
      'Marketing mix (4Ps) & supply-demand shifts',
      'Sources of business finance & entrepreneurship',
    ],
    readingAdvice: [
      'Always evaluate both advantages and drawbacks in 8–10 mark essay questions.',
      'Memorize cash-flow and gross/net profit formulas cleanly.',
    ],
  },
  {
    id: 'economics',
    name: 'Economics',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#fbbf24',
    examHotTopics: [
      'Elasticity of demand & supply curves',
      'Inflation, GDP, fiscal vs monetary policy',
      'Market structures (perfect competition vs monopoly)',
      'International trade, tariffs & exchange rates',
    ],
    readingAdvice: [
      'Always draw clearly labelled equilibrium shift diagrams alongside written explanations.',
    ],
  },
  {
    id: 'ict',
    name: 'ICT & Computer Science',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    accentColor: '#a855f7',
    examHotTopics: [
      'Binary/hexadecimal conversions & logic gates (AND, OR, NOT)',
      'Input/output/storage hardware & operating system roles',
      'Algorithms, flowcharts & loop tracing',
      'Cybersecurity threats, encryption & network topologies',
    ],
    readingAdvice: [
      'Trace algorithms row-by-row using a small variable trace table.',
      'Draw truth tables for combined logic gates step by step.',
    ],
  },
  {
    id: 'literature',
    name: 'Literature',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    accentColor: '#e879f9',
    examHotTopics: [
      'Character motivation, conflict & thematic analysis',
      'Poetry analysis: imagery, rhyme, tone & symbolism',
      'Set-book essay quoting & textual evidence',
    ],
    readingAdvice: [
      'Keep 5 versatile short quotes per major theme memorized so you can weave them into essays.',
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Nutrition',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    accentColor: '#84cc16',
    examHotTopics: [
      'Soil profile, conservation & organic mulching',
      'Crop rotation, pest control & balanced nutrition',
      'Livestock breeds, housing & disease prevention',
      'Food preservation & kitchen hygiene',
    ],
    readingAdvice: [
      'Connect soil nutrients (N, P, K) directly to visible leaf deficiency signs.',
      'Revise step-by-step nursery bed preparation and transplanting steps.',
    ],
  },
  {
    id: 'home-science',
    name: 'Home Science',
    category: 'core',
    levels: ['Primary', 'Secondary'],
    accentColor: '#ec4899',
    examHotTopics: [
      'Macro & micronutrients, deficiency diseases & meal planning',
      'Fabric care, laundry symbols & basic stitches',
      'Consumer protection, budgeting & maternal/child health',
    ],
    readingAdvice: [
      'Match every vitamin/mineral to one food source and one deficiency symptom.',
    ],
  },
  {
    id: 'csl',
    name: 'CSL (Community Service)',
    category: 'core',
    levels: ['Secondary', 'College'],
    accentColor: '#14b8a6',
    examHotTopics: [
      'Identifying community needs & project planning cycle',
      'Ethical leadership, teamwork & resource mobilization',
      'Impact evaluation & reflective journaling',
    ],
    readingAdvice: [
      'Document real observations and reflection steps—examiners look for authentic process.',
    ],
  },
  {
    id: 'religious-ed',
    name: 'Religious Education',
    category: 'core',
    levels: ['Primary', 'Secondary'],
    accentColor: '#eab308',
    examHotTopics: [
      'Moral values, integrity & stewardship teachings',
      'Scriptural foundations & application to modern life',
      'Social justice, forgiveness & community harmony',
    ],
    readingAdvice: [
      'Support every moral principle with a clear modern-day application example.',
    ],
  },
  {
    id: 'creative-arts',
    name: 'Creative Arts & Design',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    accentColor: '#fb7185',
    examHotTopics: [
      'Elements of art (line, tone, texture, perspective)',
      'Rhythm, melody notation & traditional instruments',
      'Design composition & colour harmony',
    ],
    readingAdvice: [
      'Practice identifying warm/cool complementary palettes and rhythmic time signatures.',
    ],
  },
];

export const LANGUAGE_SUBJECTS: SubjectItem[] = [
  {
    id: 'japanese',
    name: 'Japanese',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇯🇵',
    accentColor: '#f43f5e',
    examHotTopics: [
      'Particles (は, が, を, に, で, へ) & sentence order',
      'Verb て-form, ます-form & polite past/negative endings',
      'Core Kanji recognition & Hiragana/Katakana reading speed',
      'Polite Keigo expressions in situational dialogues',
    ],
    readingAdvice: [
      'Practice reading short NHK Easy articles without romaji to boost Hiragana/Katakana fluency.',
      'Group Kanji by radicals and make funny visual stories for tricky readings.',
    ],
  },
  {
    id: 'spanish',
    name: 'Spanish',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇪🇸',
    accentColor: '#f59e0b',
    examHotTopics: [
      'Ser vs Estar (DOCTOR vs PLACE) & Por vs Para',
      'Preterite vs Imperfect past tenses in storytelling',
      'Subjunctive mood triggers (WEIRDO) & reflexive verbs',
      'Exam essay openers, opinions (en mi opinión, sin embargo)',
    ],
    readingAdvice: [
      'Read graded Spanish news snippets and highlight every Ser/Estar choice to see why each was used.',
      'Build a 10-phrase opinion bank for writing and oral speaking tasks.',
    ],
  },
  {
    id: 'french',
    name: 'French',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇫🇷',
    accentColor: '#60a5fa',
    examHotTopics: [
      'Passé composé (avoir vs être + DR MRS VANDERTRAMP) vs Imparfait',
      'Pronouns (y, en, le/la/les, lui/leur) & negation (ne...pas/jamais)',
      'Guided letter/email writing on school, travel & daily routine',
      'Listening & reading comprehension keywords (time & connector cues)',
    ],
    readingAdvice: [
      'Read short French dialogues aloud and keep a tiny notebook of 20 high-frequency connectors (pourtant, donc, ensuite).',
      'Drill être-verbs in passé composé—they appear in almost every grammar & writing paper.',
    ],
  },
  {
    id: 'chinese',
    name: 'Chinese (Mandarin)',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇨🇳',
    accentColor: '#ef4444',
    examHotTopics: [
      'Tone pairs, Pinyin accuracy & measure words (个, 本, 张, 条)',
      'Time-manner-place word order & aspect markers (了, 过, 在)',
      'High-frequency HSK radicals & character stroke recognition',
      'Situational dialogues (shopping, directions, school life)',
    ],
    readingAdvice: [
      'Shadow-read audio dialogues to lock in tones alongside sentence rhythm.',
      'Pair every new character with a vivid memory picture of its radical.',
    ],
  },
  {
    id: 'german',
    name: 'German',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇩🇪',
    accentColor: '#eab308',
    examHotTopics: [
      'Cases (Nominative, Accusative, Dative, Genitive) & article shifts',
      'Verb-second (V2) word order & subordinate clause verb-at-end (weil, dass)',
      'Separable prefix verbs & Perfekt (haben/sein + Partizip II)',
      'Formal vs informal letter writing (Sehr geehrte/Liebe)',
    ],
    readingAdvice: [
      'Always learn German nouns together with their article (der/die/das) and plural form.',
      'Spot subordinating conjunctions (weil, obwohl, wenn) in sample texts to master verb placement.',
    ],
  },
  {
    id: 'arabic',
    name: 'Arabic',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇸🇦',
    accentColor: '#10b981',
    examHotTopics: [
      'Three-letter root patterns (الجذر الثلاثي) & verb conjugations',
      'Nominal (جملة اسمية) vs Verbal sentences (جملة فعلية)',
      'Idafa (الإضافة) possessive chains & gender agreement',
      'Reading comprehension & guided short composition',
    ],
    readingAdvice: [
      'Trace unfamiliar vocabulary back to its 3-letter root—one root unlocks 5–8 exam words.',
      'Read short vocalized paragraphs daily to build speed with case endings.',
    ],
  },
  {
    id: 'korean',
    name: 'Korean',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇰🇷',
    accentColor: '#38bdf8',
    examHotTopics: [
      'Topic vs subject markers (은/는 vs 이/가) & object marker (을/를)',
      'Polite endings (-아요/어요, -습니다) & tense conjugation',
      'Hangul batchim (final consonant) pronunciation rules',
    ],
    readingAdvice: [
      'Read Hangul aloud in syllable blocks and group polite vs honorific verb stems.',
    ],
  },
  {
    id: 'portuguese',
    name: 'Portuguese',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇧🇷',
    accentColor: '#22c55e',
    examHotTopics: [
      'Ser vs Estar, contractions (do, na, pelo) & nasal vowels',
      'Preterite vs Imperfect past narration',
      'Pronoun placement & formal/informal register',
    ],
    readingAdvice: [
      'Practice listening to short Brazilian/European dialogues while reading transcripts.',
    ],
  },
  {
    id: 'italian',
    name: 'Italian',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇮🇹',
    accentColor: '#10b981',
    examHotTopics: [
      'Definite articles (il, lo, la, i, gli, le) & noun plurals',
      'Passato prossimo (avere vs essere) & articulated prepositions',
      'Everyday conversational dialogues & email writing',
    ],
    readingAdvice: [
      'Read short Italian stories aloud to master open/closed vowels and double consonants.',
    ],
  },
  {
    id: 'hindi',
    name: 'Hindi',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇮🇳',
    accentColor: '#f97316',
    examHotTopics: [
      'Gender agreement on adjectives & verbs (लड़का/लड़की)',
      'Postpositions (में, पर, को, से) & oblique case forms',
      'Devanagari matra reading & essay composition',
    ],
    readingAdvice: [
      'Read short graded Devanagari passages daily and note postposition patterns.',
    ],
  },
];

export const EXPLORE_PLUGINS = [
  {
    id: 'exam-coach',
    label: 'Exam Coach',
    description: 'Highlights what examiners test most and marking key points.',
  },
  {
    id: 'step-solver',
    label: 'Step-by-Step Solver',
    description: 'Breaks formulas and problems into clear numbered steps.',
  },
  {
    id: 'diagram-explainer',
    label: 'Visual Mental Model',
    description: 'Turns abstract concepts into clear visual analogies.',
  },
  {
    id: 'quiz-me',
    label: 'Quick Quiz Check',
    description: 'Ends every reply with 1–2 rapid self-test questions.',
  },
];

export const EXPLORE_SUGGESTIONS = [
  'Explain photosynthesis simply',
  'What mostly comes in French exams?',
  'Help me understand Newton’s 2nd Law',
  'Give me a memory trick for Japanese particles',
];

export const NOTE_STYLE_OPTIONS: Array<{
  id: NoteStyleId;
  label: string;
  description: string;
}> = [
  {
    id: 'memory-tricks',
    label: 'Memory Tricks',
    description: 'Acronyms, mnemonics & sticky mental hooks',
  },
  {
    id: 'funny-examples',
    label: 'Funny Examples',
    description: 'Memorable, playful real-life stories that stick',
  },
  {
    id: 'exam-focus',
    label: 'Exam Focus',
    description: 'Likely exam questions, keywords & marking traps',
  },
  {
    id: 'real-world-analogy',
    label: 'Real-World Analogy',
    description: 'Everyday comparisons so you truly understand',
  },
  {
    id: 'quick-summary',
    label: 'Quick Bullet Summary',
    description: 'Fast 60-second revision bullets',
  },
  {
    id: 'flashcards',
    label: 'Practice Flashcards',
    description: 'Interactive Q&A cards to test yourself',
  },
];

export const STARTER_COMMUNITY_POSTS: SharedPost[] = [
  {
    id: 'post-1',
    author: 'Amina K.',
    authorRole: 'Grade 11 · CBC',
    subject: 'French',
    kind: 'Memory Trick',
    title: 'DR MRS VANDERTRAMP in 10 seconds',
    body: 'For French Passé Composé verbs that take être instead of avoir, picture a house of arrival & departure: Descendre, Rester, Monter, Revenir, Sortir, Venir, Aller, Naître, Devenir, Entrer, Rentrer, Tomber, Retourner, Arriver, Mourir, Partir!',
    likes: 34,
    createdAt: Date.now() - 1000 * 60 * 140,
  },
  {
    id: 'post-2',
    author: 'Liam O.',
    authorRole: 'Cambridge IGCSE',
    subject: 'Biology',
    kind: 'Quick Note',
    title: 'Xylem vs Phloem — Never mix them up again',
    body: 'XYlem carries water UP (like a sky elevator, X -> Sky) in dead hollow tubes. PHloem carries Food (Ph-ood!) both ways in living cells.',
    likes: 51,
    createdAt: Date.now() - 1000 * 60 * 320,
  },
  {
    id: 'post-3',
    author: 'Nadia W.',
    authorRole: 'Year 1 · University',
    subject: 'Japanese',
    kind: 'Exam Tip',
    title: 'は (wa) vs が (ga) quick exam rule',
    body: 'Think of は as the spotlight setting the topic ("As for X..."), while が points at the exact answer to "Who?" or "Which one?"!',
    likes: 27,
    createdAt: Date.now() - 1000 * 60 * 540,
  },
];
