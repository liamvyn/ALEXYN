import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  ImagePlus,
  Languages,
  Loader2,
  PlayCircle,
  Save,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS, NOTE_STYLE_OPTIONS } from '../data/curriculum';
import {
  buildFallbackNote,
  detectDifferentSubjectWarning,
  extractPureTargetSpeechText,
  extractTaughtTopics,
  findTaughtContextForTopic,
  getSpeechLangForSubject,
  getStyleLabels,
  isLanguageSubject,
  removeNoteSection,
  sanitizeSvgMarkup,
  speakWithBrowserTTS,
  stopBrowserTTS,
  toggleNoteStyle,
} from '../utils/alexynLogic';
import smartNotesGraphic from '../assets/images/alexyn_smart_notes_graphic_1794648443788.jpg';
import type {
  AttachmentImage,
  Conversation,
  EducationProfile,
  NoteDetailLevel,
  NoteImportedSource,
  NoteStyleId,
  SmartNote,
  SubjectItem,
} from '../types/alexyn';

const SMART_NOTES_ILLUSTRATION = smartNotesGraphic;

interface SmartNotesScreenProps {
  profile: EducationProfile;
  conversations: Conversation[];
  savedNotes: SmartNote[];
  activeNote: SmartNote | null;
  onSetActiveNote: (note: SmartNote | null) => void;
  onSaveNoteToLibrary: (note: SmartNote) => void;
  onUpdateSavedNote?: (note: SmartNote) => void;
  onDeleteSavedNote?: (noteId: string) => void;
  onShareNoteToCommunity: (note: SmartNote) => void;
  initialTopic?: string;
  initialSubject?: string;
  initialViewMode?: 'generate' | 'saved';
  defaultDetailLevel?: NoteDetailLevel;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
}

interface GitHubTreeEntry {
  path: string;
  size: number;
  selected: boolean;
}

