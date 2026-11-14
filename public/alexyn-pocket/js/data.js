const DEFAULT_HOSTED_API = 'https://ais-pre-okctcahi2thoggyy6ve3jc-355019958715.europe-west2.run.app';

const GRADE_OPTIONS_BY_LEVEL = {
  Primary: [
    'Grade 1 / Standard 1', 'Grade 2 / Standard 2', 'Grade 3 / Standard 3',
    'Grade 4 / Standard 4', 'Grade 5 / Standard 5', 'Grade 6 / Standard 6',
    'Standard 7', 'Standard 8'
  ],
  Secondary: [
    'Grade 7 / Form 1 / Year 7', 'Grade 8 / Form 2 / Year 8',
    'Grade 9 / Form 3 / Year 9', 'Grade 10 / Form 4 / Year 10',
    'Grade 11 / Year 11', 'Grade 12 / Year 12'
  ],
  College: [
    'Certificate Year 1', 'Diploma Year 1', 'Diploma Year 2',
    'Diploma Year 3', 'Higher National Diploma'
  ],
  University: [
    'Year 1 (Freshman)', 'Year 2 (Sophomore)', 'Year 3 (Junior)',
    'Year 4 (Senior)', 'Year 5+ / Postgraduate'
  ]
};

const CORE_SUBJECTS = [
  { id: 'math', name: 'Mathematics', topics: ['Quadratics & Algebra', 'Trigonometry', 'Calculus & Vectors'], advice: ['Practice 3 mixed past-paper problems daily.', 'Write every intermediate formula step.'] },
  { id: 'english', name: 'English', topics: ['Comprehension & Inference', 'Grammar & Synthesis', 'Essay Writing & Literature'], advice: ['Summarize each paragraph in one short phrase.', 'Use varied connectors and clear topic sentences.'] },
  { id: 'kiswahili', name: 'Kiswahili', topics: ['Insha & Utungaji', 'Sarufi na Matumizi ya Lugha', 'Fasihi Simulizi na Andishi'], advice: ['Soma habari fupi kila siku kujenga msamiati.', 'Hakikisha ngeli na nyakati zinafuatwa ipasavyo.'] },
  { id: 'biology', name: 'Biology', topics: ['Cell Structure & Osmosis', 'Photosynthesis & Respiration', 'Genetics & Evolution'], advice: ['Draw and label key organelles neatly.', 'Link structure directly to biological function.'] },
  { id: 'chemistry', name: 'Chemistry', topics: ['Atomic Structure & Bonding', 'Mole Concept & Stoichiometry', 'Acids, Bases & Salts'], advice: ['Balance equations before doing mole ratios.', 'Group reactions by functional family.'] },
  { id: 'physics', name: 'Physics', topics: ['Motion & Newton Laws', 'Electricity & Ohm Law', 'Waves & Optics'], advice: ['Always write Known -> Formula -> Substitute -> Unit.', 'Check SI units before calculating.'] },
  { id: 'integrated-science', name: 'Integrated Science', topics: ['Matter & Mixtures', 'Energy Transformations', 'Human Health'], advice: ['Connect lab safety and everyday observation.', 'Review apparatus uses and units.'] },
  { id: 'history', name: 'History', topics: ['Early Civilisations', 'Independence Movements', 'World Wars & Global Order'], advice: ['Build timeline anchors with Cause -> Event -> Impact.', 'Compare perspectives in source questions.'] },
  { id: 'geography', name: 'Geography', topics: ['Map Reading & Grid References', 'Climate & Weathering', 'Population & Urbanisation'], advice: ['Practice 6-figure grid coordinates weekly.', 'Always distinguish physical and human factors.'] },
  { id: 'business', name: 'Business Studies', topics: ['Entrepreneurship & Production', 'Double Entry Accounting', 'Marketing & Trade'], advice: ['Practice clean balance sheet formatting.', 'Support points with real small-business examples.'] },
  { id: 'ict', name: 'ICT', topics: ['Computer Hardware & OS', 'Networks & Cybersecurity', 'Spreadsheets & Logic'], advice: ['Memorise Excel IF/SUM/VLOOKUP patterns.', 'Explain data vs information clearly.'] },
  { id: 'cs', name: 'Computer Science', topics: ['Algorithms & Flowcharts', 'Binary & Logic Gates', 'Programming & Databases'], advice: ['Trace loops by hand using a dry-run table.', 'Break big problems into small functions.'] },
  { id: 'economics', name: 'Economics', topics: ['Demand & Supply Equilibrium', 'Market Structures', 'Inflation & Fiscal Policy'], advice: ['Draw fully labelled supply/demand shift curves.', 'Explain short-run vs long-run impacts.'] },
  { id: 'agriculture', name: 'Agriculture & Nutrition', topics: ['Soil Fertility & Conservation', 'Crop & Livestock Husbandry', 'Balanced Nutrition'], advice: ['Link soil pH to nutrient absorption.', 'Know water conservation methods for dry regions.'] },
  { id: 'social', name: 'Social Studies', topics: ['Civic Governance', 'Human Rights & Ethics', 'Regional Trade'], advice: ['Define civic terms accurately.', 'Use current community examples.'] },
  { id: 'csl', name: 'CSL (Community Service)', topics: ['Community Needs Assessment', 'Ethical Leadership & Planning', 'Impact Reflection'], advice: ['Document real observations and community impact honestly.'] },
  { id: 'cre', name: 'Religious Education', topics: ['Sacred Texts & Teachings', 'Ethics & Moral Decisions', 'Values & Stewardship'], advice: ['Cite specific principles to back moral arguments.', 'Compare values across units.'] },
  { id: 'arts', name: 'Creative Arts', topics: ['Design Principles', 'Music Rhythm & Notation', 'Visual Composition'], advice: ['Identify line, texture, balance and contrast.', 'Practice steady beat subdivision.'] }
];

