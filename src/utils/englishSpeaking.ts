export type EnglishSpeakingDifficulty = 'foundation' | 'intermediate' | 'advanced';

export interface EnglishSpeakingWord {
  id: string;
  difficulty: EnglishSpeakingDifficulty;
  targetWord: string;
  phonetic: string;
  syllables: string;
  meaning: string;
  pronunciationTip: string;
}

export interface EnglishWordComparisonResult {
  targetNormalized: string;
  recognizedNormalized: string;
  isExactMatch: boolean;
  isMatch: boolean;
  matchPercentage: number;
  status: 'correct' | 'close' | 'incorrect';
  feedback: string;
}

export interface EnglishSpeakingStats {
  completedIds: string[];
  attempts: number;
  matches: number;
  currentStreak: number;
  bestStreak: number;
}

export const ENGLISH_SPEAKING_STORAGE_KEY = 'alexyn_english_speaking_stats_v1';

export const ENGLISH_SPEAKING_WORDS: EnglishSpeakingWord[] = [
  // Foundation
  {
    id: 'eng-f-1',
    difficulty: 'foundation',
    targetWord: 'Wednesday',
    phonetic: 'WENZ-day',
    syllables: 'Wenz · day',
    meaning: 'The day of the week between Tuesday and Thursday',
    pronunciationTip: 'The first "d" is silent — pronounce it in two crisp syllables: Wenz-day.',
  },
  {
    id: 'eng-f-2',
    difficulty: 'foundation',
    targetWord: 'Comfortable',
    phonetic: 'KUMF-tuh-bul',
    syllables: 'Cumf · ta · ble',
    meaning: 'Giving physical ease and relaxation',
    pronunciationTip: 'Keep the middle light and smooth: "KUMF-tuh-bul" rather than four heavy syllables.',
  },
  {
    id: 'eng-f-3',
    difficulty: 'foundation',
    targetWord: 'Library',
    phonetic: 'LY-breh-ree',
    syllables: 'Li · brar · y',
    meaning: 'A building or room housing books and learning resources',
    pronunciationTip: 'Pronounce both "r" sounds clearly: LY-brer-ee, not "ly-berry".',
  },
  {
    id: 'eng-f-4',
    difficulty: 'foundation',
    targetWord: 'Schedule',
    phonetic: 'SKED-jool',
    syllables: 'Sched · ule',
    meaning: 'A plan for carrying out tasks or classes at set times',
    pronunciationTip: 'Start cleanly with "sk-" or "sh-" and finish with a rounded "-jool" sound.',
  },
  {
    id: 'eng-f-5',
    difficulty: 'foundation',
    targetWord: 'Thoughtful',
    phonetic: 'THAWT-ful',
    syllables: 'Thought · ful',
    meaning: 'Showing careful consideration or attention',
    pronunciationTip: 'Place your tongue lightly against your upper teeth for the soft "th" sound.',
  },

  // Intermediate
  {
    id: 'eng-i-1',
    difficulty: 'intermediate',
    targetWord: 'Consequently',
    phonetic: 'KON-suh-kwunt-lee',
    syllables: 'Con · se · quent · ly',
    meaning: 'As a result (formal essay linker)',
    pronunciationTip: 'Stress the first syllable "KON-" and sound the final "-ly" cleanly.',
  },
  {
    id: 'eng-i-2',
    difficulty: 'intermediate',
    targetWord: 'Pronunciation',
    phonetic: 'pruh-nun-see-AY-shun',
    syllables: 'Pro · nun · ci · a · tion',
    meaning: 'The way in which a word or language is spoken',
    pronunciationTip: 'Notice it is "-nun-" (not "noun") with the main stress on "-AY-".',
  },
  {
    id: 'eng-i-3',
    difficulty: 'intermediate',
    targetWord: 'Environment',
    phonetic: 'en-VY-run-munt',
    syllables: 'En · vi · ron · ment',
    meaning: 'The natural world and surroundings around us',
    pronunciationTip: 'Do not drop the first "n" before "-vi-" or the "n" before "-ment".',
  },
  {
    id: 'eng-i-4',
    difficulty: 'intermediate',
    targetWord: 'Elaborate carefully',
    phonetic: 'ih-LAB-uh-rayt KAIR-fuh-lee',
    syllables: 'E · lab · o · rate  care · ful · ly',
    meaning: 'Explain an idea in clear, thorough detail',
    pronunciationTip: 'As a verb, "elaborate" ends with "-rayt" (rhymes with "late"), not "-rut".',
  },
  {
    id: 'eng-i-5',
    difficulty: 'intermediate',
    targetWord: 'Resilient attitude',
    phonetic: 'rih-ZIL-yunt AT-ih-tyood',
    syllables: 'Re · sil · ient  at · ti · tude',
    meaning: 'Able to recover steadily after setbacks',
    pronunciationTip: 'Stress "-ZIL-" in resilient and keep the "-tude" ending crisp.',
  },

  // Advanced
  {
    id: 'eng-a-1',
    difficulty: 'advanced',
    targetWord: 'Notwithstanding',
    phonetic: 'not-with-STAN-ding',
    syllables: 'Not · with · stand · ing',
    meaning: 'In spite of / nevertheless',
    pronunciationTip: 'Put main stress on "-STAN-" while linking all four parts smoothly without pausing.',
  },
  {
    id: 'eng-a-2',
    difficulty: 'advanced',
    targetWord: 'Phenomenon',
    phonetic: 'fih-NOM-ih-non',
    syllables: 'Phe · nom · e · non',
    meaning: 'A remarkable observable fact or event',
    pronunciationTip: '"Ph" sounds like "f", and the strong stress lands on "-NOM-".',
  },
  {
    id: 'eng-a-3',
    difficulty: 'advanced',
    targetWord: 'Conscientious',
    phonetic: 'kon-shee-EN-shus',
    syllables: 'Con · sci · en · tious',
    meaning: 'Wishing to do one’s work thoroughly and honestly',
    pronunciationTip: 'Pronounce "-sci-" as "shee-" and stress "-EN-": kon-shee-EN-shus.',
  },
  {
    id: 'eng-a-4',
    difficulty: 'advanced',
    targetWord: 'Meticulously',
    phonetic: 'muh-TIK-yoo-lus-lee',
    syllables: 'Me · tic · u · lous · ly',
    meaning: 'With great attention to tiny details',
    pronunciationTip: 'Stress "-TIK-" and keep "-yoo-lus-lee" brisk and even.',
  },
  {
    id: 'eng-a-5',
    difficulty: 'advanced',
    targetWord: 'Comprehensive summary',
    phonetic: 'kom-prih-HEN-siv SUM-uh-ree',
    syllables: 'Com · pre · hen · sive  sum · ma · ry',
    meaning: 'A complete overview covering every essential point',
    pronunciationTip: 'Stress "-HEN-" in comprehensive and the first syllable "SUM-" in summary.',
  },
];

