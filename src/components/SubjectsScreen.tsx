import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Languages,
  Loader2,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import { analyzePerformance, getAllSubjects } from '../utils/alexynLogic';
import { ExploreScreen } from './ExploreScreen';
import { Lab3DScreen } from './Lab3DScreen';
import { ProgressScreen } from './ProgressScreen';
import { QuizzesScreen } from './QuizzesScreen';
import { SmartNotesScreen } from './SmartNotesScreen';
import type {
  AITutorSettings,
  AttachmentImage,
  Conversation,
  EducationProfile,
  GroundingSource,
  LabModelId,
  LabRecommendation,
  NoteDetailLevel,
  QuizAttempt,
  QuizDefinition,
  ReminderPreferences,
  SmartNote,
  SubjectItem,
  SubjectWindowView,
} from '../types/alexyn';

interface SubjectsScreenProps {
  profile: EducationProfile;
  aiSettings?: AITutorSettings;
  initialLabModelId?: LabModelId | null;
  onOpenRecommendedLab?: (rec: LabRecommendation) => void;
  selectedSubjectWindow: SubjectItem | null;
  onSelectSubjectWindow: (subject: SubjectItem | null) => void;
  subView: SubjectWindowView;
  onChangeSubView: (view: SubjectWindowView) => void;
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
  savedNotes: SmartNote[];
  activeNote: SmartNote | null;
  onSetActiveNote: (note: SmartNote | null) => void;
  onSaveNoteToLibrary: (note: SmartNote) => void;
  onUpdateSavedNote: (note: SmartNote) => void;
  onDeleteSavedNote: (noteId: string) => void;
  onShareNoteToCommunity: (note: SmartNote) => void;
  savedQuizzes: QuizDefinition[];
  onSaveQuiz: (quiz: QuizDefinition) => void;
  onDeleteQuiz: (quizId: string) => void;
  quizAttempts: QuizAttempt[];
  onRecordQuizAttempt: (attempt: QuizAttempt) => void;
  reminderPrefs: ReminderPreferences;
  onUpdateReminderPrefs: (prefs: ReminderPreferences) => void;
  dismissedReminderIds: string[];
  onDismissReminder: (id: string) => void;
  defaultNoteDepth: NoteDetailLevel;
  voiceLanguage: string;
  autoScrollKeyboard: boolean;
  onOpenAccountModal: () => void;
}

interface LiveCoachData {
  summary: string;
  examHotTopics: string[];
  commonQuestionPatterns?: string[];
  areasNeedingRevision?: string[];
  overlookedAreas?: string[];
  readingAdvice: string[];
  evidenceNote?: string;
  sources?: GroundingSource[];
}

