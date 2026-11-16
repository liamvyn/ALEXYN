import {
  BrainCircuit,
  Globe2,
  Keyboard,
  Mic,
  Server,
  Sliders,
  TrendingUp,
  X,
} from 'lucide-react';
import { DEFAULT_AI_TUTOR_SETTINGS } from '../utils/alexynLogic';
import type {
  AIExplanationDepth,
  AIResponseLength,
  AITeachingApproach,
  AITutorSettings,
  AppSettings,
  NoteDetailLevel,
} from '../types/alexyn';

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
  if (!open) return null;

  const aiTutor: AITutorSettings = {
    ...DEFAULT_AI_TUTOR_SETTINGS,
    ...(settings.aiTutor || {}),
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

          <div>
            <label
              htmlFor="settingsVoiceLang"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300"
            >
              <Mic className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Voice Recognition Language</span>
            </label>
            <select
              id="settingsVoiceLang"
              value={settings.voiceLanguage}
              onChange={(e) =>
                onUpdateSettings({ ...settings, voiceLanguage: e.target.value })
              }
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0C1736] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
            >
              {VOICE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

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

          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1736] p-3.5">
            <label
              htmlFor="pocketServerUrl"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300"
            >
              <Server className="h-3.5 w-3.5 text-[#5EEAD4]" />
              <span>AI Server URL (for Pocket Code WebView)</span>
            </label>
            <input
              id="pocketServerUrl"
              type="url"
              value={settings.pocketCodeServerUrl}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  pocketCodeServerUrl: e.target.value,
                })
              }
              placeholder="https://your-alexyn-server.run.app"
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Used when running the standalone HTML/JS file inside Pocket Code so live AI tutoring connects automatically.
            </p>
          </div>

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
