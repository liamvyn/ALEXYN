/**
 * Pure TTS & Speech Language Helpers shared between server.ts, voiceEngine.ts, and node:test.
 */

export interface WavConversionResult {
  buffer: Buffer;
  mimeType: string;
  wrappedFromRawPcm: boolean;
}

/**
 * Checks whether a buffer already starts with a valid RIFF...WAVE header.
 */
export function hasRiffWaveHeader(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  return (
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x41 && // A
    buf[10] === 0x56 && // V
    buf[11] === 0x45 // E
  );
}

/**
 * Parses sample rate from audio/L16;rate=24000 or audio/pcm;rate=24000 mimeType strings.
 */
export function parsePcmSampleRate(mimeType?: string): number {
  if (!mimeType) return 24000;
  const match = mimeType.match(/rate=(\d+)/i);
  if (!match) return 24000;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 8000 && parsed <= 192000 ? parsed : 24000;
}

/**
 * Ensures audio bytes from Gemini TTS are browser-playable WAV (or passes through MP3/OGG/WAV intact).
 * If Gemini returns raw linear PCM (`audio/L16` / `audio/pcm` or headerless PCM bytes), wraps it in a standard 44-byte RIFF/WAVE header.
 */
export function ensurePlayableWavBuffer(audioBuf: Buffer, inlineMimeType?: string): WavConversionResult {
  const cleanMime = (inlineMimeType || 'audio/wav').trim();
  const lowerMime = cleanMime.toLowerCase();

  if (hasRiffWaveHeader(audioBuf)) {
    return { buffer: audioBuf, mimeType: 'audio/wav', wrappedFromRawPcm: false };
  }

  // Pass through compressed formats that have their own headers (MP3/OGG/AAC/FLAC/MP4)
  if (
    (lowerMime.includes('mpeg') ||
      lowerMime.includes('mp3') ||
      lowerMime.includes('ogg') ||
      lowerMime.includes('opus') ||
      lowerMime.includes('flac') ||
      lowerMime.includes('mp4') ||
      lowerMime.includes('aac')) &&
    !lowerMime.includes('pcm') &&
    !lowerMime.includes('l16')
  ) {
    return { buffer: audioBuf, mimeType: cleanMime.split(';')[0] || cleanMime, wrappedFromRawPcm: false };
  }

  // Raw PCM -> wrap with 44-byte RIFF/WAVE PCM16 LE header
  const sampleRate = parsePcmSampleRate(cleanMime);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = audioBuf.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM subchunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return {
    buffer: Buffer.concat([header, audioBuf]),
    mimeType: 'audio/wav',
    wrappedFromRawPcm: true,
  };
}

export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  'en-US': 'English',
  'en-GB': 'English (UK)',
  'en-KE': 'English (Kenya)',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'ja-JP': 'Japanese',
  'sw-KE': 'Kiswahili',
  'de-DE': 'German',
  'zh-CN': 'Mandarin Chinese',
  'ar-SA': 'Arabic',
  'pt-BR': 'Portuguese',
  'it-IT': 'Italian',
  'ko-KR': 'Korean',
  'hi-IN': 'Hindi',
};

export function normalizeSpeechLangCode(raw?: string): string {
  if (!raw) return 'en-US';
  const cleaned = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    en: 'en-US',
    'en-us': 'en-US',
    'en-gb': 'en-GB',
    'en-ke': 'en-KE',
    english: 'en-US',
    fr: 'fr-FR',
    'fr-fr': 'fr-FR',
    french: 'fr-FR',
    'français': 'fr-FR',
    francais: 'fr-FR',
    es: 'es-ES',
    'es-es': 'es-ES',
    'es-mx': 'es-ES',
    spanish: 'es-ES',
    'español': 'es-ES',
    espanol: 'es-ES',
    ja: 'ja-JP',
    'ja-jp': 'ja-JP',
    japanese: 'ja-JP',
    sw: 'sw-KE',
    'sw-ke': 'sw-KE',
    'sw-tz': 'sw-KE',
    kiswahili: 'sw-KE',
    swahili: 'sw-KE',
    de: 'de-DE',
    'de-de': 'de-DE',
    german: 'de-DE',
    zh: 'zh-CN',
    'zh-cn': 'zh-CN',
    chinese: 'zh-CN',
    mandarin: 'zh-CN',
    ar: 'ar-SA',
    'ar-sa': 'ar-SA',
    arabic: 'ar-SA',
    pt: 'pt-BR',
    'pt-br': 'pt-BR',
    portuguese: 'pt-BR',
    it: 'it-IT',
    'it-it': 'it-IT',
    italian: 'it-IT',
    ko: 'ko-KR',
    'ko-kr': 'ko-KR',
    korean: 'ko-KR',
    hi: 'hi-IN',
    'hi-in': 'hi-IN',
    hindi: 'hi-IN',
  };
  if (map[cleaned]) return map[cleaned];
  if (/^[a-z]{2}-[a-z]{2}$/i.test(cleaned)) {
    const [lang, region] = cleaned.split('-');
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }
  return raw;
}