export function SubjectsScreen({
  profile,
  aiSettings,
  initialLabModelId,
  onOpenRecommendedLab,
  selectedSubjectWindow,
  onSelectSubjectWindow,
  subView,
  onChangeSubView,
  conversations,
  activePlugins,
  onTogglePlugin,
  onSendScopedExplore,
  isSendingExplore,
  savedNotes,
  activeNote,
  onSetActiveNote,
  onSaveNoteToLibrary,
  onUpdateSavedNote,
  onDeleteSavedNote,
  onShareNoteToCommunity,
  savedQuizzes,
  onSaveQuiz,
  onDeleteQuiz,
  quizAttempts,
  onRecordQuizAttempt,
  reminderPrefs,
  onUpdateReminderPrefs,
  dismissedReminderIds,
  onDismissReminder,
  defaultNoteDepth,
  voiceLanguage,
  autoScrollKeyboard,
  onOpenAccountModal,
}: SubjectsScreenProps) {
  const [tab, setTab] = useState<'all' | 'languages'>('all');
  const [scopedNoteTopic, setScopedNoteTopic] = useState('');
  const [scopedQuizTopic, setScopedQuizTopic] = useState('');
  const [scopedLabModelId, setScopedLabModelId] = useState<LabModelId | null>(null);
  const [liveCoach, setLiveCoach] = useState<LiveCoachData | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const perfAnalysis = useMemo(() => analyzePerformance(quizAttempts), [quizAttempts]);

  const displayedSubjects =
    tab === 'languages' ? LANGUAGE_SUBJECTS : getAllSubjects('core');

  const handleOpenSubjectWindow = (subj: SubjectItem) => {
    setLiveCoach(null);
    setCoachError(null);
    onChangeSubView('overview');
    setScopedNoteTopic('');
    setScopedQuizTopic('');
    setScopedLabModelId(null);
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

    const subjectNotesText = savedNotes
      .filter((n) => n.subject.toLowerCase() === subj.name.toLowerCase())
      .slice(0, 4)
      .map(
        (n) =>
          `${n.title}: ${n.overview} ${n.sections
            .slice(0, 2)
            .map((s) => s.content)
            .join(' ')}`
      )
      .join('\n')
      .slice(0, 3000);

    try {
      const res = await fetch('/api/subjects/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          subject: subj.name,
          isLanguage: subj.category === 'language',
          profile,
          uploadedMaterialsText: subjectNotesText,
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

  // SUBJECT WORKSPACE WINDOW (Bottom navigation stays hidden across overview + subviews)
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
          onOpenRecommendedLab={(rec) => {
            const sameSubject =
              rec.subject.toLowerCase() === selectedSubjectWindow.name.toLowerCase() ||
              (selectedSubjectWindow.category === 'language' && rec.subject === 'Languages');
            if (sameSubject) {
              setScopedLabModelId(rec.modelId);
              onChangeSubView('lab');
            } else {
              onOpenRecommendedLab?.(rec);
            }
          }}
          voiceLanguage={voiceLanguage}
          autoScrollKeyboard={autoScrollKeyboard}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
          onSwitchToSubject={handleSwitchSubjectByName}
        />
      );
    }

    if (subView === 'quizzes') {
      return (
        <QuizzesScreen
          profile={profile}
          savedQuizzes={savedQuizzes}
          onSaveQuiz={onSaveQuiz}
          onDeleteQuiz={onDeleteQuiz}
          onRecordAttempt={onRecordQuizAttempt}
          recentAttempts={quizAttempts.filter(
            (a) => a.subject.toLowerCase() === selectedSubjectWindow.name.toLowerCase()
          )}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
          initialTopic={scopedQuizTopic}
          initialSubject={selectedSubjectWindow.name}
          onMakeSmartNotes={(topic) => {
            setScopedNoteTopic(topic);
            onChangeSubView('notes');
          }}
        />
      );
    }

    if (subView === 'progress') {
      return (
        <ProgressScreen
          profile={profile}
          attempts={quizAttempts}
          reminderPrefs={reminderPrefs}
          onUpdateReminderPrefs={onUpdateReminderPrefs}
          dismissedReminderIds={dismissedReminderIds}
          onDismissReminder={onDismissReminder}
          onStartQuizForTopic={(topic) => {
            setScopedQuizTopic(topic);
            onChangeSubView('quizzes');
          }}
          onOpenNotesForTopic={(topic) => {
            setScopedNoteTopic(topic);
            onChangeSubView('notes');
          }}
          onGoToQuizzes={() => onChangeSubView('quizzes')}
          scopedSubject={selectedSubjectWindow}
          onBackFromScoped={() => onChangeSubView('overview')}
        />
      );
    }

    if (subView === 'notes') {
      return (
        <SmartNotesScreen
          key={`${selectedSubjectWindow.id}-${scopedNoteTopic}`}
          profile={profile}
          conversations={conversations}
          savedNotes={savedNotes}
          activeNote={activeNote}
          onSetActiveNote={onSetActiveNote}
          onSaveNoteToLibrary={onSaveNoteToLibrary}
          onUpdateSavedNote={onUpdateSavedNote}
          onDeleteSavedNote={onDeleteSavedNote}
          onShareNoteToCommunity={onShareNoteToCommunity}
          initialTopic={scopedNoteTopic}
          initialSubject={selectedSubjectWindow.name}
          initialViewMode="generate"
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
          aiSettings={aiSettings}
          initialModelId={scopedLabModelId || initialLabModelId}
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

    const subjectPerf = perfAnalysis.subjectSummaries.find(
      (s) => s.subject.toLowerCase() === selectedSubjectWindow.name.toLowerCase()
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
            <span>Research Exam Focus</span>
          </button>
        </div>

        {profile.mode === 'guest' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                You are in Guest mode—sign in or create an account to save your {selectedSubjectWindow.name} performance permanently.
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
            <div className="min-w-0 flex-1">
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
              {liveCoach?.evidenceNote && (
                <p className="mt-1.5 text-[11px] text-amber-200/90">
                  {liveCoach.evidenceNote}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onChangeSubView('progress')}
              className="min-w-[175px] rounded-2xl border border-[var(--alexyn-border)] bg-[#071026] px-4 py-3 text-left transition-colors hover:border-[#38BDF8]"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-[#5EEAD4]" />
                  <span>Avg Marks</span>
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {subjectPerf ? `${subjectPerf.currentAverage}%` : 'No quizzes'}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#132550]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2E8BFF] to-[#5EEAD4] transition-all"
                  style={{ width: `${subjectPerf?.currentAverage || 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-[#7DD3FC]">
                {subjectPerf
                  ? `${subjectPerf.attemptCount} graded quiz(zes) · Open Progress →`
                  : 'Take a quiz to record marks →'}
              </p>
            </button>
          </div>

          {liveCoach?.sources && liveCoach.sources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
              {liveCoach.sources.map((src, i) => (
                <a
                  key={`${src.url}-${i}`}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/35 bg-[#0A183B] px-2.5 py-1 text-[11px] text-slate-200 hover:text-white"
                >
                  <span className="max-w-[190px] truncate">{src.title}</span>
                  <ExternalLink className="h-3 w-3 text-[#38BDF8]" />
                </a>
              ))}
            </div>
          )}

          {coachError && (
            <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {coachError}
            </p>
          )}
        </section>

        {/* SCOPED SUBJECT TOOLS: QUIZZES, SMART NOTES, 3D LAB, EXPLORE AI */}
        <section aria-label="Subject tools" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setScopedQuizTopic(hotTopics[0] || selectedSubjectWindow.name);
              onChangeSubView('quizzes');
            }}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1B3D] to-[#0A132C] p-4 text-left transition-colors hover:border-[#2E8BFF]/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#38BDF8]">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Quizzes</h2>
                <p className="text-[11px] text-slate-400">Test & upload papers</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>

          <button
            type="button"
            onClick={() => {
              setScopedNoteTopic(`${selectedSubjectWindow.name} Key Concepts`);
              onChangeSubView('notes');
            }}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0F1B3D] to-[#0A132C] p-4 text-left transition-colors hover:border-[#2E8BFF]/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#5EEAD4]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Smart Notes</h2>
                <p className="text-[11px] text-slate-400">Drafts & saved library</p>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#818CF8]">
                <Atom className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Practice Area</h2>
                <p className="text-[11px] text-slate-400">Interactive exercises</p>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#162C61] text-[#38BDF8]">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Explore AI</h2>
                <p className="text-[11px] text-slate-400">Personal tutor</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>
        </section>

        {/* RESEARCHED PATTERNS & OVERLOOKED AREAS (WHEN FETCHED) */}
        {liveCoach &&
          (liveCoach.commonQuestionPatterns?.length ||
            liveCoach.areasNeedingRevision?.length ||
            liveCoach.overlookedAreas?.length) && (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {liveCoach.commonQuestionPatterns && liveCoach.commonQuestionPatterns.length > 0 && (
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-4">
                  <h3 className="text-xs font-bold text-[#7DD3FC]">Common Question Patterns</h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                    {liveCoach.commonQuestionPatterns.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {liveCoach.areasNeedingRevision && liveCoach.areasNeedingRevision.length > 0 && (
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-4">
                  <h3 className="text-xs font-bold text-amber-300">Priority Revision</h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                    {liveCoach.areasNeedingRevision.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {liveCoach.overlookedAreas && liveCoach.overlookedAreas.length > 0 && (
                <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-4">
                  <h3 className="text-xs font-bold text-[#5EEAD4]">Often Overlooked Topics</h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                    {liveCoach.overlookedAreas.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

        {/* HIGH-YIELD EXAM TOPICS WITH QUICK QUIZ & SMART NOTES ACTIONS */}
        <section className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white">
              Exam-Tested Topics · Notes & Quizzes
            </h2>
            <span className="text-xs text-slate-400">
              {hotTopics.length} priority topic(s)
            </span>
          </div>

          <ul className="mt-3 space-y-2.5">
            {hotTopics.map((topic) => (
              <li
                key={topic}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3D] px-3.5 py-3"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">
                  {topic}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setScopedQuizTopic(topic);
                      onChangeSubView('quizzes');
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#7DD3FC] hover:underline"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span>Quiz Me</span>
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
                </div>
              </li>
            ))}
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
              ? 'World Languages · Exam Focus & Practice'
              : 'All Subjects · Pick Anything to Study'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {tab === 'languages'
              ? 'Japanese, Spanish, French, Chinese & more—bilingual notes, quizzes & speaking practice.'
              : 'Tap any subject to open its Quizzes, Smart Notes, Practice Area, Tutor, and real Marks Progress.'}
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
          const subjStat = perfAnalysis.subjectSummaries.find(
            (s) => s.subject.toLowerCase() === subj.name.toLowerCase()
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
                {subjStat ? (
                  <span className="font-mono text-[11px] font-semibold text-[#5EEAD4] tabular-nums">
                    {subjStat.currentAverage}% avg
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
