import type { VoicePreferences } from '../types/alexyn';
import {
  getSpeechLangForSubject,
  isSpeechSynthesisSupported,
  splitSpeechChunks,
  stopBrowserTTS,
  stripMarkdownForSpeech,
} from './alexynLogic';
import {
  checkBrowserVoiceSupportForLang,
  detectSpeechLanguageCode,
  LANGUAGE_DISPLAY_NAMES,
  normalizeSpeechLangCode,
} from './ttsUtils';
import { apiUrl } from './apiBase';

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  engine: 'auto',
  voiceName: 'Kore',
  voiceStyle: 'Warm, clear & natural teacher',
  speed: 1.15,
  readLanguageCode: 'en-US',
};

export const NEURAL_VOICE_OPTIONS: Array<{
  id: VoicePreferences['voiceName'];
  label: string;
  tone: string;
}> = [
  { id: 'Kore', label: 'Kore — Clear & Warm Mentor', tone: 'Balanced, natural teaching tone' },
  { id: 'Zephyr', label: 'Zephyr — Calm & Encouraging', tone: 'Gentle pacing for detailed study notes' },
  { id: 'Puck', label: 'Puck — Bright & Energetic', tone: 'Lively conversational companion' },
  { id: 'Charon', label: 'Charon — Steady & Authoritative', tone: 'Clear examination reader & analyst' },
  { id: 'Fenrir', label: 'Fenrir — Deep & Expressive', tone: 'Storytelling & humanities narration' },
];

export const VOICE_STYLE_PRESETS: string[] = [
  'Warm, clear & natural teacher',
  'Calm study narrator with natural pauses',
  'Friendly conversational companion',
  'Clear examination & language pronunciation coach',
];

export type VoicePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface VoicePlaybackSnapshot {
  status: VoicePlaybackStatus;
  activeId: string | null;
  engineUsed: 'neural' | 'browser' | null;
  voiceLabel: string;
  languageCode: string | null;
  error: string | null;
}

type SnapshotListener = (snapshot: VoicePlaybackSnapshot) => void;
type SpeedPersistHandler = (speed: number) => void;

export async function loadBrowserVoicesAsync(timeoutMs = 600): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return [];
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) return immediate;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener?.('voiceschanged', onChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    const onChanged = () => finish();
    window.speechSynthesis.addEventListener?.('voiceschanged', onChanged);
    window.setTimeout(finish, timeoutMs);
  });
}

class AlexynVoiceEngine {
  private snapshot: VoicePlaybackSnapshot = {
    status: 'idle',
    activeId: null,
    engineUsed: null,
    voiceLabel: '',
    languageCode: null,
    error: null,
  };
  private listeners = new Set<SnapshotListener>();
  private audioEl: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private unlockedAudioCtx: AudioContext | null = null;
  private sessionCounter = 0;
  private currentSpeed = 1.15;
  private speedPersistHandler: SpeedPersistHandler | null = null;

  // Browser chunk resumption state so live speed change works cleanly
  private activeBrowserChunks: string[] = [];
  private activeBrowserChunkIdx = 0;
  private activeBrowserLang = 'en-US';
  private activeBrowserVoice: SpeechSynthesisVoice | null = null;
  private activeBrowserId = '';

  registerSpeedPersistHandler(handler: SpeedPersistHandler | null) {
    this.speedPersistHandler = handler;
  }

  updatePreferredSpeed(speed: number) {
    const safeSpeed = Math.max(0.7, Math.min(1.6, Number(speed) || 1.15));
    this.setPlaybackSpeed(safeSpeed);
    this.speedPersistHandler?.(safeSpeed);
  }

  getSnapshot(): VoicePlaybackSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<VoicePlaybackSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  /**
   * Synchronous user-gesture audio unlock so Android Chrome / iOS Safari / WebViews
   * still allow audio.play() after async /api/tts network fetch finishes.
   */
  public unlockAudio() {
    this.unlockAudioContextSync();
  }

