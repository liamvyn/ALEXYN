import type {
  EducationProfile,
  NoteStyleId,
  SharedPost,
  SubjectItem,
} from '../types/alexyn';

export const COUNTRIES: string[] = [
  'Kenya',
  'United Kingdom',
  'United States',
  'Nigeria',
  'South Africa',
  'Uganda',
  'Tanzania',
  'India',
  'Canada',
  'Australia',
  'Singapore',
  'International / Other',
];

export const CURRICULA: string[] = [
  'CBC (Kenya)',
  '8-4-4 / KCSE (Kenya)',
  'Cambridge IGCSE / A-Level',
  'IB (International Baccalaureate)',
  'UK National Curriculum / GCSE',
  'US Common Core / AP',
  'WAEC / West African Curriculum',
  'Indian CBSE / ICSE',
  'University / Higher Education',
  'Self-Study / General',
];

export const EDUCATION_LEVELS: Array<Exclude<EducationProfile['educationLevel'], ''>> = [
  'Primary',
  'Secondary',
  'College',
  'University',
];

export const UNIVERSITY_YEARS: string[] = [
  'Year 1 (Freshman)',
  'Year 2 (Sophomore)',
  'Year 3 (Junior)',
  'Year 4 (Senior)',
  'Year 5+ / Postgraduate',
];

export const GRADE_OPTIONS_BY_LEVEL: Record<
  Exclude<EducationProfile['educationLevel'], ''>,
  string[]
> = {
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
  University: UNIVERSITY_YEARS,
};