const LANGUAGES = [
  { id: 'japanese', name: '🇯🇵 Japanese', topics: ['Hiragana & Katakana', 'Particles (は, が, を, に)', 'Daily Verbs & Politeness'] },
  { id: 'spanish', name: '🇪🇸 Spanish', topics: ['Ser vs Estar', 'Present & Preterite Verbs', 'Travel Conversations'] },
  { id: 'french', name: '🇫🇷 French', topics: ['Passé Composé vs Imparfait', 'Gendered Articles', 'Everyday Expressions'] },
  { id: 'chinese', name: '🇨🇳 Chinese (Mandarin)', topics: ['4 Pinyin Tones', 'Core Radicals & Characters', 'Measure Words (个, 本)'] },
  { id: 'german', name: '🇩🇪 German', topics: ['Noun Cases (Nom/Akk/Dat)', 'Verb-Second Word Order', 'Daily Dialogues'] },
  { id: 'arabic', name: '🇸🇦 Arabic', topics: ['Root Patterns & Script', 'Greetings & Numbers', 'Nominal vs Verbal Sentences'] },
  { id: 'korean', name: '🇰🇷 Korean', topics: ['Hangul Blocks', 'Polite -요 Endings', 'Particles & Numbers'] },
  { id: 'portuguese', name: '🇵🇹 Portuguese', topics: ['Nasal Vowels', 'Verb Conjugations', 'Everyday Phrases'] },
  { id: 'italian', name: '🇮🇹 Italian', topics: ['Articles & Plurals', 'Present Tense Verbs', 'Culture & Travel'] },
  { id: 'hindi', name: '🇮🇳 Hindi', topics: ['Devanagari Script', 'Postpositions', 'Common Conversation'] }
];

const NOTE_STYLES = [
  'Memory Tricks',
  'Funny Examples',
  'Exam Focus',
  'Real-World Analogy',
  'Quick Bullet Summary',
  'Practice Flashcards'
];

