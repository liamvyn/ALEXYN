import { Globe2, Keyboard, Mic, Server, Sliders, X } from 'lucide-react';
import type { AppSettings, NoteDetailLevel } from '../types/alexyn';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onClearGuestCache: () => void;
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
}: SettingsModalProps) {
  if (!open) return null;

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
              <h2 className="text-base font-bold text-white">App Settings</h2>
              <p className="text-xs text-slate-400">
                Customize voice language, keyboard scrolling & Pocket Code sync
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