export const CORE_SUBJECTS: SubjectItem[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    examHotTopics: [
      'Quadratics & Algebraic Equations',
      'Trigonometry & Pythagoras (SOHCAHTOA)',
      'Calculus, Differentiation & Integration',
      'Vectors, Matrices & Coordinate Geometry',
    ],
    readingAdvice: [
      'Practice 3 mixed past-paper problems daily without looking at the marking scheme first.',
      'Write every intermediate formula step clearly to secure method marks.',
    ],
    accentColor: '#38BDF8',
  },
  {
    id: 'english',
    name: 'English',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    examHotTopics: [
      'Comprehension & Inference',
      'Grammar, Clauses & Synthesis',
      'Essay Writing & Functional Composition',
      'Literary Analysis & Poetry Devices',
    ],
    readingAdvice: [
      'Summarize each comprehension paragraph in one crisp phrase while reading.',
      'Back every literature point with a short direct textual reference.',
    ],
    accentColor: '#60A5FA',
  },
  {
    id: 'kiswahili',
    name: 'Kiswahili',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    examHotTopics: [
      'Insha na Utungaji Bora',
      'Sarufi, Ngeli na Matumizi ya Lugha',
      'Ufahamu na Ufupisho',
      'Fasihi Simulizi na Andishi',
    ],
    readingAdvice: [
      'Soma makala mafupi kila siku kujenga msamiati wa insha na ufahamu.',
      'Hakikisha ngeli, nyakati na alama za uakifishaji zinafuatwa ipasavyo.',
    ],
    accentColor: '#34D399',
  },
  {
    id: 'science-tech',
    name: 'Science & Technology',
    category: 'core',
    levels: ['Primary'],
    examHotTopics: [
      'Living Things & Plant Parts',
      'States of Matter & Mixtures',
      'Simple Machines, Force & Energy',
      'Digital Literacy & Water Conservation',
    ],
    readingAdvice: [
      'Connect every science idea to everyday objects you can observe around home or school.',
      'Draw neat labelled diagrams for plant parts and simple machines.',
    ],
    accentColor: '#2DD4BF',
  },
  {
    id: 'biology',
    name: 'Biology',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    examHotTopics: [
      'Cell Structure, Osmosis & Active Transport',
      'Photosynthesis & Cellular Respiration',
      'Genetics, Mitosis, Meiosis & Punnett Squares',
      'Human Circulation, Enzymes & Homeostasis',
    ],
    readingAdvice: [
      'Link every organelle or organ structure directly to its biological function.',
      'Use exact marking terms such as semi-permeable membrane and water potential.',
    ],
    accentColor: '#5EEAD4',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    examHotTopics: [
      'Atomic Structure, Periodic Trends & Bonding',
      'Mole Concept, Stoichiometry & Titration',
      'Acids, Bases, Salts & pH Scale',
      'Organic Chemistry (Alkanes, Alkenes) & Energetics',
    ],
    readingAdvice: [
      'Always balance chemical equations before calculating mole ratios.',
      'Group reactions by functional family rather than memorizing isolated equations.',
    ],
    accentColor: '#818CF8',
  },
  {
    id: 'physics',
    name: 'Physics',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    examHotTopics: [
      'Kinematics, Forces & Newton’s Laws',
      'Electricity, Circuits & Ohm’s Law',
      'Waves, Sound, Optics & Refraction',
      'Work, Energy, Power & Electromagnetism',
    ],
    readingAdvice: [
      'Always write Known → Formula → Substitute → Answer with SI Unit.',
      'Sketch free-body or circuit diagrams before plugging numbers into equations.',
    ],
    accentColor: '#38BDF8',
  },
  {
    id: 'integrated-science',
    name: 'Integrated Science',
    category: 'core',
    levels: ['Secondary'],
    examHotTopics: [
      'Mixtures, Separation & Pure Substances',
      'Energy Transformations & Simple Circuits',
      'Human Health, Reproduction & Nutrition',
      'Laboratory Safety & Apparatus',
    ],
    readingAdvice: [
      'Review standard laboratory apparatus names, uses, and measurement units.',
      'Practice explaining observations using cause-and-effect scientific reasoning.',
    ],
    accentColor: '#22D3EE',
  },
  {
    id: 'history',
    name: 'History',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    examHotTopics: [
      'Early Civilisations & Trade Networks',
      'Colonialism & Independence Movements',
      'World Wars & Modern Global Order',
      'Constitutional Development & Source Analysis',
    ],
    readingAdvice: [
      'Build timeline anchors structured as Cause → Turning Point → Long-Term Impact.',
      'In source questions, evaluate bias, authorship, and historical context.',
    ],
    accentColor: '#F59E0B',
  },
  {
    id: 'geography',
    name: 'Geography',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    examHotTopics: [
      'Map Reading, Contours & 6-Figure Grid References',
      'Plate Tectonics, Weathering & Landforms',
      'Climate Patterns, Monsoons & Biomes',
      'Population, Urbanisation & Sustainable Resources',
    ],
    readingAdvice: [
      'Practice 6-figure grid coordinates and bearing measurements weekly.',
      'Always distinguish between physical causes and human impacts in essays.',
    ],
    accentColor: '#10B981',
  },
  {
    id: 'business',
    name: 'Business Studies',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    examHotTopics: [
      'Entrepreneurship & Forms of Business Ownership',
      'Double-Entry Accounting & Balance Sheets',
      'Marketing Mix, Pricing & Break-Even Analysis',
      'International Trade & Banking',
    ],
    readingAdvice: [
      'Practice clean income statement and balance sheet formatting under time pressure.',
      'Support evaluative answers with concrete real-business scenarios.',
    ],
    accentColor: '#A78BFA',
  },
  {
    id: 'ict',
    name: 'ICT & Computer Science',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    examHotTopics: [
      'Binary Conversion & Boolean Logic Gates',
      'Algorithms, Flowcharts & Pseudocode',
      'Computer Hardware, Networks & Cybersecurity',
      'Programming, SQL Databases & Spreadsheets',
    ],
    readingAdvice: [
      'Trace loops and flowcharts step-by-step using a dry-run trace table.',
      'Double-check binary place values (128, 64, 32, 16, 8, 4, 2, 1) before adding.',
    ],
    accentColor: '#38BDF8',
  },
  {
    id: 'economics',
    name: 'Economics',
    category: 'core',
    levels: ['Secondary', 'College', 'University'],
    examHotTopics: [
      'Demand, Supply & Market Equilibrium',
      'Price Elasticity of Demand & Supply',
      'Market Structures & Cost Curves',
      'Inflation, GDP, Monetary & Fiscal Policy',
    ],
    readingAdvice: [
      'Draw fully labelled demand/supply diagrams showing curve shifts and new equilibrium.',
      'Always contrast short-run effects with long-run policy trade-offs.',
    ],
    accentColor: '#F472B6',
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Nutrition',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    examHotTopics: [
      'Soil Fertility, pH & Water Conservation',
      'Crop Husbandry & Integrated Pest Control',
      'Livestock Health & Dairy Management',
      'Balanced Nutrition & Food Preservation',
    ],
    readingAdvice: [
      'Connect soil structure and pH directly to crop nutrient uptake.',
      'Compare traditional and modern sustainable water-harvesting methods.',
    ],
    accentColor: '#84CC16',
  },
  {
    id: 'social-studies',
    name: 'Social Studies',
    category: 'core',
    levels: ['Primary', 'Secondary'],
    examHotTopics: [
      'Civic Governance & Democratic Institutions',
      'Human Rights, Ethics & Citizenship',
      'Regional Cooperation & Trade',
      'Environmental Stewardship',
    ],
    readingAdvice: [
      'Define civic terms accurately and link them to real community examples.',
      'Compare local, national, and regional governance roles clearly.',
    ],
    accentColor: '#38BDF8',
  },
  {
    id: 'csl',
    name: 'CSL (Community Service)',
    category: 'core',
    levels: ['Secondary', 'College'],
    examHotTopics: [
      'Community Needs Assessment & Action Planning',
      'Ethical Leadership & Teamwork',
      'Resource Mobilisation & Project Execution',
      'Impact Reflection & Documentation',
    ],
    readingAdvice: [
      'Document real observations, measurable outcomes, and honest reflections.',
      'Tie every community project step to civic responsibility and sustainability.',
    ],
    accentColor: '#5EEAD4',
  },
  {
    id: 'cre',
    name: 'Religious Education',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    examHotTopics: [
      'Sacred Texts & Foundational Teachings',
      'Ethics, Moral Choices & Contemporary Issues',
      'Leadership, Justice & Compassion',
      'Faith in Community & Stewardship',
    ],
    readingAdvice: [
      'Cite specific teachings or principles to back moral and ethical arguments.',
      'Compare traditional perspectives with modern everyday challenges.',
    ],
    accentColor: '#C084FC',
  },
  {
    id: 'creative-arts',
    name: 'Creative Arts',
    category: 'core',
    levels: ['Primary', 'Secondary', 'College'],
    examHotTopics: [
      'Elements & Principles of Visual Design',
      'Music Rhythm, Scales & Staff Notation',
      'Colour Theory, Perspective & Composition',
      'Performing Arts & Cultural Expression',
    ],
    readingAdvice: [
      'Identify line, texture, balance, contrast, and rhythm in every critique.',
      'Practice clapping and subdividing time signatures steadily.',
    ],
    accentColor: '#FB7185',
  },
];

