import test from 'node:test';
import assert from 'node:assert/strict';
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
} from './mathWorking';

test('formatMathNotation converts ASCII algebra syntax to crisp mathematical symbols', () => {
  assert.equal(formatMathNotation('x^2 + sqrt(16) * pi != 0'), 'x² + √(16) × π ≠ 0');
  assert.equal(formatMathNotation('cbrt(27) + a <= b and c >= d'), '∛(27) + a ≤ b and c ≥ d');
  assert.equal(formatMathNotation('x^(n) + y^3'), 'xⁿ + y³');
});

test('tryEvaluateNumericExpression and verifySimpleNumericEquation evaluate deterministic steps', () => {
  const res = tryEvaluateNumericExpression('2 * (3 + 4)^2');
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value, 98);

  const eqTrue = verifySimpleNumericEquation('3 * 4 + 2 = sqrt(196)');
  assert.equal(eqTrue.canVerify, true);
  assert.equal(eqTrue.isTrue, true);

  const eqFalse = verifySimpleNumericEquation('5 + 5 = 12');
  assert.equal(eqFalse.canVerify, true);
  assert.equal(eqFalse.isTrue, false);

  const symbolic = verifySimpleNumericEquation('2x + 3 = 11');
  assert.equal(symbolic.canVerify, false);
});

test('MATH_SYMBOL_GROUPS and QUICK_MATH_KEYS expose x variable, operators, powers, roots, brackets, and trig functions', () => {
  const ids = MATH_SYMBOL_GROUPS.map((g) => g.id);
  assert.deepEqual(ids, ['operators', 'powers', 'algebra', 'functions']);
  assert.equal(MATH_SYMBOL_GROUPS.every((g) => g.buttons.length >= 6), true);

  assert.equal(QUICK_MATH_KEYS.some((k) => k.label === 'x' && k.insert === 'x'), true);
  assert.equal(QUICK_MATH_KEYS.some((k) => k.label === '÷' && k.insert === ' / '), true);
  assert.equal(QUICK_MATH_KEYS.some((k) => k.label === '√' && k.insert === 'sqrt()'), true);

  const powers = MATH_SYMBOL_GROUPS.find((g) => g.id === 'powers')!;
  assert.equal(powers.buttons.some((b) => b.label === '∛' && b.insert === 'cbrt()'), true);
  assert.equal(powers.buttons.some((b) => b.label === '{ }' && b.insert === '{}'), true);
});

test('insertAtCursor and backspaceAtCursor preserve prior lines and edit accurately', () => {
  const mid = insertAtCursor('2x + 5 = 11', 2, 2, '^2');
  assert.equal(mid.nextValue, '2x^2 + 5 = 11');
  assert.equal(mid.nextCaret, 4);

  const root = insertAtCursor('y = ', 4, 4, 'sqrt()', 5);
  assert.equal(root.nextValue, 'y = sqrt()');
  assert.equal(root.nextCaret, 9);

  const replaced = insertAtCursor('2x + 5', 3, 6, '- 3');
  assert.equal(replaced.nextValue, '2x - 3');

  const back1 = backspaceAtCursor('3x = 21\nx = 7', 7, 7);
  assert.equal(back1.nextValue, '3x = 2\nx = 7');
  assert.equal(back1.nextCaret, 6);

  const backSel = backspaceAtCursor('3x + 5 = 14', 2, 6);
  assert.equal(backSel.nextValue, '3x = 14');
  assert.equal(backSel.nextCaret, 2);
});

test('joinWorkingLines, splitWorkingLines, and hasSubstantialMathWork manage continuous multi-line notes cleanly', () => {
  const lines = ['3x - 7 = 14', '3x = 21', 'x = 7'];
  const joined = joinWorkingLines(lines);
  assert.equal(joined, '3x - 7 = 14\n3x = 21\nx = 7');
  assert.deepEqual(splitWorkingLines(joined), lines);
  assert.deepEqual(splitWorkingLines(''), ['']);

  assert.equal(hasSubstantialMathWork('Solve 3x - 7 = 14', ['3x = 21', 'x = 7'], '7'), true);
  assert.equal(hasSubstantialMathWork('Solve x + 1 = 2', ['x = 1'], ''), false);
  assert.equal(hasSubstantialMathWork('', [''], ''), false);
});

test('formatMathNotation and symbols support subscripts, nth roots, Greek symbols, and decimals', () => {
  assert.equal(formatMathNotation('x_1 + x_(n) + nthRoot(16, 4)'), 'x₁ + xₙ + ⁴√(16)');
  assert.equal(formatMathNotation('alpha + beta + delta * theta'), 'α + β + Δ × θ');

  const operators = MATH_SYMBOL_GROUPS.find((g) => g.id === 'operators')!;
  const powers = MATH_SYMBOL_GROUPS.find((g) => g.id === 'powers')!;
  const algebra = MATH_SYMBOL_GROUPS.find((g) => g.id === 'algebra')!;

  assert.equal(operators.buttons.some((b) => b.insert === '.'), true);
  assert.equal(powers.buttons.some((b) => b.insert === '_1'), true);
  assert.equal(powers.buttons.some((b) => b.insert.startsWith('nthRoot(')), true);
  assert.equal(algebra.buttons.some((b) => b.insert === 'α'), true);
  assert.equal(algebra.buttons.some((b) => b.insert === 'Δ'), true);

  const pctEval = tryEvaluateNumericExpression('25% * 80 + 1.5');
  assert.equal(pctEval.ok, true);
  if (pctEval.ok) assert.equal(pctEval.value, 21.5);
});
