import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMathNotation,
  MATH_SYMBOL_GROUPS,
  tryEvaluateNumericExpression,
  verifySimpleNumericEquation,
} from './mathWorking';

test('formatMathNotation converts ASCII algebra syntax to crisp mathematical symbols', () => {
  assert.equal(formatMathNotation('x^2 + sqrt(16) * pi != 0'), 'x² + √(16) × π ≠ 0');
  assert.equal(formatMathNotation('a <= b and c >= d'), 'a ≤ b and c ≥ d');
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

test('MATH_SYMBOL_GROUPS exposes operators, algebra variables, powers, and trig functions', () => {
  const ids = MATH_SYMBOL_GROUPS.map((g) => g.id);
  assert.deepEqual(ids, ['operators', 'powers', 'algebra', 'functions']);
  assert.equal(MATH_SYMBOL_GROUPS.every((g) => g.buttons.length >= 6), true);
});
