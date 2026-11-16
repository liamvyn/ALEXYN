import type { VoicePreferences } from '../types/alexyn';
import {
  getSpeechLangForSubject,
  isSpeechSynthesisSupported,
  splitSpeechChunks,
  stopBrowserTTS,
  stripMarkdownForSpeech,
} from './alexynLogic';
import { apiUrl } from './apiBase';

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  engine: 'auto',
  voiceName: 'Kore',
  voiceStyle: 'Warm, clear & natural teacher',
  speed: 1.0,
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
  error: string | null;
}

type SnapshotListener = (snapshot: VoicePlaybackSnapshot) => void;

class AlexynVoiceEngine {
  private snapshot: VoicePlaybackSnapshot = {
    status: 'idle',
    activeId: null,
    engineUsed: null,
    voiceLabel: '',
    error: null,
  };
  private listeners = new Set<SnapshotListener>();
  private audioEl: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private sessionCounter = 0;

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

  private cleanupAudioElement() {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
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

  stop() {
    this.sessionCounter += 1;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.cleanupAudioElement();
    stopBrowserTTS();
    this.emit({
      status: 'idle',
      activeId: null,
      engineUsed: null,
      voiceLabel: '',
      error: null,
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

  setPlaybackSpeed(speed: number) {
    const safeSpeed = Math.max(0.6, Math.min(1.6, speed));
    if (this.audioEl) {
      this.audioEl.playbackRate = safeSpeed;
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
    const prefs = { ...DEFAULT_VOICE_PREFERENCES, ...(params.prefs || {}) };
    const speed = Math.max(0.6, Math.min(1.6, params.speedOverride ?? prefs.speed ?? 1.0));
    const languageCode =
      params.langOverride ||
      getSpeechLangForSubject(params.subjectHint, prefs.readLanguageCode || 'en-US');

    const cleanText = stripMarkdownForSpeech(params.text);
    if (!cleanText) {
      this.emit({ error: 'Nothing readable to speak.' });
      return;
    }

    // Stop any previous playback cleanly
    this.stop();
    const mySession = this.sessionCounter;

    const tryBrowserFallback = (fallbackNotice?: string) => {
      if (mySession !== this.sessionCounter) return;
      if (!isSpeechSynthesisSupported()) {
        this.emit({
          status: 'idle',
          activeId: null,
          error: fallbackNotice || 'Spoken audio is unavailable in this browser.',
        });
        return;
      }

      const chunks = splitSpeechChunks(cleanText, 200);
      const voices = window.speechSynthesis.getVoices();
      const baseLang = languageCode.split('-')[0].toLowerCase();
      const chosenBrowserVoice =
        (prefs.browserVoiceUri
          ? voices.find((v) => v.voiceURI === prefs.browserVoiceUri)
          : undefined) ||
        voices.find(
          (v) =>
            v.lang.toLowerCase() === languageCode.toLowerCase() &&
            /natural|neural|google|microsoft|samantha|daniel|karen/i.test(v.name)
        ) ||
        voices.find((v) => v.lang.toLowerCase() === languageCode.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(baseLang));

      let chunkIdx = 0;
      const speakNext = () => {
        if (mySession !== this.sessionCounter) return;
        if (chunkIdx >= chunks.length) {
          this.emit({ status: 'idle', activeId: null, engineUsed: null });
          return;
        }
        const utt = new SpeechSynthesisUtterance(chunks[chunkIdx]);
        utt.lang = languageCode;
        utt.rate = speed;
        if (chosenBrowserVoice) utt.voice = chosenBrowserVoice;
        utt.onend = () => {
          if (mySession !== this.sessionCounter) return;
          chunkIdx += 1;
          speakNext();
        };
        utt.onerror = () => {
          if (mySession !== this.sessionCounter) return;
          this.emit({
            status: 'idle',
            activeId: null,
            error: 'Browser speech stopped unexpectedly.',
          });
        };
        window.speechSynthesis.speak(utt);
      };

      this.emit({
        status: 'playing',
        activeId: params.id,
        engineUsed: 'browser',
        voiceLabel: chosenBrowserVoice?.name || `Browser Voice (${languageCode})`,
        error: fallbackNotice || null,
      });
      speakNext();
    };

    if (prefs.engine === 'browser') {
      tryBrowserFallback();
      return;
    }

    // Attempt neural TTS via /api/tts
    this.emit({
      status: 'loading',
      activeId: params.id,
      engineUsed: 'neural',
      voiceLabel: `${prefs.voiceName} (Neural)`,
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
            error: data.reason || data.error || 'Neural voice service unavailable right now.',
          });
          return;
        }
        tryBrowserFallback();
        return;
      }

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      this.activeObjectUrl = url;

      const audio = new Audio(url);
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
        });
      };

      audio.onerror = () => {
        if (mySession !== this.sessionCounter) return;
        this.cleanupAudioElement();
        tryBrowserFallback('Audio stream interrupted — switched to browser speech.');
      };

      await audio.play();
      if (mySession !== this.sessionCounter) return;
      this.emit({
        status: 'playing',
        activeId: params.id,
        engineUsed: 'neural',
        voiceLabel: `${data.voiceUsed || prefs.voiceName} · Neural`,
        error: null,
      });
    } catch (err) {
      if (mySession !== this.sessionCounter) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (prefs.engine === 'neural') {
        this.emit({
          status: 'idle',
          activeId: null,
          error: err instanceof Error ? err.message : 'Unable to generate neural speech.',
        });
        return;
      }
      tryBrowserFallback();
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }
}

export const voiceEngine = new AlexynVoiceEngine();
