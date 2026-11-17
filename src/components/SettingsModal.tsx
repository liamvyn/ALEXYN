import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Globe2,
  Keyboard,
  Loader2,
  Mic,
  Sliders,
  TrendingUp,
  X,
  AlertCircle,
} from 'lucide-react';
import { DEFAULT_AI_TUTOR_SETTINGS } from '../utils/alexynLogic';
import {
  DEFAULT_VOICE_PREFERENCES,
  loadBrowserVoicesAsync,
  NEURAL_VOICE_OPTIONS,
  VOICE_STYLE_PRESETS,
} from '../utils/voiceEngine';
import { checkBrowserVoiceSupportForLang } from '../utils/ttsUtils';
import { VoiceControlBar } from './VoiceControlBar';
import { apiUrl, getApiBaseUrl, setApiBaseUrl } from '../utils/apiBase';
import type {
  AIExplanationDepth,
  AIProviderId,
  AIProviderInfo,
  AIResponseLength,
  AITeachingApproach,
  AITutorSettings,
  AppSettings,
  NeuralVoiceName,
  NoteDetailLevel,
  PrivacySettings,
  VoiceEngineMode,
  VoicePreferences,
} from '../types/alexyn';
import { ShieldCheck, Volume2 } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onClearGuestCache: () => void;
  onOpenProgress?: () => void;
  progressSummary?: { overallAverage: number; totalAttempts: number };
}