export const LANGUAGE_SUBJECTS: SubjectItem[] = [
  {
    id: 'french',
    name: 'French',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇫🇷',
    examHotTopics: [
      'Passé Composé vs Imparfait',
      'Gendered Articles & Adjective Agreement',
      'Pronouns (y, en, COD, COI)',
      'Everyday Dialogues & Letter Writing',
    ],
    readingAdvice: [
      'Memorize DR MRS VANDERTRAMP movement verbs that take être in passé composé.',
      'Read short French dialogues aloud daily to build natural liaison flow.',
    ],
    accentColor: '#60A5FA',
  },
  {
    id: 'spanish',
    name: 'Spanish',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇪🇸',
    examHotTopics: [
      'Ser vs Estar Usage Rules',
      'Preterite vs Imperfect Past Tenses',
      'Por vs Para Prepositions',
      'Travel, School & Daily Conversations',
    ],
    readingAdvice: [
      'Think DOCTOR for Ser and PLACE for Estar when choosing between "to be" verbs.',
      'Practice rolling stress patterns and accent marks carefully.',
    ],
    accentColor: '#F59E0B',
  },
  {
    id: 'japanese',
    name: 'Japanese',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇯🇵',
    examHotTopics: [
      'Hiragana & Katakana Mastery',
      'Core Particles (は, が, を, に, で)',
      'Polite -ます / -ません Verb Forms',
      'Essential JLPT N5/N4 Kanji & Counters',
    ],
    readingAdvice: [
      'Write and speak Hiragana syllables aloud in 5-character rows rather than silent staring.',
      'Group verbs into Godan, Ichidan, and Irregular families early.',
    ],
    accentColor: '#F472B6',
  },
  {
    id: 'chinese',
    name: 'Chinese (Mandarin)',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇨🇳',
    examHotTopics: [
      '4 Pinyin Tones & Tone Sandhi',
      'Core Radicals & Stroke Order',
      'Measure Words (个, 本, 张)',
      'Time, Aspect (了, 过) & Daily Dialogues',
    ],
    readingAdvice: [
      'Practice tone pairs together (e.g., 1+2, 3+4) so tones stay natural in real speech.',
      'Learn character radicals to guess the meaning of unfamiliar words.',
    ],
    accentColor: '#EF4444',
  },
  {
    id: 'german',
    name: 'German',
    category: 'language',
    levels: ['Secondary', 'College', 'University'],
    flag: '🇩🇪',
    examHotTopics: [
      'Noun Cases (Nominative, Accusative, Dative, Genitive)',
      'Verb-Second (V2) & Subordinate Word Order',
      'Separable Verbs & Modal Auxiliaries',
      'Formal vs Informal Correspondence',
    ],
    readingAdvice: [
      'Always learn every German noun together with its article (der, die, das).',
      'Locate the conjugated verb in position 2 first when parsing long sentences.',
    ],
    accentColor: '#FBBF24',
  },
  {
    id: 'arabic',
    name: 'Arabic',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇸🇦',
    examHotTopics: [
      'Trilateral Root Patterns & Script Forms',
      'Sun & Moon Letters (الـ)',
      'Nominal vs Verbal Sentences',
      'Greetings, Numbers & Verb Conjugation',
    ],
    readingAdvice: [
      'Trace each letter in its initial, medial, final, and isolated forms.',
      'Notice how 3-letter roots unlock whole families of related words.',
    ],
    accentColor: '#10B981',
  },
  {
    id: 'korean',
    name: 'Korean',
    category: 'language',
    levels: ['Secondary', 'College', 'University'],
    flag: '🇰🇷',
    examHotTopics: [
      'Hangul Syllable Blocks & Batchim',
      'Topic/Subject Particles (은/는, 이/가)',
      'Polite -아/어요 Conjugation',
      'Honorifics & Everyday Conversations',
    ],
    readingAdvice: [
      'Master Hangul vowel-consonant blocks in your first week—avoid relying on romanization.',
      'Pay close attention to final consonant (batchim) sound-linking rules.',
    ],
    accentColor: '#38BDF8',
  },
  {
    id: 'portuguese',
    name: 'Portuguese',
    category: 'language',
    levels: ['Secondary', 'College', 'University'],
    flag: '🇵🇹',
    examHotTopics: [
      'Nasal Vowels & Pronunciation',
      'Ser vs Estar & Ter Usage',
      'Present, Preterite & Imperfect Verbs',
      'Everyday Dialogues & Idioms',
    ],
    readingAdvice: [
      'Listen carefully to nasal endings (-ão, -õe, -ã) and repeat short phrases aloud.',
      'Compare European and Brazilian Portuguese pronoun placement patterns.',
    ],
    accentColor: '#22C55E',
  },
  {
    id: 'italian',
    name: 'Italian',
    category: 'language',
    levels: ['Secondary', 'College', 'University'],
    flag: '🇮🇹',
    examHotTopics: [
      'Definite Articles & Gender Plurals',
      'Regular & Irregular Present Tense (-are, -ere, -ire)',
      'Passato Prossimo with Avere vs Essere',
      'Culture, Travel & Expressive Phrases',
    ],
    readingAdvice: [
      'Pronounce double consonants clearly—they often distinguish completely different words.',
      'Pair flashcards with full short sentences rather than isolated infinitives.',
    ],
    accentColor: '#34D399',
  },
  {
    id: 'hindi',
    name: 'Hindi',
    category: 'language',
    levels: ['Primary', 'Secondary', 'College', 'University'],
    flag: '🇮🇳',
    examHotTopics: [
      'Devanagari Script & Vowel Matras',
      'Gender Agreement & Postpositions (में, पर, को)',
      'Present & Past Habitual Sentences',
      'Polite Requests (आप) & Everyday Dialogue',
    ],
    readingAdvice: [
      'Practice aspirated vs unaspirated consonants (क vs ख, प vs फ) out loud.',
      'Remember that Hindi verbs sit at the end of the clause (SOV order).',
    ],
    accentColor: '#FB923C',
  },
];

