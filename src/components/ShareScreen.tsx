import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Bookmark,
  BookOpen,
  Heart,
  ImagePlus,
  Search,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGE_SUBJECTS } from '../data/curriculum';
import { filterCommunityPosts } from '../utils/alexynLogic';
import type { EducationProfile, SharedPost } from '../types/alexyn';

interface ShareScreenProps {
  profile: EducationProfile;
  posts: SharedPost[];
  onCreatePost: (post: Omit<SharedPost, 'id' | 'likes' | 'createdAt'>) => void;
  onLikePost: (id: string) => void;
  onBookmarkPost: (id: string) => void;
  onMakeNotesFromPost: (topic: string, subject: string) => void;
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
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Biology');
  const [kind, setKind] = useState<SharedPost['kind']>('Memory Trick');
  const [body, setBody] = useState('');
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const imgRef = useRef<HTMLInputElement>(null);

  const allSubjects = [...CORE_SUBJECTS, ...LANGUAGE_SUBJECTS].map((s) => s.name);
  const visiblePosts = filterCommunityPosts(posts, subjectFilter, searchQuery);

  const handleImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError('Please add both a short title and your note or trick.');
      return;
    }
    setFormError(null);
    onCreatePost({
      author: profile.name.trim() || 'Guest Learner',
      authorRole: profile.grade || profile.curriculum || 'ALEXYN Explorer',
      subject,
      kind,
      title: title.trim(),
      body: body.trim(),
      imagePreview,
    });
    setTitle('');
    setBody('');
    setImagePreview(undefined);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 md:px-8">
      <div>
        <p className="text-xs font-medium text-[#7DD3FC]">
          Community Drops · Share Your Own Small Stuff
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
          Share Quick Tricks, Mini-Notes & Ideas
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Post a tiny memory trick, diagram photo, or exam shortcut that helped things click for you.
        </p>
      </div>

      {/* COMPOSER FORM */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="shareTitle" className="mb-1 block text-xs font-semibold text-slate-300">
              Title
            </label>
            <input
              id="shareTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Never forget SOHCAHTOA or Ser vs Estar"
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="shareSubject" className="mb-1 block text-xs font-semibold text-slate-300">
              Subject
            </label>
            <select
              id="shareSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
            >
              {allSubjects.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="shareKind" className="mb-1 block text-xs font-semibold text-slate-300">
              Type
            </label>
            <select
              id="shareKind"
              value={kind}
              onChange={(e) => setKind(e.target.value as SharedPost['kind'])}
              className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
            >
              {POST_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="shareBody" className="mb-1 block text-xs font-semibold text-slate-300">
            Your quick note or trick
          </label>
          <textarea
            id="shareBody"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your short explanation, mnemonic, or funny example..."
            className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-sm text-white focus:border-[#2E8BFF] focus:outline-none"
          />
        </div>

        {imagePreview && (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Attachment preview"
              referrerPolicy="no-referrer"
              className="h-24 rounded-xl border border-[var(--alexyn-border)] object-cover"
            />
            <button
              type="button"
              onClick={() => setImagePreview(undefined)}
              aria-label="Remove attached photo"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {formError && (
          <p className="text-xs text-rose-300">{formError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--alexyn-border)] bg-[#0D1A3D] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#2E8BFF]"
          >
            <ImagePlus className="h-4 w-4 text-[#5EEAD4]" />
            <span>Attach sketch / screenshot</span>
          </button>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />

          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-5 py-2 text-xs font-bold text-white"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Share with ALEXYN</span>
          </button>
        </div>
      </form>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shared tricks..."
            aria-label="Search shared tricks"
            className="w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] py-2.5 pl-9 pr-3 text-xs text-white focus:border-[#2E8BFF] focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter shared drops by subject"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-xl border border-[var(--alexyn-border)] bg-[#0A1430] px-3.5 py-2.5 text-xs font-medium text-white focus:border-[#2E8BFF] focus:outline-none"
        >
          <option value="All">All Subjects</option>
          {allSubjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* FEED */}
      {visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1430] p-8 text-center">
          <Share2 className="mx-auto h-7 w-7 text-slate-500" />
          <p className="mt-2 text-sm text-slate-300">No shared items match that filter yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visiblePosts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5"
            >
              <div>
                <p className="text-xs text-slate-400">
                  {post.subject} · {post.kind} · {post.author} ({post.authorRole})
                </p>
                <h2 className="mt-1.5 text-base font-bold text-white">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {post.body}
                </p>
                {post.imagePreview && (
                  <img
                    src={post.imagePreview}
                    alt={post.title}
                    referrerPolicy="no-referrer"
                    className="mt-3 max-h-44 w-full rounded-xl border border-[var(--alexyn-border)] object-cover"
                  />
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--alexyn-border)] pt-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onLikePost(post.id)}
                    aria-label={`Like ${post.title}`}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      post.likedByMe ? 'text-rose-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                    <span className="tabular-nums">{post.likes}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onBookmarkPost(post.id)}
                    aria-label={`Bookmark ${post.title}`}
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      post.bookmarked ? 'text-amber-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bookmark className={`h-4 w-4 ${post.bookmarked ? 'fill-current' : ''}`} />
                    <span>{post.bookmarked ? 'Saved' : 'Save'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onMakeNotesFromPost(post.title, post.subject)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5EEAD4] hover:underline"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Expand into Notes</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
