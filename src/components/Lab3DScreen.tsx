import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Atom,
  BookOpen,
  Calculator,
  CheckCircle2,
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
  History,
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
  Search,
  Send,
  Shapes,
  Sparkles,
  Square,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  computeCircuitMetrics,
  computeForceMotion,
  detectDifferentSubjectWarning,
  extractPureTargetSpeechText,
  getAtomElementInfo,
  getSpeechLangForSubject,
  stopBrowserTTS,
} from '../utils/alexynLogic';
import {
  computeExpandedGeometryMetrics,
  generateShapeWireframeData,
  searchShapes3D,
  SHAPES_3D_CATALOG,
  type ExpandedShapeId,
  type ShapeCategory,
} from '../utils/shapes3d';
import {
  evaluateSpokenEnglishMatch,
  getEnglishSpeakingWordsByDifficulty,
  loadEnglishSpeakingStats,
  recordEnglishSpeakingAttempt,
  saveEnglishSpeakingStats,
  type EnglishSpeakingDifficulty,
  type EnglishSpeakingStats,
  type EnglishWordComparisonResult,
} from '../utils/englishSpeaking';
import {
  applyGraphActionToState,
  DEFAULT_GRAPH_STATE,
  extractGraphActionsFromAIResponse,
  inferGraphActionFromPrompt,
  type GraphState,
} from '../utils/mathGraph';
import { voiceEngine } from '../utils/voiceEngine';
import {
  apiUrl,
  formatConnectionError,
  parseJsonResponseSafe,
} from '../utils/apiBase';
import {
  describeMicPermissionError,
  startBuiltInMicDictation,
  type ActiveMicHandle,
  type MicCaptureStatus,
} from '../utils/micRecorder';
import { MathEquationWorkspace } from './MathEquationWorkspace';
import { MathGraphWorkspace } from './MathGraphWorkspace';
import { VoiceControlBar } from './VoiceControlBar';
import type {
  AISelection,
  AITutorSettings,
  EducationProfile,
  LabModelId,
  LabSubjectCategory,
  LanguageAssessmentResult,
  SubjectItem,
  VoicePreferences,
} from '../types/alexyn';

interface Lab3DScreenProps {
  profile: EducationProfile;
  aiSettings?: AITutorSettings;
  aiSelection?: AISelection;
  voicePrefs?: VoicePreferences;
  initialModelId?: LabModelId | null;
  pendingGraphCommand?: { id: string; equations?: string[]; prompt?: string } | null;
  onConsumeGraphCommand?: () => void;
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
    id: 'math-working',
    category: 'mathematics',
    label: 'Calculation Workspace',
    subject: 'Mathematics',
    formula: 'Calc · Algebra · Steps',
    description:
      'Perform calculations or multi-step algebra in a spacious working notebook. Open Math Tools for operators, powers, subscripts, roots, and Greek letters, preview live calculated results, and check your working.',
    quickPrompts: [
      'Walk me through solving a quadratic equation by completing the square',
      'What are the most common sign errors when solving linear equations?',
    ],
    icon: Calculator,
  },
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
    formula: 'y = ax³ + bx² + cx + d',
    description:
      'Plot straight lines, quadratics, cubics, trig, and multiple equations together, add coordinate points (x, y), zoom, pan, extend negative axes, and ask AI to graph or explain changes.',
    quickPrompts: [
      'Draw the graph of y = x².',
      'Plot y = 2x + 3 on the same graph.',
      'Extend the negative side of the x-axis.',
      'Explain what happens when the coefficient changes.',
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
    id: 'humanities-timeline',
    category: 'humanities',
    label: 'Timeline & Cause-Effect',
    subject: 'History & Humanities',
    formula: 'Cause → Turning Point → Consequence',
    description:
      'Trace historical cause-and-effect chains step by step, evaluate primary sources for bias and reliability, and test chronology.',
    quickPrompts: [
      'Explain long-term vs immediate causes in history essays',
      'How do I assess primary source reliability for top exam marks?',
    ],
    icon: History,
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
  graphUpdateNote?: string;
  error?: boolean;
  retryPrompt?: string;
}