/**
 * Detects the target speech language from Unicode script or explicit hint/subject context.
 * Prioritizes non-Latin Unicode scripts first, then explicit language hints, then strong word markers.
 */
export function detectSpeechLanguageCode(text: string, hint?: string, fallbackLang = 'en-US'): string {
  const sample = (text || '').trim();
  const hintLower = (hint || '').toLowerCase();

  // 1. Unambiguous non-Latin scripts
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return 'ja-JP'; // Hiragana / Katakana
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(sample)) return 'ko-KR'; // Hangul
  if (/[\u0600-\u06FF]/.test(sample)) return 'ar-SA'; // Arabic
  if (/[\u0900-\u097F]/.test(sample)) return 'hi-IN'; // Devanagari
  if (/[\u4E00-\u9FFF]/.test(sample)) {
    return hintLower.includes('japan') || hintLower.includes('ja') ? 'ja-JP' : 'zh-CN';
  }

  // 2. Explicit hint (subject/language name/BCP-47 code)
  const hintPairs: Array<[RegExp, string]> = [
    [/\b(ja|ja-jp|japanese|nihongo|hiragana|katakana|kanji)\b/i, 'ja-JP'],
    [/\b(fr|fr-fr|french|français|francais)\b/i, 'fr-FR'],
    [/\b(es|es-es|spanish|español|espanol)\b/i, 'es-ES'],
    [/\b(sw|sw-ke|sw-tz|kiswahili|swahili)\b/i, 'sw-KE'],
    [/\b(de|de-de|german|deutsch)\b/i, 'de-DE'],
    [/\b(zh|zh-cn|mandarin|chinese|pinyin)\b/i, 'zh-CN'],
    [/\b(ar|ar-sa|arabic)\b/i, 'ar-SA'],
    [/\b(pt|pt-br|portuguese|português)\b/i, 'pt-BR'],
    [/\b(it|it-it|italian|italiano)\b/i, 'it-IT'],
    [/\b(ko|ko-kr|korean|hangul)\b/i, 'ko-KR'],
    [/\b(hi|hi-in|hindi)\b/i, 'hi-IN'],
  ];
  for (const [pattern, code] of hintPairs) {
    if (pattern.test(hintLower)) return code;
  }

  // 3. Common Latin-script language phrases / diacritics when no explicit hint was supplied
  if (/[¿¡ñ]|(\b(?:buenos días|buenas tardes|hola|gracias|por favor|cómo estás|como estas|me llamo)\b)/i.test(sample)) {
    return 'es-ES';
  }
  if (/[çœæ]|(\b(?:bonjour|bonsoir|merci beaucoup|comment allez|je m'appelle|s'il vous plaît|au revoir|oui|très bien)\b)/i.test(sample)) {
    return 'fr-FR';
  }
  if (/\b(?:habari|jambo|asante|tafadhali|shikamoo|nzuri|karibu|kwaheri|ninafurahi|jina langu|shule|mwalimu|rafiki|chakula|maji|sana)\b/i.test(sample)) {
    return 'sw-KE';
  }
  if (/[äöüß]|(\b(?:guten tag|danke schön|danke schoen|wie geht|ich heiße|auf wiedersehen|bitte sehr)\b)/i.test(sample)) {
    return 'de-DE';
  }

  return normalizeSpeechLangCode(fallbackLang);
}

