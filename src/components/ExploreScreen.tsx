import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Mic,
  Plus,
  Puzzle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { EXPLORE_PLUGINS, EXPLORE_SUGGESTIONS } from '../data/curriculum';
import { detectDifferentSubjectWarning } from '../utils/alexynLogic';
import { AlexynLogo } from './AlexynLogo';
import type { AttachmentImage, ChatMessage, Conversation, SubjectItem } from '../types/alexyn';

interface ExploreScreenProps {
  conversation: Conversation;
  activePlugins: string[];
  onTogglePlugin: (pluginId: string) => void;
  onSendMessage: (text: string, images: AttachmentImage[], strictScope?: boolean) => Promise<void>;
  isSending: boolean;
  onMakeSmartNotes: (topic: string, subject?: string) => void;
  voiceLanguage?: string;
  autoScrollKeyboard?: boolean;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function ExploreScreen({
  conversation,
  activePlugins,
  onTogglePlugin,
  onSendMessage,
  isSending,
  onMakeSmartNotes,
  voiceLanguage = 'en-US',
  autoScrollKeyboard = true,
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
}: ExploreScreenProps) {
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachmentImage[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [pluginsPanelOpen, setPluginsPanelOpen] = useState(false);
  const [subjectWarning, setSubjectWarning] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);

  // Inline voice mode right inside the composer bar
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const scrollToLatest = () => {
    if (!autoScrollKeyboard) return;
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  useEffect(() => {
    scrollToLatest();
  }, [conversation.messages.length, isSending]);

  // Adjust height dynamically when mobile soft keyboard opens so composer never gets covered
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const topOffset = 56; // TopBar height
      const bottomOffset = scopedSubject ? 0 : 60; // BottomNav height when shown
      setViewportHeight(Math.max(260, Math.round(vv.height - topOffset - bottomOffset)));
      scrollToLatest();
    };
    handleResize();
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [scopedSubject, autoScrollKeyboard]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;

    const loaded = await Promise.all(
      files.map(
        (file) =>
          new Promise<AttachmentImage>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result || '');
              const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: file.name,
                mimeType: file.type || 'image/jpeg',
                base64Data,
                previewUrl: dataUrl,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );

    setAttachedImages((prev) => [...prev, ...loaded].slice(0, 4));
    setPlusMenuOpen(false);
    e.target.value = '';
  };

  const stopAndClearVoice = () => {
    recognitionRef.current?.abort();
    setVoiceListening(false);
    setVoiceActive(false);
    setInputText('');
    inputRef.current?.focus();
  };

  const startInlineVoice = () => {
    setPlusMenuOpen(false);
    setPluginsPanelOpen(false);
    setVoiceActive(true);
    scrollToLatest();

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceListening(true);
      inputRef.current?.focus();
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = voiceLanguage;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        const text = Array.from(event.results)
          .map((res) => res[0]?.transcript || '')
          .join(' ')
          .trim();
        setInputText(text);
        scrollToLatest();
      };
      rec.onerror = () => {
        setVoiceListening(false);
      };
      rec.onend = () => {
        setVoiceListening(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setVoiceListening(true);
      inputRef.current?.focus();
    } catch {
      setVoiceListening(true);
      inputRef.current?.focus();
    }
  };

  const handleLeftButtonPress = () => {
    if (voiceActive) {
      stopAndClearVoice();
    } else {
      setPlusMenuOpen((prev) => !prev);
    }
  };

