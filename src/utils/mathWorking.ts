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
    ],
  },
  {
    id: 'powers',
    label: 'Fractions, Powers & Roots',
    buttons: [
      { label: '(a)/(b)', insert: '() / ()', cursorOffset: 1, title: 'Fraction' },
      { label: 'x²', insert: '^2', title: 'Square' },
      { label: 'x³', insert: '^3', title: 'Cube' },
      { label: 'xⁿ', insert: '^()', cursorOffset: 2, title: 'Exponent' },
      { label: '√', insert: 'sqrt()', cursorOffset: 5, title: 'Square root' },
      { label: '( )', insert: '()', cursorOffset: 1, title: 'Brackets' },
      { label: '[ ]', insert: '[]', cursorOffset: 1, title: 'Square brackets' },
      { label: '|x|', insert: 'abs()', cursorOffset: 4, title: 'Absolute value' },
    ],
  },
  {
    id: 'algebra',
    label: 'Variables & Constants',
    buttons: [
      { label: 'x', insert: 'x', title: 'Variable x' },
      { label: 'y', insert: 'y', title: 'Variable y' },
      { label: 'z', insert: 'z', title: 'Variable z' },
      { label: 'a', insert: 'a', title: 'Coefficient a' },
      { label: 'b', insert: 'b', title: 'Coefficient b' },
      { label: 'c', insert: 'c', title: 'Constant c' },
      { label: 'n', insert: 'n', title: 'Integer n' },
      { label: 'π', insert: 'pi', title: 'Pi constant' },
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

/**
 * Formats raw keyboard / symbol math syntax (e.g. "x^2 + sqrt(16) * pi != 0")
 * into crisp human-readable mathematical notation ("x² + √(16) × π ≠ 0").
 */
export function formatMathNotation(raw: string): string {
  let out = String(raw || '').trim();
  if (!out) return '';

  out = out
    .replace(/sqrt\s*\(/gi, '√(')
    .replace(/log10\s*\(/gi, 'log₁₀(')
    .replace(/\blog\s*\(/gi, 'ln(')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\btheta\b/gi, 'θ')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/\*/g, ' × ')
    .replace(/\^(\([^)]+\)|[0-9nxy])/g, (_, exp: string) => toSuperscript(exp))
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}

export function normalizeExpressionForEval(raw: string): string {
  return String(raw || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks deterministic numerical equality when both sides are arithmetic expressions
 * or equations like "x = 5" vs "5", or step transitions like "2x + 4 = 10" -> "2x = 6".
 */
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