export function Lab3DScreen({
  profile,
  aiSettings,
  aiSelection,
  voicePrefs,
  initialModelId,
  pendingGraphCommand,
  onConsumeGraphCommand,
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
      if (low.includes('histor')) return 'humanities-timeline';
      if (
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
  const [mathShape, setMathShape] = useState<ExpandedShapeId>('octahedron');
  const [mathSize, setMathSize] = useState(6);
  const [mathAngle, setMathAngle] = useState(60);
  const [mathRatio, setMathRatio] = useState(0.5);
  const [shapeSearch, setShapeSearch] = useState('');
  const [shapeCategoryFilter, setShapeCategoryFilter] = useState<'all' | ShapeCategory>('all');
  const [graphState, setGraphState] = useState<GraphState>(() => ({
    equations: DEFAULT_GRAPH_STATE.equations.map((eq) => ({ ...eq })),
    points: DEFAULT_GRAPH_STATE.points.map((pt) => ({ ...pt })),
    viewport: { ...DEFAULT_GRAPH_STATE.viewport },
  }));
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
  const [langAssessment, setLangAssessment] = useState<LanguageAssessmentResult | null>(null);
  const [assessingSpeech, setAssessingSpeech] = useState(false);
  const [customPracticePhrase, setCustomPracticePhrase] = useState('');
  const [langConvoAutoSpeak, setLangConvoAutoSpeak] = useState(true);
  const [langConvoLoading, setLangConvoLoading] = useState(false);
  const [langConvoError, setLangConvoError] = useState<string | null>(null);
  const [langConvoTurns, setLangConvoTurns] = useState<
    Array<{
      id: string;
      role: 'partner' | 'user';
      targetText: string;
      englishText?: string;
      isNatural?: boolean;
      correction?: string;
      coachingNote?: string;
      pronunciationTip?: string;
      analysisMode?: 'audio-gemini' | 'transcript-only';
    }>
  >([]);

  // Guided English Speaking Trainer state
  const [englishDifficulty, setEnglishDifficulty] =
    useState<EnglishSpeakingDifficulty>('foundation');
  const [englishWordIdx, setEnglishWordIdx] = useState(0);
  const [englishSpeakingStats, setEnglishSpeakingStats] = useState<EnglishSpeakingStats>(() =>
    loadEnglishSpeakingStats()
  );
  const [englishWordMatch, setEnglishWordMatch] = useState<EnglishWordComparisonResult | null>(
    null
  );

  // Math Equation Editor & Step-by-Step Working state
  const [mathWorkingProblem, setMathWorkingProblem] = useState('Solve 3x - 7 = 14');
  const [mathWorkingSteps, setMathWorkingSteps] = useState<string[]>([
    '3x = 14 + 7',
    '3x = 21',
    'x = 7',
  ]);
  const [mathWorkingFinalAnswer, setMathWorkingFinalAnswer] = useState('x = 7');

  // Humanities Timeline & Source Cause-Effect state
  const [selectedEra, setSelectedEra] = useState<'industrial' | 'independence' | 'cold-war'>('industrial');
  const [selectedTimelineIdx, setSelectedTimelineIdx] = useState(0);
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
  const [labVoiceState, setLabVoiceState] = useState<MicCaptureStatus>('idle');
  const [labVoiceNotice, setLabVoiceNotice] = useState<string | null>(null);
  const [subjectWarning, setSubjectWarning] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);
  const langSpeechRecRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const labMicHandleRef = useRef<ActiveMicHandle | null>(null);
  const labVoiceBaseTextRef = useRef<string>('');
  const labInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechTranscriptRef = useRef<string>('');

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
    return () => {
      voiceEngine.stop();
      stopBrowserTTS();
      labMicHandleRef.current?.stop();
      labMicHandleRef.current = null;
      try {
        langSpeechRecRef.current?.abort();
      } catch {
        // ignore
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pendingGraphCommand) return;
    setActiveCategory('mathematics');
    setActiveModel('math-graph');
    if (pendingGraphCommand.equations && pendingGraphCommand.equations.length > 0) {
      const applied = applyGraphActionToState(graphState, {
        mode: 'replace',
        equations: pendingGraphCommand.equations,
      });
      setGraphState(applied.nextState);
    } else if (pendingGraphCommand.prompt) {
      const action = inferGraphActionFromPrompt(pendingGraphCommand.prompt, graphState);
      if (action) {
        const applied = applyGraphActionToState(graphState, action);
        setGraphState(applied.nextState);
      }
    }
    onConsumeGraphCommand?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGraphCommand?.id]);

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
      else if (low.includes('histor')) setActiveModel('humanities-timeline');
      else if (
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

  const hasVisualCanvas =
    activeModel !== 'lang-practice' &&
    activeModel !== 'humanities-practice' &&
    activeModel !== 'humanities-timeline' &&
    activeModel !== 'math-working' &&
    activeModel !== 'math-graph';
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

  const mathMetrics = computeExpandedGeometryMetrics(mathShape, mathSize, mathAngle, mathRatio);
  const activeShapeMeta =
    SHAPES_3D_CATALOG.find((item) => item.id === mathShape) || SHAPES_3D_CATALOG[0];
  const filteredShapes = searchShapes3D(shapeSearch).filter(
    (item) => shapeCategoryFilter === 'all' || item.category === shapeCategoryFilter
  );
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
  const englishWordsForLevel = getEnglishSpeakingWordsByDifficulty(englishDifficulty);
  const activeEnglishWord =
    englishWordsForLevel[englishWordIdx % Math.max(1, englishWordsForLevel.length)] ||
    englishWordsForLevel[0];

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
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
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
        const mesh = generateShapeWireframeData(mathShape, mathSize, mathAngle, mathRatio);
        const projVerts = mesh.vertices.map((v) => project3D(v.x, v.y, v.z, rx, ry, zoom, cx, cy));

        if (activeShapeMeta.category === '2d' && projVerts.length >= 3) {
          ctx.beginPath();
          projVerts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
          ctx.closePath();
          ctx.fillStyle = 'rgba(46, 139, 255, 0.2)';
          ctx.fill();
        }

        mesh.rings.forEach((ring) => {
          if (ring.points.length < 2) return;
          const pRing = ring.points.map((pt) => project3D(pt.x, pt.y, pt.z, rx, ry, zoom, cx, cy));
          ctx.save();
          if (ring.dashed) ctx.setLineDash([5, 4]);
          ctx.beginPath();
          pRing.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
          if (activeShapeMeta.category === '2d') {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
            ctx.fill();
          }
          ctx.strokeStyle = ring.color || mesh.accentColor;
          ctx.lineWidth = 2.1;
          ctx.stroke();
          ctx.restore();
        });

        mesh.edges.forEach(([aIdx, bIdx]) => {
          const va = projVerts[aIdx];
          const vb = projVerts[bIdx];
          if (!va || !vb) return;
          const avgDepth = (va.depth + vb.depth) / 2;
          const alpha = Math.max(0.42, Math.min(1, 0.85 - avgDepth / 340));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(va.sx, va.sy);
          ctx.lineTo(vb.sx, vb.sy);
          ctx.strokeStyle = mesh.accentColor;
          ctx.lineWidth = 2.3;
          ctx.stroke();
          ctx.restore();
        });
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
    mathRatio,
    activeShapeMeta.category,
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
  const [labSpeechError, setLabSpeechError] = useState<string | null>(null);

  useEffect(() => {
    return voiceEngine.subscribe((snap) => {
      if (snap.status === 'idle') {
        setSpeakingLabId(null);
      } else {
        setSpeakingLabId(snap.activeId);
      }
      if (snap.error) {
        setLabSpeechError(snap.error);
      }
    });
  }, []);

  const handleToggleSpeakLab = (
    id: string,
    text: string,
    targetLanguage?: string,
    speedOverride?: number
  ) => {
    setLabSpeechError(null);
    if (speakingLabId === id) {
      voiceEngine.stop();
      setSpeakingLabId(null);
      return;
    }
    const cleanText = targetLanguage ? extractPureTargetSpeechText(text) || text : text;
    setSpeakingLabId(id);
    void voiceEngine.speak({
      id,
      text: cleanText,
      prefs: voicePrefs,
      subjectHint: targetLanguage,
      langOverride: targetLanguage ? getSpeechLangForSubject(targetLanguage) : 'en-US',
      speedOverride,
    });
  };

  const resetEnglishSpeakingAttempt = () => {
    setSpeakingTargetTerm(null);
    setSpokenHeardText('');
    setSpokenResultFeedback(null);
    setLangAssessment(null);
    setEnglishWordMatch(null);
  };

  const recordEnglishWordAttemptResult = (wordId: string, matched: boolean) => {
    setEnglishSpeakingStats((prev) => {
      const next = recordEnglishSpeakingAttempt(prev, wordId, matched);
      saveEnglishSpeakingStats(next);
      return next;
    });
  };

  const evaluateCapturedSpeaking = async (
    targetPhrase: string,
    audioBase64?: string,
    audioMimeType?: string,
    transcriptHint?: string,
    isConversationReply = false
  ) => {
    const cleanTranscript = (transcriptHint || speechTranscriptRef.current || '').trim();
    if (!audioBase64 && !cleanTranscript) {
      setSpokenResultFeedback(
        'No speech audio or spoken transcript was captured. Allow microphone access or speak clearly and try again.'
      );
      return;
    }

    if (isConversationReply) {
      void handleSendLanguageTurn(cleanTranscript, audioBase64, audioMimeType);
      return;
    }

    const isEnglishGuided = practiceLang === 'English' && langTab === 'vocab' && !isConversationReply;
    const matchedEnglishWord = isEnglishGuided
      ? englishWordsForLevel.find(
          (w) => w.targetWord.toLowerCase() === targetPhrase.toLowerCase()
        ) || activeEnglishWord
      : undefined;

    if (!audioBase64 && cleanTranscript && isEnglishGuided && matchedEnglishWord) {
      const matchRes = evaluateSpokenEnglishMatch(
        matchedEnglishWord.targetWord,
        cleanTranscript,
        matchedEnglishWord.pronunciationTip
      );
      setEnglishWordMatch(matchRes);
      setSpokenHeardText(cleanTranscript);
      recordEnglishWordAttemptResult(matchedEnglishWord.id, matchRes.isMatch);
      setLangAssessment({
        analysisMode: 'transcript-only',
        transcript: cleanTranscript,
        clarityScore: matchRes.matchPercentage,
        accuracyScore: matchRes.matchPercentage,
        wordFeedback: [
          {
            target: matchedEnglishWord.targetWord,
            heard: cleanTranscript,
            status:
              matchRes.status === 'correct'
                ? 'good'
                : matchRes.status === 'close'
                ? 'practice'
                : 'missing',
            tip: matchRes.feedback,
          },
        ],
        overallNote: matchRes.feedback,
        pronunciationTips: [matchedEnglishWord.pronunciationTip],
        suggestedRetryPhrase: matchedEnglishWord.targetWord,
      });
      return;
    }

    setAssessingSpeech(true);
    setLangAssessment(null);
    setSpokenResultFeedback(null);

    try {
      const res = await fetch(apiUrl('/api/languages/assess'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55000),
        body: JSON.stringify({
          targetPhrase,
          language: practiceLang,
          audioBase64,
          audioMimeType,
          transcriptHint: cleanTranscript,
          aiSelection,
        }),
      });
      const data = await parseJsonResponseSafe<LanguageAssessmentResult>(res);
      if (!res.ok) {
        throw new Error(data.error || 'Could not assess spoken response.');
      }
      const result = data as LanguageAssessmentResult;
      setLangAssessment(result);
      const effectiveTranscript = (result.transcript || cleanTranscript).trim();
      if (effectiveTranscript) {
        setSpokenHeardText(effectiveTranscript);
      }
      if (isEnglishGuided && matchedEnglishWord) {
        if (effectiveTranscript) {
          const matchRes = evaluateSpokenEnglishMatch(
            matchedEnglishWord.targetWord,
            effectiveTranscript,
            matchedEnglishWord.pronunciationTip
          );
          setEnglishWordMatch(matchRes);
          recordEnglishWordAttemptResult(
            matchedEnglishWord.id,
            matchRes.isMatch || result.accuracyScore >= 75
          );
        } else {
          recordEnglishWordAttemptResult(matchedEnglishWord.id, result.accuracyScore >= 75);
        }
      }
    } catch (err) {
      if (isEnglishGuided && matchedEnglishWord && cleanTranscript) {
        const matchRes = evaluateSpokenEnglishMatch(
          matchedEnglishWord.targetWord,
          cleanTranscript,
          matchedEnglishWord.pronunciationTip
        );
        setEnglishWordMatch(matchRes);
        setSpokenHeardText(cleanTranscript);
        recordEnglishWordAttemptResult(matchedEnglishWord.id, matchRes.isMatch);
        setLangAssessment({
          analysisMode: 'transcript-only',
          transcript: cleanTranscript,
          clarityScore: matchRes.matchPercentage,
          accuracyScore: matchRes.matchPercentage,
          wordFeedback: [
            {
              target: matchedEnglishWord.targetWord,
              heard: cleanTranscript,
              status:
                matchRes.status === 'correct'
                  ? 'good'
                  : matchRes.status === 'close'
                  ? 'practice'
                  : 'missing',
              tip: matchRes.feedback,
            },
          ],
          overallNote: matchRes.feedback,
          pronunciationTips: [matchedEnglishWord.pronunciationTip],
          suggestedRetryPhrase: matchedEnglishWord.targetWord,
        });
      } else {
        setSpokenResultFeedback(
          formatConnectionError(
            err,
            'Could not evaluate spoken audio right now. Try again closer to the mic.'
          )
        );
      }
    } finally {
      setAssessingSpeech(false);
    }
  };

  const startSpeakingPractice = async (targetPhrase: string, isConversationReply = false) => {
    setSpokenHeardText('');
    setSpokenResultFeedback(null);
    setLangAssessment(null);
    setEnglishWordMatch(null);

    if (speakingTargetTerm === targetPhrase) {
      if (isConversationReply && langConvoAutoSpeak) {
        voiceEngine.unlockAudio();
      }
      try {
        langSpeechRecRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      setSpeakingTargetTerm(null);
      return;
    }

    speechTranscriptRef.current = '';

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

    const startSpeechRecHint = () => {
      if (!SpeechRec) return false;
      try {
        const rec = new SpeechRec();
        rec.lang = getSpeechLangForSubject(practiceLang);
        rec.interimResults = true;
        rec.onresult = (ev) => {
          const transcript = Array.from(ev.results)
            .map((r) => r[0]?.transcript || '')
            .join(' ')
            .trim();
          speechTranscriptRef.current = transcript;
          setSpokenHeardText(transcript);
          if (isConversationReply) {
            setTranslationPrompt(transcript);
          }
        };
        rec.onerror = () => {
          // Non-fatal if MediaRecorder is handling audio capture
        };
        rec.onend = () => {
          if (!mediaRecorderRef.current) {
            setSpeakingTargetTerm(null);
            if (speechTranscriptRef.current && !isConversationReply) {
              void evaluateCapturedSpeaking(
                targetPhrase,
                undefined,
                undefined,
                speechTranscriptRef.current,
                false
              );
            }
          }
        };
        langSpeechRecRef.current = rec;
        rec.start();
        return true;
      } catch {
        return false;
      }
    };

    let micFailureReason = '';
    // Prefer real MediaRecorder audio capture so backend assesses acoustic pronunciation
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];
        const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          try {
            langSpeechRecRef.current?.stop();
          } catch {
            // ignore
          }
          setSpeakingTargetTerm(null);

          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          if (blob.size < 250) {
            if (speechTranscriptRef.current) {
              void evaluateCapturedSpeaking(
                targetPhrase,
                undefined,
                undefined,
                speechTranscriptRef.current,
                isConversationReply
              );
            } else {
              setSpokenResultFeedback(
                'No clear microphone audio was captured. Tap Speak again and speak close to your mic.'
              );
            }
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = String(reader.result || '');
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            void evaluateCapturedSpeaking(
              targetPhrase,
              b64,
              blob.type || 'audio/webm',
              speechTranscriptRef.current,
              isConversationReply
            );
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorderRef.current = recorder;
        setSpeakingTargetTerm(targetPhrase);
        recorder.start();
        startSpeechRecHint();
        return;
      } catch (err) {
        micFailureReason = describeMicPermissionError(err);
      }
    }

    if (startSpeechRecHint()) {
      setSpeakingTargetTerm(targetPhrase);
    } else {
      setSpokenResultFeedback(
        micFailureReason ||
          'Microphone capture is unavailable in this browser—listen aloud with the Speaker button or type your response.'
      );
    }
  };

  const handleCheckTranslation = async (modeType = 'translation') => {
    if (!translationPrompt.trim()) return;
    setCheckingTranslation(true);
    setTranslationResult(null);
    try {
      const res = await fetch(apiUrl('/api/language/check'), {
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
          aiSelection,
        }),
      });
      const data = await parseJsonResponseSafe<{
        isNatural?: boolean;
        isCorrect?: boolean;
        corrected?: string;
        correctedSentence?: string;
        englishMeaning?: string;
        feedback?: string;
        grammarExplanation?: string;
      }>(res);
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
        feedback: formatConnectionError(
          err,
          'Unable to reach AI checker right now; compare with the reference sentence above.'
        ),
      });
    } finally {
      setCheckingTranslation(false);
    }
  };

  const handleSendLanguageTurn = async (
    transcriptOverride?: string,
    audioBase64?: string,
    audioMimeType?: string
  ) => {
    const attempt = (transcriptOverride ?? translationPrompt).trim();
    if (!attempt && !audioBase64) return;
    if (!transcriptOverride) {
      setTranslationPrompt('');
    }
    if (langConvoAutoSpeak) {
      voiceEngine.unlockAudio();
    }
    setLangConvoLoading(true);
    setLangConvoError(null);

    const historyPayload = [
      { role: 'partner' as const, text: langPack.conversation.speakerLine },
      ...langConvoTurns.map((t) => ({ role: t.role, text: t.targetText })),
    ];

    try {
      const res = await fetch(apiUrl('/api/language/converse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          language: practiceLang,
          transcript: attempt,
          audioBase64,
          audioMimeType,
          scenario: `${langPack.conversation.speakerLine} (${langPack.conversation.goalPrompt})`,
          history: historyPayload,
          aiSelection,
        }),
      });
      const data = await parseJsonResponseSafe<{
        heardText?: string;
        understoodMeaning?: string;
        isNatural?: boolean;
        correctedPhrasing?: string;
        coachingNote?: string;
        pronunciationTip?: string;
        analysisMode?: string;
        partnerReplyTarget?: string;
        partnerReplyEnglish?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach conversation partner right now.');
      }

      const heard = String(data.heardText || attempt || '(Spoken audio)').trim();
      const userTurn = {
        id: `conv-u-${Date.now()}`,
        role: 'user' as const,
        targetText: heard,
        englishText: data.understoodMeaning ? String(data.understoodMeaning) : undefined,
        isNatural: Boolean(data.isNatural ?? true),
        correction: data.correctedPhrasing ? String(data.correctedPhrasing) : undefined,
        coachingNote: data.coachingNote ? String(data.coachingNote) : undefined,
        pronunciationTip: data.pronunciationTip ? String(data.pronunciationTip) : undefined,
        analysisMode: (data.analysisMode === 'audio-gemini' ? 'audio-gemini' : 'transcript-only') as
          | 'audio-gemini'
          | 'transcript-only',
      };
      const partnerReply = String(data.partnerReplyTarget || '').trim();
      const partnerTurn = partnerReply
        ? {
            id: `conv-p-${Date.now() + 1}`,
            role: 'partner' as const,
            targetText: partnerReply,
            englishText: data.partnerReplyEnglish ? String(data.partnerReplyEnglish) : undefined,
            pronunciationTip: data.pronunciationTip ? String(data.pronunciationTip) : undefined,
          }
        : null;

      setLangConvoTurns((prev) => (partnerTurn ? [...prev, userTurn, partnerTurn] : [...prev, userTurn]));

      if (langConvoAutoSpeak && partnerTurn) {
        const cleanReply = extractPureTargetSpeechText(partnerTurn.targetText) || partnerTurn.targetText;
        void voiceEngine.speak({
          id: partnerTurn.id,
          text: cleanReply,
          prefs: voicePrefs,
          subjectHint: practiceLang,
          langOverride: getSpeechLangForSubject(practiceLang),
        });
      }
    } catch (err) {
      setLangConvoError(
        formatConnectionError(err, 'Conversation partner temporarily unavailable.')
      );
    } finally {
      setLangConvoLoading(false);
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

    // Pre-apply deterministic prompt graph action immediately if in math-graph mode
    const promptAction =
      activeModel === 'math-graph' ? inferGraphActionFromPrompt(q, graphState) : null;
    let appliedSummary: string | null = null;
    let workingGraphState = graphState;
    if (promptAction) {
      const applied = applyGraphActionToState(workingGraphState, promptAction);
      workingGraphState = applied.nextState;
      appliedSummary = applied.changeSummary;
      setGraphState(workingGraphState);
    }

    try {
      const res = await fetch(apiUrl('/api/chat'), {
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
          aiSelection,
          graphContext:
            activeModel === 'math-graph'
              ? {
                  equations: workingGraphState.equations.map((e) => e.expression),
                  points: workingGraphState.points.map((p) => ({
                    x: p.x,
                    y: p.y,
                    label: p.label,
                  })),
                  viewport: workingGraphState.viewport,
                }
              : undefined,
        }),
      });
      const data = await parseJsonResponseSafe<{ reply?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Could not reach Practice Area AI tutor.');

      let replyText = String(data.reply || '');
      let finalSummary = appliedSummary;
      if (activeModel === 'math-graph') {
        const extracted = extractGraphActionsFromAIResponse(replyText);
        replyText = extracted.cleanText || replyText;
        if (extracted.action) {
          const appliedAI = applyGraphActionToState(workingGraphState, extracted.action);
          setGraphState(appliedAI.nextState);
          if (appliedAI.changeSummary) {
            finalSummary = appliedAI.changeSummary;
          }
        }
      }

      setLabMessages((prev) => [
        ...prev,
        {
          id: `lab-a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          graphUpdateNote: finalSummary || undefined,
        },
      ]);
    } catch (err) {
      const msg = formatConnectionError(err, 'Unable to reach Practice Tutor right now.');
      setLabMessages((prev) => [
        ...prev,
        {
          id: `lab-e-${Date.now()}`,
          role: 'assistant',
          text: appliedSummary
            ? `Updated the interactive graph directly (${appliedSummary}). ${msg}`
            : msg,
          graphUpdateNote: appliedSummary || undefined,
          error: true,
          retryPrompt: q,
        },
      ]);
    } finally {
      setAskingLab(false);
    }
  };

  const stopLabVoiceKeepText = () => {
    labMicHandleRef.current?.stop();
    labMicHandleRef.current = null;
    setLabVoiceState((curr) => (curr === 'listening' ? 'stopped' : curr));
  };

  const toggleLabVoiceInput = async () => {
    if (labVoiceState === 'listening') {
      stopLabVoiceKeepText();
      return;
    }
    if (labVoiceState === 'transcribing') {
      return;
    }

    setLabVoiceNotice(null);
    labVoiceBaseTextRef.current = labQuestion.trim();

    const speechLang = getSpeechLangForSubject(activeSubjectLabel, voicePrefs?.readLanguageCode);
    const handle = await startBuiltInMicDictation(speechLang, {
      onStatusChange: (status) => {
        setLabVoiceState(status);
        if (status === 'stopped' || status === 'error') {
          labMicHandleRef.current = null;
        }
      },
      onTranscript: (spoken) => {
        const prefix = labVoiceBaseTextRef.current.trim();
        setLabQuestion(prefix ? (spoken ? `${prefix} ${spoken}` : prefix) : spoken);
      },
      onNotice: (msg) => {
        setLabVoiceNotice(msg);
      },
    });
    if (handle) {
      labMicHandleRef.current = handle;
      labInputRef.current?.focus();
    }
  };

  const handleLabSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (labVoiceState === 'listening') {
      stopLabVoiceKeepText();
    }
    setLabVoiceState('idle');
    setLabVoiceNotice(null);
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

      {activeModel === 'math-graph' ? (
        <MathGraphWorkspace
          graphState={graphState}
          onChangeGraphState={setGraphState}
          onAskTutorAboutGraph={askInlineLabTutor}
        />
      ) : activeModel === 'math-working' ? (
        <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-[#7DD3FC]">
                Mathematics · Equation Editor & Step-by-Step Checking
              </p>
              <h2 className="mt-0.5 text-xl font-extrabold text-white">
                {displayModelTitle}
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: 'Arithmetic',
                  problem: 'Evaluate (125 * 4) + sqrt(144) - 18',
                  steps: ['125 * 4 = 500', 'sqrt(144) = 12', '500 + 12 - 18'],
                  ans: '494',
                },
                {
                  label: 'Linear Eq',
                  problem: 'Solve 3x - 7 = 14',
                  steps: ['3x = 14 + 7', '3x = 21', 'x = 7'],
                  ans: 'x = 7',
                },
                {
                  label: 'Quadratic',
                  problem: 'Solve x² - 5x + 6 = 0',
                  steps: ['(x - 2)(x - 3) = 0', 'x - 2 = 0 or x - 3 = 0'],
                  ans: 'x = 2 or x = 3',
                },
                {
                  label: 'Roots & Trig',
                  problem: 'Evaluate nthRoot(81, 4) + sin(30°)',
                  steps: ['nthRoot(81, 4) = 3', 'sin(30°) = 0.5', '3 + 0.5'],
                  ans: '3.5',
                },
                {
                  label: 'Blank Notebook',
                  problem: '',
                  steps: [''],
                  ans: '',
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMathWorkingProblem(preset.problem);
                    setMathWorkingSteps(preset.steps);
                    setMathWorkingFinalAnswer(preset.ans);
                  }}
                  className="rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-[#38BDF8]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <MathEquationWorkspace
            problemStatement={mathWorkingProblem}
            onChangeProblem={setMathWorkingProblem}
            steps={mathWorkingSteps}
            onChangeSteps={setMathWorkingSteps}
            finalAnswer={mathWorkingFinalAnswer}
            onChangeFinalAnswer={setMathWorkingFinalAnswer}
            maxMarks={4}
            profile={profile}
            aiSelection={aiSelection}
          />
        </section>
      ) : (
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
                      setTranslationPrompt('');
                      setLangConvoTurns([]);
                      setLangConvoError(null);
                      setCustomPracticePhrase('');
                      setListeningAnswers({});
                      setGrammarAnswers({});
                      setReadingAnswer(null);
                      resetEnglishSpeakingAttempt();
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
                  {practiceLang === 'English' && activeEnglishWord ? (
                    <div className="space-y-4">
                      {/* Difficulty Selector & Progress Stats */}
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="English speaking difficulty">
                          {(
                            [
                              { id: 'foundation', label: 'Foundation' },
                              { id: 'intermediate', label: 'Intermediate' },
                              { id: 'advanced', label: 'Advanced' },
                            ] as const
                          ).map((lvl) => {
                            const active = englishDifficulty === lvl.id;
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => {
                                  setEnglishDifficulty(lvl.id);
                                  setEnglishWordIdx(0);
                                  resetEnglishSpeakingAttempt();
                                }}
                                className={`min-h-[34px] rounded-xl border px-3 py-1 text-xs font-bold transition-colors ${
                                  active
                                    ? 'border-[#38BDF8] bg-[#16346E] text-white'
                                    : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
                                }`}
                              >
                                {lvl.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B1C3F] px-2.5 py-1 text-slate-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>
                              Completed{' '}
                              <strong className="text-white">
                                {englishSpeakingStats.completedIds.length}/15
                              </strong>
                            </span>
                          </span>
                          <span className="rounded-lg bg-[#0B1C3F] px-2.5 py-1 text-slate-200">
                            Avg Accuracy{' '}
                            <strong className="text-[#7DD3FC]">
                              {englishSpeakingStats.attempts > 0
                                ? `${Math.round(
                                    (englishSpeakingStats.matches /
                                      englishSpeakingStats.attempts) *
                                      100
                                  )}%`
                                : '—'}
                            </strong>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B1C3F] px-2.5 py-1 text-slate-200">
                            <Trophy className="h-3.5 w-3.5 text-amber-300" />
                            <span>
                              Best Streak{' '}
                              <strong className="text-amber-200">
                                {englishSpeakingStats.bestStreak}
                              </strong>
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Guided Active Word / Phrase Card */}
                      <div className="space-y-4 rounded-2xl border border-[#38BDF8]/40 bg-[#060E24] p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[#7DD3FC]">
                            Word {(englishWordIdx % englishWordsForLevel.length) + 1} of{' '}
                            {englishWordsForLevel.length} · {englishDifficulty}
                          </span>
                          {englishSpeakingStats.completedIds.includes(activeEnglishWord.id) && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Practised</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                            {activeEnglishWord.targetWord}
                          </h3>
                          <p className="mt-1 text-sm text-[#5EEAD4]">
                            Say: <span className="font-mono font-semibold">{activeEnglishWord.phonetic}</span>{' '}
                            <span className="text-slate-400">({activeEnglishWord.syllables})</span>
                          </p>
                          <p className="mt-1.5 text-xs text-slate-300">
                            Meaning: {activeEnglishWord.meaning}
                          </p>
                          <p className="mt-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3 py-2 text-xs text-slate-200">
                            <strong className="text-[#7DD3FC]">Coaching tip:</strong>{' '}
                            {activeEnglishWord.pronunciationTip}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSpeakLab(
                                `eng-word-${activeEnglishWord.id}`,
                                activeEnglishWord.targetWord,
                                'English'
                              )
                            }
                            aria-label={`Hear pronunciation of ${activeEnglishWord.targetWord}`}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#38BDF8]/50 bg-[#122658] px-3.5 py-2 text-xs font-bold text-[#7DD3FC] hover:text-white"
                          >
                            {speakingLabId === `eng-word-${activeEnglishWord.id}` ? (
                              <>
                                <VolumeX className="h-4 w-4" />
                                <span>Stop Voice</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-4 w-4" />
                                <span>Hear Model</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => startSpeakingPractice(activeEnglishWord.targetWord)}
                            aria-label={`Speak ${activeEnglishWord.targetWord}`}
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                              speakingTargetTerm === activeEnglishWord.targetWord
                                ? 'border-rose-400 bg-rose-500 text-white'
                                : 'border-transparent bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] text-white'
                            }`}
                          >
                            {speakingTargetTerm === activeEnglishWord.targetWord ? (
                              <>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                <span>Stop Recording</span>
                              </>
                            ) : (
                              <>
                                <Mic className="h-4 w-4" />
                                <span>Speak Now</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={resetEnglishSpeakingAttempt}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#38BDF8]"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Try Again</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEnglishWordIdx(
                                (prev) => (prev + 1) % englishWordsForLevel.length
                              );
                              resetEnglishSpeakingAttempt();
                            }}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3.5 py-2 text-xs font-bold text-[#5EEAD4] hover:border-[#5EEAD4]"
                          >
                            <span>Next Word →</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Custom / Any Phrase Pronunciation Coach */}
                      <div className="space-y-2.5 rounded-2xl border border-[#38BDF8]/35 bg-[#060E24] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#7DD3FC]">
                            {practiceLang} Pronunciation Coach
                          </p>
                          <span className="text-[11px] text-slate-400">
                            Tap any card below or type your own phrase
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={customPracticePhrase}
                            onChange={(e) => setCustomPracticePhrase(e.target.value)}
                            placeholder={`Type any ${practiceLang} word or phrase (e.g. "${langPack.vocab[0]?.term || ''}")...`}
                            className="min-w-[200px] flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-2 text-xs text-white placeholder:text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const target = customPracticePhrase.trim() || langPack.vocab[0]?.term || '';
                              if (target) handleToggleSpeakLab(`custom-${practiceLang}`, target, practiceLang);
                            }}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#38BDF8]/40 bg-[#122658] px-3 py-1.5 text-xs font-semibold text-[#7DD3FC] hover:text-white"
                          >
                            {speakingLabId === `custom-${practiceLang}` ? (
                              <VolumeX className="h-3.5 w-3.5" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            <span>Hear Model</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const target = customPracticePhrase.trim() || langPack.vocab[0]?.term || '';
                              if (target) void startSpeakingPractice(target);
                            }}
                            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                              speakingTargetTerm === (customPracticePhrase.trim() || langPack.vocab[0]?.term)
                                ? 'border-rose-400 bg-rose-500 text-white'
                                : 'border-transparent bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] text-white'
                            }`}
                          >
                            <Mic className="h-3.5 w-3.5" />
                            <span>
                              {speakingTargetTerm === (customPracticePhrase.trim() || langPack.vocab[0]?.term)
                                ? 'Stop Recording'
                                : 'Speak Now'}
                            </span>
                          </button>
                          {(langAssessment || spokenHeardText || spokenResultFeedback) && (
                            <button
                              type="button"
                              onClick={resetEnglishSpeakingAttempt}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#38BDF8]"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Try Again</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {langPack.vocab.map((v) => {
                          const isListeningThis = speakingTargetTerm === v.term;
                          return (
                            <div
                              key={v.term}
                              className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-xs"
                            >
                              <button
                                type="button"
                                onClick={() => setCustomPracticePhrase(v.term)}
                                className="min-w-0 text-left"
                              >
                                <p className="font-bold text-white">
                                  {v.term}{' '}
                                  <span className="font-normal text-[#5EEAD4]">[{v.english}]</span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  Say: {v.phonetic}
                                </p>
                              </button>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSpeakLab(`vocab-${v.term}`, v.term, practiceLang)
                                  }
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
                                  onClick={() => {
                                    setCustomPracticePhrase(v.term);
                                    void startSpeakingPractice(v.term);
                                  }}
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
                    </div>
                  )}

                  {labSpeechError && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
                      {labSpeechError}
                    </div>
                  )}

                  {(assessingSpeech ||
                    langAssessment ||
                    englishWordMatch ||
                    spokenHeardText ||
                    spokenResultFeedback) && (
                    <div className="space-y-2.5 rounded-2xl border border-[#38BDF8]/40 bg-[#0D1E45] p-3.5 text-xs text-slate-100">
                      {assessingSpeech && (
                        <div className="flex items-center gap-2 text-[#7DD3FC]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Analysing your spoken audio and pronunciation...</span>
                        </div>
                      )}

                      {englishWordMatch && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#071330] px-3 py-2">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                              englishWordMatch.status === 'correct'
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : englishWordMatch.status === 'close'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-rose-500/20 text-rose-200'
                            }`}
                          >
                            {englishWordMatch.status === 'correct'
                              ? 'Target Matched'
                              : englishWordMatch.status === 'close'
                              ? 'Almost There'
                              : 'Needs Another Try'}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#7DD3FC]">
                            Word Match {englishWordMatch.matchPercentage}%
                          </span>
                        </div>
                      )}

                      {langAssessment && (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                                langAssessment.analysisMode === 'audio-gemini'
                                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                  : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                              }`}
                            >
                              {langAssessment.analysisMode === 'audio-gemini'
                                ? 'Real Audio Assessed via Gemini'
                                : 'Transcript Word-Match Only (Acoustic pronunciation not directly analysed)'}
                            </span>
                            <div className="flex items-center gap-3 font-mono font-bold">
                              <span className="text-[#5EEAD4]">
                                Clarity {langAssessment.clarityScore}%
                              </span>
                              <span className="text-[#7DD3FC]">
                                Accuracy {langAssessment.accuracyScore}%
                              </span>
                            </div>
                          </div>

                          {langAssessment.transcript && (
                            <p className="font-semibold text-[#7DD3FC]">
                              Heard: "{langAssessment.transcript}"
                            </p>
                          )}
                          <p className="leading-relaxed text-slate-200">
                            {langAssessment.overallNote}
                          </p>

                          {langAssessment.wordFeedback.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {langAssessment.wordFeedback.map((wf, wIdx) => (
                                <span
                                  key={`${wf.target}-${wIdx}`}
                                  title={wf.tip}
                                  className={`rounded-lg border px-2 py-1 text-[11px] ${
                                    wf.status === 'good'
                                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                      : wf.status === 'practice'
                                      ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                                      : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                                  }`}
                                >
                                  {wf.target}
                                  {wf.tip ? ` — ${wf.tip}` : ''}
                                </span>
                              ))}
                            </div>
                          )}

                          {langAssessment.pronunciationTips.length > 0 && (
                            <ul className="space-y-1 text-[11px] text-slate-300">
                              {langAssessment.pronunciationTips.map((tip, tIdx) => (
                                <li key={tIdx}>• {tip}</li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}

                      {!langAssessment && spokenHeardText && (
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
                          <div className="flex flex-wrap items-center gap-2">
                            <VoiceControlBar
                              playbackId={`listen-norm-${practiceLang}-${idx}`}
                              text={item.spokenText}
                              voicePrefs={voicePrefs}
                              subjectHint={practiceLang}
                              langOverride={getSpeechLangForSubject(practiceLang)}
                              compact
                              label="Play Audio"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSpeakLab(
                                  `listen-slow-${idx}`,
                                  item.spokenText,
                                  practiceLang,
                                  0.72
                                )
                              }
                              className="rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-[#38BDF8]"
                            >
                              {speakingLabId === `listen-slow-${idx}` ? 'Stop Slow' : 'Slowly (0.7x)'}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#5EEAD4]">
                        Live {practiceLang} Spoken Conversation
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Goal: {langPack.conversation.goalPrompt}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLangConvoAutoSpeak((v) => !v)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                          langConvoAutoSpeak
                            ? 'border-[#5EEAD4]/50 bg-[#0D2A3F] text-[#5EEAD4]'
                            : 'border-[var(--alexyn-border)] bg-[#0A1430] text-slate-300'
                        }`}
                      >
                        {langConvoAutoSpeak ? 'Auto-Speak: On' : 'Auto-Speak: Off'}
                      </button>
                      {langConvoTurns.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setLangConvoTurns([]);
                            setLangConvoError(null);
                            setTranslationPrompt('');
                          }}
                          className="rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
                        >
                          Reset Dialogue
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Conversation Thread */}
                  <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
                    {/* Opening Partner Prompt */}
                    <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[#2E8BFF]/30 bg-[#0A1430] p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7DD3FC]">
                          Dialogue Partner
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {langPack.conversation.speakerLine}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          [{langPack.conversation.speakerMeaning}]
                        </p>
                      </div>
                      <VoiceControlBar
                        playbackId={`conv-open-${practiceLang}`}
                        text={langPack.conversation.speakerLine}
                        voicePrefs={voicePrefs}
                        subjectHint={practiceLang}
                        langOverride={getSpeechLangForSubject(practiceLang)}
                        compact
                        label="Listen"
                      />
                    </div>

                    {langConvoTurns.map((turn) => (
                      <div
                        key={turn.id}
                        className={`rounded-xl border p-3 text-xs ${
                          turn.role === 'user'
                            ? 'border-[#6E5BFF]/40 bg-[#131F4B] text-white'
                            : 'border-[#2E8BFF]/30 bg-[#0A1430] text-slate-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#7DD3FC]">
                                {turn.role === 'user' ? 'You' : `${practiceLang} Partner`}
                              </span>
                              {turn.role === 'user' && turn.analysisMode && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    turn.analysisMode === 'audio-gemini'
                                      ? 'bg-emerald-500/20 text-emerald-200'
                                      : 'bg-sky-500/20 text-sky-200'
                                  }`}
                                >
                                  {turn.analysisMode === 'audio-gemini' ? 'Audio Analysed' : 'Text Reply'}
                                </span>
                              )}
                              {turn.role === 'user' && turn.isNatural !== undefined && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    turn.isNatural
                                      ? 'bg-emerald-500/20 text-emerald-200'
                                      : 'bg-amber-500/20 text-amber-200'
                                  }`}
                                >
                                  {turn.isNatural ? 'Natural' : 'Tip Available'}
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-white">{turn.targetText}</p>
                            {turn.englishText && (
                              <p className="text-slate-300">[{turn.englishText}]</p>
                            )}
                            {turn.correction &&
                              turn.correction.toLowerCase() !== turn.targetText.toLowerCase() && (
                                <p className="rounded-lg bg-[#08122C] px-2.5 py-1 text-[#5EEAD4]">
                                  <strong>More natural phrasing:</strong> {turn.correction}
                                </p>
                              )}
                            {turn.coachingNote && (
                              <p className="text-[11px] text-slate-300">{turn.coachingNote}</p>
                            )}
                            {turn.pronunciationTip && (
                              <p className="text-[11px] text-[#7DD3FC]">
                                <strong>Pronunciation tip:</strong> {turn.pronunciationTip}
                              </p>
                            )}
                          </div>

                          {turn.role === 'partner' && (
                            <VoiceControlBar
                              playbackId={turn.id}
                              text={turn.targetText}
                              voicePrefs={voicePrefs}
                              subjectHint={practiceLang}
                              langOverride={getSpeechLangForSubject(practiceLang)}
                              compact
                              label="Listen"
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {langConvoLoading && (
                      <div className="flex items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3 text-xs text-[#7DD3FC]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Listening &amp; preparing {practiceLang} response...</span>
                      </div>
                    )}
                  </div>

                  {langConvoError && (
                    <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {langConvoError}
                    </div>
                  )}

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
                          <span>Stop &amp; Send Voice</span>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && translationPrompt.trim() && !langConvoLoading) {
                          e.preventDefault();
                          void handleSendLanguageTurn();
                        }
                      }}
                      placeholder={`Speak or type your ${practiceLang} reply...`}
                      className="min-w-[200px] flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={langConvoLoading || !translationPrompt.trim()}
                      onClick={() => void handleSendLanguageTurn()}
                      className="rounded-xl bg-[#6E5BFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {langConvoLoading ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORICAL TIMELINE & SOURCE CAUSE-EFFECT */}
          {activeModel === 'humanities-timeline' && (() => {
            const ERAS: Record<
              'industrial' | 'independence' | 'cold-war',
              {
                label: string;
                nodes: Array<{ year: string; title: string; cause: string; impact: string; source: string }>;
              }
            > = {
              industrial: {
                label: 'Industrial Revolution (1760–1840)',
                nodes: [
                  {
                    year: '1769',
                    title: 'Watt Steam Engine',
                    cause: 'Mining & textile demand outpaced water-wheel locations.',
                    impact: 'Factories relocated near coal & cities, multiplying output.',
                    source: 'Primary Patent & Boulton-Watt Factory Ledgers (verify bias toward owners vs factory workers).',
                  },
                  {
                    year: '1825',
                    title: 'Public Steam Railways',
                    cause: 'Coal and iron transport bottlenecks raised coastal shipping costs.',
                    impact: 'Unified national markets, cut travel times, and reshaped urban work hours.',
                    source: 'Parliamentary Railway Committee Minutes (inspect landowner vs merchant viewpoints).',
                  },
                ],
              },
              independence: {
                label: 'African & Kenyan Independence (1945–1963)',
                nodes: [
                  {
                    year: '1952',
                    title: 'Mau Mau Emergency & Land Grievances',
                    cause: 'Colonial land alienation in the White Highlands & lack of African representation.',
                    impact: 'Forced constitutional negotiations toward self-rule.',
                    source: 'Compare colonial administrative dispatches with oral testimonies of freedom fighters.',
                  },
                  {
                    year: '1963',
                    title: 'Kenyan Independence (Jamhuri)',
                    cause: 'Lancaster House Conferences & nationalist political mobilization.',
                    impact: 'Established sovereign parliamentary governance and national development planning.',
                    source: '1963 Independence Constitution & Parliamentary Hansard records.',
                  },
                ],
              },
              'cold-war': {
                label: 'Post-1945 Cold War Shifts (1947–1991)',
                nodes: [
                  {
                    year: '1947',
                    title: 'Truman Doctrine & Marshall Plan',
                    cause: 'Post-WWII European economic collapse & superpower ideological rivalry.',
                    impact: 'Institutionalized Western economic recovery & East-West bloc division.',
                    source: 'Official speeches vs Soviet diplomatic cables (cross-check propaganda framing).',
                  },
                  {
                    year: '1989',
                    title: 'Fall of the Berlin Wall',
                    cause: 'Economic stagnation, reform pressures, and peaceful civil demonstrations.',
                    impact: 'Accelerated German reunification and ended Cold War bipolar division.',
                    source: 'Eyewitness journalism & East/West archive transcripts.',
                  },
                ],
              },
            };
            const currentEra = ERAS[selectedEra];
            const node = currentEra.nodes[selectedTimelineIdx] || currentEra.nodes[0];

            return (
              <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {(['industrial', 'independence', 'cold-war'] as const).map((eraKey) => (
                    <button
                      key={eraKey}
                      type="button"
                      onClick={() => {
                        setSelectedEra(eraKey);
                        setSelectedTimelineIdx(0);
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                        selectedEra === eraKey
                          ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                          : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300'
                      }`}
                    >
                      {ERAS[eraKey].label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {currentEra.nodes.map((item, idx) => (
                    <button
                      key={item.year}
                      type="button"
                      onClick={() => setSelectedTimelineIdx(idx)}
                      className={`rounded-2xl border p-3 text-left transition-colors ${
                        selectedTimelineIdx === idx
                          ? 'border-[#5EEAD4] bg-[#0D2A3F]'
                          : 'border-[var(--alexyn-border)] bg-[#060E24] hover:border-[#2E8BFF]'
                      }`}
                    >
                      <span className="font-mono text-xs font-bold text-[#5EEAD4]">{item.year}</span>
                      <p className="mt-0.5 text-sm font-bold text-white">{item.title}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4 text-xs">
                  <p>
                    <strong className="text-[#7DD3FC]">Root Cause: </strong>
                    <span className="text-slate-200">{node.cause}</span>
                  </p>
                  <p>
                    <strong className="text-[#5EEAD4]">Consequence: </strong>
                    <span className="text-slate-200">{node.impact}</span>
                  </p>
                  <p>
                    <strong className="text-amber-300">Primary Source Check: </strong>
                    <span className="text-slate-300">{node.source}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      askInlineLabTutor(
                        `For the ${node.year} event "${node.title}", help me build a top-scoring cause-and-effect exam explanation and evaluate source reliability.`
                      )
                    }
                    className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3.5 py-2 text-xs font-bold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Analyse Cause &amp; Effect with AI</span>
                  </button>
                </div>
              </div>
            );
          })()}

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

          {/* EXPANDED 2D, 3D, FRUSTUM & COMPOUND GEOMETRY LAB */}
          {activeModel === 'math-shapes' && (
            <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-3">
              {/* Search Shapes */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={shapeSearch}
                  onChange={(e) => setShapeSearch(e.target.value)}
                  placeholder="Search frustum, hemisphere, prism, cone, compound..."
                  aria-label="Search 3D and compound shapes"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] py-2 pl-8 pr-8 text-xs text-white placeholder:text-slate-500"
                />
                {shapeSearch && (
                  <button
                    type="button"
                    onClick={() => setShapeSearch('')}
                    aria-label="Clear shape search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All (21)' },
                    { id: '3d', label: '3D Solids' },
                    { id: 'frustum', label: 'Frustums' },
                    { id: 'compound', label: 'Compound' },
                    { id: '2d', label: '2D' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setShapeCategoryFilter(cat.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      shapeCategoryFilter === cat.id
                        ? 'border-[#5EEAD4] bg-[#0D2A3F] text-[#5EEAD4]'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Matching Shapes List */}
              {filteredShapes.length === 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-xs text-slate-300">
                  <span>No shape matches "{shapeSearch}".</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShapeSearch('');
                      setShapeCategoryFilter('all');
                    }}
                    className="font-semibold text-[#7DD3FC] hover:underline"
                  >
                    Show All
                  </button>
                </div>
              ) : (
                <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                  {filteredShapes.map((shapeItem) => (
                    <button
                      key={shapeItem.id}
                      type="button"
                      onClick={() => {
                        setMathShape(shapeItem.id);
                        setMathAngle(shapeItem.defaultAngleOrHeight);
                        setMathRatio(shapeItem.defaultRatio);
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                        mathShape === shapeItem.id
                          ? 'border-[#38BDF8] bg-[#142A5E] text-white'
                          : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-300 hover:border-[#2E8BFF]/60'
                      }`}
                    >
                      <span className="block truncate">{shapeItem.name}</span>
                      <span className="block text-[9px] uppercase tracking-wide text-[#7DD3FC]/80">
                        {shapeItem.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <p className="rounded-xl border border-white/10 bg-[#07112B] px-3 py-2 text-[11px] text-slate-300">
                <strong className="text-white">{activeShapeMeta.name}:</strong>{' '}
                {activeShapeMeta.shortSummary}
              </p>

              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="mathSizeSlider">Radius / Base Size</label>
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

              {activeShapeMeta.supportsRatioSlider && (
                <div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <label htmlFor="mathRatioSlider">Top Ratio / Depth Scale</label>
                    <span className="font-mono">{Math.round(mathRatio * 100)}%</span>
                  </div>
                  <input
                    id="mathRatioSlider"
                    type="range"
                    min="0.2"
                    max="0.85"
                    step="0.05"
                    value={mathRatio}
                    onChange={(e) => setMathRatio(Number(e.target.value))}
                    className="mt-1 w-full accent-[#818CF8]"
                  />
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400">{mathMetrics.primaryLabel}</p>
                    <p className="font-mono font-bold text-[#5EEAD4]">{mathMetrics.primaryValue}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">{mathMetrics.secondaryLabel}</p>
                    <p className="font-mono font-bold text-white">{mathMetrics.secondaryValue}</p>
                  </div>
                </div>
                <p className="text-[11px] text-[#7DD3FC]">{mathMetrics.anglesSummary}</p>
                {mathMetrics.partsBreakdown && mathMetrics.partsBreakdown.length > 0 && (
                  <div className="space-y-1 border-t border-white/10 pt-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Parts Breakdown
                    </p>
                    {mathMetrics.partsBreakdown.map((part, idx) => (
                      <p key={idx} className="text-[11px] text-slate-200">
                        • {part}
                      </p>
                    ))}
                  </div>
                )}
                {mathMetrics.formulasUsed && mathMetrics.formulasUsed.length > 0 && (
                  <div className="space-y-0.5 border-t border-white/10 pt-1.5 font-mono text-[11px] text-[#5EEAD4]">
                    {mathMetrics.formulasUsed.map((f, idx) => (
                      <p key={idx}>{f}</p>
                    ))}
                  </div>
                )}
              </div>
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
      )}

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
                    : msg.error
                    ? 'mr-4 border border-rose-400/45 bg-rose-500/10 text-rose-100'
                    : 'mr-4 border border-[var(--alexyn-border)] bg-[#0E1B3D] text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {msg.graphUpdateNote && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#5EEAD4]/35 bg-[#081A36] px-2.5 py-1 text-[11px] font-semibold text-[#5EEAD4]">
                    <LineChart className="h-3 w-3" />
                    <span>Graph updated: {msg.graphUpdateNote}</span>
                  </p>
                )}
                {msg.role === 'assistant' && !msg.error && (
                  <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-1.5">
                    <VoiceControlBar
                      playbackId={`lab-msg-${msg.id}`}
                      text={msg.text}
                      voicePrefs={voicePrefs}
                      subjectHint={activeSubjectLabel}
                      compact
                      label="Speak explanation"
                    />
                  </div>
                )}
                {msg.error && msg.retryPrompt && (
                  <div className="mt-2 flex items-center gap-2 border-t border-rose-400/20 pt-1.5">
                    <button
                      type="button"
                      onClick={() => void askInlineLabTutor(msg.retryPrompt!)}
                      className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-500/30"
                    >
                      Retry question
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

        {(labVoiceState === 'listening' || labVoiceState === 'transcribing') && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#38BDF8]/40 bg-[#08173A] px-3.5 py-2 text-xs text-[#7DD3FC]">
            <div className="flex items-center gap-2">
              {labVoiceState === 'transcribing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#38BDF8]" />
              ) : (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
              )}
              <span className="font-semibold">
                {labVoiceState === 'transcribing'
                  ? 'Transcribing microphone audio...'
                  : 'Listening for your question...'}
              </span>
            </div>
            {labVoiceState === 'listening' && (
              <button
                type="button"
                onClick={stopLabVoiceKeepText}
                className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {labVoiceNotice && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
            <span>{labVoiceNotice}</span>
            <button
              type="button"
              onClick={() => setLabVoiceNotice(null)}
              className="shrink-0 font-bold text-amber-100 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleLabSubmit} className="mt-3 flex items-center gap-2">
          <input
            ref={labInputRef}
            type="text"
            value={labQuestion}
            onChange={(e) => setLabQuestion(e.target.value)}
            placeholder={`Ask ALEXYN about ${displayModelTitle}...`}
            aria-label={`Ask ALEXYN about ${displayModelTitle}`}
            className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
          />
          <button
            type="button"
            disabled={labVoiceState === 'transcribing'}
            onClick={() => void toggleLabVoiceInput()}
            aria-label={
              labVoiceState === 'listening'
                ? 'Stop voice input'
                : labVoiceState === 'transcribing'
                ? 'Transcribing audio'
                : 'Start voice input'
            }
            title={
              labVoiceState === 'listening'
                ? 'Stop listening'
                : labVoiceState === 'transcribing'
                ? 'Transcribing...'
                : 'Speak your question'
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              labVoiceState === 'listening'
                ? 'border-rose-400 bg-rose-500 text-white'
                : labVoiceState === 'transcribing'
                ? 'border-[#38BDF8]/50 bg-[#122658] text-[#7DD3FC]'
                : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-200 hover:border-[#38BDF8] hover:text-white'
            }`}
          >
            {labVoiceState === 'listening' ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : labVoiceState === 'transcribing' ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
            ) : (
              <Mic className="h-4 w-4 text-[#5EEAD4]" />
            )}
          </button>
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
