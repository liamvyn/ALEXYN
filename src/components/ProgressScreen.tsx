import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ClipboardCheck,
  Loader2,
  Minus,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { analyzePerformance, buildSmartReminders } from '../utils/alexynLogic';
import type {
  EducationProfile,
  QuizAttempt,
  ReminderPreferences,
  SubjectItem,
} from '../types/alexyn';

interface ProgressScreenProps {
  profile: EducationProfile;
  attempts: QuizAttempt[];
  reminderPrefs: ReminderPreferences;
  onUpdateReminderPrefs: (prefs: ReminderPreferences) => void;
  dismissedReminderIds: string[];
  onDismissReminder: (id: string) => void;
  onStartQuizForTopic: (topic: string, subject: string) => void;
  onOpenNotesForTopic: (topic: string, subject: string) => void;
  onGoToQuizzes: () => void;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
}

export function ProgressScreen({
  profile,
  attempts,
  reminderPrefs,
  onUpdateReminderPrefs,
  dismissedReminderIds,
  onDismissReminder,
  onStartQuizForTopic,
  onOpenNotesForTopic,
  onGoToQuizzes,
  scopedSubject,
  onBackFromScoped,
}: ProgressScreenProps) {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(
    scopedSubject?.name || 'All'
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  const effectiveFilter = scopedSubject ? scopedSubject.name : selectedSubjectFilter;

  const filteredAttempts = useMemo(() => {
    const sorted = [...attempts]
      .filter((a) => a.maxScore > 0)
      .sort((a, b) => a.completedAt - b.completedAt);
    if (effectiveFilter === 'All') return sorted;
    return sorted.filter(
      (a) => a.subject.toLowerCase() === effectiveFilter.toLowerCase()
    );
  }, [attempts, effectiveFilter]);

  const analysis = useMemo(
    () => analyzePerformance(scopedSubject ? filteredAttempts : attempts),
    [attempts, filteredAttempts, scopedSubject]
  );

  const reminders = useMemo(() => {
    const all = buildSmartReminders(analysis.subjectSummaries, attempts);
    return all.filter((r) => !dismissedReminderIds.includes(r.id));
  }, [analysis.subjectSummaries, attempts, dismissedReminderIds]);

  const activeDrilldown = useMemo(() => {
    if (effectiveFilter !== 'All') {
      return analysis.subjectSummaries.find(
        (s) => s.subject.toLowerCase() === effectiveFilter.toLowerCase()
      );
    }
    return analysis.subjectSummaries[0] || null;
  }, [analysis.subjectSummaries, effectiveFilter]);

  const inspectedAttempt =
    filteredAttempts.find((a) => a.id === selectedAttemptId) ||
    filteredAttempts[filteredAttempts.length - 1] ||
    null;

  const handleFetchAiInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/progress/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          attempts: filteredAttempts,
          summaries: analysis.subjectSummaries,
          profile,
        }),
      });
      const data = (await res.json()) as {
        headline?: string;
        insights?: string[];
        actionPlan?: string[];
        summary?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate AI coaching insights.');
      }

      if (data.summary) {
        setAiInsights(data.summary);
      } else {
        const parts: string[] = [];
        if (data.headline) parts.push(data.headline);
        if (Array.isArray(data.insights) && data.insights.length > 0) {
          parts.push(`Key Observations:\n${data.insights.map((item) => `• ${item}`).join('\n')}`);
        }
        if (Array.isArray(data.actionPlan) && data.actionPlan.length > 0) {
          parts.push(`Action Plan:\n${data.actionPlan.map((step, i) => `${i + 1}. ${step}`).join('\n')}`);
        }
        setAiInsights(
          parts.join('\n\n') ||
            'Keep recording quizzes so ALEXYN can refine your topic mastery coaching.'
        );
      }
    } catch (err) {
      setAiInsights(
        err instanceof Error
          ? err.message
          : 'Keep recording quizzes so ALEXYN can refine your topic mastery coaching.'
      );
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleToggleBrowserNotifications = async () => {
    setNotifFeedback(null);
    if (!reminderPrefs.browserNotifications) {
      if (typeof Notification === 'undefined') {
        setNotifFeedback('Browser notifications are not supported in this browser, so reminders will appear inside ALEXYN.');
        onUpdateReminderPrefs({ ...reminderPrefs, browserNotifications: false });
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        onUpdateReminderPrefs({ ...reminderPrefs, browserNotifications: true });
        setNotifFeedback('Browser study notifications enabled ✓');
      } else {
        setNotifFeedback('Notification permission declined — reminders will stay visible inside ALEXYN.');
      }
    } else {
      onUpdateReminderPrefs({ ...reminderPrefs, browserNotifications: false });
    }
  };

  // Multi-Color SVG Graph coordinates
  const chartW = 640;
  const chartH = 210;
  const padX = 40;
  const padY = 24;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const chartPoints = filteredAttempts.map((att, idx) => {
    const x =
      filteredAttempts.length === 1
        ? padX + plotW / 2
        : padX + (idx / (filteredAttempts.length - 1)) * plotW;
    const y = padY + ((100 - Math.max(0, Math.min(100, att.percentage))) / 100) * plotH;
    return { att, x, y, idx };
  });

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
            {scopedSubject.name} Real Marks & Analytics
          </span>
        </div>
      )}

      {/* HEADER */}
      <section className="rounded-3xl border border-[var(--alexyn-border)] bg-gradient-to-br from-[#0B1739] via-[#08122E] to-[#050C20] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#132960] text-[#5EEAD4]">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                {scopedSubject ? `${scopedSubject.name} Performance` : 'Academic Progress'}
              </h1>
              <p className="text-xs text-slate-400">
                Real quiz marks, subject trends, multi-color graphs & evidence-based revision reminders
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToQuizzes}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-bold text-white"
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Take Practice Quiz</span>
          </button>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
            <p className="text-[11px] text-slate-400">Overall Average</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#5EEAD4]">
              {analysis.totalAttempts > 0 ? `${analysis.overallAverage}%` : '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
            <p className="text-[11px] text-slate-400">Graded Quizzes</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-white">
              {analysis.totalAttempts}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
            <p className="text-[11px] text-slate-400">Recent Step Change</p>
            <p
              className={`mt-1 flex items-center gap-1 font-mono text-xl font-extrabold ${
                analysis.overallTrendDelta === null
                  ? 'text-slate-400'
                  : analysis.overallTrendDelta > 0
                  ? 'text-emerald-400'
                  : analysis.overallTrendDelta < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {analysis.overallTrendDelta === null ? (
                'Need 2+'
              ) : analysis.overallTrendDelta > 0 ? (
                <>
                  <ArrowUpRight className="h-5 w-5" />+{analysis.overallTrendDelta}pp
                </>
              ) : analysis.overallTrendDelta < 0 ? (
                <>
                  <ArrowDownRight className="h-5 w-5" />
                  {analysis.overallTrendDelta}pp
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4" /> 0pp
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4">
            <p className="text-[11px] text-slate-400">Top Subject</p>
            <p className="mt-1 truncate text-sm font-bold text-[#7DD3FC]">
              {analysis.subjectSummaries.length > 0
                ? [...analysis.subjectSummaries].sort(
                    (a, b) => b.currentAverage - a.currentAverage
                  )[0].subject
                : 'No data yet'}
            </p>
          </div>
        </div>
      </section>

      {filteredAttempts.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-[var(--alexyn-border)] bg-[#0A1430] p-8 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-[#38BDF8]" />
          <h2 className="mt-3 text-lg font-bold text-white">No Graded Quiz Marks Yet</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
            ALEXYN only tracks real quiz results and never invents fake averages or reminders. Complete a graded quiz in {scopedSubject ? scopedSubject.name : 'Quizzes'} to unlock your color-coded performance graph and personalized reminders.
          </p>
          <button
            type="button"
            onClick={onGoToQuizzes}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2E8BFF] px-5 py-2.5 text-xs font-bold text-white"
          >
            <span>Start First Quiz</span>
          </button>
        </section>
      ) : (
        <>
          {/* MULTI-COLOR SEGMENTED PERFORMANCE GRAPH */}
          <section className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Performance Graph (Color-Coded Trends)</h2>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-emerald-400">Green</span> = score increased ·{' '}
                  <span className="font-semibold text-rose-400">Red</span> = score declined ·{' '}
                  <span className="font-semibold text-slate-300">Grey</span> = unchanged
                </p>
              </div>

              {!scopedSubject && analysis.subjectSummaries.length > 0 && (
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => {
                    setSelectedSubjectFilter(e.target.value);
                    setSelectedAttemptId(null);
                  }}
                  aria-label="Filter graph by subject"
                  className="rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 text-xs font-semibold text-white"
                >
                  <option value="All">All Subjects</option>
                  {analysis.subjectSummaries.map((s) => (
                    <option key={s.subject} value={s.subject}>
                      {s.subject} ({s.attemptCount})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-3">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                role="img"
                aria-label="Quiz score progression chart"
                className="h-52 w-full min-w-[360px]"
              >
                {[0, 25, 50, 75, 100].map((pct) => {
                  const y = padY + ((100 - pct) / 100) * plotH;
                  return (
                    <g key={pct}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={chartW - padX}
                        y2={y}
                        stroke="rgba(148,163,184,0.18)"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={padX - 8}
                        y={y + 4}
                        textAnchor="end"
                        fill="#94A3B8"
                        fontSize="10"
                      >
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* Individual green/red/neutral line segments */}
                {chartPoints.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = chartPoints[i - 1];
                  const delta = pt.att.percentage - prev.att.percentage;
                  const stroke =
                    delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#94A3B8';
                  return (
                    <line
                      key={`seg-${pt.att.id}`}
                      x1={prev.x}
                      y1={prev.y}
                      x2={pt.x}
                      y2={pt.y}
                      stroke={stroke}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Interactive data nodes */}
                {chartPoints.map((pt, i) => {
                  const prevPct = i > 0 ? chartPoints[i - 1].att.percentage : null;
                  const delta = prevPct !== null ? pt.att.percentage - prevPct : 0;
                  const fill =
                    i === 0
                      ? '#38BDF8'
                      : delta > 0
                      ? '#22C55E'
                      : delta < 0
                      ? '#EF4444'
                      : '#94A3B8';
                  const isSelected = inspectedAttempt?.id === pt.att.id;
                  return (
                    <g
                      key={pt.att.id}
                      onClick={() => setSelectedAttemptId(pt.att.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 8 : 6}
                        fill={fill}
                        stroke="#040A1A"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y={Math.max(14, pt.y - 11)}
                        textAnchor="middle"
                        fill="#E2E8F0"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {pt.att.percentage}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {inspectedAttempt && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] px-4 py-3 text-xs">
                <div>
                  <span className="font-bold text-white">{inspectedAttempt.quizTitle}</span>
                  <span className="ml-2 text-slate-400">
                    ({inspectedAttempt.subject} · {new Date(inspectedAttempt.completedAt).toLocaleDateString()})
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono font-bold">
                  <span className="text-slate-200">
                    {inspectedAttempt.score}/{inspectedAttempt.maxScore}
                  </span>
                  <span className="text-[#5EEAD4]">{inspectedAttempt.percentage}%</span>
                </div>
              </div>
            )}
          </section>

          {/* SUBJECT BREAKDOWN + DRILLDOWN */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-5">
              <h2 className="text-base font-bold text-white">Subject Breakdown</h2>
              {analysis.subjectSummaries.map((sub) => {
                const isSelected = activeDrilldown?.subject === sub.subject;
                return (
                  <button
                    key={sub.subject}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(sub.subject)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-[#38BDF8] bg-[#13295E]'
                        : 'border-[var(--alexyn-border)] bg-[#0A1430] hover:border-[#2E8BFF]/60'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{sub.subject}</p>
                      <p className="text-xs text-slate-400">
                        {sub.attemptCount} quiz(zes) · High {sub.highestScore}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-extrabold text-[#5EEAD4]">
                        {sub.currentAverage}%
                      </p>
                      <p
                        className={`text-[11px] font-semibold ${
                          sub.trendDirection === 'improving'
                            ? 'text-emerald-400'
                            : sub.trendDirection === 'declining'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {sub.trendDirection === 'insufficient'
                          ? 'Baseline'
                          : sub.trendDelta !== null && sub.trendDelta > 0
                          ? `▲ +${sub.trendDelta}pp`
                          : sub.trendDelta !== null && sub.trendDelta < 0
                          ? `▼ ${sub.trendDelta}pp`
                          : 'Stable'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeDrilldown && (
              <div className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#7DD3FC]">Subject Drilldown</p>
                    <h3 className="text-xl font-extrabold text-white">{activeDrilldown.subject}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onStartQuizForTopic(
                        activeDrilldown.weakestTopics[0]?.topic || activeDrilldown.subject,
                        activeDrilldown.subject
                      )
                    }
                    className="rounded-xl bg-[#2E8BFF] px-3.5 py-2 text-xs font-bold text-white"
                  >
                    Take {activeDrilldown.subject} Quiz
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#060E24] p-3">
                    <p className="text-[10px] text-slate-400">Current Avg</p>
                    <p className="font-mono text-base font-bold text-[#5EEAD4]">
                      {activeDrilldown.currentAverage}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#060E24] p-3">
                    <p className="text-[10px] text-slate-400">Previous Avg</p>
                    <p className="font-mono text-base font-bold text-slate-200">
                      {activeDrilldown.previousAverage !== null
                        ? `${activeDrilldown.previousAverage}%`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#060E24] p-3">
                    <p className="text-[10px] text-slate-400">Latest</p>
                    <p className="font-mono text-base font-bold text-white">
                      {activeDrilldown.latestScore}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#060E24] p-3">
                    <p className="text-[10px] text-slate-400">Highest</p>
                    <p className="font-mono text-base font-bold text-emerald-400">
                      {activeDrilldown.highestScore}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-500/25 bg-[#061528] p-3.5">
                    <p className="text-xs font-bold text-emerald-300">Strongest Topics</p>
                    {activeDrilldown.strongestTopics.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Score ≥70% on topic questions to appear here.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-slate-200">
                        {activeDrilldown.strongestTopics.map((t) => (
                          <li key={t.topic} className="flex justify-between">
                            <span className="truncate">{t.topic}</span>
                            <span className="font-mono text-emerald-300">{t.accuracy}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-2xl border border-rose-500/25 bg-[#1B1028] p-3.5">
                    <p className="text-xs font-bold text-rose-300">Weakest Topics (Needs Revision)</p>
                    {activeDrilldown.weakestTopics.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        No topics below 70% recorded yet!
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                        {activeDrilldown.weakestTopics.map((t) => (
                          <li key={t.topic} className="flex items-center justify-between gap-2">
                            <span className="truncate">{t.topic}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-rose-300">{t.accuracy}%</span>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenNotesForTopic(t.topic, activeDrilldown.subject)
                                }
                                className="text-[11px] font-semibold text-[#5EEAD4] hover:underline"
                              >
                                Notes
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* AI RECOMMENDATIONS + SMART REMINDERS */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* AI Recommendations */}
            <div className="space-y-3 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white">AI Recommendations</h2>
                <button
                  type="button"
                  onClick={handleFetchAiInsights}
                  disabled={loadingInsights}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2E8BFF]/40 bg-[#122658] px-3 py-1.5 text-xs font-semibold text-[#7DD3FC]"
                >
                  {loadingInsights ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Deep AI Coaching</span>
                </button>
              </div>

              {aiInsights && (
                <div className="rounded-2xl border border-[#38BDF8]/35 bg-[#071636] p-3.5 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {aiInsights}
                </div>
              )}

              <div className="space-y-2.5">
                {analysis.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border p-4 text-xs ${
                      rec.tone === 'warning'
                        ? 'border-rose-500/35 bg-rose-500/10 text-rose-100'
                        : rec.tone === 'positive'
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                        : 'border-[var(--alexyn-border)] bg-[#060E24] text-slate-200'
                    }`}
                  >
                    <p className="leading-relaxed">{rec.message}</p>
                    <button
                      type="button"
                      onClick={() =>
                        rec.actionType === 'notes'
                          ? onOpenNotesForTopic(rec.topic || rec.subject, rec.subject)
                          : onStartQuizForTopic(rec.topic || rec.subject, rec.subject)
                      }
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                    >
                      {rec.actionType === 'notes' ? (
                        <BookOpen className="h-3.5 w-3.5" />
                      ) : (
                        <ClipboardCheck className="h-3.5 w-3.5" />
                      )}
                      <span>{rec.suggestedActionLabel}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SMART STUDY REMINDERS & CONTROLS */}
            <div className="space-y-3 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1430] p-5 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#5EEAD4]" />
                  <h2 className="text-base font-bold text-white">Smart Study Reminders</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefsOpen((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-200"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Schedule Settings</span>
                </button>
              </div>

              {prefsOpen && (
                <div className="space-y-3 rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4 text-xs">
                  <label className="flex cursor-pointer items-center justify-between font-semibold text-white">
                    <span>Enable smart reminders</span>
                    <input
                      type="checkbox"
                      checked={reminderPrefs.enabled}
                      onChange={(e) =>
                        onUpdateReminderPrefs({
                          ...reminderPrefs,
                          enabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#5EEAD4]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-slate-400">Frequency</label>
                      <select
                        value={reminderPrefs.frequency}
                        onChange={(e) =>
                          onUpdateReminderPrefs({
                            ...reminderPrefs,
                            frequency: e.target.value as ReminderPreferences['frequency'],
                          })
                        }
                        className="w-full rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1.5 text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="every-2-days">Every 2 Days</option>
                        <option value="study-sessions">Study Sessions</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-400">Preferred Study Time</label>
                      <input
                        type="time"
                        value={reminderPrefs.preferredTime}
                        onChange={(e) =>
                          onUpdateReminderPrefs({
                            ...reminderPrefs,
                            preferredTime: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-[var(--alexyn-border)] bg-[#0A1430] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleBrowserNotifications}
                    className="rounded-lg border border-[#2E8BFF]/40 bg-[#122658] px-3 py-1.5 font-semibold text-[#7DD3FC]"
                  >
                    {reminderPrefs.browserNotifications
                      ? 'Browser Notifications: ON ✓'
                      : 'Enable Browser Notifications'}
                  </button>
                  {notifFeedback && <p className="text-[11px] text-amber-200">{notifFeedback}</p>}
                </div>
              )}

              {!reminderPrefs.enabled ? (
                <p className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4 text-xs text-slate-400">
                  Smart reminders are currently paused. Turn them back on anytime in Schedule Settings.
                </p>
              ) : reminders.length === 0 ? (
                <p className="rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-4 text-xs text-slate-400">
                  No urgent revision reminders right now — take another quiz across topics to generate tailored schedule nudges.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {reminders.map((rem) => (
                    <div
                      key={rem.id}
                      className={`rounded-2xl border p-4 text-xs ${
                        rem.priority === 'high'
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-[var(--alexyn-border)] bg-[#060E24]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {rem.priority === 'high' && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                            )}
                            <span className="font-bold text-white">{rem.title}</span>
                          </div>
                          <p className="mt-1 text-slate-300">{rem.reason}</p>
                          <p className="mt-1 text-[10px] text-[#7DD3FC]">
                            {rem.dueLabel} · Scheduled {reminderPrefs.preferredTime} ({reminderPrefs.frequency})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDismissReminder(rem.id)}
                          aria-label={`Dismiss reminder ${rem.title}`}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onStartQuizForTopic(rem.topic, rem.subject)}
                          className="rounded-lg bg-[#2E8BFF] px-3 py-1.5 text-[11px] font-bold text-white"
                        >
                          Practise Now
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenNotesForTopic(rem.topic, rem.subject)}
                          className="rounded-lg border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-[11px] font-semibold text-slate-200"
                        >
                          Revise Notes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
