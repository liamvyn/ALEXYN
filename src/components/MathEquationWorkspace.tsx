import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CornerDownLeft,
  Delete,
  Eraser,
  Keyboard,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AISelection,
  EducationProfile,
  MathWorkingEvaluation,
} from '../types/alexyn';
import {
  backspaceAtCursor,
  formatMathNotation,
  hasSubstantialMathWork,
  insertAtCursor,
  joinWorkingLines,
  MATH_SYMBOL_GROUPS,
  QUICK_MATH_KEYS,
  splitWorkingLines,
  tryEvaluateNumericExpression,
  verifySimpleNumericEquation,
} from '../utils/mathWorking';
import { formatConnectionError, apiUrl, parseJsonResponseSafe } from '../utils/apiBase';
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
  const [activeTarget, setActiveTarget] = useState<'problem' | 'working' | 'final'>('working');
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
  const [confirmCancelMode, setConfirmCancelMode] = useState<'problem' | 'blank' | null>(null);

  const calcState = externalCalcState ?? internalCalcState;
  const setCalcState = onChangeCalcState ?? setInternalCalcState;

  const problemRef = useRef<HTMLTextAreaElement | null>(null);
  const workingRef = useRef<HTMLTextAreaElement | null>(null);
  const finalRef = useRef<HTMLInputElement | null>(null);
  const lastSelectionRef = useRef<Record<'problem' | 'working' | 'final', { start: number; end: number }>>({
    problem: { start: problemStatement.length, end: problemStatement.length },
    working: { start: joinWorkingLines(steps).length, end: joinWorkingLines(steps).length },
    final: { start: finalAnswer.length, end: finalAnswer.length },
  });

  const safeSteps = steps.length > 0 ? steps : [''];
  const workingText = joinWorkingLines(safeSteps);
  const effectiveTarget: 'problem' | 'working' | 'final' =
    activeTarget === 'problem' && readOnlyProblem
      ? 'working'
      : activeTarget === 'final' && !onChangeFinalAnswer
      ? 'working'
      : activeTarget;

  const recordSelection = (
    key: 'problem' | 'working' | 'final',
    el: HTMLInputElement | HTMLTextAreaElement | null
  ) => {
    if (!el) return;
    lastSelectionRef.current[key] = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const getTargetElement = (key: 'problem' | 'working' | 'final') => {
    if (key === 'problem') return problemRef.current;
    if (key === 'final') return finalRef.current;
    return workingRef.current;
  };

  const getTargetValue = (key: 'problem' | 'working' | 'final') => {
    if (key === 'problem') return problemStatement;
    if (key === 'final') return finalAnswer;
    return workingText;
  };

  const applyTargetValue = (
    key: 'problem' | 'working' | 'final',
    nextVal: string,
    nextCaret: number
  ) => {
    lastSelectionRef.current[key] = { start: nextCaret, end: nextCaret };
    if (key === 'problem') {
      onChangeProblem?.(nextVal);
    } else if (key === 'final') {
      onChangeFinalAnswer?.(nextVal);
    } else {
      onChangeSteps(splitWorkingLines(nextVal));
    }

    const el = getTargetElement(key);
    if (el && typeof document !== 'undefined' && document.activeElement === el) {
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    }
  };

  const handleInsertSymbol = (insertText: string, cursorOffset?: number) => {
    const key = effectiveTarget;
    const el = getTargetElement(key);
    const isElementActive =
      typeof document !== 'undefined' && el !== null && document.activeElement === el;
    const currentValue = getTargetValue(key);
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
    applyTargetValue(key, nextValue, nextCaret);
  };

  const handleMathBackspace = () => {
    const key = effectiveTarget;
    const el = getTargetElement(key);
    const isElementActive =
      typeof document !== 'undefined' && el !== null && document.activeElement === el;
    const currentValue = getTargetValue(key);
    const recorded = lastSelectionRef.current[key];
    const hasLiveSelection = Boolean(isElementActive && el && typeof el.selectionStart === 'number');
    const selStart = hasLiveSelection
      ? (el!.selectionStart ?? currentValue.length)
      : (recorded?.start ?? currentValue.length);
    const selEnd = hasLiveSelection
      ? (el!.selectionEnd ?? selStart)
      : (recorded?.end ?? selStart);

    const { nextValue, nextCaret } = backspaceAtCursor(currentValue, selStart, selEnd);
    applyTargetValue(key, nextValue, nextCaret);
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

  const resetAllCurrentProblem = (clearWorkingToo: boolean) => {
    onChangeProblem?.('');
    if (clearWorkingToo) {
      onChangeSteps(['']);
      onChangeFinalAnswer?.('');
      setEvalResult(null);
      setEvalError('');
    }
    setConfirmCancelMode(null);
    setActiveTarget('problem');
    requestAnimationFrame(() => {
      problemRef.current?.focus();
    });
  };

  const handleRedCancelProblemClick = () => {
    if (readOnlyProblem) return;
    if (hasSubstantialMathWork(problemStatement, safeSteps, finalAnswer)) {
      setConfirmCancelMode('problem');
      return;
    }
    resetAllCurrentProblem(true);
  };

  const handleBlankPageClick = () => {
    if (hasSubstantialMathWork(problemStatement, safeSteps, finalAnswer)) {
      setConfirmCancelMode('blank');
      return;
    }
    resetAllCurrentProblem(true);
  };

  const handleCheckWorking = async () => {
    const nonEmpty = safeSteps.map((s) => s.trim()).filter(Boolean);
    if (!problemStatement.trim() || (nonEmpty.length === 0 && !finalAnswer.trim())) {
      setEvalError('Enter the problem or calculation and at least one working line first.');
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
      const data = await parseJsonResponseSafe<MathWorkingEvaluation>(resp);
      if (!resp.ok) {
        throw new Error(data.error || 'Could not evaluate working right now.');
      }
      setEvalResult(data);
    } catch (err) {
      setEvalError(formatConnectionError(err, 'Step-by-step evaluation failed.'));
    } finally {
      setChecking(false);
    }
  };

  const diagnostics = externalDiagnostics || evalResult?.stepDiagnostics || [];
  const activeGroup =
    MATH_SYMBOL_GROUPS.find((g) => g.id === activeGroupId) || MATH_SYMBOL_GROUPS[0];
  const problemEval = tryEvaluateNumericExpression(problemStatement);
  const activeTargetLabel =
    effectiveTarget === 'problem'
      ? 'Problem / Entry'
      : effectiveTarget === 'final'
      ? 'Final Answer'
      : 'Working Space';

  const nonEmptyLines = safeSteps
    .map((line, index) => ({ line: line.trim(), rawLine: line, index }))
    .filter((item) => item.line.length > 0);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#071026]/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            Interactive Mathematics Calculation &amp; Working Notebook
          </p>
          <p className="text-[11px] text-slate-400">
            Write continuously across multiple lines (press Enter for the next line), or toggle{' '}
            <span className="font-semibold text-[#5EEAD4]">Scientific Calculator</span> and{' '}
            <span className="font-semibold text-sky-200">Math Keyboard</span> independently.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnlyProblem && (
            <button
              type="button"
              onClick={handleBlankPageClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-400/40 hover:text-white"
            >
              <Eraser className="h-3.5 w-3.5" />
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
            <Calculator className="h-3.5 w-3.5" />
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
            <Keyboard className="h-3.5 w-3.5" />
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

      {/* Problem / Entry Box with Visible Red X Cancellation Control */}
      {!readOnlyProblem && (
        <div
          className={`rounded-xl border p-3 transition ${
            effectiveTarget === 'problem'
              ? 'border-sky-400/50 bg-[#091536]'
              : 'border-white/10 bg-[#050B1C]'
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="mathWorkspaceProblemInput" className="text-[11px] font-semibold text-slate-300">
              Math Problem or Expression
            </label>
            <div className="flex items-center gap-2">
              {problemEval.ok && (
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                  = {Number.isInteger(problemEval.value) ? problemEval.value : Number(problemEval.value.toFixed(6))}
                </span>
              )}
              {(problemStatement.trim() || workingText.trim() || finalAnswer.trim()) && (
                <button
                  type="button"
                  data-testid="cancel-math-problem-btn"
                  onClick={handleRedCancelProblemClick}
                  aria-label="Cancel and remove current math problem"
                  title="Cancel / remove this unwanted math problem"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/60 bg-rose-600/20 text-rose-400 transition hover:bg-rose-600 hover:text-white"
                >
                  <X className="h-4 w-4 stroke-[2.75]" />
                </button>
              )}
            </div>
          </div>
          <textarea
            id="mathWorkspaceProblemInput"
            ref={problemRef}
            rows={2}
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
            placeholder="Write your math problem or expression across one or more lines (e.g. Solve 2x^2 - 8 = 0)..."
            className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed text-white placeholder-slate-500 focus:outline-none sm:text-base"
          />
          {problemStatement && formatMathNotation(problemStatement) !== problemStatement && (
            <p className="mt-1.5 text-xs font-medium text-teal-300">
              Notation: {formatMathNotation(problemStatement)}
            </p>
          )}
        </div>
      )}

      {/* Safe Inline Confirmation Banner when Cancelling Substantial Existing Work */}
      {confirmCancelMode && (
        <div
          role="alertdialog"
          aria-label="Confirm removing current problem"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/45 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-100"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="font-bold text-white">
                {confirmCancelMode === 'problem'
                  ? 'Cancel and clear this problem entry?'
                  : 'Start a fresh blank page?'}
              </p>
              <p className="text-[11px] text-rose-200/90">
                Your calculator history, saved quizzes, and other notes remain completely untouched.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {confirmCancelMode === 'problem' && (
              <button
                type="button"
                onClick={() => resetAllCurrentProblem(false)}
                className="rounded-lg border border-rose-400/50 bg-[#0A1430] px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
              >
                Clear Problem Text Only
              </button>
            )}
            <button
              type="button"
              onClick={() => resetAllCurrentProblem(true)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500"
            >
              Remove Problem &amp; Working
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancelMode(null)}
              className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-white"
            >
              Keep Working
            </button>
          </div>
        </div>
      )}

      {/* Independent Mathematical Writing Keyboard (never triggers phone OS keyboard) */}
      {showKeyboard && (
        <div
          role="region"
          aria-label="ALEXYN Mathematical Writing Keyboard"
          className="space-y-2.5 rounded-xl border border-sky-400/25 bg-[#050B1D] p-3"
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
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                    activeGroupId === g.id
                      ? 'border-sky-400/40 bg-sky-500/25 text-sky-200'
                      : 'border-transparent bg-white/[0.03] text-slate-400 hover:text-slate-200'
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
                className="min-w-[40px] rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:border-sky-400/40 hover:bg-sky-500/20 active:scale-95 sm:text-sm"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Always-visible Variable (x, y), Operators, Brackets, Digits, New Line & Backspace Bar */}
          <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-2">
            {QUICK_MATH_KEYS.map((keyItem) => {
              const isVar = keyItem.insert === 'x' || keyItem.insert === 'y';
              return (
                <button
                  key={keyItem.label}
                  type="button"
                  title={keyItem.title}
                  aria-label={keyItem.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSymbol(keyItem.insert, keyItem.cursorOffset)}
                  className={`min-w-[32px] rounded-md border px-2 py-1 font-mono text-xs font-bold transition active:scale-95 ${
                    isVar
                      ? 'border-sky-400/50 bg-sky-500/20 italic text-sky-200 hover:bg-sky-500/35'
                      : 'border-white/10 bg-[#0A1534] text-slate-100 hover:bg-sky-500/20'
                  }`}
                >
                  {keyItem.label}
                </button>
              );
            })}
            <button
              type="button"
              title="Next line (Enter)"
              aria-label="Insert new working line"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleInsertSymbol('\n')}
              className="inline-flex items-center gap-1 rounded-md border border-[#5EEAD4]/40 bg-[#0D2A3F] px-2.5 py-1 text-xs font-semibold text-[#5EEAD4] hover:bg-[#143955]"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
              <span>Line</span>
            </button>
            <button
              type="button"
              title="Backspace / Delete character"
              aria-label="Backspace in math workspace"
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleMathBackspace}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
            >
              <Delete className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Continuous Multi-Line Working Space */}
      <div
        className={`rounded-xl border p-3.5 transition ${
          effectiveTarget === 'working'
            ? 'border-sky-400/50 bg-[#091536]'
            : 'border-white/10 bg-[#050B1C]'
        }`}
      >
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="mathContinuousWorkingArea" className="text-xs font-bold text-[#5EEAD4]">
            Continuous Step-by-Step Working Space
          </label>
          <span className="text-[11px] text-slate-400">
            {nonEmptyLines.length} working line{nonEmptyLines.length === 1 ? '' : 's'} · Press Enter to continue to the next line
          </span>
        </div>

        <textarea
          id="mathContinuousWorkingArea"
          ref={workingRef}
          rows={6}
          value={workingText}
          aria-label="Continuous math working space"
          onFocus={(e) => {
            setActiveTarget('working');
            recordSelection('working', e.currentTarget);
          }}
          onClick={(e) => recordSelection('working', e.currentTarget)}
          onKeyUp={(e) => recordSelection('working', e.currentTarget)}
          onSelect={(e) => recordSelection('working', e.currentTarget)}
          onChange={(e) => {
            recordSelection('working', e.currentTarget);
            onChangeSteps(splitWorkingLines(e.target.value));
          }}
          placeholder={
            'Write continuously line by line without losing previous lines...\nStep 1: 3x - 7 = 14\nStep 2: 3x = 14 + 7\nStep 3: 3x = 21\nx = 7'
          }
          className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed text-white placeholder-slate-500 focus:outline-none sm:text-base"
        />

        {/* Live Line-by-Line Notation, Arithmetic Checks & Diagnostics */}
        {nonEmptyLines.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live Line Preview &amp; Verification
            </p>
            {nonEmptyLines.map((item, visibleIdx) => {
              const diag =
                diagnostics.find((d) => d.stepIndex === visibleIdx) ||
                diagnostics.find((d) => d.stepIndex === item.index);
              const numericCheck = item.line.includes('=')
                ? verifySimpleNumericEquation(item.line)
                : { canVerify: false };
              const exprEval = !item.line.includes('=')
                ? tryEvaluateNumericExpression(item.line)
                : { ok: false as const };
              const formatted = formatMathNotation(item.line);

              return (
                <div
                  key={`${item.index}-${visibleIdx}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                    diag?.status === 'error'
                      ? 'border-rose-400/45 bg-rose-500/10 text-rose-100'
                      : diag?.status === 'correct'
                      ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/5 bg-[#060E24] text-slate-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="mr-2 font-mono text-[10px] font-bold text-slate-400">
                      L{visibleIdx + 1}
                    </span>
                    <span className="font-medium text-teal-200">{formatted || item.line}</span>
                    {diag?.note && (
                      <p className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-300">
                        {diag.status === 'error' ? (
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                        )}
                        <span>{diag.note}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {numericCheck.canVerify && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          numericCheck.isTrue
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {numericCheck.isTrue ? 'Arithmetic ✓' : 'Arithmetic ≠'}
                      </span>
                    )}
                    {exprEval.ok && item.line !== String(exprEval.value) && (
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-300">
                        = {Number.isInteger(exprEval.value) ? exprEval.value : Number(exprEval.value.toFixed(6))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!hideAICheckButton && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCheckWorking}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-95 disabled:opacity-50"
          >
            {checking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking Steps...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Check Steps Line-by-Line
              </>
            )}
          </button>
        </div>
      )}

      {/* Optional Final Answer Box */}
      {onChangeFinalAnswer && (
        <div
          className={`rounded-xl border p-3 transition ${
            effectiveTarget === 'final'
              ? 'border-sky-400/50 bg-[#091536]'
              : 'border-white/10 bg-[#050B1C]'
          }`}
        >
          <label htmlFor="mathWorkspaceFinalAnswer" className="mb-1 block text-[11px] font-semibold text-slate-300">
            Final Answer
          </label>
          <input
            id="mathWorkspaceFinalAnswer"
            ref={finalRef}
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
            className="w-full bg-transparent font-mono text-base text-white placeholder-slate-500 focus:outline-none"
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
        <div className="space-y-2 rounded-xl border border-sky-400/30 bg-[#06122E] p-3 text-xs">
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
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-semibold text-white">
              Method Score: {evalResult.scoreAwarded} / {evalResult.maxMarks}
            </span>
          </div>
          {evalResult.correctNextSteps?.length > 0 && (
            <div className="space-y-1 text-slate-200">
              <p className="font-semibold text-sky-300">Correct Continuation:</p>
              {evalResult.correctNextSteps.map((s, i) => (
                <p key={i} className="border-l-2 border-sky-400/40 pl-2 font-mono text-[11px]">
                  {formatMathNotation(s)}
                </p>
              ))}
            </div>
          )}
          {evalResult.conceptualTip && (
            <p className="leading-relaxed text-slate-300">
              <strong className="text-teal-300">Key Principle:</strong> {evalResult.conceptualTip}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
