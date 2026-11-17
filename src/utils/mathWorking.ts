import { evaluate, parse } from 'mathjs';

export interface MathSymbolButton {
  label: string;
  insert: string;
  cursorOffset?: number;
  title: string;
}

export interface MathSymbolGroup {
  id: 'operators' | 'algebra' | 'powers' | 'functions';
  label: string;
  buttons: MathSymbolButton[];
}

export const QUICK_MATH_KEYS: MathSymbolButton[] = [
  { label: 'x', insert: 'x', title: 'Variable x' },
  { label: 'y', insert: 'y', title: 'Variable y' },
  { label: '=', insert: ' = ', title: 'Equals' },
  { label: '+', insert: ' + ', title: 'Plus' },
  { label: '−', insert: ' - ', title: 'Minus' },
  { label: '×', insert: ' * ', title: 'Multiply' },
  { label: '÷', insert: ' / ', title: 'Divide / Fraction' },
  { label: '^', insert: '^', title: 'Power exponent' },
  { label: '√', insert: 'sqrt()', cursorOffset: 5, title: 'Square root' },
  { label: '(', insert: '(', title: 'Open bracket' },
  { label: ')', insert: ')', title: 'Close bracket' },
  { label: '.', insert: '.', title: 'Decimal point' },
  { label: '1', insert: '1', title: 'Digit 1' },
  { label: '2', insert: '2', title: 'Digit 2' },
  { label: '3', insert: '3', title: 'Digit 3' },
  { label: '4', insert: '4', title: 'Digit 4' },
  { label: '5', insert: '5', title: 'Digit 5' },
  { label: '6', insert: '6', title: 'Digit 6' },
  { label: '7', insert: '7', title: 'Digit 7' },
  { label: '8', insert: '8', title: 'Digit 8' },
  { label: '9', insert: '9', title: 'Digit 9' },
  { label: '0', insert: '0', title: 'Digit 0' },
];