export const NOTE_STYLE_OPTIONS: Array<{
  id: NoteStyleId;
  label: string;
  description: string;
}> = [
  {
    id: 'memory-tricks',
    label: 'Memory Tricks',
    description: 'Mnemonics, vivid hooks & quick recall anchors',
  },
  {
    id: 'funny-examples',
    label: 'Funny Examples',
    description: 'Light, memorable scenarios that stick effortlessly',
  },
  {
    id: 'exam-focus',
    label: 'Exam Focus',
    description: 'High-yield marking keywords & examiner traps',
  },
  {
    id: 'real-world-analogy',
    label: 'Real-World Analogy',
    description: 'Relatable everyday comparisons for deep clarity',
  },
  {
    id: 'quick-summary',
    label: 'Quick Summary',
    description: '60-second revision bullets for fast review',
  },
  {
    id: 'flashcards',
    label: 'Practice Flashcards',
    description: 'Interactive Q&A cards to test active recall',
  },
];

export const EXPLORE_PLUGINS: Array<{
  id: string;
  label: string;
  description: string;
}> = [
  {
    id: 'exam-coach',
    label: 'Exam Coach',
    description: 'Highlights likely exam questions & marking points',
  },
  {
    id: 'step-solver',
    label: 'Step-by-Step Solver',
    description: 'Breaks complex answers into numbered steps',
  },
  {
    id: 'visual-model',
    label: 'Visual Mental Model',
    description: 'Paints vivid diagrams and intuitive analogies',
  },
  {
    id: 'quick-quiz',
    label: 'Quick Quiz Check',
    description: 'Ends explanations with 1–2 quick check questions',
  },
];