/**
 * Strips translations, parenthetical romanization, headings, and markdown wrappers
 * so a pronunciation button only speaks the target phrase.
 */
export function extractPureTargetSpeechText(raw: string): string {
  let cleaned = (raw || '').trim();
  if (!cleaned) return '';

  // Remove bold/italic/code markdown markers
  cleaned = cleaned.replace(/[`*_#]/g, ' ');
  // Remove leading bullet/number prefixes
  cleaned = cleaned.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '');
  // Remove bracketed IPA/romanization/gloss annotations like [pronunciation] or (/.../)
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s*\([^)]*(?:lit\.|meaning|pronounced|romanization|english|translation)[^)]*\)/gi, '');
  // Split at common gloss separators (" — ", " - ", " = ") when left side isn't empty
  const splitMatch = cleaned.match(/^(.+?)\s+(?:—|–|=|->|→)\s+(.+)$/);
  if (splitMatch && splitMatch[1].trim().length >= 2) {
    cleaned = splitMatch[1].trim();
  }
  // Remove wrapping quotes
  cleaned = cleaned.replace(/^["'“”«»「」]+|["'“”«»「」]+$/g, '').trim();
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export interface BrowserVoiceCandidate {
  name: string;
  lang: string;
  voiceURI: string;
  default?: boolean;
  localService?: boolean;
}

export interface BrowserVoiceMatchResult<T extends BrowserVoiceCandidate = BrowserVoiceCandidate> {
  matchedVoice: T | null;
  languageSupported: boolean;
  unsupportedReason?: string;
}

/**
 * Finds a browser speechSynthesis voice matching targetLang.
 * CRITICAL: For non-English target languages, NEVER silently falls back to an English voice.
 * If no matching language voice exists on the device, marks languageSupported=false with an honest explanation.
 */
export function checkBrowserVoiceSupportForLang<T extends BrowserVoiceCandidate>(
  voices: T[],
  targetLang: string,
  preferredVoiceUri?: string
): BrowserVoiceMatchResult<T> {
  const normalizedTarget = normalizeSpeechLangCode(targetLang);
  const baseLang = normalizedTarget.split('-')[0].toLowerCase();
  const displayName = LANGUAGE_DISPLAY_NAMES[normalizedTarget] || normalizedTarget;

  if (!voices || voices.length === 0) {
    if (baseLang === 'en') {
      return {
        matchedVoice: null,
        languageSupported: true,
      };
    }
    return {
      matchedVoice: null,
      languageSupported: false,
      unsupportedReason: `No ${displayName} voice is installed on this browser/device and neural TTS is currently unavailable.`,
    };
  }

  // Exact BCP-47 match first (e.g., fr-FR, sw-KE)
  const exactMatches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === normalizedTarget.toLowerCase());
  // Base language match (e.g., fr-CA for fr-FR, sw-TZ for sw-KE)
  const baseMatches = voices.filter((v) => {
    const vBase = v.lang.toLowerCase().replace('_', '-').split('-')[0];
    return vBase === baseLang;
  });

  const pool = exactMatches.length > 0 ? exactMatches : baseMatches;

  if (pool.length > 0) {
    const preferred = preferredVoiceUri ? pool.find((v) => v.voiceURI === preferredVoiceUri) : undefined;
    const local = pool.find((v) => v.localService);
    return {
      matchedVoice: preferred || local || pool[0],
      languageSupported: true,
    };
  }

  // If English is requested and browser only lists non-tagged default voice
  if (baseLang === 'en') {
    const preferred = preferredVoiceUri ? voices.find((v) => v.voiceURI === preferredVoiceUri) : undefined;
    const defaultEn = voices.find((v) => v.default) || voices[0];
    return {
      matchedVoice: preferred || defaultEn || null,
      languageSupported: true,
    };
  }

  // Non-English language with zero matching browser voices: refuse silent wrong-accent fallback!
  return {
    matchedVoice: null,
    languageSupported: false,
    unsupportedReason: `This device/browser has no ${displayName} (${normalizedTarget}) speech voice installed, and neural TTS could not provide ${displayName} audio.`,
  };
}
