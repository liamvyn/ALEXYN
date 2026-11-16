import { useEffect, useRef, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { BottomNav } from './components/BottomNav';
import { ExploreScreen } from './components/ExploreScreen';
import { Lab3DScreen } from './components/Lab3DScreen';
import { LeftDrawer } from './components/LeftDrawer';
import { ProgressScreen } from './components/ProgressScreen';
import { QuizzesScreen } from './components/QuizzesScreen';
import { SettingsModal } from './components/SettingsModal';
import { ShareScreen } from './components/ShareScreen';
import { SmartNotesScreen } from './components/SmartNotesScreen';
import { SubjectsScreen } from './components/SubjectsScreen';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { EXPLORE_PLUGINS, STARTER_COMMUNITY_POSTS } from './data/curriculum';
import {
  analyzePerformance,
  DEFAULT_AI_TUTOR_SETTINGS,
  DEFAULT_REMINDER_PREFERENCES,
  detectRecommendedLab,
  extractTaughtTopics,
} from './utils/alexynLogic';
import { DEFAULT_VOICE_PREFERENCES } from './utils/voiceEngine';
import type {
  AISelection,
  AppControlAction,
  AppSettings,
  AttachmentImage,
  ChatMessage,
  Conversation,
  EducationProfile,
  LabModelId,
  LabRecommendation,
  QuizAttempt,
  QuizDefinition,
  ReminderPreferences,
  ScreenId,
  SharedPost,
  SmartNote,
  SubjectItem,
  SubjectWindowView,
} from './types/alexyn';

const STORAGE_KEYS = {
  profile: 'alexyn_profile_v2',
  conversations: 'alexyn_conversations_v1',
  notes: 'alexyn_notes_v1',
  posts: 'alexyn_posts_v1',
  settings: 'alexyn_settings_v1',
  quizzes: 'alexyn_quizzes_v1',
  attempts: 'alexyn_attempts_v1',
  dismissedReminders: 'alexyn_dismissed_rem_v1',
};

const DEFAULT_PROFILE: EducationProfile = {
  name: '',
  email: '',
  mode: 'guest',
  guestConfirmed: false,
  country: 'Kenya',
  curriculum: 'CBC (Kenya)',
  educationLevel: 'Secondary',
  grade: 'Grade 10 / Form 4 / Year 10',
  subjects: ['Mathematics', 'English', 'Biology', 'French'],
  setupCompleted: false,
};

const DEFAULT_PRIVACY_SETTINGS = {
  shareNotesWithAI: true,
  shareProgressWithAI: true,
  shareHistoryWithAI: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  voiceLanguage: 'en-US',
  voicePrefs: DEFAULT_VOICE_PREFERENCES,
  privacy: DEFAULT_PRIVACY_SETTINGS,
  defaultNoteDepth: 'detailed',
  autoScrollKeyboard: true,
  aiProvider: 'auto',
  aiModel: '',
  aiTutor: DEFAULT_AI_TUTOR_SETTINGS,
  reminderPrefs: DEFAULT_REMINDER_PREFERENCES,
};

function createEmptyConversation(subjectFocus?: string): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: subjectFocus ? `${subjectFocus} Study` : 'New Exploration',
    subjectFocus,
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'explore' : 'welcome';
  });

  const [profile, setProfile] = useState<EducationProfile>(() =>
    loadJson<EducationProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadJson<Partial<AppSettings>>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      voicePrefs: {
        ...DEFAULT_VOICE_PREFERENCES,
        ...(loaded.voicePrefs || {}),
      },
      privacy: {
        ...DEFAULT_PRIVACY_SETTINGS,
        ...(loaded.privacy || {}),
      },
      aiTutor: {
        ...DEFAULT_AI_TUTOR_SETTINGS,
        ...(loaded.aiTutor || {}),
      },
      reminderPrefs: {
        ...DEFAULT_REMINDER_PREFERENCES,
        ...(loaded.reminderPrefs || {}),
      },
    };
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadJson<Conversation[]>(STORAGE_KEYS.conversations, []);
    return saved.length > 0 ? saved : [createEmptyConversation()];
  });
  const [activeConversationId, setActiveConversationId] = useState<string>(
    () => conversations[0]?.id || ''
  );

  const [savedNotes, setSavedNotes] = useState<SmartNote[]>(() =>
    loadJson<SmartNote[]>(STORAGE_KEYS.notes, [])
  );
  const [activeNote, setActiveNote] = useState<SmartNote | null>(null);
  const [notesViewMode, setNotesViewMode] = useState<'generate' | 'saved'>('generate');
  const [notePrefill, setNotePrefill] = useState<{ topic: string; subject: string }>({
    topic: '',
    subject: '',
  });

  const [savedQuizzes, setSavedQuizzes] = useState<QuizDefinition[]>(() =>
    loadJson<QuizDefinition[]>(STORAGE_KEYS.quizzes, [])
  );
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() =>
    loadJson<QuizAttempt[]>(STORAGE_KEYS.attempts, [])
  );
  const [quizPrefill, setQuizPrefill] = useState<{ topic: string; subject: string }>({
    topic: '',
    subject: '',
  });
  const [quizAdaptivePrefill, setQuizAdaptivePrefill] = useState<{
    id: string;
    subject: string;
    weakTopics: string[];
  } | null>(null);
  const [quizInitialTab, setQuizInitialTab] = useState<'generate' | 'research' | null>(null);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>(() =>
    loadJson<string[]>(STORAGE_KEYS.dismissedReminders, [])
  );

  const [selectedSubjectWindow, setSelectedSubjectWindow] =
    useState<SubjectItem | null>(null);
  const [subjectSubView, setSubjectSubView] =
    useState<SubjectWindowView>('overview');

  const [sharedPosts, setSharedPosts] = useState<SharedPost[]>(() =>
    loadJson<SharedPost[]>(STORAGE_KEYS.posts, STARTER_COMMUNITY_POSTS)
  );

  const [activePlugins, setActivePlugins] = useState<string[]>(['exam-coach']);
  const [selectedLabModelId, setSelectedLabModelId] = useState<LabModelId | null>(null);
  const [pendingGraphCommand, setPendingGraphCommand] = useState<{
    id: string;
    equations?: string[];
    prompt?: string;
  } | null>(null);
  const [pendingClearChat, setPendingClearChat] = useState<{
    conversationId: string;
    title: string;
  } | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch {
      // ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(savedNotes));
    } catch {
      // ignore
    }
  }, [savedNotes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.quizzes, JSON.stringify(savedQuizzes));
    } catch {
      // ignore
    }
  }, [savedQuizzes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(quizAttempts));
    } catch {
      // ignore
    }
  }, [quizAttempts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.dismissedReminders,
        JSON.stringify(dismissedReminderIds)
      );
    } catch {
      // ignore
    }
  }, [dismissedReminderIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(sharedPosts));
    } catch {
      // ignore
    }
  }, [sharedPosts]);

  const handleSaveProfile = (nextProfile: EducationProfile) => {
    setProfile(nextProfile);
  };

  const handleLogOut = () => {
    setProfile({
      ...DEFAULT_PROFILE,
      mode: 'guest',
      guestConfirmed: false,
    });
  };

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const handleNavigate = (nextScreen: ScreenId) => {
    if (nextScreen === 'setup') {
      setAccountOpen(true);
      return;
    }
    if (nextScreen !== 'subjects') {
      setSelectedSubjectWindow(null);
      setSubjectSubView('overview');
    }
    if (nextScreen === 'notes') {
      setNotePrefill({ topic: '', subject: '' });
    }
    if (nextScreen === 'quizzes') {
      setQuizPrefill({ topic: '', subject: '' });
      setQuizInitialTab(null);
    }
    setScreen(nextScreen);
  };

  const handleOpenRecommendedLab = (rec: LabRecommendation) => {
    setSelectedLabModelId(rec.modelId);
    setSelectedSubjectWindow(null);
    setSubjectSubView('overview');
    setScreen('lab');
  };

  const handleTogglePlugin = (pluginId: string) => {
    setActivePlugins((prev) =>
      prev.includes(pluginId) ? prev.filter((id) => id !== pluginId) : [...prev, pluginId]
    );
  };

  const handleNewChat = () => {
    const next = createEmptyConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveConversationId(next.id);
    setSelectedSubjectWindow(null);
    setSubjectSubView('overview');
    handleNavigate('explore');
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fresh = createEmptyConversation();
        setActiveConversationId(fresh.id);
        return [fresh];
      }
      if (id === activeConversationId) {
        setActiveConversationId(filtered[0].id);
      }
      return filtered;
    });
  };

  const buildLearnerContext = (subjectOverride?: string): string => {
    const parts: string[] = [];
    const privacy = settings.privacy || DEFAULT_PRIVACY_SETTINGS;

    if (privacy.shareProgressWithAI) {
      const perf = analyzePerformance(quizAttempts);
      if (perf.totalAttempts > 0) {
        const weak = perf.subjectSummaries
          .flatMap((s) => s.weakestTopics.map((w) => `${s.subject} (${w.topic}: ${w.accuracy}%)`))
          .slice(0, 3);
        if (weak.length > 0) {
          parts.push(`Weak topics from recent quizzes: ${weak.join(', ')}`);
        }
      }
    }

    if (privacy.shareNotesWithAI) {
      const recentNotes = savedNotes
        .filter((n) => !subjectOverride || n.subject.toLowerCase() === subjectOverride.toLowerCase())
        .slice(0, 2);
      if (recentNotes.length > 0) {
        parts.push(
          `Learner saved Smart Notes: ${recentNotes
            .map((n) => `${n.title} (${n.subject})`)
            .join('; ')}`
        );
      }
    }

    if (privacy.shareHistoryWithAI) {
      const convSubjectById = new Map(
        conversations.map((c) => [c.id, (c.subjectFocus || '').toLowerCase()])
      );
      const taught = extractTaughtTopics(conversations)
        .filter(
          (t) =>
            !subjectOverride ||
            convSubjectById.get(t.conversationId) === subjectOverride.toLowerCase()
        )
        .slice(0, 4);
      if (taught.length > 0) {
        parts.push(`Recent Explore study topics: ${taught.map((t) => t.topic).join(', ')}`);
      }
    }

    return parts.join(' | ');
  };

  const handleCancelChatRequest = () => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort('user-cancelled');
      chatAbortRef.current = null;
    }
    setIsSending(false);
  };

  const sendExploreMessage = async (
    text: string,
    images: AttachmentImage[],
    subjectOverride?: string,
    targetConvId?: string,
    strictScope = false
  ) => {
    let convId = targetConvId || activeConversation.id;
    let currentConv = conversations.find((c) => c.id === convId) || activeConversation;

    if (subjectOverride && strictScope && !targetConvId) {
      const existingScoped = conversations.find(
        (c) => c.subjectFocus?.toLowerCase() === subjectOverride.toLowerCase()
      );
      if (existingScoped) {
        convId = existingScoped.id;
        currentConv = existingScoped;
      } else {
        const created = createEmptyConversation(subjectOverride);
        convId = created.id;
        currentConv = created;
        setConversations((prev) => [created, ...prev]);
      }
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: text || 'Analyze attached image(s)',
      createdAt: Date.now(),
      images: images.length > 0 ? images : undefined,
    };

    const nextTitle =
      currentConv.messages.length === 0
        ? (text || 'Image Study Question').slice(0, 46)
        : currentConv.title;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: nextTitle,
              subjectFocus: subjectOverride || c.subjectFocus,
              updatedAt: Date.now(),
              messages: [...c.messages, userMsg],
            }
          : c
      )
    );

    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort('timeout'), 85000);

    setIsSending(true);
    const activePluginLabels = activePlugins
      .map((id) => EXPLORE_PLUGINS.find((p) => p.id === id)?.label)
      .filter((lbl): lbl is string => Boolean(lbl));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: currentConv.messages.map((m) => ({ role: m.role, text: m.text })),
          images: images.map((img) => ({
            mimeType: img.mimeType,
            base64Data: img.base64Data,
          })),
          plugins: activePluginLabels,
          profile,
          aiSettings: settings.aiTutor,
          aiSelection: {
            providerId: settings.aiProvider || 'auto',
            modelId: settings.aiModel || undefined,
          },
          subjectFocus: subjectOverride || currentConv.subjectFocus,
          strictScope,
          learnerContext: buildLearnerContext(subjectOverride || currentConv.subjectFocus),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach ALEXYN AI tutor.');
      }

      const recommendedLab =
        detectRecommendedLab(
          `${text} ${data.reply}`,
          subjectOverride || currentConv.subjectFocus
        ) || undefined;

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        text: data.reply,
        createdAt: Date.now(),
        pluginsUsed: activePluginLabels,
        providerUsed: typeof data.provider === 'string' ? data.provider : undefined,
        modelUsed: typeof data.model === 'string' ? data.model : undefined,
        visionNote: typeof data.visionNote === 'string' ? data.visionNote : undefined,
        appActions: Array.isArray(data.appActions) ? data.appActions : undefined,
        recommendedLab,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, aiMsg] }
            : c
        )
      );
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      const reason = controller.signal.reason;
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        text:
          isAbort && reason === 'user-cancelled'
            ? 'Stopped generating response.'
            : isAbort
            ? 'Request timed out waiting for the AI model. Try again or switch to a faster model.'
            : err instanceof Error
            ? err.message
            : 'Connection error while contacting ALEXYN AI tutor.',
        createdAt: Date.now(),
        error: !(isAbort && reason === 'user-cancelled'),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, errMsg] }
            : c
        )
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
      setIsSending(false);
    }
  };

  const handleSaveNoteToLibrary = (note: SmartNote) => {
    const finalized: SmartNote = { ...note, savedToLibrary: true, updatedAt: Date.now() };
    setSavedNotes((prev) => {
      const exists = prev.some((n) => n.id === finalized.id);
      if (exists) {
        return prev.map((n) => (n.id === finalized.id ? finalized : n));
      }
      return [finalized, ...prev];
    });
  };

  const handleUpdateSavedNote = (note: SmartNote) => {
    setSavedNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
  };

  const handleDeleteSavedNote = (noteId: string) => {
    setSavedNotes((prev) => prev.filter((n) => n.id !== noteId));
    setActiveNote((curr) => (curr?.id === noteId ? null : curr));
  };

  const handleJumpToSmartNotes = (topic: string, subject = '') => {
    setNotePrefill({ topic, subject });
    setActiveNote(null);
    setNotesViewMode('generate');
    setSelectedSubjectWindow(null);
    setSubjectSubView('overview');
    setScreen('notes');
  };

  const handleJumpToQuizzesForTopic = (topic: string, subject: string) => {
    setQuizPrefill({ topic, subject });
    setQuizInitialTab('generate');
    setSelectedSubjectWindow(null);
    setSubjectSubView('overview');
    setScreen('quizzes');
  };

  const handleStartAdaptivePractice = (subject: string, weakTopics: string[]) => {
    setQuizAdaptivePrefill({
      id: `adap-${Date.now()}`,
      subject,
      weakTopics,
    });
    setQuizInitialTab('generate');
    setSelectedSubjectWindow(null);
    setSubjectSubView('overview');
    setScreen('quizzes');
  };

  const handleExecuteAppAction = (action: AppControlAction) => {
    const payload = action.payload || {};
    switch (action.type) {
      case 'navigate_screen': {
        const target = String(payload.screen || 'explore') as ScreenId;
        if (target === 'notes') setNotesViewMode('generate');
        handleNavigate(target);
        break;
      }
      case 'open_practice_lab': {
        const requestedModel = payload.modelId ? String(payload.modelId) as LabModelId : null;
        const topicHint = String(payload.topic || payload.subject || '').toLowerCase();
        const inferredModel: LabModelId =
          requestedModel ||
          (topicHint.includes('step') || topicHint.includes('equation') || topicHint.includes('algebra')
            ? 'math-working'
            : topicHint.includes('graph')
            ? 'math-graph'
            : topicHint.includes('histor') || topicHint.includes('timeline')
            ? 'humanities-timeline'
            : 'math-shapes');
        setSelectedLabModelId(inferredModel);
        setSelectedSubjectWindow(null);
        setSubjectSubView('overview');
        setScreen('lab');
        break;
      }
      case 'plot_math_graph': {
        const equations = Array.isArray(payload.equations)
          ? payload.equations.map((e) => String(e))
          : payload.equation
          ? [String(payload.equation)]
          : undefined;
        setPendingGraphCommand({
          id: `graph-${Date.now()}`,
          equations,
          prompt: payload.prompt ? String(payload.prompt) : undefined,
        });
        setSelectedLabModelId('math-graph');
        setSelectedSubjectWindow(null);
        setSubjectSubView('overview');
        setScreen('lab');
        break;
      }
      case 'open_note': {
        const noteId = payload.noteId ? String(payload.noteId) : '';
        const titleHint = String(payload.title || payload.topic || '').toLowerCase();
        const found =
          savedNotes.find((n) => n.id === noteId) ||
          savedNotes.find(
            (n) =>
              titleHint &&
              (n.title.toLowerCase().includes(titleHint) ||
                (n.topic || '').toLowerCase().includes(titleHint))
          ) ||
          null;
        setActiveNote(found);
        setNotesViewMode('saved');
        setSelectedSubjectWindow(null);
        setSubjectSubView('overview');
        setScreen('notes');
        break;
      }
      case 'generate_notes': {
        handleJumpToSmartNotes(
          String(payload.topic || payload.title || ''),
          String(payload.subject || '')
        );
        break;
      }
      case 'create_quiz': {
        handleJumpToQuizzesForTopic(
          String(payload.topic || ''),
          String(payload.subject || profile.subjects[0] || 'Mathematics')
        );
        break;
      }
      case 'search_exams': {
        setQuizPrefill({
          topic: String(payload.topic || payload.query || ''),
          subject: String(payload.subject || profile.subjects[0] || ''),
        });
        setQuizInitialTab('research');
        setSelectedSubjectWindow(null);
        setSubjectSubView('overview');
        setScreen('quizzes');
        break;
      }
      case 'clear_chat': {
        setPendingClearChat({
          conversationId: activeConversation.id,
          title: activeConversation.title,
        });
        break;
      }
    }
  };

  const handleSaveQuiz = (quiz: QuizDefinition) => {
    setSavedQuizzes((prev) => {
      const exists = prev.some((q) => q.id === quiz.id);
      if (exists) return prev.map((q) => (q.id === quiz.id ? quiz : q));
      return [quiz, ...prev];
    });
  };

  const handleDeleteQuiz = (quizId: string) => {
    setSavedQuizzes((prev) => prev.filter((q) => q.id !== quizId));
  };

  const handleRecordQuizAttempt = (attempt: QuizAttempt) => {
    setQuizAttempts((prev) => [...prev, attempt]);
  };

  const handleUpdateReminderPrefs = (nextPrefs: ReminderPreferences) => {
    setSettings((prev) => ({ ...prev, reminderPrefs: nextPrefs }));
  };

  const handleDismissReminder = (id: string) => {
    setDismissedReminderIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleCreatePost = (postData: Omit<SharedPost, 'id' | 'likes' | 'createdAt'>) => {
    const newPost: SharedPost = {
      ...postData,
      id: `post-${Date.now()}`,
      likes: 1,
      likedByMe: true,
      createdAt: Date.now(),
    };
    setSharedPosts((prev) => [newPost, ...prev]);
  };

  const handleLikePost = (id: string) => {
    setSharedPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likes: p.likedByMe ? Math.max(0, p.likes - 1) : p.likes + 1,
            }
          : p
      )
    );
  };

  const handleBookmarkPost = (id: string) => {
    setSharedPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, bookmarked: !p.bookmarked } : p))
    );
  };

  const handleShareNoteToCommunity = (note: SmartNote) => {
    const trickBody =
      note.memoryTricks[0] ||
      note.funnyExamples[0] ||
      note.sections[0]?.content.slice(0, 240) ||
      note.overview;

    handleCreatePost({
      author: profile.name.trim() || 'Guest Learner',
      authorRole: profile.grade || profile.curriculum || 'Smart Notes',
      subject: note.subject,
      kind: note.memoryTricks.length > 0 ? 'Memory Trick' : 'Quick Note',
      title: note.title,
      body: trickBody,
    });
  };

  const screenTitleMap: Record<ScreenId, string> = {
    welcome: 'ALEXYN',
    explore: 'EXPLORE',
    subjects: selectedSubjectWindow ? selectedSubjectWindow.name.toUpperCase() : 'SUBJECTS',
    quizzes: 'QUIZZES',
    notes: 'SMART NOTES',
    lab: 'PRACTICE AREA',
    progress: 'PROGRESS',
    share: 'SHARE SPACE',
    setup: 'ACCOUNT',
  };

  const overallPerf = analyzePerformance(quizAttempts);
  const progressSummary = {
    overallAverage: overallPerf.overallAverage,
    totalAttempts: overallPerf.totalAttempts,
  };

  const showBottomNav = !(screen === 'subjects' && selectedSubjectWindow !== null);

  const showTopLeftDrawer =
    selectedSubjectWindow === null ||
    subjectSubView === 'explore' ||
    subjectSubView === 'lab';

  const currentAiSelection: AISelection = {
    providerId: settings.aiProvider || 'auto',
    modelId: settings.aiModel || undefined,
  };

  const handleUpdateAiSelection = (next: AISelection) => {
    setSettings((prev) => ({
      ...prev,
      aiProvider: next.providerId || 'auto',
      aiModel: next.modelId || '',
    }));
  };

  return (
    <div className="min-h-screen bg-[#040A1A] text-[#F4F7FF]">
      {screen === 'welcome' ? (
        <WelcomeScreen
          profile={profile}
          onExplore={() => handleNavigate('explore')}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenAccount={() => setAccountOpen(true)}
        />
      ) : (
        <>
          <TopBar
            title={screenTitleMap[screen]}
            showDrawer={showTopLeftDrawer}
            showBack={screen === 'subjects' && selectedSubjectWindow !== null}
            onBack={() => {
              if (subjectSubView !== 'overview') {
                setSubjectSubView('overview');
              } else {
                setSelectedSubjectWindow(null);
              }
            }}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAccount={() => setAccountOpen(true)}
            profile={profile}
            onGoHome={() => handleNavigate('explore')}
          />

          {screen === 'explore' && (
            <ExploreScreen
              conversation={activeConversation}
              activePlugins={activePlugins}
              onTogglePlugin={handleTogglePlugin}
              onSendMessage={(txt, imgs) => sendExploreMessage(txt, imgs)}
              onCancelRequest={handleCancelChatRequest}
              isSending={isSending}
              onMakeSmartNotes={handleJumpToSmartNotes}
              onOpenRecommendedLab={handleOpenRecommendedLab}
              onExecuteAppAction={handleExecuteAppAction}
              voiceLanguage={settings.voiceLanguage}
              voicePrefs={settings.voicePrefs}
              autoScrollKeyboard={settings.autoScrollKeyboard}
              progressSummary={progressSummary}
              onOpenProgress={() => handleNavigate('progress')}
              aiSelection={currentAiSelection}
              onChangeAiSelection={handleUpdateAiSelection}
            />
          )}

          {screen === 'subjects' && (
            <SubjectsScreen
              profile={profile}
              aiSettings={settings.aiTutor}
              aiSelection={currentAiSelection}
              onChangeAiSelection={handleUpdateAiSelection}
              initialLabModelId={selectedLabModelId}
              onOpenRecommendedLab={handleOpenRecommendedLab}
              selectedSubjectWindow={selectedSubjectWindow}
              onSelectSubjectWindow={(subj) => {
                setSelectedSubjectWindow(subj);
                setSubjectSubView('overview');
              }}
              subView={subjectSubView}
              onChangeSubView={setSubjectSubView}
              conversations={conversations}
              activePlugins={activePlugins}
              onTogglePlugin={handleTogglePlugin}
              onSendScopedExplore={(txt, imgs, subjName, strict) =>
                sendExploreMessage(txt, imgs, subjName, undefined, strict)
              }
              onCancelExploreRequest={handleCancelChatRequest}
              onExecuteAppAction={handleExecuteAppAction}
              isSendingExplore={isSending}
              savedNotes={savedNotes}
              activeNote={activeNote}
              onSetActiveNote={setActiveNote}
              onSaveNoteToLibrary={handleSaveNoteToLibrary}
              onUpdateSavedNote={handleUpdateSavedNote}
              onDeleteSavedNote={handleDeleteSavedNote}
              onShareNoteToCommunity={handleShareNoteToCommunity}
              savedQuizzes={savedQuizzes}
              onSaveQuiz={handleSaveQuiz}
              onDeleteQuiz={handleDeleteQuiz}
              quizAttempts={quizAttempts}
              onRecordQuizAttempt={handleRecordQuizAttempt}
              reminderPrefs={settings.reminderPrefs || DEFAULT_REMINDER_PREFERENCES}
              onUpdateReminderPrefs={handleUpdateReminderPrefs}
              dismissedReminderIds={dismissedReminderIds}
              onDismissReminder={handleDismissReminder}
              defaultNoteDepth={settings.defaultNoteDepth}
              voiceLanguage={settings.voiceLanguage}
              voicePrefs={settings.voicePrefs}
              autoScrollKeyboard={settings.autoScrollKeyboard}
              onOpenAccountModal={() => setAccountOpen(true)}
            />
          )}

          {screen === 'quizzes' && (
            <QuizzesScreen
              key={`${quizPrefill.topic}-${quizPrefill.subject}-${quizInitialTab || 'default'}`}
              profile={profile}
              aiSelection={currentAiSelection}
              voicePrefs={settings.voicePrefs}
              savedQuizzes={savedQuizzes}
              onSaveQuiz={handleSaveQuiz}
              onDeleteQuiz={handleDeleteQuiz}
              onRecordAttempt={handleRecordQuizAttempt}
              recentAttempts={quizAttempts}
              initialTopic={quizPrefill.topic}
              initialSubject={quizPrefill.subject}
              initialTab={quizInitialTab || undefined}
              adaptivePrefill={quizAdaptivePrefill}
              onConsumeAdaptivePrefill={() => setQuizAdaptivePrefill(null)}
              onMakeSmartNotes={handleJumpToSmartNotes}
            />
          )}

          {screen === 'notes' && (
            <SmartNotesScreen
              key={`${notePrefill.topic}-${notePrefill.subject}-${notesViewMode}`}
              profile={profile}
              aiSelection={currentAiSelection}
              voicePrefs={settings.voicePrefs}
              conversations={conversations}
              savedNotes={savedNotes}
              activeNote={activeNote}
              onSetActiveNote={setActiveNote}
              onSaveNoteToLibrary={handleSaveNoteToLibrary}
              onUpdateSavedNote={handleUpdateSavedNote}
              onDeleteSavedNote={handleDeleteSavedNote}
              onShareNoteToCommunity={handleShareNoteToCommunity}
              initialTopic={notePrefill.topic}
              initialSubject={notePrefill.subject}
              initialViewMode={notesViewMode}
              defaultDetailLevel={settings.defaultNoteDepth}
            />
          )}

          {screen === 'lab' && (
            <Lab3DScreen
              profile={profile}
              aiSettings={settings.aiTutor}
              aiSelection={currentAiSelection}
              voicePrefs={settings.voicePrefs}
              initialModelId={selectedLabModelId}
              pendingGraphCommand={pendingGraphCommand}
              onConsumeGraphCommand={() => setPendingGraphCommand(null)}
              onMakeLabNotes={handleJumpToSmartNotes}
            />
          )}

          {screen === 'progress' && (
            <ProgressScreen
              profile={profile}
              aiSelection={currentAiSelection}
              attempts={quizAttempts}
              reminderPrefs={settings.reminderPrefs || DEFAULT_REMINDER_PREFERENCES}
              onUpdateReminderPrefs={handleUpdateReminderPrefs}
              dismissedReminderIds={dismissedReminderIds}
              onDismissReminder={handleDismissReminder}
              onStartQuizForTopic={handleJumpToQuizzesForTopic}
              onStartAdaptivePractice={handleStartAdaptivePractice}
              onOpenNotesForTopic={handleJumpToSmartNotes}
              onGoToQuizzes={() => handleNavigate('quizzes')}
            />
          )}

          {screen === 'share' && (
            <ShareScreen
              profile={profile}
              posts={sharedPosts}
              onCreatePost={handleCreatePost}
              onLikePost={handleLikePost}
              onBookmarkPost={handleBookmarkPost}
              onMakeNotesFromPost={handleJumpToSmartNotes}
            />
          )}

          {showBottomNav && (
            <BottomNav activeScreen={screen} onNavigate={handleNavigate} />
          )}
        </>
      )}

      <LeftDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversation.id}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          handleNavigate('explore');
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        savedNotes={savedNotes}
        onOpenSavedNote={(note) => {
          setActiveNote(note);
          setNotesViewMode('saved');
          setSelectedSubjectWindow(null);
          setSubjectSubView('overview');
          setScreen('notes');
        }}
        onOpenSavedNotesLibrary={() => {
          setActiveNote(null);
          setNotesViewMode('saved');
          setSelectedSubjectWindow(null);
          setSubjectSubView('overview');
          setScreen('notes');
        }}
        bookmarkedPosts={sharedPosts.filter((p) => p.bookmarked)}
        onNavigate={(s) => {
          if (s === 'notes') setNotesViewMode('generate');
          handleNavigate(s);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        onLogOutAccount={handleLogOut}
        onOpenProgress={() => handleNavigate('progress')}
        progressSummary={progressSummary}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onClearGuestCache={() => {
          handleLogOut();
          setSettingsOpen(false);
        }}
        onOpenProgress={() => handleNavigate('progress')}
        progressSummary={progressSummary}
      />

      {pendingClearChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm clearing conversation"
        >
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0B1533] p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Clear Current Conversation?</h2>
            <p className="text-xs leading-relaxed text-slate-300">
              You asked ALEXYN to clear "{pendingClearChat.title}". This removes messages in the active chat thread while keeping your saved Smart Notes and Quizzes intact.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingClearChat(null)}
                className="rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = pendingClearChat.conversationId;
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === targetId ? { ...c, messages: [], updatedAt: Date.now() } : c
                    )
                  );
                  setPendingClearChat(null);
                }}
                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400"
              >
                Confirm Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
