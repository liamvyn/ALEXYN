import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import type { VoicePreferences } from '../types/alexyn';
import {
  DEFAULT_VOICE_PREFERENCES,
  voiceEngine,
  type VoicePlaybackSnapshot,
} from '../utils/voiceEngine';

interface VoiceControlBarProps {
  playbackId: string;
  text: string;
  voicePrefs?: VoicePreferences;
  subjectHint?: string;
  langOverride?: string;
  compact?: boolean;
  label?: string;
  onSpeedChange?: (nextSpeed: number) => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  playbackId,
  text,
  voicePrefs,
  subjectHint,
  langOverride,
  compact = false,
  label = 'Listen',
  onSpeedChange,
}) => {
  const [snap, setSnap] = useState<VoicePlaybackSnapshot>(() => voiceEngine.getSnapshot());
  const [localSpeed, setLocalSpeed] = useState<number>(
    voicePrefs?.speed ?? DEFAULT_VOICE_PREFERENCES.speed
  );
  const [lastAttemptedId, setLastAttemptedId] = useState(false);

  useEffect(() => {
    setLocalSpeed(voicePrefs?.speed ?? DEFAULT_VOICE_PREFERENCES.speed);
  }, [voicePrefs?.speed]);

  useEffect(() => {
    return voiceEngine.subscribe((next) => {
      setSnap(next);
      if (next.activeId === playbackId) {
        setLastAttemptedId(true);
      } else if (next.activeId !== null) {
        setLastAttemptedId(false);
      }
    });
  }, [playbackId]);

  const isMine = snap.activeId === playbackId;
  const isLoading = isMine && snap.status === 'loading';
  const isPlaying = isMine && snap.status === 'playing';
  const isPaused = isMine && snap.status === 'paused';
  const showError = (isMine || lastAttemptedId) && Boolean(snap.error);

  const handlePlayOrResume = () => {
    setLastAttemptedId(true);
    if (isPaused) {
      voiceEngine.resume();
      return;
    }
    void voiceEngine.speak({
      id: playbackId,
      text,
      prefs: voicePrefs,
      subjectHint,
      langOverride,
      speedOverride: localSpeed,
    });
  };

  const handleCycleSpeed = () => {
    const speeds = [0.95, 1.15, 1.3, 1.45];
    const currentIdx = speeds.findIndex((s) => Math.abs(s - localSpeed) < 0.05);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    setLocalSpeed(nextSpeed);
    voiceEngine.updatePreferredSpeed(nextSpeed);
    onSpeedChange?.(nextSpeed);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {isLoading ? (
          <button
            type="button"
            onClick={() => voiceEngine.stop()}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 text-sky-200 font-medium transition ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            }`}
            title="Preparing natural voice audio (click to cancel)"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Preparing Audio...
          </button>
        ) : isPlaying ? (
          <button
            type="button"
            onClick={() => voiceEngine.pause()}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 font-medium transition ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            }`}
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        ) : isPaused ? (
          <button
            type="button"
            onClick={handlePlayOrResume}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 font-medium transition ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlayOrResume}
            disabled={!text.trim()}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] text-slate-200 hover:bg-sky-500/15 hover:border-sky-400/35 disabled:opacity-40 font-medium transition ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-300" />
            {label}
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={() => voiceEngine.stop()}
            className={`inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 font-medium transition ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
            }`}
            title="Stop audio"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop
          </button>
        )}

        <button
          type="button"
          onClick={handleCycleSpeed}
          className={`rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:border-sky-400/35 hover:text-white transition ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
          }`}
          title="Adjust and save speaking speed"
        >
          {localSpeed.toFixed(2).replace(/\.00$/, '.0')}x
        </button>

        {isMine && !compact && snap.voiceLabel && (
          <span className="text-[11px] text-slate-400 ml-1">{snap.voiceLabel}</span>
        )}
      </div>

      {showError && snap.error && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          <span>{snap.error}</span>
        </div>
      )}
    </div>
  );
};
