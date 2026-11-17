import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backspaceCalculatorToken,
  evaluateScientificExpression,
  formatAsSimplifiedFraction,
} from './scientificCalculator';

test('evaluateScientificExpression handles arithmetic, roots, powers, percentages, and constants', () => {
  const res1 = evaluateScientificExpression('8 * 5 + sqrt(16)');
  assert.equal(res1.ok, true);
  assert.equal(res1.formatted, '44');

  const res2 = evaluateScientificExpression('2^5 + cbrt(27)');
  assert.equal(res2.ok, true);
  assert.equal(res2.formatted, '35');

  const res3 = evaluateScientificExpression('200 * 15%');
  assert.equal(res3.ok, true);
  assert.equal(res3.formatted, '30');

  const resPi = evaluateScientificExpression('2 * pi');
  assert.equal(resPi.ok, true);
  assert.ok(Math.abs((resPi.numericValue ?? 0) - 2 * Math.PI) < 1e-6);
});

test('evaluateScientificExpression respects DEG and RAD trig modes plus log/ln/Ans', () => {
  const degSin = evaluateScientificExpression('sin(30)', 0, 'DEG');
  assert.equal(degSin.ok, true);
  assert.equal(degSin.formatted, '0.5');

  const degTan90 = evaluateScientificExpression('tan(90)', 0, 'DEG');
  assert.equal(degTan90.ok, false);

  const radSin = evaluateScientificExpression('sin(pi / 2)', 0, 'RAD');
  assert.equal(radSin.ok, true);
  assert.equal(radSin.formatted, '1');

  const logRes = evaluateScientificExpression('log(100) + ln(e)');
  assert.equal(logRes.ok, true);
  assert.equal(logRes.formatted, '3');

  const ansRes = evaluateScientificExpression('Ans * 2', 22, 'DEG');
  assert.equal(ansRes.ok, true);
  assert.equal(ansRes.formatted, '44');
});

test('backspaceCalculatorToken and fraction formatting work cleanly', () => {
  assert.equal(backspaceCalculatorToken('5 + sin('), '5 + ');
  assert.equal(backspaceCalculatorToken('12 + Ans'), '12 + ');
  assert.equal(backspaceCalculatorToken('123'), '12');
  assert.equal(formatAsSimplifiedFraction(0.75), '3/4');
});