export const EXPLORE_SUGGESTIONS: string[] = [
  'Explain photosynthesis simply',
  'What mostly comes in French exams?',
  'Help me understand Newton’s 2nd Law',
  'Give me a memory trick for Japanese particles',
];

export const STARTER_COMMUNITY_POSTS: SharedPost[] = [
  {
    id: 'starter-1',
    author: 'Amina K.',
    authorRole: 'Form 4 · Biology',
    subject: 'Biology',
    kind: 'Memory Trick',
    title: 'ATP = Charged Phone Battery for Cells',
    body: 'Think of ATP as a fully charged battery (3 phosphates). When the cell does work, one phosphate snaps off like spending charge -> ADP + energy! Respiration recharges ADP back into ATP.',
    likes: 24,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'starter-2',
    author: 'Kenji M.',
    authorRole: 'Language Studio · Japanese',
    subject: 'Japanese',
    kind: 'Quick Note',
    title: 'は (wa) vs が (ga) in One Picture',
    body: 'は (wa) puts a spotlight on the stage ("As for today..."), while が (ga) points a laser at the exact actor who did it ("WHO ate the cake? Kenji-san が ate it!").',
    likes: 19,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'starter-3',
    author: 'Daniel O.',
    authorRole: 'Year 11 · Physics',
    subject: 'Physics',
    kind: 'Exam Tip',
    title: 'Never Lose Units Marks in Ohm’s Law',
    body: 'Examiners check three things in V = IR questions: convert mA to Amps (÷ 1000), write the formula before substituting, and include the Ω / A / V unit on the final line.',
    likes: 16,
    createdAt: Date.now() - 3600000 * 14,
  },
];
