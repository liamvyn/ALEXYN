import { useEffect, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { BottomNav } from './components/BottomNav';
import { ExploreScreen } from './components/ExploreScreen';
import { Lab3DScreen } from './components/Lab3DScreen';
import { LeftDrawer } from './components/LeftDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ShareScreen } from './components/ShareScreen';
import { SmartNotesScreen } from './components/SmartNotesScreen';
import { SubjectsScreen } from './components/SubjectsScreen';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { EXPLORE_PLUGINS, STARTER_COMMUNITY_POSTS } from './data/curriculum';
import type {
  AppSettings,
  AttachmentImage,
  ChatMessage,
  Conversation,
  EducationProfile,
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
};

function getProgressKeyForProfile(profile: EducationProfile): string | null {
  if (profile.mode !== 'signed-in' || !profile.email.trim()) return null;
  return `alexyn_progress_${profile.email.trim().toLowerCase()}`;
}

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

const DEFAULT_SETTINGS: AppSettings = {
  voiceLanguage: 'en-US',
  defaultNoteDepth: 'detailed',
  autoScrollKeyboard: true,
  pocketCodeServerUrl:
    typeof window !== 'undefined' ? window.location.origin : '',
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

  const [settings, setSettings] = useState<AppSettings>(() =>
    loadJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );

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
  const [notePrefill, setNotePrefill] = useState<{ topic: string; subject: string }>({
    topic: '',
    subject: '',
  });

  const [selectedSubjectWindow, setSelectedSubjectWindow] =
    useState<SubjectItem | null>(null);
  const [subjectSubView, setSubjectSubView] =
    useState<SubjectWindowView>('overview');
  const [subjectProgress, setSubjectProgress] = useState<Record<string, string[]>>(() => {
    const pKey = getProgressKeyForProfile(
      loadJson<EducationProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
    );
    return pKey ? loadJson<Record<string, string[]>>(pKey, {}) : {};
  });

  const [sharedPosts, setSharedPosts] = useState<SharedPost[]>(() =>
    loadJson<SharedPost[]>(STORAGE_KEYS.posts, STARTER_COMMUNITY_POSTS)
  );

  const [activePlugins, setActivePlugins] = useState<string[]>(['exam-coach']);
  const [isSending, setIsSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch {
      // ignore
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
      localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(sharedPosts));
    } catch {
      // ignore
    }
  }, [sharedPosts]);

  // Persist subject progress ONLY when user is signed in
  useEffect(() => {
    const pKey = getProgressKeyForProfile(profile);
    if (!pKey) return;
    try {
      localStorage.setItem(pKey, JSON.stringify(subjectProgress));
    } catch {
      // ignore
    }
  }, [subjectProgress, profile]);

  const handleSaveProfile = (nextProfile: EducationProfile) => {
    const prevKey = getProgressKeyForProfile(profile);
    const nextKey = getProgressKeyForProfile(nextProfile);
    if (!prevKey && nextKey) {
      // Switching/creating signed-in account saves existing session progress or loads stored
      const stored = loadJson<Record<string, string[]>>(nextKey, {});
      setSubjectProgress((current) => ({ ...stored, ...current }));
    } else if (nextKey && prevKey !== nextKey) {
      setSubjectProgress(loadJson<Record<string, string[]>>(nextKey, {}));
    }
    setProfile(nextProfile);
  };

  const handleLogOut = () => {
    setProfile({
      ...DEFAULT_PROFILE,
      mode: 'guest',
      guestConfirmed: false,
    });
    setSubjectProgress({});
  };

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const handleNavigate = (nextScreen: ScreenId) => {
    if (nextScreen !== 'subjects') {
      setSelectedSubjectWindow(null);
      setSubjectSubView('overview');
    }
    setScreen(nextScreen);
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

    setIsSending(true);
    const activePluginLabels = activePlugins
      .map((id) => EXPLORE_PLUGINS.find((p) => p.id === id)?.label)
      .filter((lbl): lbl is string => Boolean(lbl));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(16000),
        body: JSON.stringify({
          message: text,
          history: currentConv.messages.map((m) => ({ role: m.role, text: m.text })),
          images: images.map((img) => ({
            mimeType: img.mimeType,
            base64Data: img.base64Data,
          })),
          plugins: activePluginLabels,
          profile,
          subjectFocus: subjectOverride || currentConv.subjectFocus,
          strictScope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach ALEXYN AI tutor.');
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        text: data.reply,
        createdAt: Date.now(),
        pluginsUsed: activePluginLabels,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, aiMsg] }
            : c
        )
      );
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        text:
          err instanceof Error
            ? err.message
            : 'Connection error while contacting ALEXYN AI tutor.',
        createdAt: Date.now(),
        error: true,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, errMsg] }
            : c
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNoteToLibrary = (note: SmartNote) => {
    setSavedNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id);
      if (exists) {
        return prev.map((n) => (n.id === note.id ? note : n));
      }
      return [note, ...prev];
    });
  };

  const handleJumpToSmartNotes = (topic: string, subject = '') => {
    setNotePrefill({ topic, subject });
    setActiveNote(null);
    handleNavigate('notes');
  };

  const handleToggleTopicComplete = (subjectId: string, topicTitle: string) => {
    setSubjectProgress((prev) => {
      const current = prev[subjectId] || [];
      const next = current.includes(topicTitle)
        ? current.filter((t) => t !== topicTitle)
        : [...current, topicTitle];
      return { ...prev, [subjectId]: next };
    });
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
    notes: 'SMART NOTES',
    lab: '3D LAB',
    share: 'SHARE SPACE',
    setup: 'ACCOUNT',
  };

  // Bottom navigation hides when inside a Subject Workspace Window (or its scoped Explore/Notes/3D Lab)
  const showBottomNav = !(screen === 'subjects' && selectedSubjectWindow !== null);

  // Top-left conversation drawer is shown ONLY in screens where user talks to the AI
  const showTopLeftDrawer =
    screen === 'explore' ||
    screen === 'lab' ||
    (screen === 'subjects' &&
      selectedSubjectWindow !== null &&
      (subjectSubView === 'explore' || subjectSubView === 'lab'));

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
              isSending={isSending}
              onMakeSmartNotes={handleJumpToSmartNotes}
              voiceLanguage={settings.voiceLanguage}
              autoScrollKeyboard={settings.autoScrollKeyboard}
            />
          )}

          {screen === 'subjects' && (
            <SubjectsScreen
              profile={profile}
              selectedSubjectWindow={selectedSubjectWindow}
              onSelectSubjectWindow={(subj) => {
                setSelectedSubjectWindow(subj);
                setSubjectSubView('overview');
              }}
              subView={subjectSubView}
              onChangeSubView={setSubjectSubView}
              subjectProgress={subjectProgress}
              onToggleTopicComplete={handleToggleTopicComplete}
              conversations={conversations}
              activePlugins={activePlugins}
              onTogglePlugin={handleTogglePlugin}
              onSendScopedExplore={(txt, imgs, subjName, strict) =>
                sendExploreMessage(txt, imgs, subjName, undefined, strict)
              }
              isSendingExplore={isSending}
              activeNote={activeNote}
              onSetActiveNote={setActiveNote}
              onSaveNoteToLibrary={handleSaveNoteToLibrary}
              onShareNoteToCommunity={handleShareNoteToCommunity}
              defaultNoteDepth={settings.defaultNoteDepth}
              voiceLanguage={settings.voiceLanguage}
              autoScrollKeyboard={settings.autoScrollKeyboard}
              onOpenAccountModal={() => setAccountOpen(true)}
            />
          )}

          {screen === 'notes' && (
            <SmartNotesScreen
              key={`${notePrefill.topic}-${notePrefill.subject}`}
              profile={profile}
              conversations={conversations}
              activeNote={activeNote}
              onSetActiveNote={setActiveNote}
              onSaveNoteToLibrary={handleSaveNoteToLibrary}
              onShareNoteToCommunity={handleShareNoteToCommunity}
              initialTopic={notePrefill.topic}
              initialSubject={notePrefill.subject}
              defaultDetailLevel={settings.defaultNoteDepth}
            />
          )}

          {screen === 'lab' && (
            <Lab3DScreen
              profile={profile}
              onMakeLabNotes={handleJumpToSmartNotes}
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
          handleNavigate('notes');
        }}
        bookmarkedPosts={sharedPosts.filter((p) => p.bookmarked)}
        onNavigate={handleNavigate}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        onLogOutAccount={handleLogOut}
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
      />
    </div>
  );
}