function renderInlineFormatted(text: string) {
  const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|<u>[\s\S]*?<\/u>|`[^`]+`)/g;
  return text.split(tokenRegex).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return (
        <u
          key={idx}
          className="font-semibold text-[#7DD3FC] decoration-[#38BDF8] decoration-2 underline-offset-4"
        >
          {part.slice(2, -2)}
        </u>
      );
    }
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length > 7) {
      return (
        <u
          key={idx}
          className="font-semibold text-[#7DD3FC] decoration-[#38BDF8] decoration-2 underline-offset-4"
        >
          {part.slice(3, -4)}
        </u>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#0A183B] px-1.5 py-0.5 font-mono text-[12px] text-[#5EEAD4]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderRichNoteContent(raw: string) {
  const lines = String(raw || '').split('\n');
  return (
    <div className="mt-2.5 space-y-2 text-sm leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const title = trimmed.replace(/^#{2,3}\s+/, '');
          return (
            <h4
              key={idx}
              className="pt-2 text-xs font-extrabold uppercase tracking-wide text-[#93C5FD]"
            >
              {renderInlineFormatted(title)}
            </h4>
          );
        }
        if (/^Example\s*:/i.test(trimmed) || /^Worked Example\s*:/i.test(trimmed)) {
          return (
            <div
              key={idx}
              className="rounded-xl border border-[#5EEAD4]/35 bg-[#081A33] px-3.5 py-2.5 text-xs leading-relaxed text-slate-100"
            >
              {renderInlineFormatted(trimmed)}
            </div>
          );
        }
        if (/^[-*•]\s+/.test(trimmed)) {
          const body = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38BDF8]" />
              <p className="flex-1">{renderInlineFormatted(body)}</p>
            </div>
          );
        }
        const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
        if (numbered) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="mt-0.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md bg-[#122658] px-1 text-[11px] font-bold text-[#7DD3FC]">
                {numbered[1]}
              </span>
              <p className="flex-1">{renderInlineFormatted(numbered[2])}</p>
            </div>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderInlineFormatted(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function SmartNotesScreen({
  profile,
  conversations,
  savedNotes,
  activeNote,
  onSetActiveNote,
  onSaveNoteToLibrary,
  onUpdateSavedNote,
  onDeleteSavedNote,
  onShareNoteToCommunity,
  initialTopic = '',
  initialSubject = '',
  initialViewMode = 'generate',
  defaultDetailLevel = 'detailed',
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
}: SmartNotesScreenProps) {
  const [viewMode, setViewMode] = useState<'generate' | 'saved'>(initialViewMode);
  const [topic, setTopic] = useState(initialTopic);
  const [subject, setSubject] = useState(scopedSubject?.name || initialSubject || 'Biology');
  const [selectedStyles, setSelectedStyles] = useState<NoteStyleId[]>([
    'memory-tricks',
    'funny-examples',
  ]);
  const [detailLevel, setDetailLevel] = useState<NoteDetailLevel>(defaultDetailLevel);
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
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
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Draft note stays strictly separated until learner explicitly clicks Save
  const [draftNote, setDraftNote] = useState<SmartNote | null>(null);

  // External Import state (Document / URL / GitHub)
  const [importedSource, setImportedSource] = useState<NoteImportedSource | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubTree, setGithubTree] = useState<GitHubTreeEntry[]>([]);
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [importingBusy, setImportingBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Editing / Renaming state in viewer
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchSavedQuery, setSearchSavedQuery] = useState('');

  // Audio playback state
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const taughtTopics = extractTaughtTopics(conversations);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (scopedSubject) {
      setSubject(scopedSubject.name);
    } else if (initialSubject) {
      setSubject(initialSubject);
    }
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [scopedSubject?.id, initialSubject, initialTopic]);

  useEffect(() => {
    return () => {
      stopBrowserTTS();
    };
  }, []);

  const currentDisplayedNote = viewMode === 'saved' ? activeNote : draftNote;

  const setCurrentDisplayedNote = (updated: SmartNote | null) => {
    if (viewMode === 'saved') {
      onSetActiveNote(updated);
      if (updated && updated.savedToLibrary) {
        if (onUpdateSavedNote) onUpdateSavedNote(updated);
        else onSaveNoteToLibrary(updated);
      }
    } else {
      setDraftNote(updated);
    }
  };

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

  const handleImportDocumentFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingBusy(true);
    setImportError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      const res = await fetch('/api/import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not extract document.');

      setImportedSource({
        id: `imp-${Date.now()}`,
        kind: 'file',
        title: file.name,
        fileName: file.name,
        excerpt: data.text,
      });
      if (!topic.trim()) {
        setTopic(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Document extraction failed.');
    } finally {
      setImportingBusy(false);
    }
  };

  const handleImportWebUrl = async () => {
    if (!importUrl.trim()) {
      setImportError('Enter an educational webpage URL to import.');
      return;
    }
    setImportingBusy(true);
    setImportError(null);
    try {
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(28000),
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not fetch webpage content.');

      setImportedSource({
        id: `imp-${Date.now()}`,
        kind: 'url',
        title: data.title || importUrl.trim(),
        url: data.url,
        excerpt: data.text,
      });
      if (!topic.trim() && data.title) {
        setTopic(data.title);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to fetch webpage.');
    } finally {
      setImportingBusy(false);
    }
  };

  const handleLoadGitHub = async (selectedPaths?: string[]) => {
    if (!githubUrl.trim()) {
      setImportError('Enter a public GitHub repository or file URL.');
      return;
    }
    setImportingBusy(true);
    setImportError(null);
    try {
      const res = await fetch('/api/import/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
          url: githubUrl.trim(),
          selectedPaths,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load GitHub repository.');

      if (data.mode === 'tree') {
        const files: Array<{ path: string; size: number }> = Array.isArray(data.availableFiles)
          ? data.availableFiles
          : Array.isArray(data.files)
          ? data.files
          : [];
        setGithubBranch(data.branch || 'main');
        setGithubRepoUrl(data.repoUrl || githubUrl.trim());
        setGithubTree(
          files.map((f, idx) => ({
            path: f.path,
            size: f.size,
            selected: idx < 3,
          }))
        );
      } else {
        const importedFiles: Array<{ path: string; url?: string; content: string }> = Array.isArray(
          data.files
        )
          ? data.files
          : [];
        const assembledExcerpt =
          importedFiles.length > 0
            ? importedFiles.map((f) => `// File: ${f.path}\n${f.content}`).join('\n\n')
            : data.text || '';
        if (!assembledExcerpt.trim()) {
          throw new Error('No readable content returned from GitHub.');
        }
        setGithubTree([]);
        setImportedSource({
          id: `imp-${Date.now()}`,
          kind: 'github',
          title: `${data.repoUrl || githubUrl} (${importedFiles.length || 1} file${
            importedFiles.length === 1 ? '' : 's'
          })`,
          url: data.repoUrl || githubUrl.trim(),
          excerpt: assembledExcerpt,
        });
        if (!topic.trim() && data.repo) {
          setTopic(`${data.repo} Code & Technical Notes`);
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'GitHub import failed.');
    } finally {
      setImportingBusy(false);
    }
  };

  const handleGenerateNotes = async () => {
    if (!topic.trim() && screenshots.length === 0 && !importedSource) {
      setErrorMsg('Enter a topic, import material, tap what ALEXYN taught you, or attach a screenshot.');
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
    setSavedToast(null);
    setIsEditingNote(false);

    const activeSubj = scopedSubject?.name || subject;
    const taughtMatch = useTaughtContext
      ? findTaughtContextForTopic(topic || 'study', conversations)
      : { matchedTopics: [], contextText: '' };

    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(48000),
        body: JSON.stringify({
          topic:
            topic.trim() ||
            importedSource?.title ||
            'Notes from uploaded study screenshots',
          subject: activeSubj,
          strictScope: Boolean(scopedSubject),
          styles: getStyleLabels(selectedStyles),
          detailLevel,
          taughtContext: taughtMatch.contextText,
          importedSourceText: importedSource?.excerpt || '',
          importedSourceLabel: importedSource?.title || '',
          isLanguage: isLanguageSubject(activeSubj),
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

      const newDraft: SmartNote = {
        id: `note-${Date.now()}`,
        title: data.title || topic.trim() || importedSource?.title || 'Smart Notes',
        subject: data.subject || activeSubj,
        topic: topic.trim() || data.title || activeSubj,
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
        visuals: Array.isArray(data.visuals) ? data.visuals : [],
        mediaPhotos: Array.isArray(data.mediaPhotos) ? data.mediaPhotos : [],
        images: screenshots.length > 0 ? [...screenshots] : undefined,
        importedSources: importedSource ? [importedSource] : undefined,
        bilingual: data.bilingual || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fromTaughtTopics: taughtMatch.matchedTopics,
        savedToLibrary: false, // STRICT: Must NOT auto-save drafts
        lastStudiedSectionIndex: 0,
      };

      setDraftNote(newDraft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Smart Notes AI.';
      setErrorMsg(`${msg} Created a local structured draft so you can still edit or customize.`);
      const draft = buildFallbackNote({
        topic: topic.trim() || importedSource?.title || 'Study Topic',
        subject: activeSubj,
        styles: selectedStyles,
        detailLevel,
        taughtContext: taughtMatch.contextText,
      });
      draft.savedToLibrary = false;
      draft.topic = topic.trim() || draft.title;
      draft.images = screenshots.length > 0 ? [...screenshots] : undefined;
      draft.importedSources = importedSource ? [importedSource] : undefined;
      setDraftNote(draft);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraftToLibrary = (noteToSave: SmartNote) => {
    const finalized: SmartNote = {
      ...noteToSave,
      savedToLibrary: true,
      updatedAt: Date.now(),
    };
    onSaveNoteToLibrary(finalized);
    setDraftNote(finalized);
    onSetActiveNote(finalized);
    setSavedToast(`Saved "${finalized.title}" to My Saved Notes ✓`);
  };

  const handleToggleSpeakText = (key: string, textToSpeak: string, subjName: string) => {
    setSpeechStatus(null);
    if (speakingKey === key) {
      stopBrowserTTS();
      setSpeakingKey(null);
      return;
    }
    const isBilingualTarget = key.startsWith('vocab-') || key.startsWith('sent-');
    const cleanText = isBilingualTarget
      ? extractPureTargetSpeechText(textToSpeak) || textToSpeak
      : textToSpeak;
    const ok = speakWithBrowserTTS({
      text: cleanText,
      lang: getSpeechLangForSubject(subjName),
      rate: isBilingualTarget ? 0.9 : 0.96,
      onStart: () => setSpeakingKey(key),
      onEnd: () => setSpeakingKey((c) => (c === key ? null : c)),
      onError: (err) => {
        setSpeakingKey(null);
        setSpeechStatus(err);
      },
    });
    if (!ok) setSpeakingKey(null);
  };

  const filteredSavedNotes = savedNotes.filter((n) => {
    if (scopedSubject && n.subject.toLowerCase() !== scopedSubject.name.toLowerCase()) {
      return false;
    }
    const q = searchSavedQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      (n.topic || '').toLowerCase().includes(q) ||
      n.overview.toLowerCase().includes(q)
    );
  });

  const renderNoteDocument = (note: SmartNote, isSavedLibraryMode: boolean) => {
    const allNoteText = [
      note.title,
      note.overview,
      ...note.sections.map((s) => `${s.heading}. ${s.content}`),
    ].join('\n\n');
    const isSpeakingNote = speakingKey === `full-${note.id}`;

    return (
      <article className="space-y-5 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-7">
        {/* TOP HEADER & ACTIONS */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--alexyn-border)] pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#7DD3FC]">
                {note.subject} ·{' '}
                {note.detailLevel === 'detailed' ? 'Detailed Book Notes' : 'Short Quick Notes'}
                {note.styles.length > 0
                  ? ` · ${getStyleLabels(note.styles).join(' · ')}`
                  : ''}
              </span>
              {!note.savedToLibrary && (
                <span className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  Editable Draft (Not Saved Yet)
                </span>
              )}
              {note.savedToLibrary && isSavedLibraryMode && (
                <span className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  Saved in Library
                </span>
              )}
            </div>

            {isEditingNote ? (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={note.title}
                  onChange={(e) => setCurrentDisplayedNote({ ...note, title: e.target.value })}
                  aria-label="Edit note title"
                  className="w-full rounded-xl border border-[#38BDF8]/50 bg-[#060E24] px-3 py-2 text-lg font-bold text-white"
                />
                <textarea
                  rows={2}
                  value={note.overview}
                  onChange={(e) => setCurrentDisplayedNote({ ...note, overview: e.target.value })}
                  aria-label="Edit note overview"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-sm text-slate-200"
                />
              </div>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-extrabold text-white">{note.title}</h2>
                {note.overview && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {renderInlineFormatted(note.overview)}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleToggleSpeakText(`full-${note.id}`, allNoteText, note.subject)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                isSpeakingNote
                  ? 'border-[#38BDF8] bg-[#132C62] text-[#38BDF8]'
                  : 'border-[var(--alexyn-border)] bg-[#0E1B3E] text-slate-200 hover:border-[#38BDF8]'
              }`}
            >
              {isSpeakingNote ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{isSpeakingNote ? 'Stop Audio' : 'Listen'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingNote((e) => !e)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                isEditingNote
                  ? 'border-[#5EEAD4] bg-[#0D2A3F] text-[#5EEAD4]'
                  : 'border-[var(--alexyn-border)] bg-[#0E1B3E] text-slate-200 hover:border-[#2E8BFF]'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isEditingNote ? 'Done Editing' : 'Edit'}</span>
            </button>

            {!note.savedToLibrary ? (
              <button
                type="button"
                onClick={() => handleSaveDraftToLibrary(note)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-bold text-white"
              >
                <Save className="h-4 w-4" />
                <span>Save to My Saved Notes</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveDraftToLibrary(note)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#5EEAD4]/40 bg-[#10214B] px-3.5 py-2 text-xs font-semibold text-[#5EEAD4]"
              >
                <BookmarkCheck className="h-4 w-4" />
                <span>Saved</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onShareNoteToCommunity(note);
                setSharedFeedback(true);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3.5 py-2 text-xs font-bold text-white"
            >
              <Share2 className="h-4 w-4" />
              <span>{sharedFeedback ? 'Shared!' : 'Share'}</span>
            </button>

            {isSavedLibraryMode && onDeleteSavedNote && (
              <button
                type="button"
                onClick={() => {
                  onDeleteSavedNote(note.id);
                  onSetActiveNote(null);
                }}
                aria-label={`Delete saved note ${note.title}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {savedToast && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-200">
            {savedToast}
          </div>
        )}
        {speechStatus && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            {speechStatus}
          </div>
        )}

        {/* IMPORTED SOURCES NOTICE (SEPARATED FROM AI EXPLANATIONS) */}
        {note.importedSources && note.importedSources.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-cyan-500/35 bg-[#071836] p-4">
            {note.importedSources.map((src) => (
              <div key={src.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7DD3FC]">
                    {src.kind === 'github' ? (
                      <Code2 className="h-4 w-4" />
                    ) : src.kind === 'url' ? (
                      <Globe className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span>Imported Original Material: {src.title}</span>
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#38BDF8] hover:underline"
                    >
                      <span>Open Original Source</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap rounded-xl bg-[#040A1A]/70 p-2.5 font-mono text-[11px] text-slate-300">
                  {src.excerpt}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* PERSISTENT UPLOADED TEXTBOOK PHOTOS & SCREENSHOTS */}
        {note.images && note.images.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-[#7DD3FC]">
              Attached Textbook Photos & Diagrams ({note.images.length})
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {note.images.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24]"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    referrerPolicy="no-referrer"
                    className="max-h-60 w-full object-contain bg-[#040A1A]"
                  />
                  <p className="truncate px-3 py-1.5 text-[11px] text-slate-400">{img.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RELEVANT REAL-WORLD PHOTOGRAPHS & SCIENTIFIC VISUAL REFERENCES */}
        {note.mediaPhotos && note.mediaPhotos.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#7DD3FC]">
              Relevant Study Photographs & Visual References
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {note.mediaPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24]"
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="h-44 w-full bg-[#040A1A] object-cover"
                  />
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-xs font-bold text-white">{photo.title}</h3>
                      {photo.sourceUrl && (
                        <a
                          href={photo.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#38BDF8] hover:underline"
                        >
                          <span>Source</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] text-slate-300">{photo.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOPIC-SPECIFIC LABELED DIAGRAMS / VISUAL EXPLANATIONS */}
        {note.visuals && note.visuals.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#5EEAD4]">
              Topic Visual Explanations & Labelled Diagrams
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {note.visuals.map((vis, visIdx) => {
                const safeSvg = sanitizeSvgMarkup(vis.svgMarkup);
                if (!safeSvg) return null;
                return (
                  <div
                    key={vis.id || `vis-${visIdx}`}
                    className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{vis.title}</h3>
                      <span className="rounded-md bg-[#122658] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#7DD3FC]">
                        {vis.kind}
                      </span>
                    </div>
                    <div
                      className="overflow-hidden rounded-xl border border-white/10 bg-[#050C20] p-2 [&>svg]:h-auto [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: safeSvg }}
                    />
                    <p className="mt-2 text-xs text-slate-300">{vis.caption}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BILINGUAL LANGUAGE STUDY SECTION */}
        {note.bilingual && (
          <div className="space-y-4 rounded-2xl border border-indigo-400/35 bg-[#081538] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#93C5FD]">
              <Languages className="h-4 w-4 text-[#5EEAD4]" />
              <span>Bilingual {note.bilingual.targetLanguage} Study Guide (with Pronunciation & English Meaning)</span>
            </div>

            {note.bilingual.vocabulary.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {note.bilingual.vocabulary.map((v, idx) => {
                  const key = `vocab-${note.id}-${idx}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">
                          {v.term}{' '}
                          <span className="text-xs font-normal text-[#5EEAD4]">[{v.english}]</span>
                        </p>
                        {v.pronunciationGuide && (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Say: <span className="italic text-[#BAE6FD]">{v.pronunciationGuide}</span>
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSpeakText(key, v.term, note.subject)}
                        aria-label={`Pronounce ${v.term}`}
                        className="rounded-lg border border-[var(--alexyn-border)] bg-[#0E1E46] p-2 text-[#38BDF8] hover:border-[#38BDF8]"
                      >
                        {speakingKey === key ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {note.bilingual.exampleSentences && note.bilingual.exampleSentences.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#7DD3FC]">Example Sentences</p>
                {note.bilingual.exampleSentences.map((s, idx) => {
                  const key = `sent-${note.id}-${idx}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{s.targetText}</p>
                        <p className="text-xs text-[#5EEAD4]">[{s.englishTranslation}]</p>
                        {s.grammarBreakdown && (
                          <p className="text-[11px] italic text-slate-400">{s.grammarBreakdown}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSpeakText(key, s.targetText, note.subject)}
                        aria-label={`Hear example sentence ${idx + 1}`}
                        className="rounded-lg border border-[var(--alexyn-border)] bg-[#0E1E46] p-2 text-[#38BDF8] hover:border-[#38BDF8]"
                      >
                        {speakingKey === key ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {note.bilingual.grammarNotes.length > 0 && (
              <div className="rounded-xl bg-[#060E24] p-3">
                <p className="text-xs font-semibold text-[#7DD3FC]">Grammar & Usage Rules</p>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-200">
                  {note.bilingual.grammarNotes.map((g, idx) => (
                    <li key={idx}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* MAIN SECTIONS WITH EDITING, CONTINUE STUDYING PROGRESS & REMOVE */}
        {note.sections.length > 0 && (
          <div className="space-y-3">
            {note.sections.map((sec, idx) => {
              const studiedUpTo = (note.lastStudiedSectionIndex ?? -1) >= idx;
              return (
                <div
                  key={sec.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    studiedUpTo
                      ? 'border-emerald-500/40 bg-[#07152D]'
                      : 'border-[var(--alexyn-border)] bg-[#060E24]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {isEditingNote ? (
                      <input
                        type="text"
                        value={sec.heading}
                        onChange={(e) =>
                          setCurrentDisplayedNote({
                            ...note,
                            sections: note.sections.map((s) =>
                              s.id === sec.id ? { ...s, heading: e.target.value } : s
                            ),
                          })
                        }
                        className="flex-1 rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1 text-sm font-bold text-white"
                      />
                    ) : (
                      <h3 className="text-base font-bold text-white">{sec.heading}</h3>
                    )}

                    <div className="flex items-center gap-2">
                      {note.savedToLibrary && (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentDisplayedNote({
                              ...note,
                              lastStudiedSectionIndex: idx,
                              updatedAt: Date.now(),
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            studiedUpTo
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-[#0E1E46] text-slate-300 hover:text-white'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{studiedUpTo ? 'Studied' : 'Mark Studied'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentDisplayedNote(removeNoteSection(note, sec.id))}
                        aria-label={`Remove section ${sec.heading}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {isEditingNote ? (
                    <textarea
                      rows={4}
                      value={sec.content}
                      onChange={(e) =>
                        setCurrentDisplayedNote({
                          ...note,
                          sections: note.sections.map((s) =>
                            s.id === sec.id ? { ...s, content: e.target.value } : s
                          ),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3 text-sm text-slate-200"
                    />
                  ) : (
                    renderRichNoteContent(sec.content)
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MEMORY TRICKS */}
        {note.memoryTricks.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/25 bg-[#081A36] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#7DD3FC]">Memory Tricks & Mnemonics</h3>
              <button
                type="button"
                onClick={() => setCurrentDisplayedNote({ ...note, memoryTricks: [] })}
                className="text-xs text-slate-400 hover:text-rose-300"
              >
                Remove block
              </button>
            </div>
            <ul className="mt-2 space-y-2 text-sm text-slate-100">
              {note.memoryTricks.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  • {renderInlineFormatted(item)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FUNNY EXAMPLES */}
        {note.funnyExamples.length > 0 && (
          <div className="rounded-2xl border border-amber-400/25 bg-[#161936] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-300">Funny Examples</h3>
              <button
                type="button"
                onClick={() => setCurrentDisplayedNote({ ...note, funnyExamples: [] })}
                className="text-xs text-slate-400 hover:text-rose-300"
              >
                Remove block
              </button>
            </div>
            <ul className="mt-2 space-y-2 text-sm text-slate-100">
              {note.funnyExamples.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  • {renderInlineFormatted(item)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* EXAM TIPS & READING ADVICE */}
        {(note.examTips.length > 0 || note.readingAdvice.length > 0) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {note.examTips.length > 0 && (
              <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#07112B] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-emerald-300">Exam Focus</h3>
                  <button
                    type="button"
                    onClick={() => setCurrentDisplayedNote({ ...note, examTips: [] })}
                    className="text-xs text-slate-400 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200">
                  {note.examTips.map((tip, idx) => (
                    <li key={idx}>• {renderInlineFormatted(tip)}</li>
                  ))}
                </ul>
              </div>
            )}

            {note.readingAdvice.length > 0 && (
              <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#07112B] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#93C5FD]">What to Read Next</h3>
                  <button
                    type="button"
                    onClick={() => setCurrentDisplayedNote({ ...note, readingAdvice: [] })}
                    className="text-xs text-slate-400 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200">
                  {note.readingAdvice.map((tip, idx) => (
                    <li key={idx}>• {renderInlineFormatted(tip)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* PRACTICE FLASHCARDS */}
        {note.flashcards.length > 0 && (
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-white">
              Practice Flashcards (tap to flip)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {note.flashcards.map((fc) => {
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
    );
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

      {/* SMART NOTES HERO + STRICT SEPARATE TABS (GENERATE VS MY SAVED NOTES) */}
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
                <p className="text-xs text-slate-400">
                  Create editable study notes, import PDFs/URLs/GitHub, and manage your saved library
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Smart Notes sections">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'generate'}
                onClick={() => setViewMode('generate')}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                  viewMode === 'generate'
                    ? 'border-[#38BDF8] bg-[#2E8BFF] text-white'
                    : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate Notes</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'saved'}
                onClick={() => setViewMode('saved')}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
                  viewMode === 'saved'
                    ? 'border-[#38BDF8] bg-[#2E8BFF] text-white'
                    : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                <span>My Saved Notes ({savedNotes.length})</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-[var(--alexyn-border)] bg-[#061028]">
              <img
                src={SMART_NOTES_ILLUSTRATION}
                alt="Glowing ALEXYN Smart Notes holographic notebook"
                referrerPolicy="no-referrer"
                className="h-40 w-full object-cover md:h-44"
              />
            </div>
          </div>
        </div>
      </section>

      {/* VIEW MODE 2: MY SAVED NOTES LIBRARY (COMPLETELY SEPARATE FROM GENERATE) */}
      {viewMode === 'saved' ? (
        <div className="space-y-5">
          {activeNote && activeNote.savedToLibrary ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingNote(false);
                    onSetActiveNote(null);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>All My Saved Notes ({filteredSavedNotes.length})</span>
                </button>
                <span className="text-xs text-slate-400">
                  Progress: {Math.min((activeNote.lastStudiedSectionIndex ?? 0) + 1, activeNote.sections.length)}/{Math.max(1, activeNote.sections.length)} section(s)
                </span>
              </div>
              {renderNoteDocument(activeNote, true)}
            </div>
          ) : (
            <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">My Saved Notes Library</h2>
                  <p className="text-xs text-slate-400">
                    Open any saved note to continue studying, edit sections, listen aloud, or inspect diagrams.
                  </p>
                </div>
                <input
                  type="text"
                  value={searchSavedQuery}
                  onChange={(e) => setSearchSavedQuery(e.target.value)}
                  placeholder="Filter saved notes..."
                  aria-label="Filter saved notes"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 sm:w-64"
                />
              </div>

              {filteredSavedNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--alexyn-border)] bg-[#060E24] p-8 text-center">
                  <p className="text-sm font-semibold text-slate-300">
                    No saved Smart Notes yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Generate a note draft first, customize or edit it, then click "Save to My Saved Notes".
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode('generate')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2E8BFF] px-4 py-2 text-xs font-bold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Go to Generate Notes</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredSavedNotes.map((note) => {
                    const thumbImg = note.images?.[0]?.previewUrl || note.mediaPhotos?.[0]?.imageUrl;
                    const firstSvg = note.visuals?.[0]?.svgMarkup
                      ? sanitizeSvgMarkup(note.visuals[0].svgMarkup)
                      : '';
                    const isRenaming = renamingNoteId === note.id;

                    return (
                      <div
                        key={note.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4 transition-colors hover:border-[#2E8BFF]/60"
                      >
                        <div className="flex items-start gap-3">
                          {thumbImg ? (
                            <img
                              src={thumbImg}
                              alt={note.title}
                              referrerPolicy="no-referrer"
                              className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover"
                            />
                          ) : firstSvg ? (
                            <div
                              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2E8BFF]/30 bg-[#050C20] p-1 [&>svg]:h-full [&>svg]:w-full"
                              dangerouslySetInnerHTML={{ __html: firstSvg }}
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#2E8BFF]/30 bg-[#0E1E46] text-[#38BDF8]">
                              <BookOpen className="h-7 w-7" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-[#7DD3FC]">
                              {note.subject}
                              {note.topic ? ` · ${note.topic}` : ''}
                            </p>
                            {isRenaming ? (
                              <div className="mt-1 flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  className="min-w-0 flex-1 rounded-lg border border-[#38BDF8] bg-[#0A1430] px-2 py-1 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const trimmed = renameValue.trim();
                                    if (trimmed) {
                                      const updated = { ...note, title: trimmed, updatedAt: Date.now() };
                                      if (onUpdateSavedNote) onUpdateSavedNote(updated);
                                      else onSaveNoteToLibrary(updated);
                                    }
                                    setRenamingNoteId(null);
                                  }}
                                  className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-200"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <h3 className="mt-0.5 truncate text-base font-bold text-white">
                                {note.title}
                              </h3>
                            )}
                            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                              {note.overview || note.sections[0]?.content || 'Saved ALEXYN study note'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingNote(false);
                              onSetActiveNote(note);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2E8BFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E75EA]"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span>Continue Studying</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingNoteId(note.id);
                              setRenameValue(note.title);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-2.5 py-2 text-xs text-slate-200 hover:border-[#38BDF8]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Rename</span>
                          </button>
                          {onDeleteSavedNote && (
                            <button
                              type="button"
                              onClick={() => onDeleteSavedNote(note.id)}
                              aria-label={`Delete ${note.title}`}
                              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        /* VIEW MODE 1: GENERATE NOTES + DRAFT EDITOR */
        <div className="space-y-6">
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
                  {taughtTopics.map((item, tIdx) => (
                    <button
                      key={`${item.conversationId}-${tIdx}`}
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

            {/* ATTACH SCREENSHOTS / TEXTBOOK PHOTOS */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
              >
                <ImagePlus className="h-4 w-4 text-[#5EEAD4]" />
                <span>Attach textbook photos / diagrams</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUploadScreenshots}
              />

              <button
                type="button"
                onClick={() => setImportOpen((p) => !p)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#2E8BFF]/40 bg-[#10214E] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:border-[#38BDF8]"
              >
                <Upload className="h-4 w-4" />
                <span>Import PDF, Word, URL or GitHub Repo</span>
              </button>

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

            {/* EXTERNAL MATERIAL IMPORT PANEL (PDF/WORD/PPT + URL + PUBLIC GITHUB REPO) */}
            {importOpen && (
              <div className="mt-4 space-y-4 rounded-2xl border border-[#2E8BFF]/35 bg-[#060E24] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">
                    Import External Study Material (Document, Website, or Public GitHub Repo)
                  </p>
                  {importedSource && (
                    <button
                      type="button"
                      onClick={() => setImportedSource(null)}
                      className="text-xs text-rose-300 hover:underline"
                    >
                      Clear imported material
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {/* Document File */}
                  <div className="rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#5EEAD4]">1. Document File</p>
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.md,.csv,.py,.js,.ts,.html,.css,.json"
                      className="hidden"
                      onChange={handleImportDocumentFile}
                    />
                    <button
                      type="button"
                      disabled={importingBusy}
                      onClick={() => docFileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2E8BFF]/50 bg-[#060E24] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-[#38BDF8]"
                    >
                      <FileText className="h-4 w-4 text-[#5EEAD4]" />
                      <span>Upload PDF / Word / PPT / Code</span>
                    </button>
                  </div>

                  {/* Webpage URL */}
                  <div className="rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#7DD3FC]">2. Educational Website URL</p>
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://en.wikipedia.org/..."
                        className="min-w-0 flex-1 rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={importingBusy}
                        onClick={handleImportWebUrl}
                        className="rounded-lg bg-[#2E8BFF] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Fetch
                      </button>
                    </div>
                  </div>

                  {/* Public GitHub Repo/File */}
                  <div className="rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3">
                    <p className="mb-2 text-xs font-semibold text-purple-300">3. Public GitHub Repo / File</p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="owner/repo or github.com/..."
                        className="min-w-0 flex-1 rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={importingBusy}
                        onClick={() => handleLoadGitHub()}
                        className="rounded-lg bg-[#6E5BFF] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>

                {importingBusy && (
                  <div className="flex items-center gap-2 text-xs text-[#7DD3FC]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Reading external source cleanly...</span>
                  </div>
                )}

                {importError && (
                  <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {importError}
                  </p>
                )}

                {githubTree.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">
                        Select files from {githubRepoUrl} ({githubBranch}):
                      </span>
                      <button
                        type="button"
                        disabled={importingBusy}
                        onClick={() =>
                          handleLoadGitHub(
                            githubTree.filter((f) => f.selected).map((f) => f.path)
                          )
                        }
                        className="rounded-lg bg-[#2E8BFF] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Import Selected Files
                      </button>
                    </div>
                    <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                      {githubTree.map((f) => (
                        <label
                          key={f.path}
                          className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#060E24] px-2.5 py-1.5 text-[11px] text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={f.selected}
                            onChange={() =>
                              setGithubTree((prev) =>
                                prev.map((item) =>
                                  item.path === f.path
                                    ? { ...item, selected: !item.selected }
                                    : item
                                )
                              )
                            }
                            className="h-3.5 w-3.5 accent-[#6E5BFF]"
                          />
                          <span className="truncate font-mono">{f.path}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {importedSource && (
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100">
                    ✓ Loaded <strong>{importedSource.title}</strong> ({importedSource.excerpt.length} chars). Click Generate Smart Notes below to summarize and explain it!
                  </div>
                )}
              </div>
            )}

            {/* CUSTOMIZE PANEL */}
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
                          Deep explanations, diagrams, complete steps & full context
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
                    <span>Crafting your Smart Notes draft...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Smart Notes</span>
                  </>
                )}
              </button>

              {draftNote && (
                <button
                  type="button"
                  onClick={() => setDraftNote(null)}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1A3D] px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Discard Draft</span>
                </button>
              )}
            </div>
          </section>

          {draftNote && renderNoteDocument(draftNote, false)}
        </div>
      )}
    </div>
  );
}
