import {
  Bookmark,
  BookOpen,
  ClipboardCheck,
  Compass,
  Download,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Settings,
  Share2,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AlexynLogo } from './AlexynLogo';
import type { Conversation, ScreenId, SharedPost, SmartNote } from '../types/alexyn';

interface LeftDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  savedNotes: SmartNote[];
  onOpenSavedNote: (note: SmartNote) => void;
  onOpenSavedNotesLibrary: () => void;
  bookmarkedPosts: SharedPost[];
  onNavigate: (screen: ScreenId) => void;
  onOpenSettings: () => void;
}

export function LeftDrawer({
  open,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  savedNotes,
  onOpenSavedNote,
  onOpenSavedNotesLibrary,
  bookmarkedPosts,
  onNavigate,
  onOpenSettings,
}: LeftDrawerProps) {
  if (!open) return null;

  const recentAttachments = conversations
    .flatMap((c) => c.messages.flatMap((m) => m.images || []))
    .slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Conversations and Library"
        className="relative z-10 flex h-full w-[86%] max-w-xs flex-col border-r border-[var(--alexyn-border)] bg-[#070F24] text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--alexyn-border)] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <AlexynLogo size="sm" />
            <span className="text-sm font-extrabold tracking-[0.18em] text-white">
              ALEXYN
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-[#111F44] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 p-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            <span>New Exploration</span>
          </button>

          <a
            href="/alexyn-pocketcode.html"
            download="alexyn-pocketcode.html"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0D1A3D] px-3 py-2 text-xs font-semibold text-[#7DD3FC] hover:border-[#2E8BFF] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Pocket Code (HTML + JS)</span>
          </a>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          <div>
            <p className="mb-2 px-2 text-xs font-semibold text-slate-400">
              Quick Spaces
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onNavigate('subjects');
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <Compass className="h-4 w-4 text-[#38BDF8]" />
                <span>Subjects & Languages</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('quizzes');
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <ClipboardCheck className="h-4 w-4 text-[#38BDF8]" />
                <span>Quizzes & Assessments</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenSavedNotesLibrary();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <BookOpen className="h-4 w-4 text-[#5EEAD4]" />
                <span>My Saved Smart Notes ({savedNotes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('progress');
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <TrendingUp className="h-4 w-4 text-[#5EEAD4]" />
                <span>Progress & Reminders</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate('share');
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <Share2 className="h-4 w-4 text-[#38BDF8]" />
                <span>Share & Community Drops</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-[#111F44]"
              >
                <Settings className="h-4 w-4 text-[#5EEAD4]" />
                <span>App Settings</span>
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 px-2 text-xs font-semibold text-slate-400">
              Conversations ({conversations.length})
            </p>
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 ${
                      isActive ? 'bg-[#122249] text-white' : 'text-slate-300 hover:bg-[#0D1836]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left text-sm"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-[#60A5FA]" />
                      <span className="truncate">{conv.title}</span>
                    </button>
                    {conversations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        aria-label={`Delete conversation ${conv.title}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-xs font-semibold text-slate-400">
                Library · Saved Smart Notes ({savedNotes.length})
              </p>
              {savedNotes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSavedNotesLibrary();
                    onClose();
                  }}
                  className="text-[11px] font-semibold text-[#5EEAD4] hover:underline"
                >
                  Open All
                </button>
              )}
            </div>
            {savedNotes.length === 0 ? (
              <p className="px-2 text-xs text-slate-500">
                Drafts you explicitly save appear here.
              </p>
            ) : (
              <div className="space-y-1">
                {savedNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      onOpenSavedNote(note);
                      onClose();
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-[#0D1836]"
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#5EEAD4]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {note.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {note.subject} · {note.detailLevel === 'detailed' ? 'Detailed' : 'Short'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {bookmarkedPosts.length > 0 && (
            <div>
              <p className="mb-2 px-2 text-xs font-semibold text-slate-400">
                Library · Bookmarked Drops ({bookmarkedPosts.length})
              </p>
              <div className="space-y-1">
                {bookmarkedPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      onNavigate('share');
                      onClose();
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-[#0D1836]"
                  >
                    <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-200">{post.title}</p>
                      <p className="text-xs text-slate-400">
                        {post.subject} · {post.author}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentAttachments.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-400">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Library · Study Images ({recentAttachments.length})</span>
              </p>
              <div className="grid grid-cols-3 gap-2 px-2">
                {recentAttachments.map((img) => (
                  <img
                    key={img.id}
                    src={img.previewUrl}
                    alt={img.name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-full rounded-lg border border-[var(--alexyn-border)] object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
