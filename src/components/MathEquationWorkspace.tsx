import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Keyboard,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AISelection,
  EducationProfile,
  MathWorkingEvaluation,
} from '../types/alexyn';
import {
  formatMathNotation,
  MATH_SYMBOL_GROUPS,
  verifySimpleNumericEquation,
} from '../utils/mathWorking';

interface MathEquationWorkspaceProps {
  problemStatement: string;
  onChangeProblem?: (next: string) => void;
  steps: string[];
  onChangeSteps: (next: string[]) => void;
  finalAnswer?: string;
  onChangeFinalAnswer?: (next: string) => void;
  maxMarks?: number;
  profile?: EducationProfile;
  aiSelection?: AISelection;
  readOnlyProblem?: boolean;
  hideAICheckButton?: boolean;
  externalDiagnostics?: MathWorkingEvaluation['stepDiagnostics'];
}

export const MathEquationWorkspace: React.FC<MathEquationWorkspaceProps> = ({
  problemStatement,
  onChangeProblem,
  steps,
  onChangeSteps,
  finalAnswer = '',
  onChangeFinalAnswer,
  maxMarks = 5,
  profile,
  aiSelection,
  readOnlyProblem = false,
  hideAICheckButton = false,
  externalDiagnostics,
}) => {
  const [activeTarget, setActiveTarget] = useState<'final' | number>(0);
  const [activeGroupId, setActiveGroupId] = useState<
    'operators' | 'powers' | 'algebra' | 'functions'
  >('operators');
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [checking, setChecking] = useState(false);
  const [evalResult, setEvalResult] = useState<MathWorkingEvaluation | null>(null);
  const [evalError, setEvalError] = useState('');

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const ensureSteps = steps.length > 0 ? steps : [''];

  const handleInsertSymbol = (insertText: string, cursorOffset?: number) => {
    const key = activeTarget === 'final' ? 'final' : `step-${activeTarget}`;
    const el = inputRefs.current[key];
    const currentValue =
      activeTarget === 'final'
        ? finalAnswer
        : ensureSteps[Math.min(activeTarget, ensureSteps.length - 1)] || '';

    const selStart = el?.selectionStart ?? currentValue.length;
    const selEnd = el?.selectionEnd ?? currentValue.length;
    const nextValue =
      currentValue.slice(0, selStart) + insertText + currentValue.slice(selEnd);

    if (activeTarget === 'final') {
      onChangeFinalAnswer?.(nextValue);
    } else {
      const idx = Math.min(activeTarget, ensureSteps.length - 1);
      const copy = [...ensureSteps];
      copy[idx] = nextValue;
      onChangeSteps(copy);
    }

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = selStart + (cursorOffset ?? insertText.length);
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleAddStep = () => {
    const next = [...ensureSteps, ''];
    onChangeSteps(next);
    setActiveTarget(next.length - 1);
  };

  const handleRemoveStep = (idx: number) => {
    if (ensureSteps.length <= 1) {
      onChangeSteps(['']);
      setActiveTarget(0);
      return;
    }
    const next = ensureSteps.filter((_, i) => i !== idx);
    onChangeSteps(next);
    setActiveTarget(Math.max(0, idx - 1));
  };

  const handleCheckWorking = async () => {
    const nonEmpty = ensureSteps.map((s) => s.trim()).filter(Boolean);
    if (!problemStatement.trim() || (nonEmpty.length === 0 && !finalAnswer.trim())) {
      setEvalError('Enter the problem and at least one working step first.');
      return;
    }
    setChecking(true);
    setEvalError('');
    setEvalResult(null);

    try {
      const resp = await fetch('/api/math/check-working', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          problem: problemStatement,
          steps: nonEmpty,
          finalAnswer,
          maxMarks,
          profile,
          aiSelection,
        }),
      });
      const data = (await resp.json()) as MathWorkingEvaluation & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'Could not evaluate working right now.');
      }
      setEvalResult(data);
    } catch (err) {
      setEvalError(
        err instanceof Error ? err.message : 'Step-by-step evaluation failed.'
      );
    } finally {
      setChecking(false);
    }
  };

  const diagnostics = externalDiagnostics || evalResult?.stepDiagnostics || [];
  const activeGroup =
    MATH_SYMBOL_GROUPS.find((g) => g.id === activeGroupId) || MATH_SYMBOL_GROUPS[0];

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#071026]/85 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            Step-by-Step Equation &amp; Working Workspace
          </p>
          <p className="text-[11px] text-slate-400">
            Write each working line cleanly. ALEXYN checks every step and spots exact sign or algebra errors.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowKeyboard((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            showKeyboard
              ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
              : 'border-white/10 bg-white/[0.04] text-slate-300'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          {showKeyboard ? 'Hide Math Keypad' : 'Math Keypad'}
        </button>
      </div>

      {/* Problem input when in standalone workspace */}
      {!readOnlyProblem && (
        <div>
          <label className="block text-[11px] font-medium text-slate-300 mb-1">
            Math Question / Expression to Solve
          </label>
          <input
            type="text"
            value={problemStatement}
            onChange={(e) => onChangeProblem?.(e.target.value)}
            placeholder="e.g. Solve 2x^2 - 8 = 0  or  Simplify (3x + 6) / 3"
            className="w-full rounded-xl border border-white/10 bg-[#050B1C] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
          />
        </div>
      )}

      {/* Categorized Math Symbol Keyboard */}
      {showKeyboard && (
        <div className="rounded-xl border border-sky-400/20 bg-[#050B1D] p-2.5 space-y-2">
          <div className="flex flex-wrap gap-1">
            {MATH_SYMBOL_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroupId(g.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  activeGroupId === g.id
                    ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                    : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeGroup.buttons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                title={btn.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsertSymbol(btn.insert, btn.cursorOffset)}
                className="min-w-[38px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-sky-500/20 hover:border-sky-400/40 text-xs sm:text-sm font-semibold text-white transition active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Working Steps Lines */}
      <div className="space-y-2">
        {ensureSteps.map((stepVal, idx) => {
          const diag = diagnostics.find((d) => d.stepIndex === idx);
          const numericCheck = stepVal.includes('=')
            ? verifySimpleNumericEquation(stepVal)
            : { canVerify: false };
          const formatted = formatMathNotation(stepVal);

          return (
            <div
              key={idx}
              className={`rounded-xl border p-2.5 transition ${
                diag?.status === 'error'
                  ? 'border-rose-400/50 bg-rose-500/10'
                  : diag?.status === 'correct'
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : activeTarget === idx
                  ? 'border-sky-400/45 bg-[#091536]'
                  : 'border-white/10 bg-[#050B1C]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 w-12 shrink-0">
                  Step {idx + 1}
                </span>
                <input
                  ref={(el) => {
                    inputRefs.current[`step-${idx}`] = el;
                  }}
                  type="text"
                  value={stepVal}
                  onFocus={() => setActiveTarget(idx)}
                  onChange={(e) => {
                    const copy = [...ensureSteps];
                    copy[idx] = e.target.value;
                    onChangeSteps(copy);
                  }}
                  placeholder={`Line ${idx + 1} working (e.g. 2x = 6 or x = 3)`}
                  className="flex-1 bg-transparent text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
                />
                {numericCheck.canVerify && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      numericCheck.isTrue
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {numericCheck.isTrue ? 'Arithmetic ✓' : 'Arithmetic ≠'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveStep(idx)}
                  className="p-1 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition"
                  title="Remove step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Live math notation preview */}
              {formatted && formatted !== stepVal && (
                <div className="mt-1 pl-14 text-xs text-teal-300 font-medium">
                  Notation: {formatted}
                </div>
              )}

              {/* Step diagnostic feedback */}
              {diag && (
                <div
                  className={`mt-1.5 pl-14 flex items-start gap-1.5 text-xs ${
                    diag.status === 'error'
                      ? 'text-rose-200'
                      : diag.status === 'correct'
                      ? 'text-emerald-200'
                      : 'text-amber-200'
                  }`}
                >
                  {diag.status === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  <span>{diag.note}</span>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleAddStep}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-200 transition"
          >
            <Plus className="w-3.5 h-3.5 text-sky-300" />
            Add Working Line
          </button>

          {!hideAICheckButton && (
            <button
              type="button"
              onClick={handleCheckWorking}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] hover:opacity-95 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition"
            >
              {checking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking Steps...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Check Steps Line-by-Line
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Optional Final Answer Box */}
      {onChangeFinalAnswer && (
        <div>
          <label className="block text-[11px] font-medium text-slate-300 mb-1">
            Final Answer (optional if already shown on last line)
          </label>
          <input
            ref={(el) => {
              inputRefs.current.final = el;
            }}
            type="text"
            value={finalAnswer}
            onFocus={() => setActiveTarget('final')}
            onChange={(e) => onChangeFinalAnswer(e.target.value)}
            placeholder="e.g. x = 3 or x = ±2 cm"
            className="w-full rounded-xl border border-white/10 bg-[#050B1C] px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
          />
          {finalAnswer && formatMathNotation(finalAnswer) !== finalAnswer && (
            <p className="mt-1 text-xs text-teal-300">
              Preview: {formatMathNotation(finalAnswer)}
            </p>
          )}
        </div>
      )}

      {evalError && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
          {evalError}
        </div>
      )}

      {evalResult && (
        <div className="rounded-xl border border-sky-400/30 bg-[#06122E] p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`font-bold ${
                evalResult.overallCorrect ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {evalResult.overallCorrect
                ? 'All working steps valid!'
                : evalResult.firstErrorStepIndex !== null
                ? `First slip detected at Step ${evalResult.firstErrorStepIndex + 1}`
                : 'Review suggested improvements below'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
              Method Score: {evalResult.scoreAwarded} / {evalResult.maxMarks}
            </span>
          </div>
          {evalResult.correctNextSteps?.length > 0 && (
            <div className="space-y-1 text-slate-200">
              <p className="font-semibold text-sky-300">Correct Continuation:</p>
              {evalResult.correctNextSteps.map((s, i) => (
                <p key={i} className="font-mono text-[11px] pl-2 border-l-2 border-sky-400/40">
                  {formatMathNotation(s)}
                </p>
              ))}
            </div>
          )}
          {evalResult.conceptualTip && (
            <p className="text-slate-300 leading-relaxed">
              <strong className="text-teal-300">Key Principle:</strong> {evalResult.conceptualTip}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