const SUBJECT_KEYWORDS = [
  { subject: 'Chemistry', words: ['chemistry', 'titration', 'stoichiometry', 'molarity', 'periodic table', 'ionic bond', 'covalent bond', 'mole concept'] },
  { subject: 'Biology', words: ['biology', 'photosynthesis', 'mitosis', 'meiosis', 'osmosis', 'chloroplast', 'mitochondria', 'genetics', 'punnett'] },
  { subject: 'Physics', words: ['physics', 'newton law', 'ohm law', 'momentum', 'projectile', 'refraction', 'electromagnetic', 'kinematics'] },
  { subject: 'Mathematics', words: ['mathematics', 'quadratic', 'calculus', 'differentiation', 'integration', 'trigonometry', 'logarithm', 'sohcahtoa'] },
  { subject: 'History', words: ['history', 'world war', 'colonialism', 'independence movement'] },
  { subject: 'Geography', words: ['geography', 'plate tectonics', 'contour lines', 'oxbow lake', 'monsoon'] },
  { subject: 'French', words: ['french', 'passé composé', 'passe compose', 'imparfait', 'bonjour'] },
  { subject: 'Japanese', words: ['japanese', 'hiragana', 'katakana', 'kanji'] }
];

const LAB_MODELS = [
  { id: 'atom', label: '⚛ Bohr Atom' },
  { id: 'h2o', label: '💧 H₂O Molecule' },
  { id: 'dna', label: '🧬 DNA Helix' },
  { id: 'cell', label: '🧫 Plant Cell 3D' },
  { id: 'solar', label: '🪐 Planetary Orbits' },
  { id: 'wave', label: '〰 Wave Lattice' },
  { id: 'crystal', label: '💎 3D Octahedron' },
  { id: 'custom', label: '✨ Custom 3D' }
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Object.assign({}, fallback, JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const state = {
  screen: 'welcome',
  subjectTab: 'core',
  activeSubject: null,
  subjectSubView: 'overview',
  subjectChat: [],
  subjectProgress: {},
  voiceActive: false,
  voiceTarget: 'global',
  noteDepth: 'detailed',
  noteStyles: ['Memory Tricks', 'Funny Examples'],
  plugins: { 'step-solver': true, 'exam-coach': true },
  conversations: [
    {
      id: 'c1',
      title: 'Welcome Exploration',
      messages: [
        { role: 'ai', text: 'Welcome to ALEXYN. Ask any question across science, humanities, or world languages.' }
      ]
    }
  ],
  savedNotes: [],
  sharePosts: [
    { id: 'p1', author: 'Amina K.', subject: 'Biology', title: 'ATP = Energy Currency', body: 'Think of ATP as charged phone batteries powering every cell organelle!', likes: 14 },
    { id: 'p2', author: 'Kenji M.', subject: 'Japanese', title: 'Remembering あ vs お', body: 'Look at the loop shape when drawing Hiragana vowels in air 5 times before writing.', likes: 11 }
  ],
  labModel: 'atom',
  custom3DTopic: '3D Torus Knot Geometry',
  labChat: [{ role: 'ai', text: 'Tap "Can you teach me this?" or ask any question about this 3D model.' }],
  accountMode: 'guest',
  profile: loadJSON('alexyn_pc_profile', {
    mode: 'guest',
    guestConfirmed: false,
    signedIn: false,
    name: '',
    email: '',
    country: 'Kenya',
    curriculum: 'CBC (Competency Based)',
    educationLevel: 'Secondary',
    grade: 'Grade 10 / Form 4 / Year 10'
  }),
  settings: loadJSON('alexyn_pc_settings', {
    voiceLang: 'en-US',
    defaultNoteDepth: 'detailed',
    autoScrollKeyboard: true,
    serverUrl: DEFAULT_HOSTED_API
  })
};
