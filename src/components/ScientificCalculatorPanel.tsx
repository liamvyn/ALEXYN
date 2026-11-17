import React from 'react';
import { Calculator, ChevronUp, CornerDownLeft } from 'lucide-react';
import {
  type AngleUnit,
  backspaceCalculatorToken,
  evaluateScientificExpression,
} from '../utils/scientificCalculator';

export interface ScientificCalculatorState {
  expression: string;
  displayResult: string;
  fractionText?: string;
  lastAns: number;
  angleUnit: AngleUnit;
  showFraction: boolean;
  errorText?: string;
}

export const INITIAL_CALCULATOR_STATE: ScientificCalculatorState = {
  expression: '',
  displayResult: '0',
  lastAns: 0,
  angleUnit: 'DEG',
  showFraction: false,
};

interface ScientificCalculatorPanelProps {
  open: boolean;
  state: ScientificCalculatorState;
  onChangeState: (next: ScientificCalculatorState) => void;
  onCollapse: () => void;
  onInsertResult?: (valueText: string) => void;
  activeTargetLabel?: string;
}

export const ScientificCalculatorPanel: React.FC<ScientificCalculatorPanelProps> = ({
  open,
  state,
  onChangeState,
  onCollapse,
  onInsertResult,
  activeTargetLabel,
}) => {
  if (!open) return null;

  const stopKeyboardFocus = (e: React.SyntheticEvent) => {
    e.preventDefault();
  };

  const appendToken = (token: string) => {
    const nextExpr = state.errorText ? token : `${state.expression}${token}`;
    onChangeState({
      ...state,
      expression: nextExpr,
      errorText: undefined,
    });
  };

  const handleDel = () => {
    onChangeState({
      ...state,
      expression: backspaceCalculatorToken(state.expression),
      errorText: undefined,
    });
  };

  const handleClearAll = () => {
    onChangeState({
      ...state,
      expression: '',
      displayResult: '0',
      fractionText: undefined,
      errorText: undefined,
    });
  };

  const handleToggleSign = () => {
    const expr = state.expression.trim();
    if (!expr) {
      appendToken('-');
      return;
    }
    if (expr.startsWith('-(') && expr.endsWith(')')) {
      onChangeState({ ...state, expression: expr.slice(2, -1), errorText: undefined });
    } else if (expr.startsWith('-')) {
      onChangeState({ ...state, expression: expr.slice(1), errorText: undefined });
    } else {
      onChangeState({ ...state, expression: `-${expr}`, errorText: undefined });
    }
  };

  const handleEvaluate = () => {
    const targetExpr = state.expression.trim() || state.displayResult;
    const res = evaluateScientificExpression(targetExpr, state.lastAns, state.angleUnit);
    if (!res.ok || !res.formatted) {
      onChangeState({
        ...state,
        errorText: res.error || 'Error',
      });
      return;
    }
    onChangeState({
      ...state,
      displayResult: res.formatted,
      fractionText: res.fractionText,
      lastAns: res.numericValue ?? state.lastAns,
      errorText: undefined,
    });
  };

  const shownValue =
    state.showFraction && state.fractionText ? state.fractionText : state.displayResult;

  const sciButtons: Array<{ label: string; token?: string; onTap?: () => void; title: string; accent?: string }> = [
    { label: 'x²', token: '^2', title: 'Square (x²)' },
    { label: 'x³', token: '^3', title: 'Cube (x³)' },
    { label: 'xⁿ', token: '^', title: 'Power (x^y)' },
    { label: '√', token: 'sqrt(', title: 'Square root' },
    { label: '∛', token: 'cbrt(', title: 'Cube root' },
    { label: 'ⁿ√', token: 'nthRoot(', title: 'nth root: nthRoot(val, n)' },
    { label: 'sin', token: 'sin(', title: 'Sine' },
    { label: 'cos', token: 'cos(', title: 'Cosine' },
    { label: 'tan', token: 'tan(', title: 'Tangent' },
    { label: 'log', token: 'log(', title: 'Log base 10' },
    { label: 'ln', token: 'ln(', title: 'Natural log' },
    { label: 'π', token: 'π', title: 'Pi constant' },
    { label: '(', token: '(', title: 'Open bracket' },
    { label: ')', token: ')', title: 'Close bracket' },
    { label: 'a/b', token: '/', title: 'Fraction / Divide' },
    { label: '%', token: '%', title: 'Percentage' },
    { label: 'e', token: 'e', title: 'Euler number e' },
    { label: 'Ans', token: 'Ans', title: 'Previous result' },
  ];

  return (
    <div
      role="region"
      aria-label="ALEXYN Scientific Calculator"
      className="mx-auto w-full max-w-md rounded-2xl border border-[#38BDF8]/40 bg-[#050C21] p-3 shadow-2xl"
    >
      {/* Header Controls */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#112659] text-[#5EEAD4]">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-wide text-white">
              ALEXYN Scientific
            </p>
            <p className="text-[10px] text-slate-400">fx-Studio · Independent Keypad</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={stopKeyboardFocus}
            onPointerDown={stopKeyboardFocus}
            onClick={() =>
              onChangeState({
                ...state,
                angleUnit: state.angleUnit === 'DEG' ? 'RAD' : 'DEG',
              })
            }
            aria-label="Toggle angle unit degrees or radians"
            className="rounded-lg border border-white/15 bg-[#0C1A3D] px-2 py-1 text-[10px] font-bold text-[#7DD3FC] hover:border-[#38BDF8]"
          >
            {state.angleUnit}
          </button>

          {state.fractionText && (
            <button
              type="button"
              onMouseDown={stopKeyboardFocus}
              onPointerDown={stopKeyboardFocus}
              onClick={() =>
                onChangeState({ ...state, showFraction: !state.showFraction })
              }
              title="Toggle decimal and simplified fraction"
              className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                state.showFraction
                  ? 'border-[#5EEAD4] bg-[#0F2A44] text-[#5EEAD4]'
                  : 'border-white/15 bg-[#0C1A3D] text-slate-300'
              }`}
            >
              S⇔D
            </button>
          )}

          <button
            type="button"
            onMouseDown={stopKeyboardFocus}
            onPointerDown={stopKeyboardFocus}
            onClick={onCollapse}
            aria-label="Minimize calculator"
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#0C1A3D] px-2 py-1 text-[10px] font-semibold text-slate-300 hover:text-white"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Minimize</span>
          </button>
        </div>
      </div>

      {/* Casio-style Two-line LCD Display */}
      <div
        aria-live="polite"
        className="mb-2.5 rounded-xl border border-[#5EEAD4]/30 bg-[#08162F] px-3 py-2.5 font-mono shadow-inner"
      >
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{state.angleUnit} · {state.lastAns !== 0 ? `Ans=${state.lastAns}` : 'Ready'}</span>
          {state.fractionText && !state.errorText && (
            <span className="text-[#5EEAD4]">Frac: {state.fractionText}</span>
          )}
        </div>
        <div className="mt-1 min-h-[20px] break-all text-left text-xs text-slate-200">
          {state.expression || '0'}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2 border-t border-white/10 pt-1">
          {onInsertResult && !state.errorText && state.displayResult !== '0' ? (
            <button
              type="button"
              onMouseDown={stopKeyboardFocus}
              onPointerDown={stopKeyboardFocus}
              onClick={() => onInsertResult(shownValue)}
              title={activeTargetLabel ? `Insert into ${activeTargetLabel}` : 'Insert result'}
              className="inline-flex items-center gap-1 rounded-md border border-[#5EEAD4]/40 bg-[#0D2A3F] px-2 py-0.5 text-[10px] font-sans font-semibold text-[#5EEAD4] hover:text-white"
            >
              <CornerDownLeft className="h-3 w-3" />
              <span>Insert</span>
            </button>
          ) : (
            <span />
          )}
          <span
            data-testid="calc-display-result"
            className={`text-right text-xl font-extrabold tracking-tight ${
              state.errorText ? 'text-rose-300 text-sm' : 'text-[#5EEAD4]'
            }`}
          >
            {state.errorText || shownValue}
          </span>
        </div>
      </div>

      {/* Scientific Function Keys (6 columns) */}
      <div className="mb-2 grid grid-cols-6 gap-1">
        {sciButtons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            title={btn.title}
            onMouseDown={stopKeyboardFocus}
            onPointerDown={stopKeyboardFocus}
            onClick={() => (btn.onTap ? btn.onTap() : btn.token && appendToken(btn.token))}
            className="min-h-[34px] rounded-lg border border-white/10 bg-[#0D1A3B] px-1 py-1 font-mono text-[11px] font-semibold text-[#BAE6FD] transition hover:border-[#38BDF8]/50 hover:bg-[#162958] active:scale-95"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Main Number & Operator Keypad (5 columns) */}
      <div className="grid grid-cols-5 gap-1.5 font-mono">
        {[
          { label: '7', type: 'num', val: '7' },
          { label: '8', type: 'num', val: '8' },
          { label: '9', type: 'num', val: '9' },
          { label: 'DEL', type: 'del' },
          { label: 'AC', type: 'ac' },

          { label: '4', type: 'num', val: '4' },
          { label: '5', type: 'num', val: '5' },
          { label: '6', type: 'num', val: '6' },
          { label: '×', type: 'op', val: '×' },
          { label: '÷', type: 'op', val: '÷' },

          { label: '1', type: 'num', val: '1' },
          { label: '2', type: 'num', val: '2' },
          { label: '3', type: 'num', val: '3' },
          { label: '+', type: 'op', val: '+' },
          { label: '−', type: 'op', val: '−' },

          { label: '0', type: 'num', val: '0' },
          { label: '.', type: 'num', val: '.' },
          { label: '±', type: 'sign' },
          { label: '=', type: 'eq', span: true },
        ].map((key) => {
          const isEq = key.type === 'eq';
          const isDel = key.type === 'del';
          const isAc = key.type === 'ac';
          const isOp = key.type === 'op';

          const handlePress = () => {
            if (key.type === 'del') handleDel();
            else if (key.type === 'ac') handleClearAll();
            else if (key.type === 'sign') handleToggleSign();
            else if (key.type === 'eq') handleEvaluate();
            else if (key.val) appendToken(key.val);
          };

          return (
            <button
              key={key.label}
              type="button"
              onMouseDown={stopKeyboardFocus}
              onPointerDown={stopKeyboardFocus}
              onClick={handlePress}
              className={`min-h-[40px] rounded-xl border text-sm font-bold transition active:scale-95 ${
                isEq
                  ? 'col-span-2 border-transparent bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] text-white shadow-md shadow-sky-500/20'
                  : isAc
                  ? 'border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : isDel
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                  : isOp
                  ? 'border-[#38BDF8]/30 bg-[#122658] text-[#7DD3FC] hover:bg-[#183372]'
                  : 'border-white/10 bg-[#0A1430] text-white hover:border-[#38BDF8]/40 hover:bg-[#10204A]'
              }`}
            >
              {key.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
