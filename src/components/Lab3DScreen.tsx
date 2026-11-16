import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Atom,
  BookOpen,
  Compass,
  Cpu,
  Dna,
  Droplets,
  Eraser,
  FileText,
  Flame,
  Globe,
  Headphones,
  HeartPulse,
  Languages,
  Leaf,
  LineChart,
  Loader2,
  MessageSquareText,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Shapes,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  computeCircuitMetrics,
  computeForceMotion,
  computeGeometryMetrics,
  detectDifferentSubjectWarning,
  extractPureTargetSpeechText,
  getAtomElementInfo,
  getSpeechLangForSubject,
  speakWithBrowserTTS,
  stopBrowserTTS,
  type MathShapeKind,
} from '../utils/alexynLogic';
import type {
  AITutorSettings,
  EducationProfile,
  LabModelId,
  LabSubjectCategory,
  SubjectItem,
} from '../types/alexyn';

interface Lab3DScreenProps {
  profile: EducationProfile;
  aiSettings?: AITutorSettings;
  initialModelId?: LabModelId | null;
  onMakeLabNotes: (topic: string, subject: string) => void;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
}

interface LabModelMeta {
  id: LabModelId;
  category: LabSubjectCategory;
  label: string;
  subject: string;
  formula: string;
  description: string;
  quickPrompts: string[];
  icon: typeof Atom;
}

const LAB_CATEGORIES: Array<{
  id: LabSubjectCategory;
  label: string;
}> = [
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'biology', label: 'Biology' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'physics', label: 'Physics' },
  { id: 'languages', label: 'Languages' },
  { id: 'ict', label: 'ICT & Computing' },
  { id: 'humanities', label: 'Economics & Humanities' },
  { id: 'custom', label: 'Custom Topic' },
];

const LAB_MODELS: LabModelMeta[] = [
  {
    id: 'math-shapes',
    category: 'mathematics',
    label: '2D & 3D Geometry',
    subject: 'Mathematics',
    formula: 'V − E + F = 2',
    description:
      'Switch between triangles, rectangles, circles, cubes, pyramids, and octahedrons. Adjust size & angles while viewing live area, perimeter, and volume.',
    quickPrompts: [
      'Explain how surface area differs from volume on this shape',
      'Teach me Euler’s formula V - E + F = 2 simply',
    ],
    icon: Shapes,
  },
  {
    id: 'math-graph',
    category: 'mathematics',
    label: 'Coordinate Graphs',
    subject: 'Mathematics',
    formula: 'y = ax² + bx + c',
    description:
      'Explore Cartesian coordinates and plot linear, quadratic, or sine curves. Adjust slope/amplitude and y-intercept live.',
    quickPrompts: [
      'How do slope and y-intercept change a linear graph?',
      'Explain turning points and roots of a quadratic parabola',
    ],
    icon: LineChart,
  },
  {
    id: 'math-draw',
    category: 'mathematics',
    label: 'Draw & Annotate',
    subject: 'Mathematics',
    formula: 'Interactive Canvas',
    description:
      'Sketch geometric constructions, label angles, or plot coordinates directly inside the workspace with optional coordinate gridlines.',
    quickPrompts: [
      'Give me a geometry construction challenge to sketch',
      'How do alternate and corresponding angles work on parallel lines?',
    ],
    icon: Pencil,
  },
  {
    id: 'bio-cell',
    category: 'biology',
    label: 'Cells & Organelles',
    subject: 'Biology',
    formula: '6CO₂ + 6H₂O → C₆H₁₂O₆',
    description:
      'Switch between Plant and Animal cells, rotate in 3D, and select organelles to inspect how each structure powers life.',
    quickPrompts: [
      'Compare chloroplasts and mitochondria in plain English',
      'Key differences between plant cells and animal cells for exams',
    ],
    icon: Leaf,
  },
  {
    id: 'bio-dna',
    category: 'biology',
    label: 'DNA Helix & Pairing',
    subject: 'Biology',
    formula: 'A=T · C≡G Base Pairs',
    description:
      'Inspect complementary nucleotide strands, hydrogen bonds, and toggle DNA unzipping to see how semi-conservative replication starts.',
    quickPrompts: [
      'Give me a memory trick for A-T and C-G DNA pairing',
      'How does DNA unzip during replication?',
    ],
    icon: Dna,
  },
  {
    id: 'bio-body',
    category: 'biology',
    label: 'Body Systems',
    subject: 'Biology',
    formula: 'O₂ → Lungs → Heart → Body',
    description:
      'Explore double circulation between lungs, heart chambers, and body tissues. Adjust heart rate (BPM) to observe blood flow speed.',
    quickPrompts: [
      'Why does the left ventricle have a thicker muscular wall?',
      'Trace one red blood cell through the heart and lungs',
    ],
    icon: HeartPulse,
  },
  {
    id: 'chem-atom',
    category: 'chemistry',
    label: 'Atom & Shell Builder',
    subject: 'Chemistry',
    formula: '2n² Shell Capacity',
    description:
      'Slide atomic number (1–18) to build real elements from Hydrogen to Argon and see how valence electrons determine reactivity.',
    quickPrompts: [
      'Why do valence electrons decide how an atom bonds?',
      'Explain why noble gases like Neon rarely react',
    ],
    icon: Atom,
  },
  {
    id: 'chem-water',
    category: 'chemistry',
    label: 'Molecules & Bonding',
    subject: 'Chemistry',
    formula: 'Covalent vs Ionic',
    description:
      'Compare H₂O (104.5° polar bent), CO₂ (180° linear), CH₄ (109.5° tetrahedral), and NaCl ionic crystal lattice in 3D.',
    quickPrompts: [
      'Why is H₂O bent at 104.5° while CO₂ is linear?',
      'Compare ionic electron transfer vs covalent electron sharing',
    ],
    icon: Droplets,
  },
  {
    id: 'chem-reaction',
    category: 'chemistry',
    label: 'Chemical Reactions',
    subject: 'Chemistry',
    formula: 'Reactants → Products',
    description:
      'Adjust reaction progress and temperature/collision energy to visualize how bonds break and new balanced products form.',
    quickPrompts: [
      'What happens to energy during an exothermic reaction?',
      'How do you balance chemical equations step by step?',
    ],
    icon: Flame,
  },
  {
    id: 'phys-forces',
    category: 'physics',
    label: 'Forces & Motion',
    subject: 'Physics',
    formula: 'F_net = m · a',
    description:
      'Experiment with ramp incline angle, block mass, applied force, and surface friction while watching live force vectors and acceleration.',
    quickPrompts: [
      'Explain normal force and friction on an inclined plane',
      'How does Newton’s 2nd Law F = ma work here?',
    ],
    icon: Compass,
  },
  {
    id: 'phys-wave',
    category: 'physics',
    label: 'Waves & Energy',
    subject: 'Physics',
    formula: 'v = f · λ',
    description:
      'Switch between transverse and longitudinal waves, tune frequency and amplitude, and observe wavelength and particle oscillation.',
    quickPrompts: [
      'Explain frequency vs wavelength using an everyday analogy',
      'Difference between transverse and longitudinal waves',
    ],
    icon: Radio,
  },
  {
    id: 'phys-circuit',
    category: 'physics',
    label: 'Electricity & Circuits',
    subject: 'Physics',
    formula: 'V = I · R · P = V·I',
    description:
      'Toggle Series vs Parallel resistors, flip the circuit switch, and tune voltage & resistance to see live current flow and bulb glow.',
    quickPrompts: [
      'Why is total resistance lower in parallel than in series?',
      'Explain Ohm’s Law V = I·R with a water-pipe analogy',
    ],
    icon: Zap,
  },
  {
    id: 'phys-solar',
    category: 'physics',
    label: 'Planetary Orbits',
    subject: 'Physics',
    formula: 'T² ∝ r³ (Kepler III)',
    description:
      'Watch inner planets sweep faster orbital arcs near the Sun while outer planets travel wider gravitational paths.',
    quickPrompts: [
      'Why don’t orbiting planets fall straight into the Sun?',
      'Explain Kepler’s Third Law simply',
    ],
    icon: Compass,
  },
  {
    id: 'lang-practice',
    category: 'languages',
    label: 'Language Practice Studio',
    subject: 'Languages',
    formula: 'Speak · Listen · Read · Grammar',
    description:
      'Practise English, Kiswahili, and world languages through vocabulary pronunciation, listening comprehension, grammar drills, reading passages, and guided conversation.',
    quickPrompts: [
      'Give me 3 natural expressions in this language with English meanings',
      'Explain a key grammar rule learners mix up in this language',
    ],
    icon: Languages,
  },
  {
    id: 'ict-logic',
    category: 'ict',
    label: 'Logic Gates & Binary Lab',
    subject: 'ICT & Computer Science',
    formula: 'AND · OR · XOR · 8-Bit Binary',
    description:
      'Flip binary input switches (0/1), inspect live AND/OR/XOR/NAND output LEDs, and convert 8-bit binary bytes into decimal & hexadecimal.',
    quickPrompts: [
      'Explain the difference between OR and XOR logic gates simply',
      'How do you convert an 8-bit binary number into decimal?',
    ],
    icon: Cpu,
  },
  {
    id: 'econ-supply',
    category: 'humanities',
    label: 'Supply & Demand Curve',
    subject: 'Economics & Business',
    formula: 'Equilibrium: Q_d = Q_s',
    description:
      'Shift market Demand & Supply curves interactively to see how equilibrium price (P*) and quantity (Q*) adjust.',
    quickPrompts: [
      'Why does a price floor above equilibrium cause a surplus?',
      'Explain what shifts the demand curve vs movement along the curve',
    ],
    icon: TrendingUp,
  },
  {
    id: 'geo-globe',
    category: 'humanities',
    label: '3D Earth & Map Grids',
    subject: 'Geography',
    formula: '6-Figure Grid Reference',
    description:
      'Rotate a 3D latitude/longitude globe with tectonic arcs and practice reading 6-figure Eastings & Northings.',
    quickPrompts: [
      'How do you read a 6-figure grid reference accurately?',
      'Compare constructive and destructive tectonic plate boundaries',
    ],
    icon: Globe,
  },
  {
    id: 'humanities-practice',
    category: 'humanities',
    label: 'Concepts, Sources & Essays',
    subject: 'Humanities & Social Studies',
    formula: 'Claim · Evidence · Analysis',
    description:
      'Practise interpreting historical and literary sources, structuring PEEL paragraphs, and testing civic or ethical reasoning without unnecessary graphs.',
    quickPrompts: [
      'Show me how to write a strong PEEL exam paragraph on this topic',
      'How do I evaluate primary historical or literary evidence?',
    ],
    icon: FileText,
  },
  {
    id: 'custom',
    category: 'custom',
    label: 'Custom Topic Practice',
    subject: 'Any Unlimited Topic',
    formula: 'Interactive Practice + Tutor',
    description:
      'Type ANY concept—Mitochondria, Benzene Ring, Pendulum, Black Hole, Volcano—to render a live visual & practise with the AI tutor.',
    quickPrompts: [
      'Teach me this custom topic step by step',
      'Give me an exam question on this concept',
    ],
    icon: Sparkles,
  },
];