export function getEnglishSpeakingWordsByDifficulty(
  difficulty: EnglishSpeakingDifficulty
): EnglishSpeakingWord[] {
  return ENGLISH_SPEAKING_WORDS.filter((item) => item.difficulty === difficulty);
}

export function normalizeEnglishSpeechText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateSpokenEnglishMatch(
  targetWord: string,
  recognizedTranscript: string,
  pronunciationTip?: string
): EnglishWordComparisonResult {
  const targetNorm = normalizeEnglishSpeechText(targetWord);
  const heardNorm = normalizeEnglishSpeechText(recognizedTranscript);

  if (!heardNorm) {
    return {
      targetNormalized: targetNorm,
      recognizedNormalized: '',
      isExactMatch: false,
      isMatch: false,
      matchPercentage: 0,
      status: 'incorrect',
      feedback: 'No speech words were recognized. Speak clearly into your microphone and try again.',
    };
  }

  if (heardNorm === targetNorm) {
    return {
      targetNormalized: targetNorm,
      recognizedNormalized: heardNorm,
      isExactMatch: true,
      isMatch: true,
      matchPercentage: 100,
      status: 'correct',
      feedback: `Recognized "${recognizedTranscript.trim()}" — matches "${targetWord}".`,
    };
  }

  const targetTokens = targetNorm.split(' ').filter(Boolean);
  const heardTokens = heardNorm.split(' ').filter(Boolean);
  const heardSet = new Set(heardTokens);
  const matchedTokens = targetTokens.filter((t) => heardSet.has(t));
  const missingTokens = targetTokens.filter((t) => !heardSet.has(t));
  const tokenRatio =
    targetTokens.length > 0 ? matchedTokens.length / targetTokens.length : 0;

  // Allow containing the exact phrase within extra surrounding words (e.g. "I said Wednesday")
  const containsFullPhrase =
    targetTokens.length > 0 &&
    (` ${heardNorm} `.includes(` ${targetNorm} `) || tokenRatio === 1);

  if (containsFullPhrase) {
    return {
      targetNormalized: targetNorm,
      recognizedNormalized: heardNorm,
      isExactMatch: false,
      isMatch: true,
      matchPercentage: 95,
      status: 'correct',
      feedback: `Target phrase detected inside "${recognizedTranscript.trim()}". Tap Next Word when ready.`,
    };
  }

  const matchPercentage = Math.round(tokenRatio * 100);
  if (matchPercentage >= 50) {
    return {
      targetNormalized: targetNorm,
      recognizedNormalized: heardNorm,
      isExactMatch: false,
      isMatch: false,
      matchPercentage,
      status: 'close',
      feedback: `Heard "${recognizedTranscript.trim()}" instead of "${targetWord}". Missing or unclear: ${missingTokens.join(', ')}.${pronunciationTip ? ` Tip: ${pronunciationTip}` : ''}`,
    };
  }

  return {
    targetNormalized: targetNorm,
    recognizedNormalized: heardNorm,
    isExactMatch: false,
    isMatch: false,
    matchPercentage,
    status: 'incorrect',
    feedback: `Recognized "${recognizedTranscript.trim()}", which does not match "${targetWord}".${pronunciationTip ? ` Coaching tip: ${pronunciationTip}` : ' Listen to the model voice again and tap Try Again.'}`,
  };
}

