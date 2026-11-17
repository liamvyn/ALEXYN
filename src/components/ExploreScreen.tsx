import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Atom,
  BookOpen,
  Camera,
  Check,
  Cpu,
  ExternalLink,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Mic,
  Plus,
  Puzzle,
  Send,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { EXPLORE_PLUGINS, EXPLORE_SUGGESTIONS } from '../data/curriculum';
import {
  detectDifferentSubjectWarning,
  extractLanguagePracticePhrases,
  extractPureTargetSpeechText,
  getSpeechLangForSubject,
} from '../utils/alexynLogic';
import { voiceEngine } from '../utils/voiceEngine';
import { apiUrl } from '../utils/apiBase';
import { AlexynLogo } from './AlexynLogo';
import { VoiceControlBar } from './VoiceControlBar';
import type {
  AIProviderId,
  AIProviderInfo,
  AISelection,
  AppControlAction,
  AttachmentImage,
  ChatMessage,
  Conversation,
  ImportedMaterialItem,
  LabRecommendation,
  SubjectItem,
  VoicePreferences,
} from '../types/alexyn';

interface ExploreScreenProps {
  conversation: Conversation;
  activePlugins: string[];
  onTogglePlugin: (pluginId: string) => void;
  onSendMessage: (
    text: string,
    images: AttachmentImage[],
    strictScope?: boolean,
    importedMaterials?: ImportedMaterialItem[]
  ) => Promise<void>;
  onCancelRequest?: () => void;
  isSending: boolean;
  onMakeSmartNotes: (topic: string, subject?: string) => void;
  onOpenRecommendedLab?: (rec: LabRecommendation) => void;
  onExecuteAppAction?: (action: AppControlAction) => void;
  voiceLanguage?: string;
  voicePrefs?: VoicePreferences;
  autoScrollKeyboard?: boolean;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
  progressSummary?: { overallAverage: number; totalAttempts: number };
  onOpenProgress?: () => void;
  aiSelection?: AISelection;
  onChangeAiSelection?: (next: AISelection) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
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
  onCancelRequest,
  isSending,
  onMakeSmartNotes,
  onOpenRecommendedLab,
  onExecuteAppAction,
  voiceLanguage = 'en-US',
  voicePrefs,
  autoScrollKeyboard = true,
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
  progressSummary,
  onOpenProgress,
  aiSelection,
  onChangeAiSelection,
}: ExploreScreenProps) {
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachmentImage[]>([]);
  const [attachedMaterials, setAttachedMaterials] = useState<ImportedMaterialItem[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [pluginsPanelOpen, setPluginsPanelOpen] = useState(false);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [importUrlValue, setImportUrlValue] = useState('');
  const [importingMaterial, setImportingMaterial] = useState(false);
  const [importMaterialError, setImportMaterialError] = useState<string | null>(null);
  const [aiProviders, setAiProviders] = useState<AIProviderInfo[]>([]);
  const [subjectWarning, setSubjectWarning] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);

  // Voice recording state (100% independent of + button)
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'stopped'>('idle');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [speakingPhraseKey, setSpeakingPhraseKey] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextBeforeVoiceRef = useRef<string>('');
  const voiceSessionActiveRef = useRef(false);

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

  // Auto-grow textarea height safely
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [inputText]);

  // Adjust height dynamically when mobile soft keyboard opens so composer never gets covered
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const topOffset = 56;
      const bottomOffset = scopedSubject ? 0 : 64;
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
    const unsub = voiceEngine.subscribe((snap) => {
      if (snap.error) {
        setSpeechError(snap.error);
      }
      if (snap.status === 'idle') {
        setSpeakingPhraseKey((curr) => (curr && snap.activeId !== `phrase-${curr}` ? curr : null));
      }
    });
    return () => {
      unsub();
      recognitionRef.current?.abort();
      voiceEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!plusMenuOpen || aiProviders.length > 0) return;
    fetch(apiUrl('/api/ai/providers'))
      .then((r) => r.json())
      .then((data: { providers?: AIProviderInfo[] }) => {
        if (Array.isArray(data.providers)) {
          setAiProviders(data.providers);
        }
      })
      .catch(() => {
        // ignore if offline
      });
  }, [plusMenuOpen, aiProviders.length]);

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

  const handleDocumentSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingMaterial(true);
    setImportMaterialError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read selected document.'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      const res = await fetch(apiUrl('/api/import/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not extract text from document.');
      }

      const item: ImportedMaterialItem = {
        id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: file.name,
        sourceType: 'file',
        fileName: file.name,
        detailLabel: data.detailLabel || 'Document',
        pageCount: typeof data.pageCount === 'number' ? data.pageCount : undefined,
        pages: Array.isArray(data.pages) ? data.pages : undefined,
        text: String(data.text || ''),
        charCount: Number(data.charCount || String(data.text || '').length),
      };
      setAttachedMaterials((prev) => [...prev, item].slice(0, 3));
      setPlusMenuOpen(false);
    } catch (err) {
      setImportMaterialError(
        err instanceof Error ? err.message : 'Unable to extract document text.'
      );
    } finally {
      setImportingMaterial(false);
    }
  };

  const handleImportUrlMaterial = async () => {
    const raw = importUrlValue.trim();
    if (!raw) {
      setImportMaterialError('Paste an educational webpage or PDF URL to import.');
      return;
    }
    setImportingMaterial(true);
    setImportMaterialError(null);
    try {
      const res = await fetch(apiUrl('/api/import/url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({ url: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not fetch content from URL.');
      }
      const item: ImportedMaterialItem = {
        id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: String(data.title || raw),
        sourceType: 'url',
        url: String(data.url || raw),
        detailLabel: data.detailLabel || 'Webpage',
        pageCount: typeof data.pageCount === 'number' ? data.pageCount : undefined,
        pages: Array.isArray(data.pages) ? data.pages : undefined,
        text: String(data.text || ''),
        charCount: Number(data.charCount || String(data.text || '').length),
      };
      setAttachedMaterials((prev) => [...prev, item].slice(0, 3));
      setImportUrlValue('');
      setUrlImportOpen(false);
      setPlusMenuOpen(false);
    } catch (err) {
      setImportMaterialError(
        err instanceof Error ? err.message : 'Unable to fetch webpage or PDF URL.'
      );
    } finally {
      setImportingMaterial(false);
    }
  };

  // Stop voice recording while KEEPING transcribed words in the editable typing area
  const stopVoiceKeepText = () => {
    voiceSessionActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore if already stopped
    }
    setVoiceState((prev) => (prev === 'listening' ? 'stopped' : prev));
    textareaRef.current?.focus();
  };

  const startVoiceInput = () => {
    setVoiceNotice(null);
    baseTextBeforeVoiceRef.current = inputText;
    voiceSessionActiveRef.current = true;
    setVoiceState('listening');
    scrollToLatest();

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      voiceSessionActiveRef.current = false;
      setVoiceState('stopped');
      setVoiceNotice('Speech-to-text is unavailable in this browser. Type your message directly below.');
      textareaRef.current?.focus();
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = getSpeechLangForSubject(
        scopedSubject?.name || conversation.subjectFocus,
        voiceLanguage
      );
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        if (!voiceSessionActiveRef.current) return;
        const finals: string[] = [];
        const interims: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          const piece = item?.[0]?.transcript?.trim();
          if (!piece) continue;
          if (item.isFinal) {
            if (finals[finals.length - 1] !== piece) {
              finals.push(piece);
            }
          } else {
            interims.push(piece);
          }
        }
        const spoken = [...finals, ...interims].join(' ').replace(/\s+/g, ' ').trim();
        const prefix = baseTextBeforeVoiceRef.current.trim();
        setInputText(prefix ? (spoken ? `${prefix} ${spoken}` : prefix) : spoken);
        scrollToLatest();
      };
      rec.onerror = (ev) => {
        voiceSessionActiveRef.current = false;
        setVoiceState('stopped');
        if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
          setVoiceNotice('Microphone permission was denied. Allow microphone access or type directly.');
        } else if (ev?.error === 'no-speech') {
          setVoiceNotice('No speech detected. Tap the mic to try again or edit below.');
        } else if (ev?.error && ev.error !== 'aborted') {
          setVoiceNotice('Microphone stopped. Review or edit your text below.');
        }
      };
      rec.onend = () => {
        voiceSessionActiveRef.current = false;
        setVoiceState((curr) => (curr === 'listening' ? 'stopped' : curr));
      };
      recognitionRef.current = rec;
      rec.start();
      textareaRef.current?.focus();
    } catch {
      voiceSessionActiveRef.current = false;
      setVoiceState('stopped');
      setVoiceNotice('Could not start microphone capture. You can type directly below.');
      textareaRef.current?.focus();
    }
  };

  // Function B: Target-language word/phrase pronunciation (speaks ONLY the pure target text via VoiceEngine)
  const handleToggleSpeakPhrase = (key: string, targetText: string, langHint?: string) => {
    setSpeechError(null);
    setSpeakingMsgId(null);
    if (speakingPhraseKey === key) {
      voiceEngine.stop();
      setSpeakingPhraseKey(null);
      return;
    }

    const pureTarget = extractPureTargetSpeechText(targetText);
    const detectedLang = getSpeechLangForSubject(
      langHint || scopedSubject?.name || conversation.subjectFocus,
      voiceLanguage
    );
    setSpeakingPhraseKey(key);
    void voiceEngine
      .speak({
        id: `phrase-${key}`,
        text: pureTarget || targetText,
        prefs: voicePrefs,
        langOverride: detectedLang,
      })
      .finally(() => {
        setSpeakingPhraseKey((curr) => (curr === key ? null : curr));
      });
  };

  const handleSendText = async (
    rawText: string,
    imgs: AttachmentImage[],
    mats: ImportedMaterialItem[] = []
  ) => {
    const trimmed = rawText.trim();
    if ((!trimmed && imgs.length === 0 && mats.length === 0) || isSending) return;

    if (scopedSubject && trimmed) {
      const crossWarning = detectDifferentSubjectWarning(trimmed, scopedSubject.name);
      if (crossWarning) {
        setSubjectWarning(crossWarning);
        return;
      }
    }
    setSubjectWarning(null);
    await onSendMessage(trimmed, imgs, Boolean(scopedSubject), mats);
    scrollToLatest();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && attachedImages.length === 0 && attachedMaterials.length === 0) || isSending) {
      return;
    }

    const imgs = [...attachedImages];
    const mats = [...attachedMaterials];
    voiceSessionActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setVoiceState('idle');
    setVoiceNotice(null);
    setInputText('');
    setAttachedImages([]);
    setAttachedMaterials([]);
    setPlusMenuOpen(false);
    setPluginsPanelOpen(false);
    setUrlImportOpen(false);
    await handleSendText(trimmed, imgs, mats);
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
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
            : 'h-[calc(100dvh-3.5rem-4rem)]'
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
                  : 'What would you like to talk about?'}
              </h1>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                {scopedSubject
                  ? `Focused strictly on ${scopedSubject.name}. If you ask about another subject, I will point you to that subject.`
                  : 'Chat freely about anything — tech, music, creativity, coding, everyday ideas, or school studies.'}
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

              {!scopedSubject && progressSummary && progressSummary.totalAttempts > 0 && onOpenProgress && (
                <button
                  type="button"
                  onClick={onOpenProgress}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#2E8BFF]/35 bg-[#0A1532] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-[#38BDF8] hover:text-white"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-[#5EEAD4]" />
                  <span>
                    My Progress: <strong className="text-[#5EEAD4]">{progressSummary.overallAverage}% avg</strong> across {progressSummary.totalAttempts} quiz{progressSummary.totalAttempts === 1 ? '' : 'zes'}
                  </span>
                  <span className="text-[#7DD3FC]">View →</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-3">
              {conversation.messages.map((msg: ChatMessage) => {
                const isSpeaking = speakingMsgId === msg.id;
                const targetPhrases =
                  msg.role === 'assistant' && !msg.error
                    ? extractLanguagePracticePhrases(
                        msg.text,
                        scopedSubject?.name || conversation.subjectFocus
                      )
                    : [];
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${
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
                      {msg.materials && msg.materials.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-1.5">
                          {msg.materials.map((mat) => (
                            <span
                              key={mat.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white"
                            >
                              {mat.sourceType === 'url' ? (
                                <Globe className="h-3 w-3 text-[#7DD3FC]" />
                              ) : (
                                <FileText className="h-3 w-3 text-[#5EEAD4]" />
                              )}
                              <span className="max-w-[180px] truncate">{mat.title}</span>
                              {mat.detailLabel && (
                                <span className="text-[10px] text-sky-200/80">· {mat.detailLabel}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {msg.streaming && !msg.text ? (
                          <div className="flex items-center gap-3 text-slate-300">
                            <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                            <span>ALEXYN is thinking...</span>
                            {onCancelRequest && (
                              <button
                                type="button"
                                onClick={onCancelRequest}
                                className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                              >
                                Stop
                              </button>
                            )}
                          </div>
                        ) : (
                          msg.text.split('\n').map((line, lineIdx) => {
                            const trimmed = line.trim();
                            if (!trimmed) {
                              return <div key={lineIdx} className="h-1" />;
                            }
                            const renderInline = (text: string) =>
                              text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                                  return (
                                    <strong key={pIdx} className="font-bold text-white">
                                      {part.slice(2, -2)}
                                    </strong>
                                  );
                                }
                                if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                                  return (
                                    <code
                                      key={pIdx}
                                      className="rounded bg-[#07112B] px-1.5 py-0.5 font-mono text-[12px] text-[#7DD3FC]"
                                    >
                                      {part.slice(1, -1)}
                                    </code>
                                  );
                                }
                                return <span key={pIdx}>{part}</span>;
                              });

                            if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
                              const headingText = trimmed.replace(/^#{2,3}\s+/, '');
                              return (
                                <p key={lineIdx} className="pt-1 font-bold text-[#93C5FD]">
                                  {renderInline(headingText)}
                                </p>
                              );
                            }
                            if (/^[-*•]\s+/.test(trimmed)) {
                              const itemText = trimmed.replace(/^[-*•]\s+/, '');
                              return (
                                <div key={lineIdx} className="flex items-start gap-2 pl-1">
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38BDF8]" />
                                  <p className="flex-1">{renderInline(itemText)}</p>
                                </div>
                              );
                            }
                            return (
                              <p key={lineIdx} className="whitespace-pre-wrap">
                                {renderInline(line)}
                              </p>
                            );
                          })
                        )}
                      </div>

                      {msg.role === 'assistant' && msg.streaming && msg.text && (
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-[#7DD3FC]">
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Streaming response...</span>
                          </span>
                          {onCancelRequest && (
                            <button
                              type="button"
                              onClick={onCancelRequest}
                              className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-0.5 font-semibold text-rose-200 hover:bg-rose-500/20"
                            >
                              Stop
                            </button>
                          )}
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-[#08122E] p-2.5">
                          <p className="mb-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                            Referenced educational sources:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, idx) => (
                              <a
                                key={`${src.url}-${idx}`}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/30 bg-[#0E1E46] px-2.5 py-1 text-[11px] text-slate-200 hover:border-[#38BDF8] hover:text-white"
                              >
                                <span className="max-w-[180px] truncate">{src.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.role === 'assistant' && !msg.error && !msg.streaming && (
                        <div className="mt-3 space-y-2 border-t border-white/10 pt-2.5">
                          {targetPhrases.length > 0 && (
                            <div className="rounded-xl border border-indigo-400/30 bg-[#081538] p-2.5">
                              <p className="mb-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                                Pronounce target word / phrase:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {targetPhrases.map((p, idx) => {
                                  const phraseKey = `${msg.id}-p-${idx}`;
                                  const activePhrase = speakingPhraseKey === phraseKey;
                                  return (
                                    <button
                                      key={phraseKey}
                                      type="button"
                                      onClick={() =>
                                        handleToggleSpeakPhrase(
                                          phraseKey,
                                          p.targetText,
                                          `${scopedSubject?.name || conversation.subjectFocus || ''} ${msg.text.slice(0, 120)}`
                                        )
                                      }
                                      aria-label={`Pronounce ${p.targetText}`}
                                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                        activePhrase
                                          ? 'border-[#38BDF8] bg-[#142D66] text-white'
                                          : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-100 hover:border-[#38BDF8]'
                                      }`}
                                    >
                                      {activePhrase ? (
                                        <VolumeX className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                                      ) : (
                                        <Volume2 className="h-3 w-3 shrink-0 text-[#38BDF8]" />
                                      )}
                                      <span>{p.targetText}</span>
                                      {p.meaning && (
                                        <span className="font-normal text-[#5EEAD4]">
                                          [{p.meaning}]
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {msg.visionNote && (
                            <p className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
                              {msg.visionNote}
                            </p>
                          )}

                          {msg.appActions && msg.appActions.length > 0 && onExecuteAppAction && (
                            <div className="space-y-1.5 rounded-xl border border-teal-400/30 bg-[#081636] p-2.5">
                              <p className="text-[11px] font-semibold text-teal-300">
                                Quick App Action{msg.appActions.length > 1 ? 's' : ''}:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.appActions.map((act) => (
                                  <button
                                    key={act.id}
                                    type="button"
                                    onClick={() => onExecuteAppAction(act)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                                      act.requiresConfirmation
                                        ? 'border-amber-400/45 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                                        : 'border-teal-400/40 bg-teal-500/15 text-teal-200 hover:bg-teal-500/25'
                                    }`}
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    <span>
                                      {act.requiresConfirmation ? `Confirm: ${act.label}` : act.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.recommendedLab && onOpenRecommendedLab && (
                            <button
                              type="button"
                              onClick={() => onOpenRecommendedLab(msg.recommendedLab!)}
                              className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#2E8BFF]/40 bg-[#122658] px-3 py-2 text-left transition-colors hover:border-[#38BDF8] hover:bg-[#193372]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Atom className="h-4 w-4 shrink-0 text-[#38BDF8]" />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-white">
                                    {msg.recommendedLab.label}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-300">
                                    {msg.recommendedLab.reason}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold text-[#7DD3FC]">
                                Launch →
                              </span>
                            </button>
                          )}
                          <div className="flex flex-wrap items-center gap-3">
                            <VoiceControlBar
                              playbackId={`explore-msg-${msg.id}`}
                              text={msg.text}
                              voicePrefs={voicePrefs}
                              subjectHint={scopedSubject?.name || conversation.subjectFocus}
                              compact
                              label="Speak"
                            />
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
                            {msg.providerUsed && (
                              <span className="text-[11px] text-slate-500">
                                · AI: {msg.providerUsed}
                                {msg.modelUsed ? ` (${msg.modelUsed})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && !conversation.messages.some((m) => m.streaming) && (
                <div className="flex items-start">
                  <div className="flex items-center gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#0C1736] px-4 py-3 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                    <span>ALEXYN is thinking...</span>
                    {onCancelRequest && (
                      <button
                        type="button"
                        onClick={onCancelRequest}
                        className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {speechError && (
            <div className="mt-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
              {speechError}
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

      {/* COMPOSER WITH INDEPENDENT + MENU & IN-INPUT LISTENING INDICATOR */}
      <div className="relative shrink-0 border-t border-[var(--alexyn-border)] bg-[#060E24]/95 px-3 py-2.5 backdrop-blur-md md:px-8">
        <div className="relative mx-auto max-w-3xl">
          {voiceNotice && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
              <span>{voiceNotice}</span>
              <button
                type="button"
                onClick={() => setVoiceNotice(null)}
                aria-label="Dismiss microphone notice"
                className="text-amber-200 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {plusMenuOpen && (
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
                  disabled={importingMaterial}
                  onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-100 hover:bg-[#162958] disabled:opacity-60"
                >
                  <FileText className="h-4 w-4 text-[#5EEAD4]" />
                  <span>{importingMaterial ? 'Reading doc...' : 'Upload Document'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlImportOpen((prev) => !prev);
                    setImportMaterialError(null);
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-100 hover:bg-[#162958]"
                >
                  <Globe className="h-4 w-4 text-[#7DD3FC]" />
                  <span>Import URL / PDF</span>
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

              {urlImportOpen && (
                <div className="mt-2 space-y-2 border-t border-[var(--alexyn-border)] pt-2">
                  <label htmlFor="exploreImportUrl" className="block text-[11px] font-semibold text-[#7DD3FC]">
                    Paste an educational webpage or direct PDF link:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="exploreImportUrl"
                      type="url"
                      value={importUrlValue}
                      onChange={(e) => setImportUrlValue(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/... or https://.../paper.pdf"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs text-white placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      disabled={importingMaterial}
                      onClick={handleImportUrlMaterial}
                      className="rounded-xl bg-[#2E8BFF] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {importingMaterial ? 'Importing...' : 'Attach'}
                    </button>
                  </div>
                </div>
              )}

              {importMaterialError && (
                <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {importMaterialError}
                </p>
              )}

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

                  {onChangeAiSelection && (
                    <div className="mt-2.5 rounded-xl border border-[var(--alexyn-border)] bg-[#071026] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#7DD3FC]">
                        <Cpu className="h-3.5 w-3.5 text-[#5EEAD4]" />
                        <span>AI Provider &amp; Model Plugin</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <select
                          id="exploreAiProvider"
                          aria-label="Explore AI Provider"
                          value={aiSelection?.providerId || 'auto'}
                          onChange={(e) => {
                            const nextId = e.target.value as AIProviderId;
                            const found = aiProviders.find((p) => p.id === nextId);
                            onChangeAiSelection({
                              providerId: nextId,
                              modelId: found?.models[0]?.id || '',
                            });
                          }}
                          className="rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 text-xs text-white"
                        >
                          {aiProviders.length === 0 ? (
                            <option value="auto">Smart Auto (Free / Configured)</option>
                          ) : (
                            aiProviders.map((prov) => (
                              <option key={prov.id} value={prov.id}>
                                {prov.shortName} ({prov.configured ? 'Ready' : 'Needs Key'})
                              </option>
                            ))
                          )}
                        </select>
                        <select
                          id="exploreAiModel"
                          aria-label="Explore AI Model"
                          value={
                            aiSelection?.modelId ||
                            aiProviders.find((p) => p.id === (aiSelection?.providerId || 'auto'))
                              ?.models[0]?.id ||
                            ''
                          }
                          onChange={(e) =>
                            onChangeAiSelection({
                              providerId: aiSelection?.providerId || 'auto',
                              modelId: e.target.value,
                            })
                          }
                          className="rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 text-xs text-white"
                        >
                          {(
                            aiProviders.find((p) => p.id === (aiSelection?.providerId || 'auto'))
                              ?.models || []
                          ).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label} ({m.tier})
                            </option>
                          ))}
                          {aiProviders.length === 0 && <option value="">Auto Model</option>}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(attachedImages.length > 0 || attachedMaterials.length > 0 || activePlugins.length > 0) && (
            <div className="mb-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
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

                {attachedMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="flex items-center gap-2 rounded-xl border border-[#5EEAD4]/40 bg-[#081F36] px-2.5 py-1.5"
                  >
                    {mat.sourceType === 'url' ? (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-[#7DD3FC]" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[#5EEAD4]" />
                    )}
                    <div className="min-w-0">
                      <p className="max-w-[160px] truncate text-[11px] font-bold text-white">
                        {mat.title}
                      </p>
                      <p className="text-[10px] text-[#5EEAD4]">
                        {mat.detailLabel || (mat.pageCount ? `${mat.pageCount} pages` : 'Imported source')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedMaterials((prev) => prev.filter((item) => item.id !== mat.id))
                      }
                      aria-label={`Remove material ${mat.title}`}
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

              {attachedMaterials.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400">Study actions:</span>
                  {[
                    {
                      label: 'Summarize Material',
                      prompt:
                        'Summarize the key points from this attached material section by section with page/source citations, then give clear AI study explanations separately.',
                    },
                    {
                      label: 'Explain Difficult Parts',
                      prompt:
                        'Identify and explain the most difficult concepts in this attached material simply, keeping quotes/page references separate from your explanations.',
                    },
                    {
                      label: 'Extract Key Definitions',
                      prompt:
                        'Extract the key definitions, formulas, and terms from this attached material with page citations.',
                    },
                  ].map((qa) => (
                    <button
                      key={qa.label}
                      type="button"
                      disabled={isSending}
                      onClick={() => {
                        const mats = [...attachedMaterials];
                        const imgs = [...attachedImages];
                        setAttachedMaterials([]);
                        setAttachedImages([]);
                        void handleSendText(qa.prompt, imgs, mats);
                      }}
                      className="rounded-lg border border-[#2E8BFF]/35 bg-[#0C1D44] px-2.5 py-1 text-[11px] font-semibold text-[#7DD3FC] hover:border-[#38BDF8] hover:text-white disabled:opacity-50"
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={`flex items-end gap-2 rounded-3xl border p-1.5 transition-all ${
              voiceState === 'listening'
                ? 'border-[#38BDF8] bg-[#0D1E45] ring-2 ring-[#38BDF8]/30 shadow-[0_0_24px_rgba(56,189,248,0.2)]'
                : 'border-[var(--alexyn-border)] bg-[#101B38]'
            }`}
          >
            {/* + Button ALWAYS remains completely independent Attachments & Plugins trigger */}
            <button
              type="button"
              onClick={() => setPlusMenuOpen((prev) => !prev)}
              aria-label="Open photos and plugins menu"
              aria-expanded={plusMenuOpen}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                plusMenuOpen
                  ? 'bg-[#2E8BFF] text-white'
                  : 'text-slate-200 hover:bg-[#192B59]'
              }`}
            >
              <Plus className={`h-5 w-5 transition-transform ${plusMenuOpen ? 'rotate-45' : ''}`} />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              {voiceState === 'listening' && (
                <div
                  role="status"
                  aria-live="polite"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#38BDF8]/40 bg-[#142B61] px-2.5 py-1 text-xs font-bold text-[#7DD3FC]"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                  <span>Listening...</span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onFocus={scrollToLatest}
                onKeyDown={handleTextareaKeyDown}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (voiceState === 'stopped' && !e.target.value.trim()) {
                    setVoiceState('idle');
                  }
                }}
                placeholder={
                  voiceState === 'listening'
                    ? 'Listening... speak clearly'
                    : scopedSubject
                    ? `Ask your ${scopedSubject.name} teacher...`
                    : 'Ask ALEXYN anything...'
                }
                aria-label={voiceState === 'listening' ? 'Listening voice input typing area' : 'Ask ALEXYN anything'}
                className="max-h-32 min-h-[38px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-snug text-white placeholder:text-slate-400 focus:outline-none sm:text-base"
              />
            </div>

            <button
              type="button"
              onClick={voiceState === 'listening' ? stopVoiceKeepText : startVoiceInput}
              aria-label={voiceState === 'listening' ? 'Stop voice recording' : 'Start voice input'}
              title={voiceState === 'listening' ? 'Stop recording and keep text' : 'Speak your message'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                voiceState === 'listening'
                  ? 'bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.45)] hover:bg-rose-400'
                  : 'text-slate-200 hover:bg-[#192B59]'
              }`}
            >
              {voiceState === 'listening' ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <button
              type="submit"
              disabled={
                (!inputText.trim() &&
                  attachedImages.length === 0 &&
                  attachedMaterials.length === 0) ||
                isSending
              }
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
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.pptx,.txt,.md,.csv,.py,.js,.ts,.html,.css,.json"
            className="hidden"
            onChange={handleDocumentSelected}
          />
        </div>
      </div>
    </div>
  );
}