export const MATH_SYMBOL_GROUPS: MathSymbolGroup[] = [
  {
    id: 'operators',
    label: 'Operators & Relations',
    buttons: [
      { label: '+', insert: ' + ', title: 'Plus' },
      { label: '−', insert: ' - ', title: 'Minus' },
      { label: '×', insert: ' * ', title: 'Multiply' },
      { label: '÷', insert: ' / ', title: 'Divide / Fraction' },
      { label: '=', insert: ' = ', title: 'Equals' },
      { label: '≠', insert: ' != ', title: 'Not equal' },
      { label: '<', insert: ' < ', title: 'Less than' },
      { label: '>', insert: ' > ', title: 'Greater than' },
      { label: '≤', insert: ' <= ', title: 'Less than or equal' },
      { label: '≥', insert: ' >= ', title: 'Greater than or equal' },
      { label: '±', insert: ' ± ', title: 'Plus or minus' },
      { label: '.', insert: '.', title: 'Decimal point' },
    ],
  },
  {
    id: 'powers',
    label: 'Fractions, Powers & Roots',
    buttons: [
      { label: '(a)/(b)', insert: '() / ()', cursorOffset: 1, title: 'Fraction' },
      { label: 'x²', insert: '^2', title: 'Square power' },
      { label: 'x³', insert: '^3', title: 'Cube power' },
      { label: 'xⁿ', insert: '^()', cursorOffset: 2, title: 'Exponent / power' },
      { label: 'x₁', insert: '_1', title: 'Subscript 1' },
      { label: 'xₙ', insert: '_()', cursorOffset: 2, title: 'Subscript' },
      { label: '√', insert: 'sqrt()', cursorOffset: 5, title: 'Square root' },
      { label: '∛', insert: 'cbrt()', cursorOffset: 5, title: 'Cube root' },
      { label: 'ⁿ√', insert: 'nthRoot(, )', cursorOffset: 8, title: 'nth root: nthRoot(value, n)' },
      { label: '( )', insert: '()', cursorOffset: 1, title: 'Parentheses' },
      { label: '[ ]', insert: '[]', cursorOffset: 1, title: 'Square brackets' },
      { label: '{ }', insert: '{}', cursorOffset: 1, title: 'Curly brackets' },
      { label: '|x|', insert: 'abs()', cursorOffset: 4, title: 'Absolute value' },
    ],
  },
  {
    id: 'algebra',
    label: 'Variables & Greek',
    buttons: [
      { label: 'x', insert: 'x', title: 'Variable x' },
      { label: 'y', insert: 'y', title: 'Variable y' },
      { label: 'z', insert: 'z', title: 'Variable z' },
      { label: 'a', insert: 'a', title: 'Coefficient a' },
      { label: 'b', insert: 'b', title: 'Coefficient b' },
      { label: 'c', insert: 'c', title: 'Constant c' },
      { label: 'n', insert: 'n', title: 'Integer n' },
      { label: 'π', insert: 'pi', title: 'Pi constant' },
      { label: 'α', insert: 'α', title: 'Greek alpha' },
      { label: 'β', insert: 'β', title: 'Greek beta' },
      { label: 'Δ', insert: 'Δ', title: 'Greek Delta (change / discriminant)' },
      { label: 'θ', insert: 'θ', title: 'Angle theta' },
      { label: '°', insert: '°', title: 'Degrees' },
      { label: '%', insert: '%', title: 'Percent' },
    ],
  },
  {
    id: 'functions',
    label: 'Trig & Logs',
    buttons: [
      { label: 'sin', insert: 'sin()', cursorOffset: 4, title: 'Sine' },
      { label: 'cos', insert: 'cos()', cursorOffset: 4, title: 'Cosine' },
      { label: 'tan', insert: 'tan()', cursorOffset: 4, title: 'Tangent' },
      { label: 'log', insert: 'log10()', cursorOffset: 6, title: 'Log base 10' },
      { label: 'ln', insert: 'log()', cursorOffset: 4, title: 'Natural logarithm' },
      { label: 'eˣ', insert: 'exp()', cursorOffset: 4, title: 'Exponential' },
      { label: '→', insert: ' → ', title: 'Implies / Leads to' },
      { label: '∴', insert: '∴ ', title: 'Therefore' },
    ],
  },
];

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  'n': 'ⁿ',
  'x': 'ˣ',
  'y': 'ʸ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  'a': 'ₐ',
  'e': 'ₑ',
  'i': 'ᵢ',
  'k': 'ₖ',
  'm': 'ₘ',
  'n': 'ₙ',
  'o': 'ₒ',
  'p': 'ₚ',
  'r': 'ᵣ',
  's': 'ₛ',
  't': 'ₜ',
  'x': 'ₓ',
};

function toSuperscript(exp: string): string {
  const clean = exp.replace(/^\((.+)\)$/, '$1').trim();
  if (/^[0-9+\-nxy]+$/.test(clean)) {
    return clean
      .split('')
      .map((ch) => SUPERSCRIPT_MAP[ch] || ch)
      .join('');
  }
  return `^(${clean})`;
}

function toSubscript(sub: string): string {
  const clean = sub.replace(/^\((.+)\)$/, '$1').trim();
  if (/^[0-9+\-aeikmnoprstx]+$/.test(clean)) {
    return clean
      .split('')
      .map((ch) => SUBSCRIPT_MAP[ch] || ch)
      .join('');
  }
  return `_(${clean})`;
}

/**
 * Formats keyboard/symbol math syntax (e.g. "x^2 + sqrt(16) * pi != 0")
 * into clear mathematical notation ("x² + √(16) × π ≠ 0").
 */