export function createEmptyEnglishSpeakingStats(): EnglishSpeakingStats {
  return {
    completedIds: [],
    attempts: 0,
    matches: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function recordEnglishSpeakingAttempt(
  prev: EnglishSpeakingStats,
  wordId: string,
  matched: boolean
): EnglishSpeakingStats {
  const nextStreak = matched ? prev.currentStreak + 1 : 0;
  const completedIds =
    matched && !prev.completedIds.includes(wordId)
      ? [...prev.completedIds, wordId]
      : prev.completedIds;

  return {
    completedIds,
    attempts: prev.attempts + 1,
    matches: prev.matches + (matched ? 1 : 0),
    currentStreak: nextStreak,
    bestStreak: Math.max(prev.bestStreak, nextStreak),
  };
}

export function loadEnglishSpeakingStats(): EnglishSpeakingStats {
  if (typeof window === 'undefined') return createEmptyEnglishSpeakingStats();
  try {
    const raw = window.localStorage.getItem(ENGLISH_SPEAKING_STORAGE_KEY);
    if (!raw) return createEmptyEnglishSpeakingStats();
    const parsed = JSON.parse(raw) as Partial<EnglishSpeakingStats>;
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      attempts: Number(parsed.attempts) || 0,
      matches: Number(parsed.matches) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    };
  } catch {
    return createEmptyEnglishSpeakingStats();
  }
}

export function saveEnglishSpeakingStats(stats: EnglishSpeakingStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENGLISH_SPEAKING_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage quota errors
  }
}
