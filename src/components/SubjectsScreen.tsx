import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Compass,
  Languages,
  Loader2,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import { computeSubjectProgress, getAllSubjects } from '../utils/alexynLogic';
import { ExploreScreen } from './ExploreScreen';
import { Lab3DScreen } from './Lab3DScreen';
import { SmartNotesScreen } from './SmartNotesScreen';
import type {
  AttachmentImage,
  Conversation,
  EducationProfile,
  NoteDetailLevel,
  SmartNote,
  SubjectItem,
  SubjectWindowView,
} from '../types/alexyn';

interface SubjectsScreenProps {
  profile: EducationProfile;
  selectedSubjectWindow: SubjectItem | null;
  onSelectSubjectWindow: (subject: SubjectItem | null) => void;
  subView: SubjectWindowView;
  onChangeSubView: (view: SubjectWindowView) => void;
  subjectProgress: Record<string, string[]>;
  onToggleTopicComplete: (subjectId: string, topicTitle: string) => void;
  conversations: Conversation[];
  activePlugins: string[];
  onTogglePlugin: (pluginId: string) => void;
  onSendScopedExplore: (
    text: string,
    images: AttachmentImage[],
    subjectName: string,
    strictScope: boolean
  ) => Promise<void>;
  isSendingExplore: boolean;
  activeNote: SmartNote | null;
  onSetActiveNote: (note: SmartNote | null) => void;
  onSaveNoteToLibrary: (note: SmartNote) => void;
  onShareNoteToCommunity: (note: SmartNote) => void;
  defaultNoteDepth: NoteDetailLevel;
  voiceLanguage: string;
  autoScrollKeyboard: boolean;
  onOpenAccountModal: () => void;
}

interface LiveCoachData {
  summary: string;
  examHotTopics: string[];
  readingAdvice: string[];
}

