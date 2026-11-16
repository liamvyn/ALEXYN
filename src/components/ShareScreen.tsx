import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Bookmark,
  BookOpen,
  Heart,
  ImagePlus,
  Plus,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import { filterCommunityPosts } from '../utils/alexynLogic';
import type { EducationProfile, SharedPost } from '../types/alexyn';

interface ShareScreenProps {
  profile: EducationProfile;
  posts: SharedPost[];
  onCreatePost: (postData: Omit<SharedPost, 'id' | 'likes' | 'createdAt'>) => void;
  onLikePost: (id: string) => void;
  onBookmarkPost: (id: string) => void;
  onMakeNotesFromPost: (topic: string, subject?: string) => void;
}

const POST_KINDS: SharedPost['kind'][] = [
  'Memory Trick',
  'Quick Note',
  'Exam Tip',
  'Sketch / Formula',
];

export function ShareScreen({
  profile,
  posts,
  onCreatePost,
  onLikePost,
  onBookmarkPost,
  onMakeNotesFromPost,
}: ShareScreenProps) {
  const allSubjectNames = useMemo(
    () => [
      ...CORE_SUBJECTS.map((s) => s.name),
      ...LANGUAGE_SUBJECTS.map((s) => s.name),
    ],
    []
  );

  const [subjectFilter, setSubjectFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(profile.subjects[0] || 'Biology');
  const [kind, setKind] = useState<SharedPost['kind']>('Memory Trick');
  const [body, setBody] = useState('');
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState('');

  const filteredPosts = useMemo(() => {
    const base = filterCommunityPosts(posts, subjectFilter, searchQuery);
    return showBookmarkedOnly ? base.filter((p) => p.bookmarked) : base;
  }, [posts, subjectFilter, searchQuery, showBookmarkedOnly]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError('Please add both a short title and your study trick or note.');
      return;
    }
    onCreatePost({
      author: profile.name.trim() || 'Guest Learner',
      authorRole: profile.grade || profile.curriculum || 'Learner',
      subject,
      kind,
      title: title.trim(),
      body: body.trim(),
      imagePreview,
    });
    setTitle('');
    setBody('');
    setImagePreview(undefined);
    setFormError('');
    setComposerOpen(false);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-24 pt-5 md:px-8">
      <section className="rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0B1739] via-[#091330] to-[#0D1A40] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[#5EEAD4]">
              <Share2 className="h-4 w-4" />
              <span>COMMUNITY STUDY DROPS</span>
            </div>
            <h1 className="text-xl font-extrabold text-white sm:text-2xl">
              Share &amp; Discover Study Tricks
            </h1>
            <p className="max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              Post memorable analogies, exam tips, and formula sketches—or turn any drop into customizable Smart Notes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-opacity hover:opacity-95 sm:text-sm"
          >
            {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{composerOpen ? 'Close Composer' : 'Share a Study Drop'}</span>
          </button>
        </div>

        {composerOpen && (
          <form
            onSubmit={handleSubmit}
            className="mt-5 space-y-3.5 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="shareTitle">
                  Title
                </label>
                <input
                  id="shareTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Quick trick to remember Redox (OIL RIG)"
                  className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0B1636] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="shareSubject">
                    Subject
                  </label>
                  <select
                    id="shareSubject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0B1636] px-3 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                  >
                    {allSubjectNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="shareKind">
                    Drop Type
                  </label>
                  <select
                    id="shareKind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as SharedPost['kind'])}
                    className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0B1636] px-3 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
                  >
                    {POST_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="shareBody">
                Your Explanation / Trick
              </label>
              <textarea
                id="shareBody"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a clear explanation, mnemonic, or exam reminder that helps others understand instead of cramming..."
                className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0B1636] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0B1636] px-3 py-2 text-xs font-medium text-[#7DD3FC] hover:border-[#2E8BFF]">
                <ImagePlus className="h-4 w-4" />
                <span>{imagePreview ? 'Change sketch / photo' : 'Attach sketch or photo (optional)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#2E8BFF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1E78EA]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Publish Drop</span>
              </button>
            </div>

            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Attached sketch preview"
                  className="max-h-40 rounded-xl border border-[var(--alexyn-border)] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(undefined)}
                  aria-label="Remove attached image"
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {formError && <p className="text-xs font-medium text-rose-300">{formError}</p>}
          </form>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[210px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search study drops, subjects, or authors..."
            className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#09122B] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter drops by subject"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-xl border border-[var(--alexyn-border)] bg-[#09122B] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
        >
          <option value="All">All Subjects</option>
          {allSubjectNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowBookmarkedOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
            showBookmarkedOnly
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
              : 'border-[var(--alexyn-border)] bg-[#09122B] text-slate-300 hover:border-slate-500'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Bookmarked</span>
        </button>
      </section>

      {filteredPosts.length === 0 ? (
        <div className="rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-8 text-center">
          <p className="text-sm font-semibold text-slate-200">
            No study drops match that filter yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Try clearing your search or share the first study trick for this topic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col justify-between rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 transition-colors hover:border-[#2E8BFF]/45"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded-lg border border-[#38BDF8]/30 bg-[#102452] px-2.5 py-0.5 text-[11px] font-semibold text-[#7DD3FC]">
                      {post.subject} · {post.kind}
                    </span>
                    <h2 className="mt-2.5 text-base font-bold text-white">{post.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBookmarkPost(post.id)}
                    aria-label={post.bookmarked ? 'Remove bookmark' : 'Bookmark study drop'}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      post.bookmarked
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                        : 'border-[var(--alexyn-border)] bg-[#071028] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {post.body}
                </p>

                {post.imagePreview && (
                  <img
                    src={post.imagePreview}
                    alt={post.title}
                    className="mt-3 max-h-52 w-full rounded-2xl border border-[var(--alexyn-border)] object-cover"
                  />
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--alexyn-border)] pt-3">
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">{post.author}</span>
                  <span> · {post.authorRole}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLikePost(post.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      post.likedByMe
                        ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                        : 'border-[var(--alexyn-border)] bg-[#071028] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? 'fill-current' : ''}`} />
                    <span>{post.likes}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onMakeNotesFromPost(post.title, post.subject)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#5EEAD4]/35 bg-[#0D2834] px-3 py-1.5 text-xs font-semibold text-[#5EEAD4] hover:border-[#5EEAD4]"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Smart Notes</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