const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English (US / International)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'sw-KE', label: 'Kiswahili (Kenya / Tanzania)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'zh-CN', label: 'Chinese Mandarin (中文)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onClearGuestCache,
  onOpenProgress,
  progressSummary,
}: SettingsModalProps) {
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [apiBaseInput, setApiBaseInput] = useState(() => getApiBaseUrl());
  const [apiBaseSaved, setApiBaseSaved] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  const loadProviders = () => {
    setLoadingProviders(true);
    fetch(apiUrl('/api/ai/providers'))
      .then((r) => r.json())
      .then((data: { providers?: AIProviderInfo[] }) => {
        if (Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
      })
      .catch(() => {
        // leave current list if offline
      })
      .finally(() => {
        setLoadingProviders(false);
      });
  };

  useEffect(() => {
    if (!open) return;
    setApiBaseInput(getApiBaseUrl());
    setApiBaseSaved(false);
    let cancelled = false;
    setLoadingProviders(true);
    fetch(apiUrl('/api/ai/providers'))
      .then((r) => r.json())
      .then((data: { providers?: AIProviderInfo[] }) => {
        if (!cancelled && Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
      })
      .catch(() => {
        // leave current list if offline
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });
    void loadBrowserVoicesAsync(500).then((vList) => {
      if (!cancelled) setBrowserVoices(vList);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const aiTutor: AITutorSettings = {
    ...DEFAULT_AI_TUTOR_SETTINGS,
    ...(settings.aiTutor || {}),
  };

  const voicePrefs: VoicePreferences = {
    ...DEFAULT_VOICE_PREFERENCES,
    ...(settings.voicePrefs || {}),
  };

  const privacyPrefs: PrivacySettings = {
    shareNotesWithAI: true,
    shareProgressWithAI: true,
    shareHistoryWithAI: true,
    ...(settings.privacy || {}),
  };

  const updateVoicePrefs = (patch: Partial<VoicePreferences>) => {
    onUpdateSettings({
      ...settings,
      voicePrefs: {
        ...voicePrefs,
        ...patch,
      },
    });
  };

  const updatePrivacy = (patch: Partial<PrivacySettings>) => {
    onUpdateSettings({
      ...settings,
      privacy: {
        ...privacyPrefs,
        ...patch,
      },
    });
  };

  const selectedProviderId: AIProviderId = settings.aiProvider || 'auto';
  const activeProvider = providers.find((p) => p.id === selectedProviderId);
  const availableModels = activeProvider?.models || [];
  const selectedModelId = settings.aiModel || availableModels[0]?.id || '';

  const handleSelectProvider = (providerId: AIProviderId) => {
    const found = providers.find((p) => p.id === providerId);
    const defaultModel = found?.models[0]?.id || '';
    setTestResult(null);
    onUpdateSettings({
      ...settings,
      aiProvider: providerId,
      aiModel: defaultModel,
    });
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setTestResult(null);
    try {
      const res = await fetch(apiUrl('/api/ai/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          providerId: selectedProviderId,
          modelId: selectedModelId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTestResult({
          ok: false,
          message: data.error || 'Provider connection test failed.',
        });
      } else {
        setTestResult({
          ok: true,
          message: `Connected via ${data.providerId} (${data.modelId}) in ${data.latencyMs}ms.`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to reach AI provider.',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const updateAiTutor = (patch: Partial<AITutorSettings>) => {
    onUpdateSettings({
      ...settings,
      aiTutor: {
        ...aiTutor,
        ...patch,
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ALEXYN Settings"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--alexyn-border)] bg-[#081129] p-5 text-slate-100 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-[var(--alexyn-border)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#132550] text-[#38BDF8]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">App & AI Tutor Settings</h2>
              <p className="text-xs text-slate-400">
                Customize AI teaching style, voice language & study preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-[#122249] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* AI TUTOR PERSONALIZATION */}
          <section
            aria-label="AI Teaching Behaviour"
            className="space-y-3 rounded-2xl border border-[#2E8BFF]/30 bg-[#0B1636] p-4"
          >
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[#38BDF8]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7DD3FC]">
                AI Teaching Preferences
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="aiExplanationDepth"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Explanation Depth
                </label>
                <select
                  id="aiExplanationDepth"
                  value={aiTutor.explanationDepth}
                  onChange={(e) =>
                    updateAiTutor({
                      explanationDepth: e.target.value as AIExplanationDepth,
                    })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="foundational">Foundational (Beginner)</option>
                  <option value="balanced">Balanced (Clear + Key)</option>
                  <option value="deep">Deep (Full Mechanisms)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="aiResponseLength"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Response Length
                </label>
                <select
                  id="aiResponseLength"
                  value={aiTutor.responseLength}
                  onChange={(e) =>
                    updateAiTutor({
                      responseLength: e.target.value as AIResponseLength,
                    })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="concise">Concise (Quick & Crisp)</option>
                  <option value="medium">Medium (Well-Paced)</option>
                  <option value="comprehensive">Comprehensive (Detailed)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="aiTeachingApproach"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Teaching Approach
                </label>
                <select
                  id="aiTeachingApproach"
                  value={aiTutor.teachingApproach}
                  onChange={(e) =>
                    updateAiTutor({
                      teachingApproach: e.target.value as AITeachingApproach,
                    })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="intuitive">Intuitive & Conceptual</option>
                  <option value="step-by-step">Step-by-Step Guide</option>
                  <option value="socratic">Socratic (Guided Q&A)</option>
                  <option value="exam-focused">Exam & Marking Focus</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="aiEducationalLevel"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Educational Level
                </label>
                <select
                  id="aiEducationalLevel"
                  value={aiTutor.educationalLevel}
                  onChange={(e) =>
                    updateAiTutor({
                      educationalLevel: e.target.value as AITutorSettings['educationalLevel'],
                    })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="auto">Auto (Match Profile)</option>
                  <option value="Primary">Primary School</option>
                  <option value="Secondary">Secondary / High School</option>
                  <option value="College">College / Diploma</option>
                  <option value="University">University / Degree</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5">
                <span className="text-xs font-medium text-slate-200">
                  Use relatable everyday examples
                </span>
                <input
                  type="checkbox"
                  checked={aiTutor.useRelatableExamples}
                  onChange={(e) =>
                    updateAiTutor({ useRelatableExamples: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#2E8BFF]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5">
                <span className="text-xs font-medium text-slate-200">
                  Include natural humorous or imaginative comparisons
                </span>
                <input
                  type="checkbox"
                  checked={aiTutor.useHumorousExamples}
                  onChange={(e) =>
                    updateAiTutor({ useHumorousExamples: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#2E8BFF]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5">
                <span className="text-xs font-medium text-slate-200">
                  Ask helpful follow-up questions
                </span>
                <input
                  type="checkbox"
                  checked={aiTutor.askFollowUpQuestions}
                  onChange={(e) =>
                    updateAiTutor({ askFollowUpQuestions: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#2E8BFF]"
                />
              </label>
            </div>
          </section>

          {/* NATURAL AI VOICE & SPEECH STUDIO */}
          <section
            aria-label="Natural AI Voice Preferences"
            className="space-y-3 rounded-2xl border border-teal-400/30 bg-[#0A1634] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-teal-300" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-200">
                  AI Voice &amp; Pronunciation
                </h3>
              </div>
              <VoiceControlBar
                playbackId="settings-voice-preview"
                text="Hi! This is ALEXYN speaking clearly at your chosen pace. Ready to understand more together?"
                voicePrefs={voicePrefs}
                compact
                label="Preview Voice"
                onSpeedChange={(nextSpeed) => updateVoicePrefs({ speed: nextSpeed })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settingsVoiceEngine"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Voice Engine
                </label>
                <select
                  id="settingsVoiceEngine"
                  value={voicePrefs.engine}
                  onChange={(e) =>
                    updateVoicePrefs({ engine: e.target.value as VoiceEngineMode })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="auto">Auto (Natural Neural + Fallback)</option>
                  <option value="neural">Natural Neural Voice (Gemini TTS)</option>
                  <option value="browser">Device Browser Speech Only</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="settingsNeuralVoice"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Voice Character
                </label>
                <select
                  id="settingsNeuralVoice"
                  value={voicePrefs.voiceName}
                  onChange={(e) =>
                    updateVoicePrefs({ voiceName: e.target.value as NeuralVoiceName })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {NEURAL_VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="settingsVoiceStyle"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Speaking Style
                </label>
                <select
                  id="settingsVoiceStyle"
                  value={voicePrefs.voiceStyle}
                  onChange={(e) => updateVoicePrefs({ voiceStyle: e.target.value })}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {VOICE_STYLE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="settingsVoiceSpeed"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <span>Speaking Speed</span>
                  <span className="text-sky-300 font-mono">
                    {voicePrefs.speed.toFixed(2).replace(/\.00$/, '.0')}x
                  </span>
                </label>
                <input
                  id="settingsVoiceSpeed"
                  type="range"
                  min="0.8"
                  max="1.6"
                  step="0.05"
                  value={voicePrefs.speed}
                  onChange={(e) =>
                    updateVoicePrefs({ speed: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#5EEAD4] mt-1.5"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    { label: '0.9x Calm', val: 0.9 },
                    { label: '1.15x Default', val: 1.15 },
                    { label: '1.3x Brisk', val: 1.3 },
                    { label: '1.5x Fast', val: 1.5 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => updateVoicePrefs({ speed: preset.val })}
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        Math.abs(voicePrefs.speed - preset.val) < 0.03
                          ? 'border-[#5EEAD4] bg-[#0D2A3F] text-[#5EEAD4]'
                          : 'border-white/10 bg-[#060E24] text-slate-300 hover:border-[#38BDF8]/50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="settingsVoiceLang"
                className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300"
              >
                <Mic className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>Microphone &amp; Default Reading Language</span>
              </label>
                <select
                id="settingsVoiceLang"
                value={settings.voiceLanguage}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    voiceLanguage: e.target.value,
                    voicePrefs: { ...voicePrefs, readLanguageCode: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
              >
                {VOICE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {browserVoices.length > 0 && (
              <div>
                <label
                  htmlFor="settingsBrowserVoice"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Preferred Device Browser Voice (Fallback / Offline)
                </label>
                <select
                  id="settingsBrowserVoice"
                  value={voicePrefs.browserVoiceUri || ''}
                  onChange={(e) =>
                    updateVoicePrefs({ browserVoiceUri: e.target.value || undefined })
                  }
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  <option value="">Auto-Match Target Language Voice</option>
                  {browserVoices.map((bv) => (
                    <option key={bv.voiceURI} value={bv.voiceURI}>
                      {bv.name} ({bv.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-[#060E24] p-2.5 text-[11px] text-slate-300">
              <p className="font-semibold text-teal-200 mb-1">
                Device Fallback Language Support (when Neural TTS is offline):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'English', code: 'en-US' },
                  { label: 'French', code: 'fr-FR' },
                  { label: 'Spanish', code: 'es-ES' },
                  { label: 'Japanese', code: 'ja-JP' },
                  { label: 'Kiswahili', code: 'sw-KE' },
                ].map((item) => {
                  const res = checkBrowserVoiceSupportForLang(browserVoices, item.code);
                  return (
                    <span
                      key={item.code}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                        res.languageSupported && res.matchedVoice
                          ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      {item.label}: {res.languageSupported && res.matchedVoice ? 'Device Ready' : 'Neural TTS'}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {/* AI PRIVACY & STUDY MEMORY PERMISSIONS */}
          <section
            aria-label="AI Privacy and Study Memory"
            className="space-y-2 rounded-2xl border border-white/10 bg-[#0C1736] p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-200">
                AI Context &amp; Privacy Controls
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Choose what personal study data Explore AI may read to tailor help and execute in-app study requests.
            </p>
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2">
              <span className="text-xs font-medium text-slate-200">
                Share saved Smart Notes summaries with Explore AI
              </span>
              <input
                type="checkbox"
                checked={privacyPrefs.shareNotesWithAI}
                onChange={(e) =>
                  updatePrivacy({ shareNotesWithAI: e.target.checked })
                }
                className="h-4 w-4 accent-[#2E8BFF]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2">
              <span className="text-xs font-medium text-slate-200">
                Share quiz marks &amp; weak topics with Explore AI
              </span>
              <input
                type="checkbox"
                checked={privacyPrefs.shareProgressWithAI}
                onChange={(e) =>
                  updatePrivacy({ shareProgressWithAI: e.target.checked })
                }
                className="h-4 w-4 accent-[#2E8BFF]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2">
              <span className="text-xs font-medium text-slate-200">
                Share recent study topic history across sessions
              </span>
              <input
                type="checkbox"
                checked={privacyPrefs.shareHistoryWithAI}
                onChange={(e) =>
                  updatePrivacy({ shareHistoryWithAI: e.target.checked })
                }
                className="h-4 w-4 accent-[#2E8BFF]"
              />
            </label>
          </section>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Globe2 className="h-3.5 w-3.5 text-[#5EEAD4]" />
              <span>Default Smart Notes Depth</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['detailed', 'short'] as NoteDetailLevel[]).map((depth) => (
                <button
                  key={depth}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, defaultNoteDepth: depth })
                  }
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    settings.defaultNoteDepth === depth
                      ? 'border-[#38BDF8] bg-[#13295E] text-white'
                      : 'border-[var(--alexyn-border)] bg-[#0C1736] text-slate-300'
                  }`}
                >
                  {depth === 'detailed' ? 'Detailed (For Book)' : 'Short (Quick Review)'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1736] p-3.5">
            <div className="flex items-start gap-2.5">
              <Keyboard className="mt-0.5 h-4 w-4 text-[#38BDF8]" />
              <div>
                <p className="text-xs font-bold text-white">Auto-Scroll Chat Above Keyboard</p>
                <p className="text-[11px] text-slate-400">
                  Shifts messages upward automatically when typing or using inline voice
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoScrollKeyboard}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  autoScrollKeyboard: e.target.checked,
                })
              }
              className="h-4 w-4 accent-[#2E8BFF]"
            />
          </label>

          {/* MULTI-PROVIDER AI ENGINE SELECTOR */}
          <section
            aria-label="AI Provider and Model"
            className="space-y-3 rounded-2xl border border-[#2E8BFF]/35 bg-[#0C1736] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#5EEAD4]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7DD3FC]">
                  AI Provider &amp; Model
                </h3>
              </div>
              {loadingProviders && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#38BDF8]" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settingsAiProvider"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  AI Provider
                </label>
                <select
                  id="settingsAiProvider"
                  value={selectedProviderId}
                  onChange={(e) => handleSelectProvider(e.target.value as AIProviderId)}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
                >
                  {providers.length === 0 ? (
                    <option value="auto">Smart Auto (Best Configured Free/Default)</option>
                  ) : (
                    providers.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name} ({prov.configured ? 'Ready' : 'Needs Key'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="settingsAiModel"
                  className="mb-1 block text-xs font-semibold text-slate-300"
                >
                  Model
                </label>
                <select
                  id="settingsAiModel"
                  value={selectedModelId}
                  onChange={(e) => {
                    setTestResult(null);
                    onUpdateSettings({ ...settings, aiModel: e.target.value });
                  }}
                  disabled={availableModels.length === 0}
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white focus:border-[#2E8BFF] focus:outline-none disabled:opacity-60"
                >
                  {availableModels.length === 0 ? (
                    <option value="">Default Auto Model</option>
                  ) : (
                    availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} [{m.tier === 'free' ? 'Free Tier' : m.tier === 'paid' ? 'Paid' : 'Varies'}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {activeProvider && (
              <div className="space-y-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      activeProvider.configured ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {activeProvider.configured ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    <span>{activeProvider.statusText}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Server env: {activeProvider.envVarHint}
                  </span>
                </div>
                <p className="text-slate-300">{activeProvider.freeTierInfo}</p>
                <p className="text-slate-400">
                  Billing / Key note: {activeProvider.requiresPaymentOrKey.replace(/\.+$/, '')}. API keys remain securely on the backend server.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConn}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193372] disabled:opacity-50"
              >
                {testingConn ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Cpu className="h-3.5 w-3.5" />
                )}
                <span>{testingConn ? 'Testing...' : 'Test Connection'}</span>
              </button>

              {testResult && (
                <span
                  className={`text-[11px] font-medium ${
                    testResult.ok ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {testResult.message}
                </span>
              )}
            </div>

            <div className="space-y-1.5 border-t border-[var(--alexyn-border)] pt-3">
              <label
                htmlFor="alexynBackendUrl"
                className="block text-[11px] font-semibold text-slate-300"
              >
                Backend Server URL (Optional — for Standalone HTML / Mobile Viewers)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="alexynBackendUrl"
                  type="url"
                  value={apiBaseInput}
                  onChange={(e) => {
                    setApiBaseInput(e.target.value);
                    setApiBaseSaved(false);
                  }}
                  placeholder="Leave blank on server, or e.g. http://localhost:3000"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const saved = setApiBaseUrl(apiBaseInput);
                    setApiBaseInput(saved);
                    setApiBaseSaved(true);
                    loadProviders();
                  }}
                  className="shrink-0 rounded-xl border border-[#2E8BFF]/40 bg-[#122658] px-3 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193372]"
                >
                  Save URL
                </button>
              </div>
              {apiBaseSaved && (
                <p className="text-[11px] text-emerald-300">
                  {apiBaseInput
                    ? `Connected API base to ${apiBaseInput}`
                    : 'Reset to default same-origin server.'}
                </p>
              )}
            </div>
          </section>

          {onOpenProgress && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProgress();
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-[#2E8BFF]/40 bg-[#0D1E45] p-3.5 text-left transition-colors hover:border-[#38BDF8] hover:bg-[#132960]"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-4 w-4 text-[#5EEAD4]" />
                <div>
                  <p className="text-xs font-bold text-white">My Progress & Academic Analytics</p>
                  <p className="text-[11px] text-slate-300">
                    {progressSummary && progressSummary.totalAttempts > 0
                      ? `${progressSummary.overallAverage}% avg · ${progressSummary.totalAttempts} graded quiz${progressSummary.totalAttempts === 1 ? '' : 'zes'}`
                      : 'View real quiz marks, graphs & smart reminders'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#7DD3FC]">View →</span>
            </button>
          )}

          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1736] p-3.5">
            <p className="text-xs font-bold text-[#7DD3FC]">About ALEXYN</p>
            <p className="mt-1 text-xs font-semibold text-white">
              Created by Alex Mbugua · Secondary Student
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Understand more. Memorise less. Think smarter.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--alexyn-border)] pt-3">
            <button
              type="button"
              onClick={onClearGuestCache}
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
            >
              Reset Guest Session
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-2 text-xs font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