export function formatMathNotation(raw: string): string {
  let out = String(raw || '').trim();
  if (!out) return '';

  out = out
    .replace(/nthRoot\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/gi, (_, val: string, rootN: string) => {
      return `${toSuperscript(rootN)}√(${val.trim()})`;
    })
    .replace(/sqrt\s*\(/gi, '√(')
    .replace(/cbrt\s*\(/gi, '∛(')
    .replace(/log10\s*\(/gi, 'log₁₀(')
    .replace(/\blog\s*\(/gi, 'ln(')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\balpha\b/gi, 'α')
    .replace(/\bbeta\b/gi, 'β')
    .replace(/\bdelta\b/g, 'Δ')
    .replace(/\btheta\b/gi, 'θ')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/\*/g, ' × ')
    .replace(/\^(\([^)]+\)|[0-9nxy])/g, (_, exp: string) => toSuperscript(exp))
    .replace(/_(\([^)]+\)|[0-9a-zA-Z])/g, (_, sub: string) => toSubscript(sub))
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}

export function insertAtCursor(
  currentValue: string,
  selStart: number | null | undefined,
  selEnd: number | null | undefined,
  insertText: string,
  cursorOffset?: number
): { nextValue: string; nextCaret: number } {
  const safeVal = String(currentValue || '');
  const start = Math.max(0, Math.min(safeVal.length, selStart ?? safeVal.length));
  const end = Math.max(start, Math.min(safeVal.length, selEnd ?? start));
  const nextValue = safeVal.slice(0, start) + insertText + safeVal.slice(end);
  const nextCaret = start + (cursorOffset ?? insertText.length);
  return { nextValue, nextCaret };
}

export function backspaceAtCursor(
  currentValue: string,
  selStart: number | null | undefined,
  selEnd: number | null | undefined
): { nextValue: string; nextCaret: number } {
  const safeVal = String(currentValue || '');
  const start = Math.max(0, Math.min(safeVal.length, selStart ?? safeVal.length));
  const end = Math.max(start, Math.min(safeVal.length, selEnd ?? start));
  if (end > start) {
    return {
      nextValue: safeVal.slice(0, start) + safeVal.slice(end),
      nextCaret: start,
    };
  }
  if (start === 0) {
    return { nextValue: safeVal, nextCaret: 0 };
  }
  return {
    nextValue: safeVal.slice(0, start - 1) + safeVal.slice(start),
    nextCaret: start - 1,
  };
}

export function joinWorkingLines(steps: string[]): string {
  return (Array.isArray(steps) ? steps : ['']).join('\n');
}

export function splitWorkingLines(text: string): string[] {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.length > 0 ? lines : [''];
}

export function hasSubstantialMathWork(
  problem: string,
  steps: string[],
  finalAnswer = ''
): boolean {
  const nonEmptySteps = (Array.isArray(steps) ? steps : []).map((s) => s.trim()).filter(Boolean);
  const totalStepChars = nonEmptySteps.join('').length;
  return (
    nonEmptySteps.length >= 2 ||
    totalStepChars >= 20 ||
    (Boolean(finalAnswer.trim()) && (nonEmptySteps.length >= 1 || problem.trim().length > 12))
  );
}

export function normalizeExpressionForEval(raw: string): string {
  return String(raw || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
    .replace(/°/g, ' deg')
    .replace(/√\(/g, 'sqrt(')
    .replace(/∛\(/g, 'cbrt(')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tryEvaluateNumericExpression(expr: string): { ok: true; value: number } | { ok: false } {
  const cleaned = normalizeExpressionForEval(expr);
  if (!cleaned || cleaned.includes('=')) return { ok: false };
  try {
    parse(cleaned);
    const val = evaluate(cleaned);
    if (typeof val === 'number' && Number.isFinite(val)) {
      return { ok: true, value: val };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export function verifySimpleNumericEquation(equationLine: string): {
  canVerify: boolean;
  isTrue?: boolean;
  leftVal?: number;
  rightVal?: number;
} {
  const parts = equationLine.split('=');
  if (parts.length !== 2) return { canVerify: false };
  const left = tryEvaluateNumericExpression(parts[0]);
  const right = tryEvaluateNumericExpression(parts[1]);
  if (!left.ok || !right.ok) return { canVerify: false };
  const isTrue = Math.abs(left.value - right.value) < 1e-6;
  return {
    canVerify: true,
    isTrue,
    leftVal: left.value,
    rightVal: right.value,
  };
}