interface LanguagePackItem {
  label: string;
  vocab: Array<{ term: string; english: string; phonetic: string }>;
  sentenceTarget: string;
  sentenceEnglish: string;
  tokens: string[];
  listening: Array<{
    spokenText: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  grammarDrills: Array<{
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  reading: {
    title: string;
    passage: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  conversation: {
    speakerLine: string;
    speakerMeaning: string;
    goalPrompt: string;
  };
}

const LANGUAGE_PACKS: Record<string, LanguagePackItem> = {
  English: {
    label: 'English',
    vocab: [
      { term: 'Consequently', english: 'As a result (formal essay linker)', phonetic: 'KON-suh-kwunt-lee' },
      { term: 'Notwithstanding', english: 'In spite of / although', phonetic: 'not-with-STAN-ding' },
      { term: 'Elaborate carefully', english: 'Explain in clear detail', phonetic: 'ih-LAB-uh-rayt' },
      { term: 'Resilient attitude', english: 'Able to recover quickly from challenges', phonetic: 'rih-ZIL-yunt' },
    ],
    sentenceTarget: 'Neither the teacher nor the students were late',
    sentenceEnglish: 'Subject-verb agreement with neither/nor',
    tokens: ['the students', 'Neither', 'were', 'the teacher nor', 'late'],
    listening: [
      {
        spokenText: 'Good morning, class. Before submitting your laboratory report, check that every variable is clearly labelled.',
        question: 'What does the speaker instruct learners to verify before submitting?',
        options: [
          'That every variable is clearly labelled',
          'That the cover page is printed in colour',
          'That everyone works silently in pairs',
          'That only the conclusion is written',
        ],
        correctIndex: 0,
        explanation: 'The speaker specifically asks students to check that every variable is clearly labelled before submission.',
      },
      {
        spokenText: 'Although heavy rain delayed the morning train, the debate team arrived ten minutes before opening remarks.',
        question: 'Did the debate team miss the start of the event?',
        options: [
          'No, they arrived ten minutes early',
          'Yes, they arrived after opening remarks',
          'No, the debate was postponed',
          'Yes, because the train was cancelled',
        ],
        correctIndex: 0,
        explanation: '"Arrived ten minutes before opening remarks" means they made it on time despite the rain delay.',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Choose the grammatically accurate sentence:',
        options: [
          'Each of the candidates has submitted a polished portfolio.',
          'Each of the candidates have submitted a polished portfolio.',
          'Each of the candidate are submitting a polished portfolio.',
          'Each of the candidates were submitted a polished portfolio.',
        ],
        correctIndex: 0,
        explanation: 'The indefinite pronoun "Each" is singular, so it takes the singular verb "has".',
      },
      {
        prompt: 'Which transition best shows contrast between two ideas?',
        options: ['Nevertheless', 'Furthermore', 'Therefore', 'Similarly'],
        correctIndex: 0,
        explanation: '"Nevertheless" signals contrast, whereas the others add or show cause/similarity.',
      },
    ],
    reading: {
      title: 'Effective Academic Summaries',
      passage:
        'A concise summary captures the writer’s central thesis in the reader’s own words while omitting minor anecdotes. Strong candidates identify topic sentences first, group supporting evidence under broad themes, and avoid copying whole lines verbatim.',
      question: 'According to the passage, what should a writer leave out of a concise summary?',
      options: [
        'Minor anecdotes',
        'The central thesis',
        'Key supporting themes',
        'Their own wording',
      ],
      correctIndex: 0,
      explanation: 'The passage explicitly states that a strong summary omits minor anecdotes while keeping the central thesis.',
    },
    conversation: {
      speakerLine: 'Could you clarify why community libraries remain essential in the digital era?',
      speakerMeaning: 'Polite academic interview / oral skills question',
      goalPrompt: 'Reply in 1–2 clear, formal English sentences with one supporting reason.',
    },
  },
  Kiswahili: {
    label: 'Kiswahili',
    vocab: [
      { term: 'Habari za asubuhi?', english: 'How is your morning?', phonetic: 'ha-BAH-ree zah ah-soo-BOO-hee' },
      { term: 'Ninajifunza Kiswahili sanifu', english: 'I am learning standard Kiswahili', phonetic: 'nee-na-jee-FOON-za sah-NEE-foo' },
      { term: 'Tafadhali rudia polepole', english: 'Please repeat slowly', phonetic: 'ta-fa-DHAH-lee roo-DEE-ah' },
      { term: 'Mwanafunzi mwenye bidii', english: 'A diligent / hardworking student', phonetic: 'mwa-na-FOON-zee' },
    ],
    sentenceTarget: 'Mwanafunzi hodari anasoma kitabu darasani',
    sentenceEnglish: 'The diligent student is reading a book in class',
    tokens: ['kitabu', 'Mwanafunzi', 'darasani', 'anasoma', 'hodari'],
    listening: [
      {
        spokenText: 'Shikamoo mwalimu! Leo tutafanya mazoezi ya ngeli za nomino na ufahamu darasani.',
        question: 'Wanafunzi watafanya mazoezi yapi darasani leo?',
        options: [
          'Ngeli za nomino na ufahamu',
          'Hesabu za sehemu na jiometria',
          'Michezo ya riadha uwanjani',
          'Kupika chakula cha jioni',
        ],
        correctIndex: 0,
        explanation: 'Mzungumzaji anataja wazi "mazoezi ya ngeli za nomino na ufahamu".',
      },
      {
        spokenText: 'Kila asubuhi, Amina huamka saa kumi na mbili kasoro robo ili awahi shuleni mapema.',
        question: 'Kwa nini Amina huamka mapema kila asubuhi?',
        options: [
          'Ili awahi shuleni mapema',
          'Ili aende sokoni',
          'Kwa sababu anasafiri usiku',
          'Ili atazame televisheni',
        ],
        correctIndex: 0,
        explanation: 'Sentensi inasema "ili awahi shuleni mapema".',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Chagua sentensi iliyo na upatanisho sahihi wa kisarufi (Ngeli ya KI-VI):',
        options: [
          'Kitabu kizuri kimenunuliwa na mwalimu.',
          'Kitabu mzuri amenunuliwa na mwalimu.',
          'Kitabu wazuri wamenunuliwa na mwalimu.',
          'Kitabu zuri zimenunuliwa na mwalimu.',
        ],
        correctIndex: 0,
        explanation: 'Nomino "kitabu" imo katika ngeli ya KI-VI (umoja), kwa hivyo huchukua kiambishi "ki-": kizuri kimenunuliwa.',
      },
      {
        prompt: 'Katika methali "Haraka haraka haina baraka", maana yake kuu ni ipi?',
        options: [
          'Kufanya mambo kwa pupa huweza kuleta hasara au makosa',
          'Ni lazima kukimbia haraka kila asubuhi',
          'Baraka huja tu unaposafiri mbio',
          'Hakuna haja ya kupanga ratiba',
        ],
        correctIndex: 0,
        explanation: 'Methali hii hufundisha umuhimu wa utulivu na umakini badala ya papara.',
      },
    ],
    reading: {
      title: 'Umuhimu wa Utunzaji wa Mazingira',
      passage:
        'Upandaji wa miti husaidia kuzuia mmomonyoko wa udongo, kuhifadhi vyanzo vya maji, na kupunguza ongezeko la joto duniani. Wanafunzi wanaposhiriki katika klabu za mazingira shuleni, hujifunza uwajibikaji wa pamoja kwa jamii yao.',
      question: 'Kulingana na kifungu, upandaji wa miti husaidia kufanya nini?',
      options: [
        'Kuzuia mmomonyoko wa udongo na kuhifadhi maji',
        'Kuongeza kelele mijini',
        'Kupunguza mvua mashambani',
        'Kuzima taa za darasani',
      ],
      correctIndex: 0,
      explanation: 'Kifungu kinataja kuzuia mmomonyoko wa udongo, kuhifadhi vyanzo vya maji, na kupunguza ongezeko la joto.',
    },
    conversation: {
      speakerLine: 'Hujambo! Unaweza kujitambulisha na kueleza somo unalolipenda zaidi?',
      speakerMeaning: 'Hello! Can you introduce yourself and share your favourite subject?',
      goalPrompt: 'Jibu kwa Kiswahili fasaha (sentensi 1–2 kuhusu jina lako na somo unalopenda).',
    },
  },
  French: {
    label: 'French',
    vocab: [
      { term: 'Bonjour', english: 'Hello / Good morning', phonetic: 'bohn-ZHOOR' },
      { term: 'Je voudrais étudier', english: 'I would like to study', phonetic: 'zhuh voo-DREH ay-too-DYAY' },
      { term: 'Merci beaucoup', english: 'Thank you very much', phonetic: 'mehr-SEE boh-KOO' },
      { term: 'Quelle heure est-il ?', english: 'What time is it?', phonetic: 'kel ur eh-TEEL' },
    ],
    sentenceTarget: 'Je comprends la leçon',
    sentenceEnglish: 'I understand the lesson',
    tokens: ['la', 'comprends', 'Je', 'leçon'],
    listening: [
      {
        spokenText: 'Bonjour, je m’appelle Camille et j’étudie la biologie au lycée.',
        question: 'What subject does Camille study at high school?',
        options: ['Biology', 'History', 'Chemistry', 'Geography'],
        correctIndex: 0,
        explanation: '"J’étudie la biologie" means "I study biology".',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Which auxiliary does "aller" (to go) take in the passé composé?',
        options: ['être (je suis allé)', 'avoir (j’ai allé)', 'faire', 'venir'],
        correctIndex: 0,
        explanation: '"Aller" is a DR MRS VANDERTRAMP movement verb, so it uses "être".',
      },
    ],
    reading: {
      title: 'À la bibliothèque',
      passage:
        'Chaque mardi après-midi, Lucas va à la bibliothèque scolaire pour réviser ses notes de français avec ses camarades. Ils préparent un dialogue oral sur les voyages.',
      question: 'When does Lucas go to the school library?',
      options: ['Every Tuesday afternoon', 'Every Sunday morning', 'Only during exams', 'Every Monday evening'],
      correctIndex: 0,
      explanation: '"Chaque mardi après-midi" means "every Tuesday afternoon".',
    },
    conversation: {
      speakerLine: 'Bonjour ! Comment ça va aujourd’hui, et qu’est-ce que tu étudies ?',
      speakerMeaning: 'Hello! How are you today, and what are you studying?',
      goalPrompt: 'Reply politely in 1–2 French sentences.',
    },
  },
  Spanish: {
    label: 'Spanish',
    vocab: [
      { term: 'Buenos días', english: 'Good morning', phonetic: 'BWEH-nos DEE-as' },
      { term: 'Estoy aprendiendo', english: 'I am learning', phonetic: 'es-TOY ah-pren-DYEN-do' },
      { term: '¿Cómo estás?', english: 'How are you?', phonetic: 'KO-mo es-TAS' },
      { term: 'Muchas gracias', english: 'Thank you very much', phonetic: 'MOO-chas GRAH-syas' },
    ],
    sentenceTarget: 'Me gusta estudiar español',
    sentenceEnglish: 'I like studying Spanish',
    tokens: ['estudiar', 'gusta', 'español', 'Me'],
    listening: [
      {
        spokenText: 'Hola, mañana tenemos un examen de matemáticas a las nueve de la mañana.',
        question: 'At what time is the mathematics exam tomorrow?',
        options: ['9:00 AM', '11:00 AM', '2:00 PM', '8:00 AM'],
        correctIndex: 0,
        explanation: '"A las nueve de la mañana" translates to 9:00 AM.',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Choose the correct verb for expressing current location ("We are in Madrid"):',
        options: ['Estamos en Madrid', 'Somos en Madrid', 'Hay en Madrid', 'Vamos en Madrid'],
        correctIndex: 0,
        explanation: 'Physical location always uses "estar" (Estamos), never "ser".',
      },
    ],
    reading: {
      title: 'El fin de semana',
      passage:
        'Los sábados por la mañana, Sofía practica vocabulario en español y escucha música latina para mejorar su pronunciación.',
      question: 'Why does Sofía listen to music on Saturday mornings?',
      options: ['To improve her pronunciation', 'To cook lunch', 'To learn driving rules', 'To sleep earlier'],
      correctIndex: 0,
      explanation: '"Para mejorar su pronunciación" means "to improve her pronunciation".',
    },
    conversation: {
      speakerLine: '¡Hola! ¿Cuál es tu materia favorita en la escuela?',
      speakerMeaning: 'Hi! What is your favourite subject at school?',
      goalPrompt: 'Answer in Spanish using "Mi materia favorita es..."',
    },
  },
  Japanese: {
    label: 'Japanese',
    vocab: [
      { term: 'おはようございます', english: 'Good morning', phonetic: 'ohayō gozaimasu' },
      { term: 'わかりました', english: 'I understood', phonetic: 'wakarimashita' },
      { term: 'ありがとうございます', english: 'Thank you', phonetic: 'arigatō gozaimasu' },
      { term: '日本語を勉強します', english: 'I study Japanese', phonetic: 'nihongo o benkyō shimasu' },
    ],
    sentenceTarget: 'わたし は がくせい です',
    sentenceEnglish: 'I am a student',
    tokens: ['です', 'わたし', 'がくせい', 'は'],
    listening: [
      {
        spokenText: 'こんにちは。わたし の なまえ は けんじ です。にほんご が すき です。',
        question: 'What is the speaker’s name?',
        options: ['Kenji', 'Yuki', 'Sakura', 'Haru'],
        correctIndex: 0,
        explanation: '"わたしのなまえはけんじです" means "My name is Kenji."',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Which particle marks the direct object of an action (e.g., reading a book)?',
        options: ['を (o)', 'に (ni)', 'へ (e)', 'の (no)'],
        correctIndex: 0,
        explanation: 'を (pronounced "o") marks the direct object receiving the verb.',
      },
    ],
    reading: {
      title: 'がっこうの いちにち',
      passage:
        'あさ はちじ に がっこう へ いきます。ごぜんちゅう は すうがく と りか を べんきょう します。',
      question: 'What time does the student go to school?',
      options: ['8:00 AM (はちじ)', '10:00 AM', '6:00 AM', '12:00 PM'],
      correctIndex: 0,
      explanation: 'あさ はちじ (asa hachi-ji) means 8:00 AM.',
    },
    conversation: {
      speakerLine: 'はじめまして！おなまえ は なん です か。',
      speakerMeaning: 'Nice to meet you! What is your name?',
      goalPrompt: 'Reply politely in Japanese (e.g. "わたしは [name] です").',
    },
  },
  'Chinese (Mandarin)': {
    label: 'Chinese (Mandarin)',
    vocab: [
      { term: '你好', english: 'Hello', phonetic: 'nǐ hǎo' },
      { term: '谢谢你', english: 'Thank you', phonetic: 'xièxie nǐ' },
      { term: '我在学习中文', english: 'I am studying Chinese', phonetic: 'wǒ zài xuéxí Zhōngwén' },
      { term: '请再说一遍', english: 'Please say that again', phonetic: 'qǐng zài shuō yíbiàn' },
    ],
    sentenceTarget: '我 喜欢 学习 中文',
    sentenceEnglish: 'I like studying Chinese',
    tokens: ['学习', '我', '中文', '喜欢'],
    listening: [
      {
        spokenText: '你好，我叫林娜，我每天早上七点去学校。',
        question: 'At what time does Lin Na go to school every morning?',
        options: ['7:00 AM', '9:00 AM', '6:00 AM', '8:30 AM'],
        correctIndex: 0,
        explanation: '"早上七点" means 7 o’clock in the morning.',
      },
    ],
    grammarDrills: [
      {
        prompt: 'Which measure word fits books (书 shū)?',
        options: ['本 (běn)', '只 (zhī)', '杯 (bēi)', '件 (jiàn)'],
        correctIndex: 0,
        explanation: '本 (běn) is used for bound items such as books and notebooks (一本书).',
      },
    ],
    reading: {
      title: '我的学校生活',
      passage: '星期一我有中文课和科学课。放学以后，我和朋友一起在图书馆看书。',
      question: 'Where do the friends read books after school?',
      options: ['In the library (图书馆)', 'At the train station', 'At home alone', 'In the cafeteria'],
      correctIndex: 0,
      explanation: '在图书馆看书 means reading books in the library.',
    },
    conversation: {
      speakerLine: '你好！你今天学习什么科目？',
      speakerMeaning: 'Hello! What subject are you studying today?',
      goalPrompt: 'Reply in Chinese (e.g. "我今天学习...").',
    },
  },
  German: {
    label: 'German',
    vocab: [
      { term: 'Guten Morgen', english: 'Good morning', phonetic: 'GOO-ten MOR-gen' },
      { term: 'Ich lerne Deutsch', english: 'I am learning German', phonetic: 'ikh LER-nuh doytch' },
      { term: 'Vielen Dank', english: 'Many thanks', phonetic: 'FEE-len dahnk' },
      { term: 'Verstehen Sie?', english: 'Do you understand?', phonetic: 'fer-SHTEH-en zee' },
    ],
    sentenceTarget: 'Ich lese ein interessantes Buch',
    sentenceEnglish: 'I am reading an interesting book',
    tokens: ['Buch', 'lese', 'Ich', 'ein interessantes'],
    listening: [
      {
        spokenText: 'Guten Tag! Am Freitag schreiben wir einen kurzen Test über Grammatik.',
        question: 'What happens on Friday?',
        options: ['A short grammar test', 'A sports tournament', 'A museum trip', 'A school holiday'],
        correctIndex: 0,
        explanation: '"Einen kurzen Test über Grammatik" means a short test about grammar.',
      },
    ],
    grammarDrills: [
      {
        prompt: 'In German main clauses, where does the conjugated verb normally sit?',
        options: ['Second position (V2)', 'Always last', 'Always fourth', 'Never conjugated'],
        correctIndex: 0,
        explanation: 'German declarative main clauses follow strict V2 (verb-second) word order.',
      },
    ],
    reading: {
      title: 'In der Schule',
      passage: 'Montags beginnt der Unterricht um acht Uhr. Nach dem Mittagessen arbeitet Jonas an seinem Projekt.',
      question: 'What time do lessons begin on Mondays?',
      options: ['8:00 AM (acht Uhr)', '10:00 AM', '7:00 AM', '1:00 PM'],
      correctIndex: 0,
      explanation: '"Um acht Uhr" means at 8 o’clock.',
    },
    conversation: {
      speakerLine: 'Hallo! Wie heißt du und was lernst du gern?',
      speakerMeaning: 'Hi! What is your name and what do you like learning?',
      goalPrompt: 'Respond in 1–2 German sentences.',
    },
  },
  Arabic: {
    label: 'Arabic',
    vocab: [
      { term: 'صباح الخير', english: 'Good morning', phonetic: 'sa-BAH al-khayr' },
      { term: 'أتعلم اللغة العربية', english: 'I am learning Arabic', phonetic: 'a-ta-AL-lam al-lugha al-arabiyya' },
      { term: 'شكراً جزيلاً', english: 'Thank you very much', phonetic: 'shuk-ran ja-zee-lan' },
      { term: 'هل يمكنك المساعدة؟', english: 'Can you help?', phonetic: 'hal yum-ki-nu-ka al-mu-saa-a-da' },
    ],
    sentenceTarget: 'أنا أقرأ كتاباً مفيداً',
    sentenceEnglish: 'I am reading a useful book',
    tokens: ['مفيداً', 'أقرأ', 'أنا', 'كتاباً'],
    listening: [
      {
        spokenText: 'مرحباً، اسمي طارق وأحب دراسة العلوم والرياضيات في المدرسة.',
        question: 'Which two subjects does Tariq enjoy studying?',
        options: ['Science and Mathematics', 'Art and Music', 'History and Law', 'Geography and Drama'],
        correctIndex: 0,
        explanation: '"العلوم والرياضيات" means Science and Mathematics.',
      },
    ],
    grammarDrills: [
      {
        prompt: 'What is a nominal sentence (جملة اسمية) in Arabic?',
        options: [
          'A sentence beginning with a noun/pronoun (Subject + Predicate)',
          'A sentence that only uses numbers',
          'A sentence without any nouns',
          'A question ending with a verb only',
        ],
        correctIndex: 0,
        explanation: 'A جملة اسمية begins with a noun (مبتدأ) followed by a predicate (خبر).',
      },
    ],
    reading: {
      title: 'القراءة اليومية',
      passage: 'تساعد القراءة اليومية الطلاب على تنمية المفردات وفهم النصوص بسرعة أكبر.',
      question: 'What benefit of daily reading is mentioned?',
      options: [
        'Growing vocabulary and faster comprehension',
        'Forgetting grammar rules',
        'Sleeping fewer hours',
        'Avoiding exams',
      ],
      correctIndex: 0,
      explanation: 'تنمية المفردات وفهم النصوص بسرعة means growing vocabulary and understanding texts faster.',
    },
    conversation: {
      speakerLine: 'أهلاً بك! ما هو اسمك وماذا تتعلم اليوم؟',
      speakerMeaning: 'Welcome! What is your name and what are you learning today?',
      goalPrompt: 'Reply in 1–2 Arabic sentences.',
    },
  },
};

const ORGANELLES = [
  {
    id: 'nucleus',
    name: 'Nucleus',
    role: 'Control center storing DNA and coordinating protein synthesis and cell division.',
  },
  {
    id: 'mitochondria',
    name: 'Mitochondria',
    role: 'Powerhouse carrying out aerobic respiration to produce ATP energy.',
  },
  {
    id: 'chloroplast',
    name: 'Chloroplast (Plant)',
    role: 'Captures sunlight using chlorophyll to convert CO₂ + H₂O into glucose.',
  },
  {
    id: 'vacuole',
    name: 'Central Vacuole',
    role: 'Stores cell sap and maintains turgor pressure so plant stems stay upright.',
  },
] as const;

function resolveCategoryForSubject(subj?: SubjectItem): LabSubjectCategory {
  if (!subj) return 'mathematics';
  const low = subj.name.toLowerCase();
  if (low.includes('math')) return 'mathematics';
  if (low.includes('bio')) return 'biology';
  if (low.includes('chem')) return 'chemistry';
  if (low.includes('phys')) return 'physics';
  if (low.includes('ict') || low.includes('computer')) return 'ict';
  if (
    low.includes('econom') ||
    low.includes('business') ||
    low.includes('geog') ||
    low.includes('histor') ||
    low.includes('literat') ||
    low.includes('csl')
  ) {
    return 'humanities';
  }
  if (subj.category === 'language' || low.includes('english') || low.includes('kiswahili')) {
    return 'languages';
  }
  return 'custom';
}

function project3D(
  x: number,
  y: number,
  z: number,
  rotX: number,
  rotY: number,
  zoom: number,
  cx: number,
  cy: number
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x * cosY - z * sinY;
  const z1 = z * cosY + x * sinY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y * cosX - z1 * sinX;
  const z2 = z1 * cosX + y * sinX;

  const scale = (360 * zoom) / (360 + z2);
  return {
    sx: cx + x1 * scale,
    sy: cy + y2 * scale,
    scale,
    depth: z2,
  };
}

interface LabChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function Lab3DScreen({
  profile,
  aiSettings,
  initialModelId,
  onMakeLabNotes,
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
}: Lab3DScreenProps) {
  const initialCategory: LabSubjectCategory = (() => {
    if (initialModelId) {
      const m = LAB_MODELS.find((item) => item.id === initialModelId);
      if (m) return m.category;
    }
    return scopedSubject ? resolveCategoryForSubject(scopedSubject) : 'mathematics';
  })();

  const initialModel: LabModelId = (() => {
    if (initialModelId && LAB_MODELS.some((m) => m.id === initialModelId)) {
      return initialModelId;
    }
    if (scopedSubject) {
      const low = scopedSubject.name.toLowerCase();
      if (low.includes('geog')) return 'geo-globe';
      if (low.includes('econom') || low.includes('business')) return 'econ-supply';
      if (
        low.includes('histor') ||
        low.includes('literat') ||
        low.includes('csl') ||
        low.includes('religious') ||
        low.includes('creative')
      ) {
        return 'humanities-practice';
      }
    }
    const catModel = LAB_MODELS.find((m) => m.category === initialCategory);
    return catModel ? catModel.id : 'math-shapes';
  })();

  const [activeCategory, setActiveCategory] = useState<LabSubjectCategory>(initialCategory);
  const [activeModel, setActiveModel] = useState<LabModelId>(initialModel);
  const [customConcept, setCustomConcept] = useState(
    scopedSubject ? `${scopedSubject.name} Model` : 'Benzene Ring Structure'
  );
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  // Math Lab states
  const [mathShape, setMathShape] = useState<MathShapeKind>('octahedron');
  const [mathSize, setMathSize] = useState(6);
  const [mathAngle, setMathAngle] = useState(60);
  const [graphKind, setGraphKind] = useState<'linear' | 'quadratic' | 'sine'>('quadratic');
  const [graphA, setGraphA] = useState(1);
  const [graphC, setGraphC] = useState(-1);
  const [drawGrid, setDrawGrid] = useState(true);
  const [penColor, setPenColor] = useState('#38BDF8');

  // Biology Lab states
  const [cellType, setCellType] = useState<'plant' | 'animal'>('plant');
  const [selectedOrganelle, setSelectedOrganelle] = useState<string>('chloroplast');
  const [dnaUnzip, setDnaUnzip] = useState(false);
  const [heartBpm, setHeartBpm] = useState(72);

  // Chemistry Lab states
  const [electronCount, setElectronCount] = useState(6);
  const [moleculeKind, setMoleculeKind] = useState<'h2o' | 'co2' | 'ch4' | 'nacl'>('h2o');
  const [reactionProgress, setReactionProgress] = useState(45);

  // Physics Lab states
  const [rampMass, setRampMass] = useState(4);
  const [rampAngle, setRampAngle] = useState(25);
  const [appliedForce, setAppliedForce] = useState(30);
  const [frictionCoeff, setFrictionCoeff] = useState(0.15);
  const [waveType, setWaveType] = useState<'transverse' | 'longitudinal'>('transverse');
  const [waveFreq, setWaveFreq] = useState(2.2);
  const [waveAmp, setWaveAmp] = useState(42);
  const [circuitMode, setCircuitMode] = useState<'series' | 'parallel'>('series');
  const [circuitVoltage, setCircuitVoltage] = useState(12);
  const [circuitR1, setCircuitR1] = useState(4);
  const [circuitR2, setCircuitR2] = useState(6);
  const [circuitClosed, setCircuitClosed] = useState(true);

  // Interactive Language Studio state
  const defaultPracticeLang =
    scopedSubject && LANGUAGE_PACKS[scopedSubject.name] ? scopedSubject.name : 'English';
  const [practiceLang, setPracticeLang] = useState<string>(defaultPracticeLang);
  const [langTab, setLangTab] = useState<
    'vocab' | 'listening' | 'grammar' | 'reading' | 'conversation'
  >('vocab');
  const [builtTokens, setBuiltTokens] = useState<string[]>([]);
  const [sentenceFeedback, setSentenceFeedback] = useState<string | null>(null);
  const [translationPrompt, setTranslationPrompt] = useState('');
  const [checkingTranslation, setCheckingTranslation] = useState(false);
  const [translationResult, setTranslationResult] = useState<{
    isNatural: boolean;
    corrected: string;
    englishMeaning: string;
    feedback: string;
  } | null>(null);
  const [listeningAnswers, setListeningAnswers] = useState<Record<number, number>>({});
  const [grammarAnswers, setGrammarAnswers] = useState<Record<number, number>>({});
  const [readingAnswer, setReadingAnswer] = useState<number | null>(null);
  const [speakingTargetTerm, setSpeakingTargetTerm] = useState<string | null>(null);
  const [spokenHeardText, setSpokenHeardText] = useState<string>('');
  const [spokenResultFeedback, setSpokenResultFeedback] = useState<string | null>(null);

  // Humanities non-graph Practice state
  const [humanitiesClaim, setHumanitiesClaim] = useState('The printing press accelerated the spread of scientific ideas because books became cheaper and faster to reproduce.');
  const [humanitiesEvidence, setHumanitiesEvidence] = useState('');

  // ICT Logic Gate & Binary Simulator states
  const [gateType, setGateType] = useState<'AND' | 'OR' | 'XOR' | 'NAND'>('AND');
  const [gateA, setGateA] = useState<0 | 1>(1);
  const [gateB, setGateB] = useState<0 | 1>(0);
  const [binaryBits, setBinaryBits] = useState<number[]>([0, 0, 1, 0, 1, 0, 1, 0]);

  // Economics Supply & Demand states
  const [demandShift, setDemandShift] = useState(0);
  const [supplyShift, setSupplyShift] = useState(0);

  // Geography Grid Reference states
  const [eastingGrid, setEastingGrid] = useState('426');
  const [northingGrid, setNorthingGrid] = useState('714');

  // Inline Practice Area AI Tutor
  const [labQuestion, setLabQuestion] = useState('');
  const [labMessages, setLabMessages] = useState<LabChatMessage[]>([]);
  const [askingLab, setAskingLab] = useState(false);
  const [subjectWarning, setSubjectWarning] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);
  const langSpeechRecRef = useRef<{ stop: () => void; abort: () => void } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tutorMessagesEndRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: 0.35, y: 0.45 });
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const timeRef = useRef(0);
  const strokesRef = useRef<Array<{ color: string; pts: Array<{ x: number; y: number }> }>>([]);
  const drawingNowRef = useRef(false);

