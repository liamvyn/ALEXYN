import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS, NOTE_STYLE_OPTIONS } from '../data/curriculum';
import {
  buildFallbackNote,
  detectDifferentSubjectWarning,
  extractTaughtTopics,
  findTaughtContextForTopic,
  getStyleLabels,
  removeNoteSection,
  toggleNoteStyle,
} from '../utils/alexynLogic';
import type {
  AttachmentImage,
  Conversation,
  EducationProfile,
  NoteDetailLevel,
  NoteStyleId,
  SmartNote,
  SubjectItem,
} from '../types/alexyn';

const SMART_NOTES_ILLUSTRATION = '/src/assets/images/alexyn_smart_notes_graphic_1794648443788.jpg';

interface SmartNotesScreenProps {
  profile: EducationProfile;
  conversations: Conversation[];
  activeNote: SmartNote | null;
  onSetActiveNote: (note: SmartNote | null) => void;
  onSaveNoteToLibrary: (note: SmartNote) => void;
  onShareNoteToCommunity: (note: SmartNote) => void;
  initialTopic?: string;
  initialSubject?: string;
  defaultDetailLevel?: NoteDetailLevel;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
}

export function SmartNotesScreen({
  profile,
  conversations,
  activeNote,
  onSetActiveNote,
  onSaveNoteToLibrary,
  onShareNoteToCommunity,
  initialTopic = '',
  initialSubject = '',
  defaultDetailLevel = 'detailed',
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
}: SmartNotesScreenProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [subject, setSubject] = useState(scopedSubject?.name || initialSubject || 'Biology');
  const [selectedStyles, setSelectedStyles] = useState<NoteStyleId[]>([
    'memory-tricks',
    'funny-examples',
  ]);
  const [detailLevel, setDetailLevel] = useState<NoteDetailLevel>(defaultDetailLevel);
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [useTaughtContext, setUseTaughtContext] = useState(true);
  const [screenshots, setScreenshots] = useState<AttachmentImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subjectRecommendation, setSubjectRecommendation] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [sharedFeedback, setSharedFeedback] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const taughtTopics = extractTaughtTopics(conversations);

  const handleUploadScreenshots = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    const loaded = await Promise.all(
      files.map(
        (file) =>
          new Promise<AttachmentImage>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result || '');
              resolve({
                id: `sn-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: file.name,
                mimeType: file.type || 'image/jpeg',
                base64Data: dataUrl.includes(',') ? dataUrl.split(',')[1] : '',
                previewUrl: dataUrl,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setScreenshots((prev) => [...prev, ...loaded].slice(0, 4));
    e.target.value = '';
  };

  const handleGenerateNotes = async () => {
    if (!topic.trim() && screenshots.length === 0) {
      setErrorMsg('Enter a topic, tap what ALEXYN taught you, or attach a screenshot.');
      return;
    }

    if (scopedSubject) {
      const warning = detectDifferentSubjectWarning(topic, scopedSubject.name);
      if (warning) {
        setSubjectRecommendation(warning);
        return;
      }
    }

    setSubjectRecommendation(null);
    setGenerating(true);
    setErrorMsg(null);
    setSharedFeedback(false);

    const activeSubj = scopedSubject?.name || subject;
    const taughtMatch = useTaughtContext
      ? findTaughtContextForTopic(topic || 'study', conversations)
      : { matchedTopics: [], contextText: '' };

    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(16000),
        body: JSON.stringify({
          topic: topic.trim() || 'Notes from uploaded study screenshots',
          subject: activeSubj,
          strictScope: Boolean(scopedSubject),
          styles: getStyleLabels(selectedStyles),
          detailLevel,
          taughtContext: taughtMatch.contextText,
          images: screenshots.map((s) => ({
            mimeType: s.mimeType,
            base64Data: s.base64Data,
          })),
          profile,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate AI Smart Notes.');
      }

      const newNote: SmartNote = {
        id: `note-${Date.now()}`,
        title: data.title || topic.trim() || 'Smart Notes',
        subject: data.subject || activeSubj,
        overview: data.overview || '',
        styles: [...selectedStyles],
        detailLevel,
        sections: Array.isArray(data.sections)
          ? data.sections.map((sec: { heading?: string; content?: string; kind?: string }, idx: number) => ({
              id: `sec-${Date.now()}-${idx}`,
              heading: sec.heading || 'Key Concept',
              content: sec.content || '',
              kind: sec.kind || 'core',
            }))
          : [],
        memoryTricks: Array.isArray(data.memoryTricks) ? data.memoryTricks : [],
        funnyExamples: Array.isArray(data.funnyExamples) ? data.funnyExamples : [],
        examTips: Array.isArray(data.examTips) ? data.examTips : [],
        readingAdvice: Array.isArray(data.readingAdvice) ? data.readingAdvice : [],
        flashcards: Array.isArray(data.flashcards)
          ? data.flashcards.map((fc: { q?: string; a?: string }, idx: number) => ({
              id: `fc-${Date.now()}-${idx}`,
              q: fc.q || '',
              a: fc.a || '',
            }))
          : [],
        createdAt: Date.now(),
        fromTaughtTopics: taughtMatch.matchedTopics,
        savedToLibrary: true,
      };

      onSetActiveNote(newNote);
      onSaveNoteToLibrary(newNote);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Smart Notes AI.';
      setErrorMsg(`${msg} Created a local structured draft so you can still edit or customize.`);
      const draft = buildFallbackNote({
        topic: topic.trim() || 'Study Topic',
        subject: activeSubj,
        styles: selectedStyles,
        detailLevel,
        taughtContext: taughtMatch.contextText,
      });
      onSetActiveNote(draft);
      onSaveNoteToLibrary(draft);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 md:px-8">
      {scopedSubject && onBackFromScoped && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#08122E] px-4 py-2.5">
          <button
            type="button"
            onClick={onBackFromScoped}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-[#2E8BFF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {scopedSubject.name}</span>
          </button>
          <span className="text-xs font-semibold text-[#7DD3FC]">
            Dedicated {scopedSubject.name} Notes Studio
          </span>
        </div>
      )}

      {/* SMART NOTES HERO BANNER MATCHING SCREENSHOT */}
      <section className="overflow-hidden rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0B1739] via-[#08122E] to-[#050C20] p-5 sm:p-7">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#132960] text-[#38BDF8]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white">
                  {scopedSubject ? `${scopedSubject.name} Smart Notes` : 'Smart Notes'}
                </h1>
                <p className="text-xs text-slate-400">Your customizable study companion</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#5EEAD4]" />
                <span>Combine memory tricks, funny examples & exam tips together</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#5EEAD4]" />
                <span>Switch between quick summaries and detailed book notes</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#5EEAD4]" />
                <span>Pulls from what ALEXYN already taught you + your screenshots</span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-[var(--alexyn-border)] bg-[#061028]">
              <img
                src={SMART_NOTES_ILLUSTRATION}
                alt="Glowing ALEXYN Smart Notes holographic notebook"
                referrerPolicy="no-referrer"
                className="h-44 w-full object-cover md:h-48"
              />
            </div>
          </div>
        </div>
      </section>

      {/* TOPIC, SCREENSHOTS & CUSTOMIZE PANEL */}
      <section className="rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <label htmlFor="smartNoteTopic" className="mb-1.5 block text-xs font-semibold text-slate-300">
              Topic or concept
            </label>
            <input
              id="smartNoteTopic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis, French Passé Composé, Ohm's Law..."
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="smartNoteSubject" className="mb-1.5 block text-xs font-semibold text-slate-300">
              {scopedSubject ? 'Locked to Subject Workspace' : 'All Subjects & Languages'}
            </label>
            {scopedSubject ? (
              <div
                id="smartNoteSubject"
                className="flex min-h-[46px] items-center justify-between rounded-xl border border-[#38BDF8]/40 bg-[#0D1E45] px-3.5 py-2.5 text-sm font-semibold text-white"
              >
                <span>{scopedSubject.name}</span>
                <span className="text-[11px] font-normal text-[#7DD3FC]">Teacher Mode</span>
              </div>
            ) : (
              <select
                id="smartNoteSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-3 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
              >
                <optgroup label="Core Subjects">
                  {CORE_SUBJECTS.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="World Languages">
                  {LANGUAGE_SUBJECTS.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.flag ? `${s.flag} ` : ''}{s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>
        </div>

        {/* PULL FROM WHAT ALEXYN HAS TAUGHT YOU */}
        {taughtTopics.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#7DD3FC]">
                Topics ALEXYN taught you in Explore (tap to load):
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={useTaughtContext}
                  onChange={(e) => setUseTaughtContext(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#2E8BFF]"
                />
                <span>Look at what ALEXYN taught me</span>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {taughtTopics.map((item) => (
                <button
                  key={item.conversationId}
                  type="button"
                  onClick={() => setTopic(item.topic)}
                  className="rounded-xl border border-[#2E8BFF]/35 bg-[#10214E] px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-[#38BDF8]"
                >
                  {item.topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ATTACH SCREENSHOTS */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
          >
            <ImagePlus className="h-4 w-4 text-[#5EEAD4]" />
            <span>Send screenshots / textbook photos</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUploadScreenshots}
          />

          {screenshots.map((img) => (
            <div
              key={img.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0F1E46] p-1 pr-2.5"
            >
              <img
                src={img.previewUrl}
                alt={img.name}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="max-w-[100px] truncate text-xs text-slate-200">{img.name}</span>
              <button
                type="button"
                onClick={() =>
                  setScreenshots((prev) => prev.filter((item) => item.id !== img.id))
                }
                aria-label={`Remove screenshot ${img.name}`}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* CUSTOMIZE SECTION — PRESS TO CHANGE DEPTH & MULTI-SELECT STYLES */}
        <div className="mt-5 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
          <button
            type="button"
            onClick={() => setCustomizeOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#38BDF8]" />
              <span className="text-sm font-bold text-white">
                Customize Your Note Style & Length
              </span>
              <span className="text-xs text-slate-400">
                · {detailLevel === 'detailed' ? 'Detailed Book Notes' : 'Short Quick Notes'} ·{' '}
                {selectedStyles.length} style(s)
              </span>
            </div>
            {customizeOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {customizeOpen && (
            <div className="mt-4 space-y-4 border-t border-[var(--alexyn-border)] pt-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">
                  Note Depth (for your book vs quick review):
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDetailLevel('detailed')}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      detailLevel === 'detailed'
                        ? 'border-[#38BDF8] bg-[#13295E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#0B1533] text-slate-300 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold">Detailed Notes (For Your Book)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Deep explanations, complete steps & full context
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailLevel('short')}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      detailLevel === 'short'
                        ? 'border-[#38BDF8] bg-[#13295E] text-white'
                        : 'border-[var(--alexyn-border)] bg-[#0B1533] text-slate-300 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold">Short Notes (Quick Review)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Concise rapid revision summary
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300">
                    Choose as many styles as you want at the same time:
                  </p>
                  {selectedStyles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStyles([])}
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-rose-300 hover:underline"
                    >
                      Remove all styles
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {NOTE_STYLE_OPTIONS.map((opt) => {
                    const active = selectedStyles.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSelectedStyles((prev) => toggleNoteStyle(prev, opt.id))
                        }
                        className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? 'border-[#2E8BFF] bg-[#122658] text-white'
                            : 'border-[var(--alexyn-border)] bg-[#0B1533] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {opt.description}
                          </p>
                        </div>
                        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5EEAD4]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {subjectRecommendation && (
          <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="space-y-2">
                <p>{subjectRecommendation.message}</p>
                {onSwitchToSubject && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = subjectRecommendation.recommendedSubject;
                      setSubjectRecommendation(null);
                      onSwitchToSubject(target);
                    }}
                    className="rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30"
                  >
                    Switch to {subjectRecommendation.recommendedSubject} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateNotes}
            disabled={generating}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Crafting your Smart Notes...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Smart Notes</span>
              </>
            )}
          </button>

          {activeNote && (
            <button
              type="button"
              onClick={() => onSetActiveNote(null)}
              className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1A3D] px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Note</span>
            </button>
          )}
        </div>
      </section>

      {/* GENERATED SMART NOTE VIEWER (EDITABLE / REMOVABLE SECTIONS) */}
      {activeNote && (
        <article className="space-y-5 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--alexyn-border)] pb-4">
            <div>
              <p className="text-xs font-medium text-[#7DD3FC]">
                {activeNote.subject} ·{' '}
                {activeNote.detailLevel === 'detailed' ? 'Detailed Book Notes' : 'Short Quick Notes'}
                {activeNote.styles.length > 0
                  ? ` · ${getStyleLabels(activeNote.styles).join(' · ')}`
                  : ''}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-white">{activeNote.title}</h2>
              {activeNote.overview && (
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {activeNote.overview}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSaveNoteToLibrary(activeNote)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#10214B] px-3.5 py-2 text-xs font-semibold text-[#5EEAD4]"
              >
                <BookmarkCheck className="h-4 w-4" />
                <span>Saved in Library</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onShareNoteToCommunity(activeNote);
                  setSharedFeedback(true);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3.5 py-2 text-xs font-bold text-white"
              >
                <Share2 className="h-4 w-4" />
                <span>{sharedFeedback ? 'Shared to Feed!' : 'Share Trick'}</span>
              </button>
            </div>
          </div>

          {/* MAIN SECTIONS WITH REMOVE BUTTONS */}
          {activeNote.sections.length > 0 && (
            <div className="space-y-3">
              {activeNote.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-white">{sec.heading}</h3>
                    <button
                      type="button"
                      onClick={() => onSetActiveNote(removeNoteSection(activeNote, sec.id))}
                      aria-label={`Remove section ${sec.heading}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                    {sec.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* MEMORY TRICKS */}
          {activeNote.memoryTricks.length > 0 && (
            <div className="rounded-2xl border border-cyan-500/25 bg-[#081A36] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#7DD3FC]">Memory Tricks & Mnemonics</h3>
                <button
                  type="button"
                  onClick={() =>
                    onSetActiveNote({ ...activeNote, memoryTricks: [] })
                  }
                  className="text-xs text-slate-400 hover:text-rose-300"
                >
                  Remove block
                </button>
              </div>
              <ul className="mt-2 space-y-2 text-sm text-slate-100">
                {activeNote.memoryTricks.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* FUNNY EXAMPLES */}
          {activeNote.funnyExamples.length > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-[#161936] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-300">Funny Examples</h3>
                <button
                  type="button"
                  onClick={() =>
                    onSetActiveNote({ ...activeNote, funnyExamples: [] })
                  }
                  className="text-xs text-slate-400 hover:text-rose-300"
                >
                  Remove block
                </button>
              </div>
              <ul className="mt-2 space-y-2 text-sm text-slate-100">
                {activeNote.funnyExamples.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* EXAM TIPS & READING ADVICE */}
          {(activeNote.examTips.length > 0 || activeNote.readingAdvice.length > 0) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeNote.examTips.length > 0 && (
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#07112B] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-300">Exam Focus</h3>
                    <button
                      type="button"
                      onClick={() => onSetActiveNote({ ...activeNote, examTips: [] })}
                      className="text-xs text-slate-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200">
                    {activeNote.examTips.map((tip, idx) => (
                      <li key={idx}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeNote.readingAdvice.length > 0 && (
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#07112B] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#93C5FD]">What to Read Next</h3>
                    <button
                      type="button"
                      onClick={() => onSetActiveNote({ ...activeNote, readingAdvice: [] })}
                      className="text-xs text-slate-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200">
                    {activeNote.readingAdvice.map((tip, idx) => (
                      <li key={idx}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PRACTICE FLASHCARDS */}
          {activeNote.flashcards.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-sm font-bold text-white">
                Practice Flashcards (tap to flip)
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeNote.flashcards.map((fc) => {
                  const flipped = Boolean(flippedCards[fc.id]);
                  return (
                    <button
                      key={fc.id}
                      type="button"
                      onClick={() =>
                        setFlippedCards((prev) => ({
                          ...prev,
                          [fc.id]: !prev[fc.id],
                        }))
                      }
                      className="rounded-2xl border border-[var(--alexyn-border)] bg-[#07112B] p-4 text-left transition-colors hover:border-[#38BDF8]"
                    >
                      <p className="text-[11px] font-semibold text-[#7DD3FC]">
                        {flipped ? 'Answer' : 'Question'}
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-slate-100">
                        {flipped ? fc.a : fc.q}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