export function SubjectsScreen({
  profile,
  selectedSubjectWindow,
  onSelectSubjectWindow,
  subView,
  onChangeSubView,
  subjectProgress,
  onToggleTopicComplete,
  conversations,
  activePlugins,
  onTogglePlugin,
  onSendScopedExplore,
  isSendingExplore,
  activeNote,
  onSetActiveNote,
  onSaveNoteToLibrary,
  onShareNoteToCommunity,
  defaultNoteDepth,
  voiceLanguage,
  autoScrollKeyboard,
  onOpenAccountModal,
}: SubjectsScreenProps) {
  const [tab, setTab] = useState<'all' | 'languages'>('all');
  const [scopedNoteTopic, setScopedNoteTopic] = useState('');
  const [liveCoach, setLiveCoach] = useState<LiveCoachData | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const displayedSubjects =
    tab === 'languages' ? LANGUAGE_SUBJECTS : getAllSubjects('core');

  const handleOpenSubjectWindow = (subj: SubjectItem) => {
    setLiveCoach(null);
    setCoachError(null);
    onChangeSubView('overview');
    setScopedNoteTopic('');
    onSelectSubjectWindow(subj);
  };

  const handleSwitchSubjectByName = (targetName: string) => {
    const all = getAllSubjects('all');
    const found = all.find(
      (s) =>
        s.name.toLowerCase() === targetName.toLowerCase() ||
        s.name.toLowerCase().includes(targetName.toLowerCase())
    );
    if (found) {
      handleOpenSubjectWindow(found);
    }
  };

  const handleFetchLiveExamCoach = async (subj: SubjectItem) => {
    setLoadingCoach(true);
    setCoachError(null);
    try {
      const res = await fetch('/api/subjects/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          subject: subj.name,
          isLanguage: subj.category === 'language',
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not load AI exam coach.');
      }
      setLiveCoach(data as LiveCoachData);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'Unable to fetch live coach.');
    } finally {
      setLoadingCoach(false);
    }
  };

  // SUBJECT WORKSPACE WINDOW (Bottom navigation stays hidden across overview + personal explore/notes/lab)
  if (selectedSubjectWindow) {
    if (subView === 'explore') {
      const subjectConvo =
        conversations.find(
          (c) =>
            c.subjectFocus?.toLowerCase() === selectedSubjectWindow.name.toLowerCase()
        ) || {
          id: `scoped-${selectedSubjectWindow.id}`,
          title: `${selectedSubjectWindow.name} Study`,
          subjectFocus: selectedSubjectWindow.name,
          updatedAt: Date.now(),
          messages: [],
        };

      return (
        <ExploreScreen
          conversation={subjectConvo}
          activePlugins={activePlugins}
          onTogglePlugin={onTogglePlugin}
          onSendMessage={(txt, imgs, strict) =>
            onSendScopedExplore(
              txt,
              imgs,
              selectedSubjectWindow.name,
              strict ?? true
            )
          }
          isSending={isSendingExplore}
          onMakeSmartNotes={(topic) => {
            setScopedNoteTopic(topic);
            onChangeSubView('notes');
          }}
          voiceLanguage={voiceLanguage}
          autoScrollKeyboard={autoScrollKeyboard}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
          onSwitchToSubject={handleSwitchSubjectByName}
        />
      );
    }

    if (subView === 'notes') {
      return (
        <SmartNotesScreen
          key={`${selectedSubjectWindow.id}-${scopedNoteTopic}`}
          profile={profile}
          conversations={conversations}
          activeNote={activeNote}
          onSetActiveNote={onSetActiveNote}
          onSaveNoteToLibrary={onSaveNoteToLibrary}
          onShareNoteToCommunity={onShareNoteToCommunity}
          initialTopic={scopedNoteTopic}
          initialSubject={selectedSubjectWindow.name}
          defaultDetailLevel={defaultNoteDepth}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
          onSwitchToSubject={handleSwitchSubjectByName}
        />
      );
    }

    if (subView === 'lab') {
      return (
        <Lab3DScreen
          profile={profile}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
          onSwitchToSubject={handleSwitchSubjectByName}
          onMakeLabNotes={(topic) => {
            setScopedNoteTopic(topic);
            onChangeSubView('notes');
          }}
        />
      );
    }

    const hotTopics = liveCoach?.examHotTopics?.length
      ? liveCoach.examHotTopics
      : selectedSubjectWindow.examHotTopics;

    const readingAdvice = liveCoach?.readingAdvice?.length
      ? liveCoach.readingAdvice
      : selectedSubjectWindow.readingAdvice;

    const completedList = subjectProgress[selectedSubjectWindow.id] || [];
    const progressPct = computeSubjectProgress(
      selectedSubjectWindow.id,
      subjectProgress,
      hotTopics.length
    );

    return (
      <div className="mx-auto max-w-4xl space-y-5 px-4 pb-10 pt-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectSubjectWindow(null)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1532] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Subjects</span>
          </button>

          <button
            type="button"
            onClick={() => handleFetchLiveExamCoach(selectedSubjectWindow)}
            disabled={loadingCoach}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193272] disabled:opacity-50"
          >
            {loadingCoach ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Refresh AI Exam Guide</span>
          </button>
        </div>

        {profile.mode === 'guest' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                You are in Guest mode—sign in or create an account to save your {selectedSubjectWindow.name} progress permanently.
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenAccountModal}
              className="rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30"
            >
              Sign In / Save Progress
            </button>
          </div>
        )}

        <section className="rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1D42] to-[#081129] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#7DD3FC]">
                {selectedSubjectWindow.category === 'language'
                  ? 'Language Workspace · Exam Focus'
                  : 'Subject Workspace'}
                {profile.curriculum ? ` · ${profile.curriculum}` : ''}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                {selectedSubjectWindow.flag ? `${selectedSubjectWindow.flag} ` : ''}
                {selectedSubjectWindow.name}
              </h1>
              {liveCoach?.summary && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                  {liveCoach.summary}
                </p>
              )}
            </div>

            <div className="min-w-[150px] rounded-2xl border border-[var(--alexyn-border)] bg-[#071026] px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-[#5EEAD4]" />
                  <span>Progress</span>
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {progressPct}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#132550]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2E8BFF] to-[#5EEAD4] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                {profile.mode === 'signed-in' ? 'Saved to account ✓' : 'Session only (Guest)'}
              </p>
            </div>
          </div>

          {coachError && (
            <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {coachError}
            </p>
          )}
        </section>

        {/* SCOPED SUBJECT TOOLS: SMART NOTES, 3D LAB, PERSONAL EXPLORE */}
        <section aria-label="Subject tools" className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setScopedNoteTopic(`${selectedSubjectWindow.name} Key Concepts`);
              onChangeSubView('notes');
            }}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1B3D] to-[#0A132C] p-4 text-left transition-colors hover:border-[#2E8BFF]/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#5EEAD4]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Smart Notes</h2>
                <p className="text-xs text-slate-400">
                  {selectedSubjectWindow.name}-only notes
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('lab')}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1B3D] to-[#0A132C] p-4 text-left transition-colors hover:border-[#2E8BFF]/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#818CF8]">
                <Atom className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">3D Lab</h2>
                <p className="text-xs text-slate-400">
                  {selectedSubjectWindow.name} 3D & tutor
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('explore')}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1B3D] to-[#0A132C] p-4 text-left transition-colors hover:border-[#2E8BFF]/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#38BDF8]">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Explore AI</h2>
                <p className="text-xs text-slate-400">
                  Personal {selectedSubjectWindow.name} tutor
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>
        </section>

        {/* TOPIC PROGRESS & EXAM FOCUS LIST DOWNWARDS */}
        <section className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white">
              What Mostly Comes in Exams · Track Your Progress
            </h2>
            <span className="text-xs text-slate-400">
              {completedList.length}/{hotTopics.length} mastered
            </span>
          </div>

          <ul className="mt-3 space-y-2.5">
            {hotTopics.map((topic) => {
              const done = completedList.includes(topic);
              return (
                <li
                  key={topic}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3D] px-3.5 py-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onToggleTopicComplete(selectedSubjectWindow.id, topic)
                    }
                    className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                  >
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5EEAD4]" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <span
                      className={`text-sm leading-snug ${
                        done ? 'text-slate-400 line-through' : 'text-slate-100'
                      }`}
                    >
                      {topic}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScopedNoteTopic(topic);
                      onChangeSubView('notes');
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#5EEAD4] hover:underline"
                  >
                    <span>Make Notes</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5">
          <h2 className="text-base font-bold text-white">
            Recommended Reading & Study Advice
          </h2>
          <ul className="mt-3 space-y-2">
            {readingAdvice.map((tip) => (
              <li
                key={tip}
                className="rounded-xl bg-[#071026] px-4 py-3 text-sm leading-relaxed text-slate-300"
              >
                {tip}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#7DD3FC]">
            {profile.curriculum || 'Global Learning'}
            {profile.grade ? ` · ${profile.grade}` : ''}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
            {tab === 'languages'
              ? 'World Languages · Exam Focus & Reading Advice'
              : 'All Subjects · Pick Anything to Study'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {tab === 'languages'
              ? 'Japanese, Spanish, French, Chinese & more—focused on what mostly comes in exams.'
              : 'All subjects including English, Kiswahili, CSL & ICT—tap any subject to open its workspace.'}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'all'
                ? 'bg-[#2E8BFF] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Subjects ({CORE_SUBJECTS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('languages')}
            className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'languages'
                ? 'bg-[#2E8BFF] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span>Languages ({LANGUAGE_SUBJECTS.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {displayedSubjects.map((subj) => {
          const isEnrolled = profile.subjects.includes(subj.name);
          const donePct = computeSubjectProgress(
            subj.id,
            subjectProgress,
            subj.examHotTopics.length
          );
          return (
            <button
              key={subj.id}
              type="button"
              onClick={() => handleOpenSubjectWindow(subj)}
              className="flex min-h-[96px] flex-col items-start justify-between rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-4 text-left text-slate-200 transition-colors hover:border-[#38BDF8] hover:bg-[#11214A] hover:text-white"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xl" aria-hidden="true">
                  {subj.flag || '◈'}
                </span>
                {donePct > 0 ? (
                  <span className="font-mono text-[11px] font-semibold text-[#5EEAD4] tabular-nums">
                    {donePct}%
                  </span>
                ) : isEnrolled ? (
                  <span className="text-[11px] font-medium text-[#7DD3FC]">
                    Yours
                  </span>
                ) : null}
              </div>
              <span className="mt-2 text-sm font-bold leading-snug">
                {subj.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