  useEffect(() => {
    if (initialModelId) {
      const m = LAB_MODELS.find((item) => item.id === initialModelId);
      if (m) {
        setActiveCategory(m.category);
        setActiveModel(m.id);
        setLabMessages([]);
        return;
      }
    }
    if (scopedSubject) {
      const cat = resolveCategoryForSubject(scopedSubject);
      setActiveCategory(cat);
      const low = scopedSubject.name.toLowerCase();
      if (low.includes('geog')) setActiveModel('geo-globe');
      else if (low.includes('econom') || low.includes('business')) setActiveModel('econ-supply');
      else if (
        low.includes('histor') ||
        low.includes('literat') ||
        low.includes('csl') ||
        low.includes('religious') ||
        low.includes('creative')
      ) {
        setActiveModel('humanities-practice');
      } else {
        const first = LAB_MODELS.find((m) => m.category === cat);
        if (first) setActiveModel(first.id);
      }
      if (LANGUAGE_PACKS[scopedSubject.name]) {
        setPracticeLang(scopedSubject.name);
        setBuiltTokens([]);
        setSentenceFeedback(null);
        setListeningAnswers({});
        setGrammarAnswers({});
        setReadingAnswer(null);
      }
      setCustomConcept(`${scopedSubject.name} Practice`);
      setLabMessages([]);
    }
  }, [scopedSubject?.id, initialModelId]);

  const hasVisualCanvas = activeModel !== 'lang-practice' && activeModel !== 'humanities-practice';
  const isDrawMode = activeModel === 'math-draw';

  const visibleModels = scopedSubject
    ? LAB_MODELS.filter(
        (m) =>
          m.category === resolveCategoryForSubject(scopedSubject) ||
          m.id === 'custom'
      )
    : LAB_MODELS.filter((m) => m.category === activeCategory);

  const currentMeta =
    LAB_MODELS.find((m) => m.id === activeModel) || visibleModels[0] || LAB_MODELS[0];

  const activeSubjectLabel =
    scopedSubject?.name ||
    (currentMeta.id === 'custom' ? 'Custom Subject Practice' : currentMeta.subject);

