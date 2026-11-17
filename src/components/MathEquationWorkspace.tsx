import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Eraser,
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
  insertAtCursor,
  MATH_SYMBOL_GROUPS,
  tryEvaluateNumericExpression,
  verifySimpleNumericEquation,
} from '../utils/mathWorking';
import { apiUrl } from '../utils/apiBase';
import {
  INITIAL_CALCULATOR_STATE,
  ScientificCalculatorPanel,
  type ScientificCalculatorState,
} from './ScientificCalculatorPanel';

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
  externalCalcState?: ScientificCalculatorState;
  onChangeCalcState?: (next: ScientificCalculatorState) => void;
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
  externalCalcState,
  onChangeCalcState,
}) => {
  const [activeTarget, setActiveTarget] = useState<'problem' | 'final' | number>(0);
  const [activeGroupId, setActiveGroupId] = useState<
    'operators' | 'powers' | 'algebra' | 'functions'
  >('operators');
  const [showCalculator, setShowCalculator] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [internalCalcState, setInternalCalcState] = useState<ScientificCalculatorState>(
    INITIAL_CALCULATOR_STATE
  );
  const [checking, setChecking] = useState(false);
  const [evalResult, setEvalResult] = useState<MathWorkingEvaluation | null>(null);
  const [evalError, setEvalError] = useState('');

  const calcState = externalCalcState ?? internalCalcState;
  const setCalcState = onChangeCalcState ?? setInternalCalcState;

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastSelectionRef = useRef<Record<string, { start: number; end: number }>>({});

  const ensureSteps = steps.length > 0 ? steps : [''];

  const recordSelection = (key: string, el: HTMLInputElement | null) => {
    if (!el) return;
    lastSelectionRef.current[key] = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const handleInsertSymbol = (insertText: string, cursorOffset?: number) => {
    const key =
      activeTarget === 'problem'
        ? 'problem'
        : activeTarget === 'final'
        ? 'final'
        : `step-${activeTarget}`;
    const el = inputRefs.current[key];
    const isElementActive =
      typeof document !== 'undefined' && el !== null && document.activeElement === el;
    const currentValue =
      activeTarget === 'problem'
        ? problemStatement
        : activeTarget === 'final'
        ? finalAnswer
        : ensureSteps[Math.min(activeTarget, ensureSteps.length - 1)] || '';

    const recorded = lastSelectionRef.current[key];
    const hasLiveSelection = Boolean(isElementActive && el && typeof el.selectionStart === 'number');
    const selStart = hasLiveSelection
      ? (el!.selectionStart ?? currentValue.length)
      : (recorded?.start ?? currentValue.length);
    const selEnd = hasLiveSelection
      ? (el!.selectionEnd ?? selStart)
      : (recorded?.end ?? selStart);

    const { nextValue, nextCaret } = insertAtCursor(
      currentValue,
      selStart,
      selEnd,
      insertText,
      cursorOffset
    );
    lastSelectionRef.current[key] = { start: nextCaret, end: nextCaret };

    if (activeTarget === 'problem') {
      onChangeProblem?.(nextValue);
    } else if (activeTarget === 'final') {
      onChangeFinalAnswer?.(nextValue);
    } else {
      const idx = Math.min(activeTarget, ensureSteps.length - 1);
      const copy = [...ensureSteps];
      copy[idx] = nextValue;
      onChangeSteps(copy);
    }

    // Never call el.focus() here — only sync selection if user deliberately focused the field.
    if (isElementActive && el) {
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    }
  };

  const blurActiveFieldIfNeeded = () => {
    if (typeof document === 'undefined') return;
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur();
    }
  };

  const handleToggleCalculator = () => {
    setShowCalculator((prev) => {
      const next = !prev;
      if (next) blurActiveFieldIfNeeded();
      return next;
    });
  };

  const handleToggleMathKeyboard = () => {
    setShowKeyboard((prev) => {
      const next = !prev;
      if (next) blurActiveFieldIfNeeded();
      return next;
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

  const handleClearBlankNotebook = () => {
    onChangeProblem?.('');
    onChangeSteps(['', '']);
    onChangeFinalAnswer?.('');
    setEvalResult(null);
    setEvalError('');
    setActiveTarget('problem');
    requestAnimationFrame(() => {
      inputRefs.current.problem?.focus();
    });
  };

  const handleCheckWorking = async () => {
    const nonEmpty = ensureSteps.map((s) => s.trim()).filter(Boolean);
    if (!problemStatement.trim() || (nonEmpty.length === 0 && !finalAnswer.trim())) {
      setEvalError('Enter the problem or calculation and at least one working step first.');
      return;
    }
    setChecking(true);
    setEvalError('');
    setEvalResult(null);

    try {
      const resp = await fetch(apiUrl('/api/math/check-working'), {
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
  const problemEval = tryEvaluateNumericExpression(problemStatement);
  const activeTargetLabel =
    activeTarget === 'problem'
      ? 'Problem / Expression'
      : activeTarget === 'final'
      ? 'Final Answer'
      : `Step ${activeTarget + 1}`;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#071026]/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            Interactive Mathematics Calculation &amp; Working Notebook
          </p>
          <p className="text-[11px] text-slate-400">
            Tap any input line to type normally, or use <span className="text-[#5EEAD4] font-semibold">Scientific Calculator</span> and <span className="text-sky-200 font-semibold">Math Keyboard</span> independently (inserting into {activeTargetLabel}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnlyProblem && (
            <button
              type="button"
              onClick={handleClearBlankNotebook}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-400/40 hover:text-white transition"
            >
              <Eraser className="w-3.5 h-3.5" />
              Blank Page
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleToggleCalculator}
            aria-expanded={showCalculator}
            aria-label={showCalculator ? 'Minimize Scientific Calculator' : 'Open Scientific Calculator'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              showCalculator
                ? 'border-[#5EEAD4]/55 bg-[#0D2A3F] text-[#5EEAD4]'
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:border-[#5EEAD4]/40'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{showCalculator ? 'Hide Calculator' : 'Scientific Calculator'}</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleToggleMathKeyboard}
            aria-expanded={showKeyboard}
            aria-label={showKeyboard ? 'Hide Math Keyboard' : 'Open Math Keyboard'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              showKeyboard
                ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:border-sky-400/40'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{showKeyboard ? 'Hide Math Keyboard' : 'Math Keyboard'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Independent Scientific Calculator (retains state when minimized) */}
      <ScientificCalculatorPanel
        open={showCalculator}
        state={calcState}
        onChangeState={setCalcState}
        onCollapse={() => setShowCalculator(false)}
        onInsertResult={(val) => handleInsertSymbol(val)}
        activeTargetLabel={activeTargetLabel}
      />

      {/* Problem / Calculation Expression input when in standalone workspace */}
      {!readOnlyProblem && (
        <div
          className={`rounded-xl border p-3 transition ${
            activeTarget === 'problem'
              ? 'border-sky-400/50 bg-[#091536]'
              : 'border-white/10 bg-[#050B1C]'
          }`}
        >
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="mathWorkspaceProblemInput" className="text-[11px] font-semibold text-slate-300">
              Math Problem or Expression
            </label>
            {problemEval.ok && (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                Calculated: = {Number.isInteger(problemEval.value) ? problemEval.value : Number(problemEval.value.toFixed(6))}
              </span>
            )}
          </div>
          <input
            id="mathWorkspaceProblemInput"
            ref={(el) => {
              inputRefs.current.problem = el;
            }}
            type="text"
            value={problemStatement}
            onFocus={(e) => {
              setActiveTarget('problem');
              recordSelection('problem', e.currentTarget);
            }}
            onClick={(e) => recordSelection('problem', e.currentTarget)}
            onKeyUp={(e) => recordSelection('problem', e.currentTarget)}
            onSelect={(e) => recordSelection('problem', e.currentTarget)}
            onChange={(e) => {
              recordSelection('problem', e.currentTarget);
              onChangeProblem?.(e.target.value);
            }}
            placeholder="e.g. Solve 2x^2 - 8 = 0  or  125 * 4 + sqrt(144)"
            className="w-full bg-transparent text-base text-white font-mono placeholder-slate-500 focus:outline-none"
          />
          {problemStatement && formatMathNotation(problemStatement) !== problemStatement && (
            <p className="mt-1.5 text-xs text-teal-300 font-medium">
              Notation: {formatMathNotation(problemStatement)}
            </p>
          )}
        </div>
      )}

      {/* Categorized Mathematical Writing Keyboard */}
      {showKeyboard && (
        <div
          role="region"
          aria-label="ALEXYN Mathematical Writing Keyboard"
          className="rounded-xl border border-sky-400/25 bg-[#050B1D] p-3 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {MATH_SYMBOL_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-sky-300/80">
                Target: {activeTargetLabel}
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setShowKeyboard(false)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300 hover:text-white"
              >
                Collapse
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeGroup.buttons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                title={btn.title}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleInsertSymbol(btn.insert, btn.cursorOffset)}
                className="min-w-[40px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-sky-500/20 hover:border-sky-400/40 text-xs sm:text-sm font-semibold text-white transition active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Quick digits 0-9 for touch/mobile writing without opening phone keyboard */}
          <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '(', ')'].map((digit) => (
              <button
                key={digit}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleInsertSymbol(digit)}
                className="min-w-[32px] flex-1 sm:flex-none px-2 py-1 rounded-md border border-white/10 bg-[#0A1534] hover:bg-sky-500/20 text-xs font-mono font-bold text-slate-100 transition active:scale-95"
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spacious Working Notebook Lines */}
      <div className="space-y-2.5">
        {ensureSteps.map((stepVal, idx) => {
          const diag = diagnostics.find((d) => d.stepIndex === idx);
          const numericCheck = stepVal.includes('=')
            ? verifySimpleNumericEquation(stepVal)
            : { canVerify: false };
          const stepExprEval = !stepVal.includes('=')
            ? tryEvaluateNumericExpression(stepVal)
            : { ok: false as const };
          const formatted = formatMathNotation(stepVal);

          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 sm:p-3.5 transition ${
                diag?.status === 'error'
                  ? 'border-rose-400/50 bg-rose-500/10'
                  : diag?.status === 'correct'
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : activeTarget === idx
                  ? 'border-sky-400/50 bg-[#091536]'
                  : 'border-white/10 bg-[#050B1C]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setActiveTarget(idx)}
                  title={`Target Step ${idx + 1} for math symbols`}
                  className={`text-xs font-bold w-14 shrink-0 text-left rounded px-1 py-0.5 transition ${
                    activeTarget === idx ? 'text-[#5EEAD4] bg-sky-500/15' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Step {idx + 1}
                </button>
                <input
                  ref={(el) => {
                    inputRefs.current[`step-${idx}`] = el;
                  }}
                  type="text"
                  value={stepVal}
                  aria-label={`Working step ${idx + 1}`}
                  onFocus={(e) => {
                    setActiveTarget(idx);
                    recordSelection(`step-${idx}`, e.currentTarget);
                  }}
                  onClick={(e) => recordSelection(`step-${idx}`, e.currentTarget)}
                  onKeyUp={(e) => recordSelection(`step-${idx}`, e.currentTarget)}
                  onSelect={(e) => recordSelection(`step-${idx}`, e.currentTarget)}
                  onChange={(e) => {
                    recordSelection(`step-${idx}`, e.currentTarget);
                    const copy = [...ensureSteps];
                    copy[idx] = e.target.value;
                    onChangeSteps(copy);
                  }}
                  placeholder={`Line ${idx + 1} working (e.g. 2x = 6 or 125 * 4)`}
                  className="min-h-[30px] flex-1 bg-transparent text-base text-white font-mono placeholder-slate-500 focus:outline-none"
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
                {stepExprEval.ok && stepVal.trim() !== String(stepExprEval.value) && (
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300">
                    = {Number.isInteger(stepExprEval.value) ? stepExprEval.value : Number(stepExprEval.value.toFixed(6))}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveStep(idx)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition"
                  title="Remove step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Live math notation preview */}
              {formatted && formatted !== stepVal && (
                <div className="mt-1.5 pl-16 text-xs text-teal-300 font-medium">
                  Notation: {formatted}
                </div>
              )}

              {/* Step diagnostic feedback */}
              {diag && (
                <div
                  className={`mt-1.5 pl-16 flex items-start gap-1.5 text-xs ${
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-3.5 py-2 text-xs font-medium text-slate-200 transition"
          >
            <Plus className="w-3.5 h-3.5 text-sky-300" />
            Add Working Line
          </button>

          {!hideAICheckButton && (
            <button
              type="button"
              onClick={handleCheckWorking}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] hover:opacity-95 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition"
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
        <div
          className={`rounded-xl border p-3 transition ${
            activeTarget === 'final'
              ? 'border-sky-400/50 bg-[#091536]'
              : 'border-white/10 bg-[#050B1C]'
          }`}
        >
          <label htmlFor="mathWorkspaceFinalAnswer" className="block text-[11px] font-semibold text-slate-300 mb-1">
            Final Answer
          </label>
          <input
            id="mathWorkspaceFinalAnswer"
            ref={(el) => {
              inputRefs.current.final = el;
            }}
            type="text"
            value={finalAnswer}
            aria-label="Final Answer"
            onFocus={(e) => {
              setActiveTarget('final');
              recordSelection('final', e.currentTarget);
            }}
            onClick={(e) => recordSelection('final', e.currentTarget)}
            onKeyUp={(e) => recordSelection('final', e.currentTarget)}
            onSelect={(e) => recordSelection('final', e.currentTarget)}
            onChange={(e) => {
              recordSelection('final', e.currentTarget);
              onChangeFinalAnswer(e.target.value);
            }}
            placeholder="e.g. x = 3 or 512"
            className="w-full bg-transparent text-base text-white font-mono placeholder-slate-500 focus:outline-none"
          />
          {finalAnswer && formatMathNotation(finalAnswer) !== finalAnswer && (
            <p className="mt-1.5 text-xs text-teal-300">
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