  private unlockAudioContextSync() {
    if (typeof window === 'undefined') return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!this.unlockedAudioCtx) {
        this.unlockedAudioCtx = new Ctx();
      }
      if (this.unlockedAudioCtx.state === 'suspended') {
        void this.unlockedAudioCtx.resume().catch(() => {});
      }
    } catch {
      // ignore unlock errors
    }
  }

  private cleanupAudioElement() {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.onended = null;
        this.audioEl.onerror = null;
        this.audioEl.src = '';
      } catch {
        // ignore cleanup
      }
      this.audioEl = null;
    }
    if (this.activeObjectUrl) {
      try {
        URL.revokeObjectURL(this.activeObjectUrl);
      } catch {
        // ignore
      }
      this.activeObjectUrl = null;
    }
  }

  stop(preserveError = false) {
    this.sessionCounter += 1;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.cleanupAudioElement();
    this.activeBrowserChunks = [];
    this.activeBrowserChunkIdx = 0;
    stopBrowserTTS();
    this.emit({
      status: 'idle',
      activeId: null,
      engineUsed: null,
      voiceLabel: '',
      languageCode: null,
      error: preserveError ? this.snapshot.error : null,
    });
  }

  pause() {
    if (this.snapshot.status !== 'playing') return;
    if (this.audioEl && this.snapshot.engineUsed === 'neural') {
      this.audioEl.pause();
      this.emit({ status: 'paused' });
      return;
    }
    if (isSpeechSynthesisSupported() && this.snapshot.engineUsed === 'browser') {
      try {
        window.speechSynthesis.pause();
        this.emit({ status: 'paused' });
      } catch {
        // ignore
      }
    }
  }

  resume() {
    if (this.snapshot.status !== 'paused') return;
    if (this.audioEl && this.snapshot.engineUsed === 'neural') {
      void this.audioEl.play().then(
        () => this.emit({ status: 'playing' }),
        () => this.emit({ status: 'idle', activeId: null, error: 'Could not resume audio playback.' })
      );
      return;
    }
    if (isSpeechSynthesisSupported() && this.snapshot.engineUsed === 'browser') {
      try {
        window.speechSynthesis.resume();
        this.emit({ status: 'playing' });
      } catch {
        // ignore
      }
    }
  }

  private speakBrowserChunkSequence(sessionId: number) {
    if (sessionId !== this.sessionCounter) return;
    if (this.activeBrowserChunkIdx >= this.activeBrowserChunks.length) {
      this.emit({
        status: 'idle',
        activeId: null,
        engineUsed: null,
        voiceLabel: '',
        languageCode: null,
      });
      return;
    }

    const utt = new SpeechSynthesisUtterance(this.activeBrowserChunks[this.activeBrowserChunkIdx]);
    utt.lang = this.activeBrowserLang;
    utt.rate = this.currentSpeed;
    if (this.activeBrowserVoice) utt.voice = this.activeBrowserVoice;

    utt.onend = () => {
      if (sessionId !== this.sessionCounter) return;
      this.activeBrowserChunkIdx += 1;
      this.speakBrowserChunkSequence(sessionId);
    };

    utt.onerror = (ev) => {
      if (sessionId !== this.sessionCounter) return;
      const errCode = (ev as { error?: string })?.error;
      if (errCode === 'canceled' || errCode === 'interrupted') {
        return;
      }
      this.emit({
        status: 'idle',
        activeId: null,
        engineUsed: null,
        error: `Device speech playback stopped (${errCode || 'audio error'}). Try Neural Voice in Settings.`,
      });
    };

    window.speechSynthesis.speak(utt);
  }

  setPlaybackSpeed(speed: number) {
    const safeSpeed = Math.max(0.7, Math.min(1.6, Number(speed) || 1.15));
    this.currentSpeed = safeSpeed;
    if (this.audioEl && this.snapshot.engineUsed === 'neural') {
      this.audioEl.playbackRate = safeSpeed;
      return;
    }
    // Restart current browser speech chunk cleanly at the updated rate
    if (
      isSpeechSynthesisSupported() &&
      this.snapshot.engineUsed === 'browser' &&
      this.snapshot.status === 'playing' &&
      this.activeBrowserChunks.length > 0
    ) {
      this.sessionCounter += 1;
      const newSession = this.sessionCounter;
      stopBrowserTTS();
      this.speakBrowserChunkSequence(newSession);
    }
  }

  async speak(params: {
    id: string;
    text: string;
    prefs?: VoicePreferences;
    subjectHint?: string;
    langOverride?: string;
    speedOverride?: number;
  }): Promise<void> {
    // Synchronously unlock audio gesture before awaiting network requests
    this.unlockAudioContextSync();

    const prefs = { ...DEFAULT_VOICE_PREFERENCES, ...(params.prefs || {}) };
    const speed = Math.max(0.7, Math.min(1.6, params.speedOverride ?? prefs.speed ?? 1.15));
    this.currentSpeed = speed;

    const cleanText = stripMarkdownForSpeech(params.text);
    if (!cleanText) {
      this.emit({ error: 'Nothing readable to speak.' });
      return;
    }

    const baseSubjectLang = getSpeechLangForSubject(
      params.subjectHint,
      prefs.readLanguageCode || 'en-US'
    );
    const languageCode = normalizeSpeechLangCode(
      params.langOverride ||
        detectSpeechLanguageCode(cleanText, params.subjectHint, baseSubjectLang)
    );

    // Stop any previous playback cleanly (never overlap)
    this.stop();
    const mySession = this.sessionCounter;

    const tryBrowserFallback = async (fallbackNotice?: string) => {
      if (mySession !== this.sessionCounter) return;
      if (!isSpeechSynthesisSupported()) {
        this.emit({
          status: 'idle',
          activeId: null,
          engineUsed: null,
          languageCode: null,
          error:
            fallbackNotice && !fallbackNotice.toLowerCase().includes('not configured')
              ? `${fallbackNotice} Device speech synthesis is also unavailable in this browser.`
              : 'Speech output is unavailable on this device or browser. You can read all questions and explanations on screen, or try Chrome/Edge/Safari with device voices enabled.',
        });
        return;
      }

      const voices = await loadBrowserVoicesAsync(600);
      if (mySession !== this.sessionCounter) return;

      const matchResult = checkBrowserVoiceSupportForLang(
        voices.map((v) => ({
          name: v.name,
          lang: v.lang,
          voiceURI: v.voiceURI,
          default: v.default,
          localService: v.localService,
          raw: v,
        })),
        languageCode,
        prefs.browserVoiceUri
      );

      if (!matchResult.languageSupported) {
        const langName = LANGUAGE_DISPLAY_NAMES[languageCode] || languageCode;
        this.emit({
          status: 'idle',
          activeId: null,
          engineUsed: null,
          languageCode,
          error:
            voices.length === 0
              ? `Speech output is currently unavailable because no device voices were found in this browser (and server Neural TTS is unavailable).`
              : fallbackNotice && fallbackNotice.toLowerCase().includes('gemini')
              ? `${fallbackNotice} Also, no ${langName} voice is installed on this browser/device — playback stopped rather than speaking in the wrong English voice.`
              : matchResult.unsupportedReason ||
                `No ${langName} (${languageCode}) voice is available on this device.`,
        });
        return;
      }

      const chunks = splitSpeechChunks(cleanText, 200);
      if (chunks.length === 0) {
        this.emit({ status: 'idle', activeId: null, error: 'Nothing readable to speak.' });
        return;
      }

      this.activeBrowserChunks = chunks;
      this.activeBrowserChunkIdx = 0;
      this.activeBrowserLang = languageCode;
      this.activeBrowserVoice = matchResult.matchedVoice?.raw || null;
      this.activeBrowserId = params.id;

      this.emit({
        status: 'playing',
        activeId: params.id,
        engineUsed: 'browser',
        voiceLabel: matchResult.matchedVoice?.name || `Device Voice (${languageCode})`,
        languageCode,
        error: fallbackNotice || null,
      });

      this.speakBrowserChunkSequence(mySession);
    };

    if (prefs.engine === 'browser') {
      await tryBrowserFallback();
      return;
    }

    // Attempt neural TTS via /api/tts
    this.emit({
      status: 'loading',
      activeId: params.id,
      engineUsed: 'neural',
      voiceLabel: `${prefs.voiceName} (Neural)`,
      languageCode,
      error: null,
    });

    const controller = new AbortController();
    this.abortController = controller;
    try {
      const resp = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: cleanText.slice(0, 2600),
          voiceName: prefs.voiceName,
          style: prefs.voiceStyle,
          languageCode,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        audioBase64?: string;
        mimeType?: string;
        voiceUsed?: string;
        fallbackToBrowser?: boolean;
        reason?: string;
        error?: string;
      };

      if (mySession !== this.sessionCounter) return;

      if (!resp.ok || data.fallbackToBrowser || !data.audioBase64) {
        if (prefs.engine === 'neural') {
          this.emit({
            status: 'idle',
            activeId: null,
            engineUsed: null,
            languageCode: null,
            error: data.reason || data.error || 'Neural voice service is currently unavailable.',
          });
          return;
        }
        await tryBrowserFallback(data.reason);
        return;
      }

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      if (bytes.length < 44) {
        throw new Error('Neural TTS returned empty audio bytes.');
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      this.activeObjectUrl = url;

      const audio = new Audio(url);
      audio.preservesPitch = true;
      audio.playbackRate = speed;
      this.audioEl = audio;

      audio.onended = () => {
        if (mySession !== this.sessionCounter) return;
        this.cleanupAudioElement();
        this.emit({
          status: 'idle',
          activeId: null,
          engineUsed: null,
          voiceLabel: '',
          languageCode: null,
        });
      };

      audio.onerror = () => {
        if (mySession !== this.sessionCounter) return;
        this.cleanupAudioElement();
        void tryBrowserFallback('Audio stream failed to decode — checking device voice.');
      };

      await audio.play();
      if (mySession !== this.sessionCounter) return;
      this.emit({
        status: 'playing',
        activeId: params.id,
        engineUsed: 'neural',
        voiceLabel: `${data.voiceUsed || prefs.voiceName} · Neural`,
        languageCode,
        error: null,
      });
    } catch (err) {
      if (mySession !== this.sessionCounter) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Unable to generate neural speech.';
      if (prefs.engine === 'neural') {
        this.emit({
          status: 'idle',
          activeId: null,
          engineUsed: null,
          languageCode: null,
          error: errMsg,
        });
        return;
      }
      await tryBrowserFallback(errMsg);
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }
}

export const voiceEngine = new AlexynVoiceEngine();
