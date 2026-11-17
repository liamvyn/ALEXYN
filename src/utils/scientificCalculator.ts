import { create, all } from 'mathjs';

const math = create(all, { number: 'number' });

export type AngleUnit = 'DEG' | 'RAD';

export interface CalculatorEvaluationResult {
  ok: boolean;
  numericValue?: number;
  formatted?: string;
  fractionText?: string;
  error?: string;
}

const MULTI_CHAR_TOKENS = [
  'nthRoot(',
  'sqrt(',
  'cbrt(',
  'asin(',
  'acos(',
  'atan(',
  'sin(',
  'cos(',
  'tan(',
  'log(',
  'abs(',
  'ln(',
  'Ans',
  '10^(',
  'e^(',
  'pi',
];

export function backspaceCalculatorToken(expr: string): string {
  const s = String(expr || '');
  if (!s) return '';
  for (const tok of MULTI_CHAR_TOKENS) {
    if (s.endsWith(tok)) {
      return s.slice(0, s.length - tok.length);
    }
  }
  return s.slice(0, -1);
}

export function formatCalculatorNumber(val: number): string {
  if (!Number.isFinite(val)) return 'Error';
  const cleaned = Math.abs(val) < 1e-12 ? 0 : val;
  if (Number.isInteger(cleaned)) return String(cleaned);
  const rounded = Number(cleaned.toPrecision(12));
  if (Math.abs(rounded) >= 1e10 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-7)) {
    return rounded.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(rounded);
}

export function formatAsSimplifiedFraction(val: number): string | undefined {
  if (!Number.isFinite(val) || Number.isInteger(val)) return undefined;
  try {
    const frac = math.fraction(val);
    if (frac.d > 1 && frac.d <= 1000) {
      const sign = frac.s < 0 ? '-' : '';
      return `${sign}${frac.n}/${frac.d}`;
    }
  } catch {
    // ignore irrational or oversized denominators
  }
  return undefined;
}

function autoBalanceParentheses(expr: string): string {
  let open = 0;
  for (const ch of expr) {
    if (ch === '(') open += 1;
    else if (ch === ')' && open > 0) open -= 1;
  }
  return expr + ')'.repeat(open);
}

export function normalizeScientificExpression(
  rawExpr: string,
  ansValue: number,
  angleUnit: AngleUnit
): string {
  let s = String(rawExpr || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/∛\(/g, 'cbrt(')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\bAns\b/g, `(${Number.isFinite(ansValue) ? ansValue : 0})`)
    .replace(/(\d+(?:\.\d+)?|\))\s*%/g, '($1/100)')
    .replace(/(?<![a-zA-Z0-9_])log\(/g, 'log10(')
    .replace(/\bln\(/g, 'log(')
    .replace(/(\d)(pi|e|sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sqrt\(|cbrt\(|log10\(|log\(|abs\()/gi, '$1*$2')
    .replace(/\)(?=\d|\(|pi|sin|cos|tan|sqrt|cbrt|log|abs)/gi, ')*')
    .trim();

  s = autoBalanceParentheses(s);

  if (angleUnit === 'DEG') {
    // Keep trig names cleanly routed through custom DEG scope functions
    s = s
      .replace(/\basin\(/g, 'asind(')
      .replace(/\bacos\(/g, 'acosd(')
      .replace(/\batan\(/g, 'atand(')
      .replace(/\bsin\(/g, 'sind(')
      .replace(/\bcos\(/g, 'cosd(')
      .replace(/\btan\(/g, 'tand(');
  }

  return s;
}

export function evaluateScientificExpression(
  rawExpr: string,
  ansValue = 0,
  angleUnit: AngleUnit = 'DEG'
): CalculatorEvaluationResult {
  const trimmed = String(rawExpr || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter an expression' };
  }

  try {
    const normalized = normalizeScientificExpression(trimmed, ansValue, angleUnit);
    const scope = {
      sind: (x: number) => Math.sin((x * Math.PI) / 180),
      cosd: (x: number) => Math.cos((x * Math.PI) / 180),
      tand: (x: number) => {
        const mod = ((x % 180) + 180) % 180;
        if (Math.abs(mod - 90) < 1e-9) {
          throw new Error('Math Error (tan 90° undefined)');
        }
        return Math.tan((x * Math.PI) / 180);
      },
      asind: (x: number) => (Math.asin(x) * 180) / Math.PI,
      acosd: (x: number) => (Math.acos(x) * 180) / Math.PI,
      atand: (x: number) => (Math.atan(x) * 180) / Math.PI,
    };

    const result = math.evaluate(normalized, scope);
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return { ok: false, error: 'Math Error' };
    }

    const cleaned = Math.abs(result) < 1e-12 ? 0 : result;
    return {
      ok: true,
      numericValue: cleaned,
      formatted: formatCalculatorNumber(cleaned),
      fractionText: formatAsSimplifiedFraction(cleaned),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Syntax Error';
    if (msg.toLowerCase().includes('undefined')) {
      return { ok: false, error: msg };
    }
    return { ok: false, error: 'Syntax / Math Error' };
  }
}