  const handleSendText = async (rawText: string, imgs: AttachmentImage[]) => {
    const trimmed = rawText.trim();
    if ((!trimmed && imgs.length === 0) || isSending) return;

    if (scopedSubject) {
      const crossWarning = detectDifferentSubjectWarning(trimmed, scopedSubject.name);
      if (crossWarning) {
        setSubjectWarning(crossWarning);
        return;
      }
    }
    setSubjectWarning(null);
    await onSendMessage(trimmed, imgs, Boolean(scopedSubject));
    scrollToLatest();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && attachedImages.length === 0) || isSending) return;

    const imgs = [...attachedImages];
    recognitionRef.current?.stop();
    setVoiceListening(false);
    setVoiceActive(false);
    setInputText('');
    setAttachedImages([]);
    setPlusMenuOpen(false);
    setPluginsPanelOpen(false);
    await handleSendText(trimmed, imgs);
  };

  const hasMessages = conversation.messages.length > 0;
  const scopedSuggestions = scopedSubject
    ? [
        `Teach me ${scopedSubject.examHotTopics[0] || scopedSubject.name}`,
        `What mostly comes in ${scopedSubject.name} exams?`,
        `Give me a memory trick for ${scopedSubject.name}`,
        `Quiz me on ${scopedSubject.name}`,
      ]
    : EXPLORE_SUGGESTIONS;

  return (
    <div
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      className={`relative flex flex-col overflow-hidden bg-[#040A1A] ${
        !viewportHeight
          ? scopedSubject
            ? 'h-[calc(100dvh-3.5rem)]'
            : 'h-[calc(100dvh-3.5rem-3.75rem)]'
          : ''
      }`}
    >
      {scopedSubject && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--alexyn-border)] bg-[#08122E] px-4 py-2.5 md:px-8">
          <button
            type="button"
            onClick={onBackFromScoped}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-[#2E8BFF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {scopedSubject.name}</span>
          </button>
          <span className="truncate text-xs font-semibold text-[#7DD3FC]">
            {scopedSubject.name} Teacher
          </span>
        </div>
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col">
          {!hasMessages ? (
            <div className="my-auto flex flex-col items-center py-6 text-center sm:py-12">
              <AlexynLogo size="md" />
              <p className="mt-2 text-xs font-extrabold tracking-[0.26em] text-[#7DD3FC]">
                {scopedSubject ? `${scopedSubject.name.toUpperCase()} TUTOR` : 'ALEXYN EXPLORE'}
              </p>
              <h1 className="mt-3 text-balance text-2xl font-extrabold text-white sm:text-3xl">
                {scopedSubject
                  ? `Ask your ${scopedSubject.name} teacher`
                  : 'What would you like to understand?'}
              </h1>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                {scopedSubject
                  ? `Focused strictly on ${scopedSubject.name}. If you ask about another subject, I will point you to that subject.`
                  : 'Ask anything, snap a photo, toggle study plugins with +, or tap the mic to speak inline.'}
              </p>

              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {scopedSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendText(prompt, [])}
                    className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0B1633] px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:border-[#2E8BFF]/60 hover:bg-[#12224B] hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-3">
              {conversation.messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${
                      msg.role === 'user'
                        ? 'bg-[#2157BD] text-white'
                        : msg.error
                        ? 'border border-rose-500/35 bg-rose-500/10 text-rose-200'
                        : 'border border-[var(--alexyn-border)] bg-[#0C1736] text-slate-100'
                    }`}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="mb-2.5 flex flex-wrap gap-2">
                        {msg.images.map((img) => (
                          <img
                            key={img.id}
                            src={img.previewUrl}
                            alt={img.name}
                            referrerPolicy="no-referrer"
                            className="h-24 w-24 rounded-xl border border-white/15 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.role === 'assistant' && !msg.error && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            onMakeSmartNotes(
                              conversation.title,
                              scopedSubject?.name || conversation.subjectFocus
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5EEAD4] hover:underline"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Turn into Smart Notes</span>
                        </button>
                        {msg.pluginsUsed && msg.pluginsUsed.length > 0 && (
                          <span className="text-[11px] text-slate-400">
                            Used: {msg.pluginsUsed.join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex items-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-3 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                    <span>ALEXYN is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

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
                      Open {subjectWarning.recommendedSubject} Workspace →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSER WITH INLINE VOICE + PLUS MENU (STAYS ABOVE KEYBOARD) */}
      <div className="relative shrink-0 border-t border-[var(--alexyn-border)] bg-[#060E24]/95 px-3 py-2.5 backdrop-blur-md md:px-8">
        <div className="relative mx-auto max-w-3xl">
          {plusMenuOpen && !voiceActive && (
            <div
              role="menu"
              aria-label="Attachments and plugins"
              className="mb-2.5 rounded-2xl border border-[var(--alexyn-border)] bg-[#0D1938] p-2 shadow-2xl"
            >
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-100 hover:bg-[#162958]"
                >
                  <Camera className="h-4 w-4 text-[#38BDF8]" />
                  <span>Take a photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-100 hover:bg-[#162958]"
                >
                  <ImagePlus className="h-4 w-4 text-[#5EEAD4]" />
                  <span>Choose from gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPluginsPanelOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-100 hover:bg-[#162958]"
                >
                  <Puzzle className="h-4 w-4 text-[#A78BFA]" />
                  <span>Plugins ({activePlugins.length})</span>
                </button>
              </div>

              {pluginsPanelOpen && (
                <div className="mt-2 border-t border-[var(--alexyn-border)] pt-2">
                  <p className="mb-1.5 px-2 text-[11px] font-medium text-slate-400">
                    Toggle learning plugins (apply together):
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {EXPLORE_PLUGINS.map((plugin) => {
                      const active = activePlugins.includes(plugin.id);
                      return (
                        <button
                          key={plugin.id}
                          type="button"
                          onClick={() => onTogglePlugin(plugin.id)}
                          className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'border-[#2E8BFF] bg-[#142A5E] text-white'
                              : 'border-[var(--alexyn-border)] bg-[#09122B] text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{plugin.label}</p>
                            <p className="text-[11px] text-slate-400">{plugin.description}</p>
                          </div>
                          {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5EEAD4]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {(attachedImages.length > 0 || activePlugins.length > 0) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative flex items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0F1C3E] p-1 pr-2"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <span className="max-w-[90px] truncate text-[11px] text-slate-200">
                    {img.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedImages((prev) => prev.filter((item) => item.id !== img.id))
                    }
                    aria-label={`Remove ${img.name}`}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {activePlugins.map((pid) => {
                const p = EXPLORE_PLUGINS.find((item) => item.id === pid);
                if (!p) return null;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => onTogglePlugin(pid)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/40 bg-[#122554] px-2.5 py-1 text-[11px] font-medium text-[#7DD3FC]"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{p.label}</span>
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={`flex items-center gap-2 rounded-3xl border p-1.5 transition-colors ${
              voiceActive
                ? 'border-[#38BDF8] bg-[#0D1E45] shadow-[0_0_24px_rgba(56,189,248,0.22)]'
                : 'border-[var(--alexyn-border)] bg-[#101B38]'
            }`}
          >
            <button
              type="button"
              onClick={handleLeftButtonPress}
              aria-label={voiceActive ? 'Cancel voice input' : 'Open photos and plugins menu'}
              aria-expanded={!voiceActive && plusMenuOpen}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                voiceActive
                  ? 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/35'
                  : plusMenuOpen
                  ? 'bg-[#2E8BFF] text-white'
                  : 'text-slate-200 hover:bg-[#192B59]'
              }`}
            >
              {voiceActive ? (
                <X className="h-5 w-5" />
              ) : (
                <Plus className={`h-5 w-5 transition-transform ${plusMenuOpen ? 'rotate-45' : ''}`} />
              )}
            </button>

            {voiceActive && (
              <div
                aria-label="Live voice speech waveform"
                className="flex h-6 shrink-0 items-end gap-0.5 px-1"
              >
                {[0.45, 0.9, 0.6, 1, 0.5].map((ratio, idx) => (
                  <span
                    key={idx}
                    style={{
                      height: `${Math.round(ratio * 20)}px`,
                      animationDelay: `${idx * 100}ms`,
                    }}
                    className={`w-1 rounded-full bg-[#38BDF8] ${
                      voiceListening ? 'voice-bar' : 'opacity-65'
                    }`}
                  />
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onFocus={scrollToLatest}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                voiceActive
                  ? 'Listening... speak or edit speech'
                  : scopedSubject
                  ? `Ask your ${scopedSubject.name} teacher...`
                  : 'Ask ALEXYN anything...'
              }
              aria-label="Ask ALEXYN anything"
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none sm:text-base"
            />

            <button
              type="button"
              onClick={voiceActive ? stopAndClearVoice : startInlineVoice}
              aria-label={voiceActive ? 'Voice active — press to cancel' : 'Start inline voice input'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                voiceActive
                  ? 'bg-[#38BDF8] text-[#040A1A]'
                  : 'text-slate-200 hover:bg-[#192B59]'
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>

            <button
              type="submit"
              disabled={(!inputText.trim() && attachedImages.length === 0) || isSending}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] text-white transition-opacity disabled:bg-[#1F2D52] disabled:bg-none disabled:text-slate-500"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
        </div>
      </div>
    </div>
  );
}