  useEffect(() => {
    tutorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [labMessages.length, askingLab]);

  const mathMetrics = computeGeometryMetrics(mathShape, mathSize, mathAngle);
  const atomInfo = getAtomElementInfo(electronCount);
  const circuitMetrics = computeCircuitMetrics(
    circuitVoltage,
    circuitR1,
    circuitR2,
    circuitMode,
    circuitClosed
  );
  const forceMetrics = computeForceMotion(rampMass, rampAngle, appliedForce, frictionCoeff);

  const gateOutput: 0 | 1 = (() => {
    if (gateType === 'AND') return gateA && gateB ? 1 : 0;
    if (gateType === 'OR') return gateA || gateB ? 1 : 0;
    if (gateType === 'XOR') return gateA !== gateB ? 1 : 0;
    return !(gateA && gateB) ? 1 : 0;
  })();

  const binaryDecimal = binaryBits.reduce((acc, bit, idx) => acc + bit * 2 ** (7 - idx), 0);

  // Supply & Demand Equilibrium math: Qd = 60 + Dshift - P, Qs = 10 + Sshift + P => P* = (50 + D - S)/2
  const eqPrice = Math.max(5, Math.min(48, Math.round((50 + demandShift - supplyShift) / 2)));
  const eqQty = Math.max(5, Math.round(60 + demandShift - eqPrice));

  const langPack = LANGUAGE_PACKS[practiceLang] || LANGUAGE_PACKS.English;

  const clearDrawingStrokes = () => {
    strokesRef.current = [];
  };

  useEffect(() => {
    if (!hasVisualCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if (playing) {
        timeRef.current += dt * speed;
        if (
          !dragRef.current.active &&
          !isDrawMode &&
          activeModel !== 'math-graph' &&
          activeModel !== 'ict-logic' &&
          activeModel !== 'econ-supply'
        ) {
          rotRef.current.y += dt * 0.24 * speed;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        12,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.65
      );
      grad.addColorStop(0, '#0E1F4F');
      grad.addColorStop(1, '#040A1A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const t = timeRef.current;
      const rx = rotRef.current.x;
      const ry = rotRef.current.y;

      if (activeModel === 'math-shapes') {
        const s = 48 + mathSize * 5.5;
        if (mathShape === 'triangle') {
          const rad = (Math.max(15, Math.min(130, mathAngle)) * Math.PI) / 180;
          const halfW = s * 0.9;
          const h = Math.min(s * 1.4, halfW * Math.tan(rad));
          const pts = [
            project3D(-halfW, h * 0.45, 0, rx, ry, zoom, cx, cy),
            project3D(halfW, h * 0.45, 0, rx, ry, zoom, cx, cy),
            project3D(0, -h * 0.65, 0, rx, ry, zoom, cx, cy),
          ];
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          ctx.lineTo(pts[1].sx, pts[1].sy);
          ctx.lineTo(pts[2].sx, pts[2].sy);
          ctx.closePath();
          ctx.fillStyle = 'rgba(46, 139, 255, 0.2)';
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.6;
          ctx.stroke();
        } else if (mathShape === 'rectangle') {
          const w2 = s * 0.9;
          const h2 = s * (0.45 + mathAngle / 190);
          const pts = [
            project3D(-w2, -h2, 0, rx, ry, zoom, cx, cy),
            project3D(w2, -h2, 0, rx, ry, zoom, cx, cy),
            project3D(w2, h2, 0, rx, ry, zoom, cx, cy),
            project3D(-w2, h2, 0, rx, ry, zoom, cx, cy),
          ];
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
          ctx.closePath();
          ctx.fillStyle = 'rgba(110, 91, 255, 0.2)';
          ctx.fill();
          ctx.strokeStyle = '#7DD3FC';
          ctx.lineWidth = 2.6;
          ctx.stroke();
        } else if (mathShape === 'circle') {
          ctx.beginPath();
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            const p = project3D(Math.cos(a) * s, Math.sin(a) * s, 0, rx, ry, zoom, cx, cy);
            if (i === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.6;
          ctx.stroke();
        } else if (mathShape === 'cube') {
          const hs = s * 0.72;
          const verts = [
            [-hs, -hs, -hs], [hs, -hs, -hs], [hs, hs, -hs], [-hs, hs, -hs],
            [-hs, -hs, hs], [hs, -hs, hs], [hs, hs, hs], [-hs, hs, hs],
          ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7],
          ];
          edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(verts[a].sx, verts[a].sy);
            ctx.lineTo(verts[b].sx, verts[b].sy);
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          });
        } else if (mathShape === 'pyramid') {
          const hs = s * 0.78;
          const apexY = -s * (0.55 + mathAngle / 190);
          const verts = [
            [-hs, hs * 0.65, -hs], [hs, hs * 0.65, -hs],
            [hs, hs * 0.65, hs], [-hs, hs * 0.65, hs],
            [0, apexY, 0],
          ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [0, 4], [1, 4], [2, 4], [3, 4],
          ];
          edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(verts[a].sx, verts[a].sy);
            ctx.lineTo(verts[b].sx, verts[b].sy);
            ctx.strokeStyle = '#818CF8';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          });
        } else {
          const verts = [
            [0, -s, 0], [s, 0, 0], [0, 0, s], [-s, 0, 0], [0, 0, -s], [0, s, 0],
          ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
          const edges = [
            [0, 1], [0, 2], [0, 3], [0, 4],
            [5, 1], [5, 2], [5, 3], [5, 4],
            [1, 2], [2, 3], [3, 4], [4, 1],
          ];
          edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(verts[a].sx, verts[a].sy);
            ctx.lineTo(verts[b].sx, verts[b].sy);
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          });
        }
      } else if (activeModel === 'math-graph') {
        const step = 28 * zoom;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1;
        for (let x = cx % step; x < width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = cy % step; y < height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        ctx.beginPath();
        for (let px = 0; px <= width; px += 3) {
          const xVal = (px - cx) / step;
          let yVal = 0;
          if (graphKind === 'linear') yVal = graphA * xVal + graphC;
          else if (graphKind === 'quadratic') yVal = graphA * xVal * xVal + graphC;
          else yVal = graphA * Math.sin(xVal * 1.4 + t * 0.4) * 1.5 + graphC;
          const py = cy - yVal * step;
          if (px === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (activeModel === 'math-draw') {
        if (drawGrid) {
          const step = 28;
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.14)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        for (const stroke of strokesRef.current) {
          if (stroke.pts.length < 2) continue;
          ctx.beginPath();
          stroke.pts.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }

        if (strokesRef.current.length === 0) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.font = '13px Plus Jakarta Sans, sans-serif';
          ctx.fillText('Draw shapes, graphs, or label angles right on this canvas...', 16, 28);
        }
      } else if (activeModel === 'ict-logic') {
        // Logic Gate Digital Diagram on Canvas
        const gx = cx - 40;
        const gy = cy - 45;
        // Input wires
        ctx.lineWidth = 4;
        ctx.strokeStyle = gateA ? '#5EEAD4' : '#475569';
        ctx.beginPath();
        ctx.moveTo(cx - 140, gy + 26);
        ctx.lineTo(gx, gy + 26);
        ctx.stroke();

        ctx.strokeStyle = gateB ? '#5EEAD4' : '#475569';
        ctx.beginPath();
        ctx.moveTo(cx - 140, gy + 64);
        ctx.lineTo(gx, gy + 64);
        ctx.stroke();

        // Output wire
        ctx.strokeStyle = gateOutput ? '#38BDF8' : '#475569';
        ctx.beginPath();
        ctx.moveTo(gx + 92, gy + 45);
        ctx.lineTo(cx + 150, gy + 45);
        ctx.stroke();

        // Gate body
        ctx.fillStyle = '#0F224F';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(gx, gy + 8, 92, 74, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px JetBrains Mono, monospace';
        ctx.fillText(gateType, gx + 25, gy + 51);

        // Input nodes & Output LED
        ctx.fillStyle = gateA ? '#5EEAD4' : '#64748B';
        ctx.beginPath();
        ctx.arc(cx - 140, gy + 26, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#040A1A';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`A=${gateA}`, cx - 152, gy + 8);

        ctx.fillStyle = gateB ? '#5EEAD4' : '#64748B';
        ctx.beginPath();
        ctx.arc(cx - 140, gy + 64, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#040A1A';
        ctx.fillText(`B=${gateB}`, cx - 152, gy + 92);

        if (gateOutput) {
          const glow = ctx.createRadialGradient(cx + 150, gy + 45, 2, cx + 150, gy + 45, 28);
          glow.addColorStop(0, 'rgba(94, 234, 212, 0.9)');
          glow.addColorStop(1, 'rgba(94, 234, 212, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx + 150, gy + 45, 28, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = gateOutput ? '#5EEAD4' : '#334155';
        ctx.beginPath();
        ctx.arc(cx + 150, gy + 45, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(`OUT = ${gateOutput}`, cx + 115, gy + 16);
      } else if (activeModel === 'econ-supply') {
        const padL = 56;
        const padB = height - 42;
        const plotW = Math.max(180, width - 104);
        const plotH = Math.max(150, height - 86);

        // Axes
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padL, 30);
        ctx.lineTo(padL, padB);
        ctx.lineTo(padL + plotW, padB);
        ctx.stroke();

        ctx.fillStyle = '#BAE6FD';
        ctx.font = '11px sans-serif';
        ctx.fillText('Price (P)', padL - 44, 38);
        ctx.fillText('Quantity (Q)', padL + plotW - 65, padB + 20);

        const toPx = (q: number, p: number) => ({
          x: padL + (q / 70) * plotW,
          y: padB - (p / 60) * plotH,
        });

        // Demand Curve: P = 60 + demandShift - Q
        const dStart = toPx(5, Math.min(58, 55 + demandShift));
        const dEnd = toPx(62, Math.max(2, -2 + demandShift));
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dStart.x, dStart.y);
        ctx.lineTo(dEnd.x, dEnd.y);
        ctx.stroke();
        ctx.fillStyle = '#38BDF8';
        ctx.fillText('Demand (D)', dEnd.x - 42, dEnd.y - 8);

        // Supply Curve: P = Q - 10 - supplyShift
        const sStart = toPx(10, Math.max(3, 5 - supplyShift));
        const sEnd = toPx(62, Math.min(58, 52 - supplyShift));
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.fillStyle = '#FBBF24';
        ctx.fillText('Supply (S)', sEnd.x - 52, sEnd.y - 8);

        // Equilibrium Intersection
        const eqPt = toPx(eqQty, eqPrice);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padL, eqPt.y);
        ctx.lineTo(eqPt.x, eqPt.y);
        ctx.lineTo(eqPt.x, padB);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#5EEAD4';
        ctx.beginPath();
        ctx.arc(eqPt.x, eqPt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`E*(Q=${eqQty}, P=$${eqPrice})`, eqPt.x + 10, eqPt.y - 8);
      } else if (activeModel === 'geo-globe') {
        const radius = 84;
        // Latitude & Longitude wireframe globe
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.6;
        for (let lon = 0; lon < 6; lon++) {
          const ang = (lon / 6) * Math.PI + ry;
          ctx.beginPath();
          for (let i = 0; i <= 36; i++) {
            const theta = (i / 36) * Math.PI * 2;
            const p = project3D(
              radius * Math.sin(theta) * Math.cos(ang),
              radius * Math.cos(theta),
              radius * Math.sin(theta) * Math.sin(ang),
              rx,
              0,
              zoom,
              cx,
              cy
            );
            if (i === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          ctx.stroke();
        }
        // Equator + Tectonic belt
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const p = project3D(radius * Math.cos(a), 0, radius * Math.sin(a), rx, ry, zoom, cx, cy);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();

        // Tectonic hotspot pin
        const pin = project3D(radius * 0.85, -radius * 0.4, radius * 0.25, rx, ry, zoom, cx, cy);
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(pin.sx, pin.sy, 6 * pin.scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeModel === 'bio-cell') {
        const s = 92;
        if (cellType === 'plant') {
          const corners = [
            [-s, -60, -s * 0.7], [s, -60, -s * 0.7], [s, 60, -s * 0.7], [-s, 60, -s * 0.7],
            [-s, -60, s * 0.7], [s, -60, s * 0.7], [s, 60, s * 0.7], [-s, 60, s * 0.7],
          ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7],
          ];
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2.4;
          edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(corners[a].sx, corners[a].sy);
            ctx.lineTo(corners[b].sx, corners[b].sy);
            ctx.stroke();
          });
        } else {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          for (let tilt = -0.6; tilt <= 0.6; tilt += 0.6) {
            ctx.beginPath();
            for (let i = 0; i <= 48; i++) {
              const a = (i / 48) * Math.PI * 2;
              const p = project3D(Math.cos(a) * 95, Math.sin(a) * 72 * Math.cos(tilt), Math.sin(a) * 72 * Math.sin(tilt), rx, ry, zoom, cx, cy);
              if (i === 0) ctx.moveTo(p.sx, p.sy);
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.stroke();
          }
        }
        const nuc = project3D(-28, -8, 10, rx, ry, zoom, cx, cy);
        ctx.beginPath();
        ctx.arc(nuc.sx, nuc.sy, (selectedOrganelle === 'nucleus' ? 24 : 18) * nuc.scale, 0, Math.PI * 2);
        ctx.fillStyle = selectedOrganelle === 'nucleus' ? '#A78BFA' : '#6366F1';
        ctx.fill();
        if (cellType === 'plant') {
          const vac = project3D(24, 6, -8, rx, ry, zoom, cx, cy);
          ctx.beginPath();
          ctx.arc(vac.sx, vac.sy, (selectedOrganelle === 'vacuole' ? 28 : 22) * vac.scale, 0, Math.PI * 2);
          ctx.fillStyle = selectedOrganelle === 'vacuole' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(56, 189, 248, 0.28)';
          ctx.fill();
        }
        for (let m = 0; m < 3; m++) {
          const ang = (m / 3) * Math.PI * 2 + t * 0.45;
          const mp = project3D(Math.cos(ang) * 52, 26, Math.sin(ang) * 34, rx, ry, zoom, cx, cy);
          ctx.beginPath();
          ctx.arc(mp.sx, mp.sy, (selectedOrganelle === 'mitochondria' ? 11 : 7.5) * mp.scale, 0, Math.PI * 2);
          ctx.fillStyle = selectedOrganelle === 'mitochondria' ? '#FB923C' : '#F97316';
          ctx.fill();
        }
        if (cellType === 'plant') {
          for (let c = 0; c < 5; c++) {
            const ang = (c / 5) * Math.PI * 2 + t * 0.65;
            const cp = project3D(Math.cos(ang) * 60, Math.sin(ang * 2) * 26, Math.sin(ang) * 40, rx, ry, zoom, cx, cy);
            ctx.beginPath();
            ctx.arc(cp.sx, cp.sy, (selectedOrganelle === 'chloroplast' ? 11 : 8) * cp.scale, 0, Math.PI * 2);
            ctx.fillStyle = selectedOrganelle === 'chloroplast' ? '#4ADE80' : '#22C55E';
            ctx.fill();
          }
        }
      } else if (activeModel === 'bio-dna') {
        const steps = 16;
        const unzipSpread = dnaUnzip ? 26 : 0;
        for (let i = 0; i < steps; i++) {
          const y = (i - steps / 2) * 14;
          const phase = i * 0.48 + t * 1.4;
          const radius = 56;
          const split = i > 7 ? unzipSpread * ((i - 7) / 8) : 0;
          const pA = project3D(radius * Math.cos(phase) - split, y, radius * Math.sin(phase), rx, ry, zoom, cx, cy);
          const pB = project3D(radius * Math.cos(phase + Math.PI) + split, y, radius * Math.sin(phase + Math.PI), rx, ry, zoom, cx, cy);
          if (!dnaUnzip || i <= 7) {
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            ctx.lineTo(pB.sx, pB.sy);
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(94, 234, 212, 0.55)' : 'rgba(129, 140, 248, 0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(pA.sx, pA.sy, 5 * pA.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(pB.sx, pB.sy, 5 * pB.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#A855F7';
          ctx.fill();
        }
      } else if (activeModel === 'bio-body') {
        const beat = 1 + 0.14 * Math.sin((t * heartBpm) / 14);
        const heartPt = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
        const lungPt = project3D(0, -76, 12, rx, ry, zoom, cx, cy);
        const bodyPt = project3D(0, 78, -12, rx, ry, zoom, cx, cy);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lungPt.sx + 10, lungPt.sy);
        ctx.quadraticCurveTo(heartPt.sx + 48, heartPt.sy - 30, heartPt.sx + 10, heartPt.sy);
        ctx.quadraticCurveTo(bodyPt.sx + 56, bodyPt.sy - 20, bodyPt.sx + 8, bodyPt.sy);
        ctx.stroke();
        ctx.strokeStyle = '#3B82F6';
        ctx.beginPath();
        ctx.moveTo(bodyPt.sx - 8, bodyPt.sy);
        ctx.quadraticCurveTo(heartPt.sx - 52, heartPt.sy + 26, heartPt.sx - 10, heartPt.sy);
        ctx.quadraticCurveTo(lungPt.sx - 48, lungPt.sy + 30, lungPt.sx - 10, lungPt.sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lungPt.sx, lungPt.sy, 22 * lungPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(heartPt.sx, heartPt.sy, 20 * beat * heartPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bodyPt.sx, bodyPt.sy, 18 * bodyPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#6366F1';
        ctx.fill();
      } else if (activeModel === 'chem-atom') {
        const nuc = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
        ctx.fillStyle = '#7DD3FC';
        ctx.beginPath();
        ctx.arc(nuc.sx, nuc.sy, 16 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#040A1A';
        ctx.font = 'bold 12px JetBrains Mono, monospace';
        ctx.fillText(atomInfo.symbol, nuc.sx - 6, nuc.sy + 4);

        const shells = [
          { r: 58, max: 2, tiltX: 0.4, tiltZ: 0.2, color: '#38BDF8' },
          { r: 96, max: 8, tiltX: -0.5, tiltZ: 0.6, color: '#818CF8' },
          { r: 132, max: 8, tiltX: 0.8, tiltZ: -0.4, color: '#5EEAD4' },
        ];
        let remaining = electronCount;
        shells.forEach((shell, sIdx) => {
          const count = Math.min(remaining, shell.max);
          remaining -= count;
          if (count <= 0 && sIdx > 0) return;
          ctx.beginPath();
          for (let a = 0; a <= 48; a++) {
            const ang = (a / 48) * Math.PI * 2;
            const p = project3D(shell.r * Math.cos(ang), shell.r * Math.sin(ang) * Math.sin(shell.tiltX), shell.r * Math.sin(ang) * Math.cos(shell.tiltZ), rx, ry, zoom, cx, cy);
            if (a === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          for (let e = 0; e < count; e++) {
            const ang = (e / Math.max(1, count)) * Math.PI * 2 + t * (1.2 - sIdx * 0.22);
            const p = project3D(shell.r * Math.cos(ang), shell.r * Math.sin(ang) * Math.sin(shell.tiltX), shell.r * Math.sin(ang) * Math.cos(shell.tiltZ), rx, ry, zoom, cx, cy);
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 5.5 * p.scale, 0, Math.PI * 2);
            ctx.fillStyle = shell.color;
            ctx.fill();
          }
        });
      } else if (activeModel === 'chem-water') {
        if (moleculeKind === 'h2o') {
          const angleRad = (104.5 * Math.PI) / 180;
          const bond = 84;
          const oPos = project3D(0, -14, 0, rx, ry, zoom, cx, cy);
          const h1Pos = project3D(-bond * Math.sin(angleRad / 2), bond * Math.cos(angleRad / 2) - 14, 18, rx, ry, zoom, cx, cy);
          const h2Pos = project3D(bond * Math.sin(angleRad / 2), bond * Math.cos(angleRad / 2) - 14, -18, rx, ry, zoom, cx, cy);
          [h1Pos, h2Pos].forEach((hp) => {
            ctx.beginPath();
            ctx.moveTo(oPos.sx, oPos.sy);
            ctx.lineTo(hp.sx, hp.sy);
            ctx.strokeStyle = '#7DD3FC';
            ctx.lineWidth = 5;
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.arc(oPos.sx, oPos.sy, 22 * oPos.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444';
          ctx.fill();
          [h1Pos, h2Pos].forEach((hp) => {
            ctx.beginPath();
            ctx.arc(hp.sx, hp.sy, 14 * hp.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#F8FAFC';
            ctx.fill();
          });
        } else if (moleculeKind === 'co2') {
          const cPos = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
          const o1 = project3D(-92, 0, 0, rx, ry, zoom, cx, cy);
          const o2 = project3D(92, 0, 0, rx, ry, zoom, cx, cy);
          [o1, o2].forEach((op) => {
            ctx.beginPath();
            ctx.moveTo(cPos.sx, cPos.sy - 4);
            ctx.lineTo(op.sx, op.sy - 4);
            ctx.moveTo(cPos.sx, cPos.sy + 4);
            ctx.lineTo(op.sx, op.sy + 4);
            ctx.strokeStyle = '#5EEAD4';
            ctx.lineWidth = 3;
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.arc(cPos.sx, cPos.sy, 18 * cPos.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#64748B';
          ctx.fill();
          [o1, o2].forEach((op) => {
            ctx.beginPath();
            ctx.arc(op.sx, op.sy, 17 * op.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#EF4444';
            ctx.fill();
          });
        } else if (moleculeKind === 'ch4') {
          const cPos = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
          const hs = [
            [0, -78, 0],
            [74, 34, 42],
            [-74, 34, 42],
            [0, 34, -74],
          ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
          hs.forEach((hp) => {
            ctx.beginPath();
            ctx.moveTo(cPos.sx, cPos.sy);
            ctx.lineTo(hp.sx, hp.sy);
            ctx.strokeStyle = '#7DD3FC';
            ctx.lineWidth = 4;
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.arc(cPos.sx, cPos.sy, 19 * cPos.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          hs.forEach((hp) => {
            ctx.beginPath();
            ctx.arc(hp.sx, hp.sy, 12 * hp.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#F8FAFC';
            ctx.fill();
          });
        } else {
          const d = 48;
          for (let xi = -1; xi <= 1; xi += 2) {
            for (let yi = -1; yi <= 1; yi += 2) {
              for (let zi = -1; zi <= 1; zi += 2) {
                const isNa = (xi + yi + zi + 3) % 4 === 0;
                const p = project3D(xi * d, yi * d, zi * d, rx, ry, zoom, cx, cy);
                ctx.beginPath();
                ctx.arc(p.sx, p.sy, (isNa ? 12 : 16) * p.scale, 0, Math.PI * 2);
                ctx.fillStyle = isNa ? '#A78BFA' : '#4ADE80';
                ctx.fill();
              }
            }
          }
        }
      } else if (activeModel === 'chem-reaction') {
        const prog = reactionProgress / 100;
        const sep = (1 - Math.sin(prog * Math.PI)) * 74;
        const formed = prog >= 0.5;
        const p1 = project3D(-sep, -12, 10, rx, ry, zoom, cx, cy);
        const p2 = project3D(sep, 12, -10, rx, ry, zoom, cx, cy);
        if (formed) {
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.strokeStyle = '#5EEAD4';
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(p1.sx, p1.sy, 20 * p1.scale, 0, Math.PI * 2);
        ctx.fillStyle = formed ? '#38BDF8' : '#F97316';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p2.sx, p2.sy, 20 * p2.scale, 0, Math.PI * 2);
        ctx.fillStyle = formed ? '#A855F7' : '#EF4444';
        ctx.fill();
      } else if (activeModel === 'phys-forces') {
        const rad = (rampAngle * Math.PI) / 180;
        const baseLen = 220 * zoom;
        const startX = cx - baseLen * 0.5;
        const baseY = cy + 70;
        const topX = startX;
        const topY = baseY - Math.tan(rad) * baseLen;
        const endX = startX + baseLen;
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.lineTo(endX, baseY);
        ctx.lineTo(topX, topY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(30, 58, 138, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();

        const slideNorm = 0.45 + Math.sin(t * 1.1) * 0.12 * Math.sign(forceMetrics.acceleration || 1);
        const bx = topX + (endX - topX) * slideNorm;
        const by = topY + (baseY - topY) * slideNorm;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rad);
        ctx.fillStyle = '#5EEAD4';
        ctx.fillRect(-18, -28, 36, 26);
        ctx.restore();
      } else if (activeModel === 'phys-wave') {
        if (waveType === 'transverse') {
          ctx.beginPath();
          for (let i = -16; i <= 16; i++) {
            const p = project3D(i * 9, Math.sin(i * 0.35 * (waveFreq / 2) - t * 3) * waveAmp, Math.cos(i * 0.35 * (waveFreq / 2) - t * 3) * 16, rx, ry, zoom, cx, cy);
            if (i === -16) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          for (let i = -12; i <= 12; i++) {
            const disp = Math.sin(i * 0.5 * (waveFreq / 2) - t * 3) * (waveAmp * 0.35);
            for (let row = -1; row <= 1; row++) {
              const p = project3D(i * 11 + disp, row * 24, 0, rx, ry, zoom, cx, cy);
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, 4.5 * p.scale, 0, Math.PI * 2);
              ctx.fillStyle = '#5EEAD4';
              ctx.fill();
            }
          }
        }
      } else if (activeModel === 'phys-circuit') {
        const left = cx - 120;
        const right = cx + 120;
        const top = cy - 72;
        const bot = cy + 72;
        ctx.strokeStyle = circuitClosed ? '#38BDF8' : '#64748B';
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, right - left, bot - top);
        if (circuitMode === 'parallel') {
          ctx.beginPath();
          ctx.moveTo(left, cy);
          ctx.lineTo(right, cy);
          ctx.stroke();
        }
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(left - 14, cy - 18, 28, 36);
        ctx.fillStyle = '#040A1A';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(`${circuitVoltage}V`, left - 12, cy + 4);
      } else if (activeModel === 'phys-solar') {
        const sun = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(sun.sx, sun.sy, 18 * sun.scale, 0, Math.PI * 2);
        ctx.fill();
        const planets = [
          { r: 50, size: 5.5, speed: 1.5, color: '#38BDF8' },
          { r: 80, size: 7.5, speed: 1.0, color: '#5EEAD4' },
          { r: 112, size: 6.5, speed: 0.72, color: '#F87171' },
          { r: 144, size: 10, speed: 0.46, color: '#A78BFA' },
        ];
        planets.forEach((pl) => {
          ctx.beginPath();
          for (let a = 0; a <= 48; a++) {
            const ang = (a / 48) * Math.PI * 2;
            const op = project3D(pl.r * Math.cos(ang), 0, pl.r * Math.sin(ang), rx, ry, zoom, cx, cy);
            if (a === 0) ctx.moveTo(op.sx, op.sy);
            else ctx.lineTo(op.sx, op.sy);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.stroke();
          const ang = t * pl.speed;
          const p = project3D(pl.r * Math.cos(ang), 0, pl.r * Math.sin(ang), rx, ry, zoom, cx, cy);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, pl.size * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = pl.color;
          ctx.fill();
        });
      } else {
        const seed = customConcept.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const lobes = 2 + (seed % 4);
        const pts: Array<{ sx: number; sy: number; scale: number }> = [];
        for (let i = 0; i <= 72; i++) {
          const u = (i / 72) * Math.PI * 2;
          const rad = 70 + 28 * Math.cos(lobes * u + t);
          pts.push(project3D(rad * Math.cos(u), 44 * Math.sin(lobes * u + t), rad * Math.sin(u), rx, ry, zoom, cx, cy));
        }
        ctx.beginPath();
        pts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        });
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeModel,
    customConcept,
    playing,
    speed,
    zoom,
    isDrawMode,
    mathShape,
    mathSize,
    mathAngle,
    graphKind,
    graphA,
    graphC,
    drawGrid,
    cellType,
    selectedOrganelle,
    dnaUnzip,
    heartBpm,
    electronCount,
    atomInfo.symbol,
    moleculeKind,
    reactionProgress,
    rampAngle,
    appliedForce,
    forceMetrics.acceleration,
    waveType,
    waveFreq,
    waveAmp,
    circuitMode,
    circuitVoltage,
    circuitR1,
    circuitR2,
    circuitClosed,
    hasVisualCanvas,
    practiceLang,
    gateType,
    gateA,
    gateB,
    gateOutput,
    demandShift,
    supplyShift,
    eqPrice,
    eqQty,
  ]);

  const [speakingLabId, setSpeakingLabId] = useState<string | null>(null);

  const handleToggleSpeakLab = (id: string, text: string, targetLanguage?: string) => {
    if (speakingLabId === id) {
      stopBrowserTTS();
      setSpeakingLabId(null);
      return;
    }
    const ok = speakWithBrowserTTS({
      text: targetLanguage ? extractPureTargetSpeechText(text) || text : text,
      lang: targetLanguage ? getSpeechLangForSubject(targetLanguage) : 'en-US',
      rate: targetLanguage ? 0.9 : 0.96,
      onStart: () => setSpeakingLabId(id),
      onEnd: () => setSpeakingLabId((c) => (c === id ? null : c)),
      onError: () => setSpeakingLabId(null),
    });
    if (!ok) setSpeakingLabId(null);
  };

  const startSpeakingPractice = (targetPhrase: string, isConversationReply = false) => {
    setSpokenHeardText('');
    setSpokenResultFeedback(null);

    if (speakingTargetTerm === targetPhrase) {
      try {
        langSpeechRecRef.current?.stop();
      } catch {
        // ignore
      }
      setSpeakingTargetTerm(null);
      return;
    }

    const SpeechRec =
      (window as unknown as {
        SpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
          abort: () => void;
        };
      }).SpeechRecognition ||
      (window as unknown as {
        webkitSpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
          abort: () => void;
        };
      }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpokenResultFeedback('Live microphone speech recognition is unavailable in this browser—listen aloud and practise saying the phrase clearly, or type your response below.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = getSpeechLangForSubject(practiceLang);
      rec.interimResults = true;
      rec.onresult = (ev) => {
        const transcript = Array.from(ev.results)
          .map((r) => r[0]?.transcript || '')
          .join(' ')
          .trim();
        setSpokenHeardText(transcript);
        if (isConversationReply) {
          setTranslationPrompt(transcript);
        } else {
          const normSpoken = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
          const normTarget = extractPureTargetSpeechText(targetPhrase)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .trim();
          if (normSpoken && normTarget && (normSpoken.includes(normTarget) || normTarget.includes(normSpoken))) {
            setSpokenResultFeedback(`Great pronunciation! Recognized "${transcript}".`);
          } else if (normSpoken) {
            setSpokenResultFeedback(`Heard: "${transcript}". Compare with "${targetPhrase}" and try once more.`);
          }
        }
      };
      rec.onerror = () => {
        setSpeakingTargetTerm(null);
        setSpokenResultFeedback('Could not hear microphone clearly. Try again or type your answer.');
      };
      rec.onend = () => {
        setSpeakingTargetTerm(null);
      };
      langSpeechRecRef.current = rec;
      setSpeakingTargetTerm(targetPhrase);
      rec.start();
    } catch {
      setSpeakingTargetTerm(null);
      setSpokenResultFeedback('Microphone could not start in this browser.');
    }
  };

  const handleCheckTranslation = async (modeType = 'translation') => {
    if (!translationPrompt.trim()) return;
    setCheckingTranslation(true);
    setTranslationResult(null);
    try {
      const res = await fetch('/api/language/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          language: practiceLang,
          prompt:
            modeType === 'conversation'
              ? langPack.conversation.speakerLine
              : langPack.sentenceEnglish,
          expectedMeaning:
            modeType === 'conversation'
              ? langPack.conversation.goalPrompt
              : langPack.sentenceEnglish,
          learnerAttempt: translationPrompt.trim(),
          mode: modeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not verify sentence right now.');
      }
      setTranslationResult({
        isNatural: Boolean(data.isNatural ?? data.isCorrect),
        corrected: data.corrected || data.correctedSentence || langPack.sentenceTarget,
        englishMeaning: data.englishMeaning || langPack.sentenceEnglish,
        feedback: data.feedback || data.grammarExplanation || '',
      });
    } catch (err) {
      setTranslationResult({
        isNatural: false,
        corrected: langPack.sentenceTarget,
        englishMeaning: langPack.sentenceEnglish,
        feedback:
          err instanceof Error
            ? err.message
            : 'Unable to reach AI checker right now; compare with the reference sentence above.',
      });
    } finally {
      setCheckingTranslation(false);
    }
  };

  const askInlineLabTutor = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || askingLab) return;

    if (scopedSubject) {
      const warning = detectDifferentSubjectWarning(q, scopedSubject.name);
      if (warning) {
        setSubjectWarning(warning);
        return;
      }
    }
    setSubjectWarning(null);

    const modelTitle = activeModel === 'custom' ? customConcept : currentMeta.label;
    setLabMessages((prev) => [...prev, { id: `lab-u-${Date.now()}`, role: 'user', text: q }]);
    setLabQuestion('');
    setAskingLab(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          message: `We are currently inside the ALEXYN Practice Area (${activeSubjectLabel} · "${modelTitle}", focus: ${currentMeta.formula}). Learner asks: ${q}`,
          history: labMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          subjectFocus: activeSubjectLabel,
          strictScope: Boolean(scopedSubject),
          profile,
          aiSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reach Practice Area AI tutor.');
      setLabMessages((prev) => [
        ...prev,
        { id: `lab-a-${Date.now()}`, role: 'assistant', text: data.reply },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI right now.';
      setLabMessages((prev) => [
        ...prev,
        { id: `lab-e-${Date.now()}`, role: 'assistant', text: `${msg} Tip: ${currentMeta.description}` },
      ]);
    } finally {
      setAskingLab(false);
    }
  };

  const handleLabSubmit = (e: FormEvent) => {
    e.preventDefault();
    askInlineLabTutor(labQuestion);
  };

  const displayModelTitle = activeModel === 'custom' ? customConcept : currentMeta.label;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-24 pt-5 md:px-8">
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
            {scopedSubject.name} Practice Area
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[#7DD3FC]">
          {scopedSubject
            ? `${scopedSubject.name} Interactive Practice Area`
            : 'Subject-Specific Interactive Practice & Simulations'}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
          Practice Area · {scopedSubject ? scopedSubject.name : currentMeta.subject}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Practise languages (listening, speaking, reading & grammar), STEM simulations, ICT logic, economic curves, and conceptual reasoning.
        </p>
      </div>

      {!scopedSubject && (
        <div
          role="tablist"
          aria-label="Practice Area subjects"
          className="flex flex-wrap gap-2"
        >
          {LAB_CATEGORIES.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const firstModel = LAB_MODELS.find((m) => m.category === cat.id);
                  if (firstModel) setActiveModel(firstModel.id);
                  setLabMessages([]);
                  setSubjectWarning(null);
                }}
                className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? 'border-[#38BDF8] bg-[#2E8BFF] text-white'
                    : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {visibleModels.map((model) => {
          const Icon = model.icon;
          const active = model.id === activeModel;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                setActiveModel(model.id);
                setLabMessages([]);
                setSubjectWarning(null);
              }}
              className={`flex min-h-[48px] items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                active
                  ? 'border-[#38BDF8] bg-[#13295E] text-white shadow-[0_6px_20px_rgba(46,139,255,0.2)]'
                  : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#38BDF8]" />
              <div className="min-w-0">
                <p className="truncate font-bold">{model.label}</p>
                <p className="truncate text-[10px] text-slate-400">
                  {scopedSubject && model.id === 'custom' ? scopedSubject.name : model.formula}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {activeModel === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#38BDF8]/40 bg-[#0A1532] p-3.5">
          <Plus className="h-4 w-4 text-[#5EEAD4]" />
          <input
            type="text"
            value={customConcept}
            onChange={(e) => setCustomConcept(e.target.value)}
            placeholder="Type ANY topic (e.g. Mitochondria, Benzene Ring, Pendulum)..."
            aria-label="Custom practice topic"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              askInlineLabTutor(`Can you teach me "${customConcept}" step by step?`)
            }
            className="rounded-xl bg-[#16306E] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#1E4090]"
          >
            Practice Custom Topic
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {hasVisualCanvas && (
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-3xl border border-[var(--alexyn-border)] bg-[#050C21]">
              <canvas
                ref={canvasRef}
                data-testid="lab-3d-canvas"
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  if (isDrawMode) {
                    drawingNowRef.current = true;
                    strokesRef.current.push({ color: penColor, pts: [{ x, y }] });
                  } else {
                    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
                  }
                }}
                onPointerMove={(e) => {
                  if (isDrawMode) {
                    if (!drawingNowRef.current || strokesRef.current.length === 0) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    strokesRef.current[strokesRef.current.length - 1].pts.push({ x, y });
                    return;
                  }
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.lastX;
                  const dy = e.clientY - dragRef.current.lastY;
                  dragRef.current.lastX = e.clientX;
                  dragRef.current.lastY = e.clientY;
                  rotRef.current.y += dx * 0.01;
                  rotRef.current.x = Math.max(-1.4, Math.min(1.4, rotRef.current.x + dy * 0.01));
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                  drawingNowRef.current = false;
                }}
                onPointerLeave={() => {
                  dragRef.current.active = false;
                  drawingNowRef.current = false;
                }}
                className={`h-[290px] w-full touch-none sm:h-[360px] ${
                  isDrawMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                }`}
              />
            </div>
          </div>
        )}

        <aside
          className={`space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5 ${
            hasVisualCanvas ? 'lg:col-span-5' : 'lg:col-span-12'
          }`}
        >
          <div>
            <p className="text-xs font-medium text-[#7DD3FC]">
              {activeSubjectLabel} · <span className="font-mono">{currentMeta.formula}</span>
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-white">{displayModelTitle}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              {currentMeta.description}
            </p>
          </div>

          {/* INTERACTIVE LANGUAGE PRACTICE STUDIO (NO FORCED 3D CANVAS OR PITCH GRAPH) */}
          {activeModel === 'lang-practice' && (
            <div className="space-y-4 border-t border-[var(--alexyn-border)] pt-3">
              {/* Language Selector */}
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(LANGUAGE_PACKS).map((langKey) => (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => {
                      setPracticeLang(langKey);
                      setBuiltTokens([]);
                      setSentenceFeedback(null);
                      setTranslationResult(null);
                      setListeningAnswers({});
                      setGrammarAnswers({});
                      setReadingAnswer(null);
                      setSpokenHeardText('');
                      setSpokenResultFeedback(null);
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                      practiceLang === langKey
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300 hover:text-white'
                    }`}
                  >
                    {langKey}
                  </button>
                ))}
              </div>

              {/* Practice Activity Mode Switcher */}
              <div
                role="tablist"
                aria-label="Language practice skills"
                className="flex flex-wrap gap-1.5"
              >
                {[
                  { id: 'vocab', label: 'Vocabulary & Speaking' },
                  { id: 'listening', label: 'Listening' },
                  { id: 'grammar', label: 'Grammar & Sentences' },
                  { id: 'reading', label: 'Reading' },
                  { id: 'conversation', label: 'Conversation' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={langTab === tab.id}
                    onClick={() => setLangTab(tab.id as typeof langTab)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      langTab === tab.id
                        ? 'border-[#5EEAD4] bg-[#0D2A3F] text-[#5EEAD4]'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {langTab === 'vocab' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {langPack.vocab.map((v) => {
                      const isListeningThis = speakingTargetTerm === v.term;
                      return (
                        <div
                          key={v.term}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white">
                              {v.term} <span className="font-normal text-[#5EEAD4]">[{v.english}]</span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">Say: {v.phonetic}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSpeakLab(`vocab-${v.term}`, v.term, practiceLang)}
                              aria-label={`Listen to ${v.term}`}
                              title="Listen to pronunciation"
                              className="rounded-lg bg-[#122658] p-2 text-[#38BDF8] hover:text-white"
                            >
                              {speakingLabId === `vocab-${v.term}` ? (
                                <VolumeX className="h-3.5 w-3.5" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => startSpeakingPractice(v.term)}
                              aria-label={`Practise saying ${v.term}`}
                              title="Speak & check pronunciation"
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                                isListeningThis
                                  ? 'border-rose-400 bg-rose-500 text-white'
                                  : 'border-[var(--alexyn-border)] bg-[#0E1E46] text-slate-200 hover:border-[#38BDF8]'
                              }`}
                            >
                              {isListeningThis ? (
                                <>
                                  <Square className="h-3 w-3 fill-current" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="h-3 w-3 text-[#5EEAD4]" />
                                  <span>Speak</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(spokenHeardText || spokenResultFeedback) && (
                    <div className="rounded-xl border border-[#38BDF8]/40 bg-[#0D1E45] p-3 text-xs text-slate-100">
                      {spokenHeardText && (
                        <p className="font-semibold text-[#7DD3FC]">You said: "{spokenHeardText}"</p>
                      )}
                      {spokenResultFeedback && <p className="mt-0.5">{spokenResultFeedback}</p>}
                    </div>
                  )}
                </div>
              )}

              {langTab === 'listening' && (
                <div className="space-y-3">
                  {langPack.listening.map((item, idx) => {
                    const chosen = listeningAnswers[idx];
                    const isAnswered = chosen !== undefined;
                    return (
                      <div
                        key={idx}
                        className="space-y-2.5 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7DD3FC]">
                            <Headphones className="h-4 w-4" />
                            <span>Listening Exercise {idx + 1}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSpeakLab(`listen-norm-${idx}`, item.spokenText, practiceLang)
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-[#122658] px-3 py-1.5 text-xs font-semibold text-[#38BDF8] hover:text-white"
                            >
                              {speakingLabId === `listen-norm-${idx}` ? (
                                <VolumeX className="h-3.5 w-3.5" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5" />
                              )}
                              <span>Play Audio</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                speakWithBrowserTTS({
                                  text: item.spokenText,
                                  lang: getSpeechLangForSubject(practiceLang),
                                  rate: 0.72,
                                  onStart: () => setSpeakingLabId(`listen-slow-${idx}`),
                                  onEnd: () => setSpeakingLabId(null),
                                  onError: () => setSpeakingLabId(null),
                                })
                              }
                              className="rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-[#38BDF8]"
                            >
                              Slowly (0.7x)
                            </button>
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-white">{item.question}</p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {item.options.map((opt, optIdx) => {
                            const selected = chosen === optIdx;
                            const correct = optIdx === item.correctIndex;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  setListeningAnswers((prev) => ({ ...prev, [idx]: optIdx }))
                                }
                                className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                                  isAnswered
                                    ? correct
                                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                      : selected
                                      ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                      : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-400'
                                    : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-200 hover:border-[#38BDF8]'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {isAnswered && (
                          <p className="rounded-lg bg-[#0A1430] p-2.5 text-[11px] text-[#7DD3FC]">
                            {chosen === item.correctIndex ? '✓ Correct! ' : 'Review: '}
                            {item.explanation} (Transcript: "{item.spokenText}")
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {langTab === 'grammar' && (
                <div className="space-y-3">
                  {/* Grammar Drills */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {langPack.grammarDrills.map((drill, dIdx) => {
                      const chosen = grammarAnswers[dIdx];
                      const answered = chosen !== undefined;
                      return (
                        <div
                          key={dIdx}
                          className="space-y-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                        >
                          <p className="text-xs font-bold text-white">{drill.prompt}</p>
                          <div className="space-y-1.5">
                            {drill.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === drill.correctIndex;
                              const isSelected = chosen === oIdx;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setGrammarAnswers((prev) => ({ ...prev, [dIdx]: oIdx }))
                                  }
                                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                                    answered
                                      ? isCorrect
                                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                        : isSelected
                                        ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                        : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-400'
                                      : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-200 hover:border-[#38BDF8]'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {answered && (
                            <p className="text-[11px] text-[#5EEAD4]">
                              {chosen === drill.correctIndex ? '✓ Well done! ' : 'Tip: '}
                              {drill.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Sentence Construction */}
                  <div className="space-y-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#5EEAD4]">
                        Sentence Builder: {langPack.sentenceEnglish}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSpeakLab(
                            `ref-${practiceLang}`,
                            langPack.sentenceTarget,
                            practiceLang
                          )
                        }
                        aria-label={`Hear target sentence in ${practiceLang}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#122658] px-2.5 py-1 text-[11px] font-semibold text-[#38BDF8] hover:text-white"
                      >
                        {speakingLabId === `ref-${practiceLang}` ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        <span>Hear model</span>
                      </button>
                    </div>
                    <div className="min-h-[38px] rounded-xl border border-white/10 bg-[#040A1A] px-3 py-2 text-xs font-semibold text-white">
                      {builtTokens.length > 0 ? builtTokens.join(' ') : 'Tap words below in grammatical order...'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {langPack.tokens.map((tok, i) => (
                        <button
                          key={`${tok}-${i}`}
                          type="button"
                          onClick={() => {
                            setBuiltTokens((prev) => [...prev, tok]);
                            setSentenceFeedback(null);
                          }}
                          className="rounded-lg border border-[#2E8BFF]/40 bg-[#10214B] px-3 py-1.5 text-xs text-slate-100 hover:border-[#38BDF8]"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const attempt = builtTokens.join(' ').trim();
                          const ok =
                            attempt.toLowerCase() === langPack.sentenceTarget.toLowerCase();
                          setSentenceFeedback(
                            ok
                              ? `✓ Correct! "${langPack.sentenceTarget}".`
                              : `Check word order — target: "${langPack.sentenceTarget}".`
                          );
                        }}
                        className="rounded-lg bg-[#2E8BFF] px-3.5 py-1.5 text-xs font-bold text-white"
                      >
                        Check Sentence
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBuiltTokens([]);
                          setSentenceFeedback(null);
                        }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Reset
                      </button>
                    </div>
                    {sentenceFeedback && (
                      <p className="text-xs text-[#7DD3FC]">{sentenceFeedback}</p>
                    )}
                  </div>
                </div>
              )}

              {langTab === 'reading' && (
                <div className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{langPack.reading.title}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleSpeakLab(
                          `read-${practiceLang}`,
                          langPack.reading.passage,
                          practiceLang
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#122658] px-3 py-1.5 text-xs font-semibold text-[#38BDF8] hover:text-white"
                    >
                      {speakingLabId === `read-${practiceLang}` ? (
                        <VolumeX className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      <span>Read Passage Aloud</span>
                    </button>
                  </div>
                  <p className="rounded-xl border border-white/10 bg-[#0A1430] p-3.5 text-sm leading-relaxed text-slate-100">
                    {langPack.reading.passage}
                  </p>
                  <p className="text-xs font-bold text-[#7DD3FC]">{langPack.reading.question}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {langPack.reading.options.map((opt, idx) => {
                      const answered = readingAnswer !== null;
                      const correct = idx === langPack.reading.correctIndex;
                      const selected = readingAnswer === idx;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setReadingAnswer(idx)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs ${
                            answered
                              ? correct
                                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                : selected
                                ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                                : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-400'
                              : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-200 hover:border-[#38BDF8]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {readingAnswer !== null && (
                    <p className="text-xs text-[#5EEAD4]">
                      {readingAnswer === langPack.reading.correctIndex ? '✓ Accurate comprehension! ' : 'Note: '}
                      {langPack.reading.explanation}
                    </p>
                  )}
                </div>
              )}

              {langTab === 'conversation' && (
                <div className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[#2E8BFF]/30 bg-[#0A1430] p-3.5">
                    <div>
                      <p className="text-[11px] font-bold text-[#7DD3FC]">Dialogue Partner</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {langPack.conversation.speakerLine}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        [{langPack.conversation.speakerMeaning}]
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleSpeakLab(
                          `conv-${practiceLang}`,
                          langPack.conversation.speakerLine,
                          practiceLang
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-[#122658] px-3 py-1.5 text-xs font-semibold text-[#38BDF8] hover:text-white"
                    >
                      {speakingLabId === `conv-${practiceLang}` ? (
                        <VolumeX className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      <span>Listen</span>
                    </button>
                  </div>

                  <p className="text-xs font-medium text-[#5EEAD4]">
                    Your Task: {langPack.conversation.goalPrompt}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startSpeakingPractice('conversation-reply', true)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        speakingTargetTerm === 'conversation-reply'
                          ? 'border-rose-400 bg-rose-500 text-white'
                          : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-200 hover:border-[#38BDF8]'
                      }`}
                    >
                      {speakingTargetTerm === 'conversation-reply' ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-current" />
                          <span>Stop Speaking</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5 text-[#5EEAD4]" />
                          <span>Speak Reply</span>
                        </>
                      )}
                    </button>
                    <input
                      type="text"
                      value={translationPrompt}
                      onChange={(e) => setTranslationPrompt(e.target.value)}
                      placeholder={`Speak or type your ${practiceLang} reply here...`}
                      className="min-w-[200px] flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={checkingTranslation}
                      onClick={() => handleCheckTranslation('conversation')}
                      className="rounded-xl bg-[#6E5BFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {checkingTranslation ? 'Checking...' : 'Check Reply'}
                    </button>
                  </div>

                  {translationResult && (
                    <div className="space-y-1.5 rounded-xl bg-[#0A1430] p-3 text-xs text-slate-200">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-[#5EEAD4]">
                          {translationResult.isNatural
                            ? `✓ Natural response! ${translationResult.corrected}`
                            : `Suggested phrasing: ${translationResult.corrected}`}
                        </p>
                        {translationResult.corrected && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSpeakLab(
                                'checked-translation',
                                translationResult.corrected,
                                practiceLang
                              )
                            }
                            aria-label={`Pronounce ${translationResult.corrected}`}
                            className="shrink-0 rounded-md bg-[#122658] p-1 text-[#38BDF8] hover:text-white"
                          >
                            {speakingLabId === 'checked-translation' ? (
                              <VolumeX className="h-3.5 w-3.5" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      {translationResult.englishMeaning && (
                        <p className="text-slate-300">[{translationResult.englishMeaning}]</p>
                      )}
                      <p className="text-slate-400">{translationResult.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* HUMANITIES & CONCEPTUAL PRACTICE (NO FORCED GRAPHS/3D) */}
          {activeModel === 'humanities-practice' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
                <p className="text-xs font-bold text-[#7DD3FC]">
                  PEEL Paragraph & Source Evidence Practice
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Strengthen an academic claim with specific evidence and analysis instead of vague generalities:
                </p>
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      Topic / Point (P)
                    </label>
                    <input
                      type="text"
                      value={humanitiesClaim}
                      onChange={(e) => setHumanitiesClaim(e.target.value)}
                      className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      Your Evidence & Explanation (E + E)
                    </label>
                    <textarea
                      rows={3}
                      value={humanitiesEvidence}
                      onChange={(e) => setHumanitiesEvidence(e.target.value)}
                      placeholder="Write specific historical facts, literary quotes, or civic examples explaining why your point holds..."
                      className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3 text-xs text-white placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!humanitiesClaim.trim() || askingLab}
                    onClick={() =>
                      askInlineLabTutor(
                        `Please critique my PEEL argument below.\nPoint: "${humanitiesClaim}"\nEvidence & Analysis: "${humanitiesEvidence || '(Please suggest 2 concrete pieces of evidence and explain how to link them for exam marks.)'}"`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Evaluate My Argument</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ICT LOGIC GATES & 8-BIT BINARY */}
          {activeModel === 'ict-logic' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-4 gap-1.5">
                {(['AND', 'OR', 'XOR', 'NAND'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGateType(g)}
                    className={`rounded-lg border px-2 py-1.5 font-mono text-xs font-bold ${
                      gateType === g
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setGateA((v) => (v ? 0 : 1))}
                  className={`rounded-xl border py-2 font-bold ${
                    gateA ? 'border-[#5EEAD4] bg-[#0F2A44] text-[#5EEAD4]' : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                  }`}
                >
                  Input A: {gateA}
                </button>
                <button
                  type="button"
                  onClick={() => setGateB((v) => (v ? 0 : 1))}
                  className={`rounded-xl border py-2 font-bold ${
                    gateB ? 'border-[#5EEAD4] bg-[#0F2A44] text-[#5EEAD4]' : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                  }`}
                >
                  Input B: {gateB}
                </button>
                <div className="flex items-center justify-center rounded-xl border border-[#38BDF8]/40 bg-[#0E1E46] font-bold text-white">
                  OUT: {gateOutput}
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#7DD3FC]">8-Bit Binary Converter (tap bits)</span>
                  <span className="font-mono text-white">
                    Dec: {binaryDecimal} · Hex: 0x{binaryDecimal.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {binaryBits.map((bit, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setBinaryBits((prev) =>
                          prev.map((b, bi) => (bi === idx ? (b ? 0 : 1) : b))
                        )
                      }
                      className={`rounded-lg border py-1.5 font-mono text-xs font-bold ${
                        bit
                          ? 'border-[#5EEAD4] bg-[#133252] text-[#5EEAD4]'
                          : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-400'
                      }`}
                    >
                      {bit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ECONOMICS SUPPLY & DEMAND */}
          {activeModel === 'econ-supply' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="demandShiftSlider">Demand Shift</label>
                  <span className="font-mono text-[#38BDF8]">
                    {demandShift >= 0 ? `+${demandShift}` : demandShift}
                  </span>
                </div>
                <input
                  id="demandShiftSlider"
                  type="range"
                  min="-20"
                  max="20"
                  step="2"
                  value={demandShift}
                  onChange={(e) => setDemandShift(Number(e.target.value))}
                  className="mt-1 w-full accent-[#38BDF8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="supplyShiftSlider">Supply Shift</label>
                  <span className="font-mono text-[#FBBF24]">
                    {supplyShift >= 0 ? `+${supplyShift}` : supplyShift}
                  </span>
                </div>
                <input
                  id="supplyShiftSlider"
                  type="range"
                  min="-20"
                  max="20"
                  step="2"
                  value={supplyShift}
                  onChange={(e) => setSupplyShift(Number(e.target.value))}
                  className="mt-1 w-full accent-[#FBBF24]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#060E24] p-3 font-mono text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">Equilibrium Price (P*)</p>
                  <p className="font-bold text-[#5EEAD4]">${eqPrice}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Equilibrium Qty (Q*)</p>
                  <p className="font-bold text-white">{eqQty} units</p>
                </div>
              </div>
            </div>
          )}

          {/* GEOGRAPHY 6-FIGURE GRID */}
          {activeModel === 'geo-globe' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <p className="text-xs font-bold text-[#5EEAD4]">6-Figure Grid Reference Practice</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400">Easting (3 digits)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={eastingGrid}
                    onChange={(e) => setEastingGrid(e.target.value.replace(/\D/g, ''))}
                    className="mt-1 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400">Northing (3 digits)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={northingGrid}
                    onChange={(e) => setNorthingGrid(e.target.value.replace(/\D/g, ''))}
                    className="mt-1 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
              </div>
              <p className="rounded-xl bg-[#060E24] px-3 py-2 text-xs text-slate-200">
                Full Reference: <strong className="font-mono text-[#7DD3FC]">{eastingGrid.padEnd(3, '0')}{northingGrid.padEnd(3, '0')}</strong> (Square {eastingGrid.slice(0, 2) || '00'} East, {northingGrid.slice(0, 2) || '00'} North)
              </p>
            </div>
          )}

          {/* EXISTING STEM MODEL PANELS */}
          {activeModel === 'math-shapes' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(['triangle', 'rectangle', 'circle', 'cube', 'pyramid', 'octahedron'] as MathShapeKind[]).map(
                  (shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setMathShape(shape)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize ${
                        mathShape === shape
                          ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                          : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                      }`}
                    >
                      {shape}
                    </button>
                  )
                )}
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="mathSizeSlider">Side / Diameter</label>
                  <span className="font-mono">{mathSize} units</span>
                </div>
                <input
                  id="mathSizeSlider"
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={mathSize}
                  onChange={(e) => setMathSize(Number(e.target.value))}
                  className="mt-1 w-full accent-[#38BDF8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="mathAngleSlider">Angle / Height Factor</label>
                  <span className="font-mono">{mathAngle}°</span>
                </div>
                <input
                  id="mathAngleSlider"
                  type="range"
                  min="20"
                  max="80"
                  step="5"
                  value={mathAngle}
                  onChange={(e) => setMathAngle(Number(e.target.value))}
                  className="mt-1 w-full accent-[#5EEAD4]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">{mathMetrics.primaryLabel}</p>
                  <p className="font-mono font-bold text-[#5EEAD4]">{mathMetrics.primaryValue}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{mathMetrics.secondaryLabel}</p>
                  <p className="font-mono font-bold text-white">{mathMetrics.secondaryValue}</p>
                </div>
                <p className="col-span-2 text-[11px] text-[#7DD3FC]">{mathMetrics.anglesSummary}</p>
              </div>
            </div>
          )}

          {activeModel === 'math-graph' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(['linear', 'quadratic', 'sine'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGraphKind(g)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize ${
                      graphKind === g
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="graphASlider">{graphKind === 'linear' ? 'Slope (m)' : 'Scale (a)'}</label>
                  <span className="font-mono">{graphA.toFixed(1)}</span>
                </div>
                <input
                  id="graphASlider"
                  type="range"
                  min="-3"
                  max="3"
                  step="0.2"
                  value={graphA}
                  onChange={(e) => setGraphA(Number(e.target.value))}
                  className="mt-1 w-full accent-[#38BDF8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="graphCSlider">Y-Intercept (c)</label>
                  <span className="font-mono">{graphC.toFixed(1)}</span>
                </div>
                <input
                  id="graphCSlider"
                  type="range"
                  min="-4"
                  max="4"
                  step="0.5"
                  value={graphC}
                  onChange={(e) => setGraphC(Number(e.target.value))}
                  className="mt-1 w-full accent-[#5EEAD4]"
                />
              </div>
              <p className="rounded-xl bg-[#060E24] px-3 py-2 font-mono text-xs text-[#7DD3FC]">
                {graphKind === 'linear'
                  ? `y = ${graphA.toFixed(1)}x + (${graphC.toFixed(1)})`
                  : graphKind === 'quadratic'
                  ? `y = ${graphA.toFixed(1)}x² + (${graphC.toFixed(1)})`
                  : `y = ${graphA.toFixed(1)}·sin(x) + (${graphC.toFixed(1)})`}
              </p>
            </div>
          )}

          {activeModel === 'math-draw' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {['#38BDF8', '#5EEAD4', '#FBBF24', '#F472B6'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      aria-label={`Pen color ${col}`}
                      onClick={() => setPenColor(col)}
                      style={{ backgroundColor: col }}
                      className={`h-7 w-7 rounded-full border-2 ${
                        penColor === col ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearDrawingStrokes}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              </div>
              <label className="flex cursor-pointer items-center justify-between text-xs text-slate-300">
                <span>Show coordinate gridlines</span>
                <input
                  type="checkbox"
                  checked={drawGrid}
                  onChange={(e) => setDrawGrid(e.target.checked)}
                  className="h-4 w-4 accent-[#2E8BFF]"
                />
              </label>
            </div>
          )}

          {activeModel === 'bio-cell' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-2 gap-2">
                {(['plant', 'animal'] as const).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setCellType(ct)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${
                      cellType === ct
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {ct} Cell
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ORGANELLES.filter((o) => cellType === 'plant' || (o.id !== 'chloroplast' && o.id !== 'vacuole')).map(
                  (org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setSelectedOrganelle(org.id)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        selectedOrganelle === org.id
                          ? 'border-[#5EEAD4] bg-[#0F2A44] text-[#5EEAD4]'
                          : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                      }`}
                    >
                      {org.name}
                    </button>
                  )
                )}
              </div>
              <p className="rounded-xl bg-[#060E24] p-2.5 text-xs text-slate-200">
                {ORGANELLES.find((o) => o.id === selectedOrganelle)?.role}
              </p>
            </div>
          )}

          {activeModel === 'bio-dna' && (
            <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
              <button
                type="button"
                onClick={() => setDnaUnzip((prev) => !prev)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-bold ${
                  dnaUnzip
                    ? 'border-[#5EEAD4] bg-[#0F2A44] text-[#5EEAD4]'
                    : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-200'
                }`}
              >
                {dnaUnzip ? 'Zipped: Re-bond Strands' : 'Unzip Helix (Replication Fork)'}
              </button>
            </div>
          )}

          {activeModel === 'bio-body' && (
            <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex justify-between text-xs text-slate-300">
                <label htmlFor="heartBpmSlider">Heart Rate</label>
                <span className="font-mono text-[#5EEAD4]">{heartBpm} BPM</span>
              </div>
              <input
                id="heartBpmSlider"
                type="range"
                min="45"
                max="170"
                step="5"
                value={heartBpm}
                onChange={(e) => setHeartBpm(Number(e.target.value))}
                className="w-full accent-[#EF4444]"
              />
            </div>
          )}

          {activeModel === 'chem-atom' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex justify-between text-xs text-slate-300">
                <label htmlFor="labElectrons">Atomic Number (Z)</label>
                <span className="font-mono text-[#5EEAD4]">
                  {atomInfo.atomicNumber} · {atomInfo.name} ({atomInfo.symbol})
                </span>
              </div>
              <input
                id="labElectrons"
                type="range"
                min="1"
                max="18"
                step="1"
                value={electronCount}
                onChange={(e) => setElectronCount(Number(e.target.value))}
                className="w-full accent-[#5EEAD4]"
              />
              <div className="rounded-xl bg-[#060E24] p-2.5 text-xs text-slate-200">
                <p>
                  Shells: <span className="font-mono text-[#7DD3FC]">{atomInfo.shells.join(' · ')}</span> ({atomInfo.valence} valence e⁻)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{atomInfo.group}</p>
              </div>
            </div>
          )}

          {activeModel === 'chem-water' && (
            <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--alexyn-border)] pt-3">
              {[
                { id: 'h2o', label: 'H₂O (104.5° Bent)' },
                { id: 'co2', label: 'CO₂ (180° Linear)' },
                { id: 'ch4', label: 'CH₄ (Tetrahedral)' },
                { id: 'nacl', label: 'NaCl (Ionic Lattice)' },
              ].map((mol) => (
                <button
                  key={mol.id}
                  type="button"
                  onClick={() => setMoleculeKind(mol.id as typeof moleculeKind)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                    moleculeKind === mol.id
                      ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                      : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                  }`}
                >
                  {mol.label}
                </button>
              ))}
            </div>
          )}

          {activeModel === 'chem-reaction' && (
            <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex justify-between text-xs text-slate-300">
                <label htmlFor="reactionProgressSlider">Reaction Coordinate</label>
                <span className="font-mono">{reactionProgress}%</span>
              </div>
              <input
                id="reactionProgressSlider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={reactionProgress}
                onChange={(e) => setReactionProgress(Number(e.target.value))}
                className="w-full accent-[#F97316]"
              />
            </div>
          )}

          {activeModel === 'phys-forces' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="rampAngleSlider">Ramp Angle</label>
                    <span className="font-mono">{rampAngle}°</span>
                  </div>
                  <input
                    id="rampAngleSlider"
                    type="range"
                    min="5"
                    max="45"
                    value={rampAngle}
                    onChange={(e) => setRampAngle(Number(e.target.value))}
                    className="w-full accent-[#38BDF8]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="rampMassSlider">Mass</label>
                    <span className="font-mono">{rampMass} kg</span>
                  </div>
                  <input
                    id="rampMassSlider"
                    type="range"
                    min="1"
                    max="15"
                    value={rampMass}
                    onChange={(e) => setRampMass(Number(e.target.value))}
                    className="w-full accent-[#5EEAD4]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="appliedForceSlider">Push Force</label>
                    <span className="font-mono">{appliedForce} N</span>
                  </div>
                  <input
                    id="appliedForceSlider"
                    type="range"
                    min="0"
                    max="80"
                    step="2"
                    value={appliedForce}
                    onChange={(e) => setAppliedForce(Number(e.target.value))}
                    className="w-full accent-[#FBBF24]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="frictionSlider">Friction (μ)</label>
                    <span className="font-mono">{frictionCoeff.toFixed(2)}</span>
                  </div>
                  <input
                    id="frictionSlider"
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.05"
                    value={frictionCoeff}
                    onChange={(e) => setFrictionCoeff(Number(e.target.value))}
                    className="w-full accent-[#A78BFA]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#060E24] p-2.5 font-mono text-xs">
                <span className="text-slate-300">F_net: {forceMetrics.netForce} N</span>
                <span className="text-[#5EEAD4]">a: {forceMetrics.acceleration} m/s²</span>
              </div>
            </div>
          )}

          {activeModel === 'phys-wave' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <div className="grid grid-cols-2 gap-2">
                {(['transverse', 'longitudinal'] as const).map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => setWaveType(wt)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                      waveType === wt
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {wt}
                  </button>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="waveFreqSlider">Frequency (f)</label>
                  <span className="font-mono">{waveFreq.toFixed(1)} Hz</span>
                </div>
                <input
                  id="waveFreqSlider"
                  type="range"
                  min="1"
                  max="5"
                  step="0.2"
                  value={waveFreq}
                  onChange={(e) => setWaveFreq(Number(e.target.value))}
                  className="w-full accent-[#38BDF8]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="waveAmpSlider">Amplitude (A)</label>
                  <span className="font-mono">{waveAmp} px</span>
                </div>
                <input
                  id="waveAmpSlider"
                  type="range"
                  min="15"
                  max="65"
                  step="5"
                  value={waveAmp}
                  onChange={(e) => setWaveAmp(Number(e.target.value))}
                  className="w-full accent-[#5EEAD4]"
                />
              </div>
            </div>
          )}

          {activeModel === 'phys-circuit' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex gap-2">
                {(['series', 'parallel'] as const).map((cm) => (
                  <button
                    key={cm}
                    type="button"
                    onClick={() => setCircuitMode(cm)}
                    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                      circuitMode === cm
                        ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                    }`}
                  >
                    {cm}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCircuitClosed((prev) => !prev)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    circuitClosed
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {circuitClosed ? 'Switch: ON' : 'Switch: OFF'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="circuitV" className="block text-[10px] text-slate-400">
                    Volts ({circuitVoltage}V)
                  </label>
                  <input
                    id="circuitV"
                    type="range"
                    min="1"
                    max="24"
                    value={circuitVoltage}
                    onChange={(e) => setCircuitVoltage(Number(e.target.value))}
                    className="w-full accent-[#FBBF24]"
                  />
                </div>
                <div>
                  <label htmlFor="circuitR1" className="block text-[10px] text-slate-400">
                    R₁ ({circuitR1}Ω)
                  </label>
                  <input
                    id="circuitR1"
                    type="range"
                    min="1"
                    max="20"
                    value={circuitR1}
                    onChange={(e) => setCircuitR1(Number(e.target.value))}
                    className="w-full accent-[#38BDF8]"
                  />
                </div>
                <div>
                  <label htmlFor="circuitR2" className="block text-[10px] text-slate-400">
                    R₂ ({circuitR2}Ω)
                  </label>
                  <input
                    id="circuitR2"
                    type="range"
                    min="1"
                    max="20"
                    value={circuitR2}
                    onChange={(e) => setCircuitR2(Number(e.target.value))}
                    className="w-full accent-[#5EEAD4]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#060E24] p-2.5 text-center font-mono text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">R_tot</p>
                  <p className="text-white">{circuitMetrics.totalResistance}Ω</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Current (I)</p>
                  <p className="text-[#5EEAD4]">{circuitMetrics.currentAmps}A</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Power</p>
                  <p className="text-[#FBBF24]">{circuitMetrics.powerWatts}W</p>
                </div>
              </div>
            </div>
          )}

          {hasVisualCanvas && !isDrawMode && activeModel !== 'ict-logic' && activeModel !== 'econ-supply' && (
            <div className="space-y-2.5 border-t border-[var(--alexyn-border)] pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#142A5E] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{playing ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rotRef.current = { x: 0.35, y: 0.45 };
                    setZoom(1);
                    setSpeed(1);
                  }}
                  className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#07112B] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset View</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="labZoom">Zoom</label>
                    <span className="font-mono tabular-nums">{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    id="labZoom"
                    type="range"
                    min="0.5"
                    max="2.2"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="mt-1 w-full accent-[#2E8BFF]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <label htmlFor="labSpeed">Speed</label>
                    <span className="font-mono tabular-nums">{speed.toFixed(1)}x</span>
                  </div>
                  <input
                    id="labSpeed"
                    type="range"
                    min="0.1"
                    max="3.5"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="mt-1 w-full accent-[#2E8BFF]"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onMakeLabNotes(displayModelTitle, activeSubjectLabel)}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2.5 text-xs font-bold text-white"
          >
            <BookOpen className="h-4 w-4" />
            <span>Make Smart Notes on {displayModelTitle}</span>
          </button>
        </aside>
      </div>

      {/* EMBEDDED AI TUTOR */}
      <section
        aria-label="Practice Area AI Tutor"
        className="rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#132960] text-[#38BDF8]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Practice Tutor · Ask about {displayModelTitle}
              </h2>
              <p className="text-xs text-slate-400">
                Ask questions while practising the activity above.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => askInlineLabTutor(`Can you teach me ${displayModelTitle} simply?`)}
            disabled={askingLab}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3.5 py-1.5 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193272]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Can you teach me this?</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {currentMeta.quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => askInlineLabTutor(qp)}
              className="rounded-xl border border-[var(--alexyn-border)] bg-[#07112B] px-3 py-1.5 text-xs text-slate-200 hover:border-[#2E8BFF]"
            >
              {qp}
            </button>
          ))}
        </div>

        {subjectWarning && (
          <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="space-y-2">
                <p>{subjectWarning.message}</p>
                {onSwitchToSubject && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = subjectWarning.recommendedSubject;
                      setSubjectWarning(null);
                      onSwitchToSubject(target);
                    }}
                    className="rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30"
                  >
                    Switch to {subjectWarning.recommendedSubject} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {labMessages.length > 0 && (
          <div className="mt-4 max-h-60 space-y-2.5 overflow-y-auto rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-3.5">
            {labMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-8 bg-[#2157BD] text-white'
                    : 'mr-4 border border-[var(--alexyn-border)] bg-[#0E1B3D] text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {msg.role === 'assistant' && (
                  <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSpeakLab(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7DD3FC] hover:text-white"
                    >
                      {speakingLabId === msg.id ? (
                        <>
                          <VolumeX className="h-3 w-3" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          <span>Speak explanation</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {askingLab && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#38BDF8]" />
                <span>ALEXYN is explaining {displayModelTitle}...</span>
              </div>
            )}
            <div ref={tutorMessagesEndRef} />
          </div>
        )}

        <form onSubmit={handleLabSubmit} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={labQuestion}
            onChange={(e) => setLabQuestion(e.target.value)}
            placeholder={`Ask ALEXYN about ${displayModelTitle}...`}
            aria-label={`Ask ALEXYN about ${displayModelTitle}`}
            className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!labQuestion.trim() || askingLab}
            aria-label="Ask Practice Area Tutor"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 text-xs font-bold text-white disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </section>
    </div>
  );
}
