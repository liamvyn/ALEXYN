import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGraphActionToState,
  compileMathExpression,
  computeNiceTickStep,
  DEFAULT_GRAPH_STATE,
  extendNegativeXAxis,
  extractGraphActionsFromAIResponse,
  inferGraphActionFromPrompt,
  normalizeMathExpression,
  panViewport,
  sampleEquationCurve,
  zoomViewport,
} from './mathGraph';

test('normalizeMathExpression handles y=, f(x)=, superscripts, and unicode operators', () => {
  assert.equal(normalizeMathExpression('y = x² + 2x − 3'), 'x^2 + 2x - 3');
  assert.equal(normalizeMathExpression('f(x) = x³ - 3x'), 'x^3 - 3x');
  assert.equal(normalizeMathExpression('y = 2(x + 1)'), '2*(x + 1)');
});

test('compileMathExpression evaluates linear, quadratic, cubic, and trig functions accurately', () => {
  const quad = compileMathExpression('y = x²');
  assert.equal(quad.ok, true);
  assert.equal(quad.evalAt(-3), 9);
  assert.equal(quad.evalAt(0), 0);
  assert.equal(quad.evalAt(4), 16);

  const cubic = compileMathExpression('y = x^3 - 3x');
  assert.equal(cubic.ok, true);
  assert.equal(cubic.evalAt(2), 2);
  assert.equal(cubic.evalAt(-2), -2);

  const invalid = compileMathExpression('y = ');
  assert.equal(invalid.ok, false);
});

test('sampleEquationCurve splits discontinuous jumps such as y = 1/x', () => {
  const inv = compileMathExpression('y = 1/x');
  assert.equal(inv.ok, true);
  const segs = sampleEquationCurve(inv.evalAt, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 201);
  assert.equal(segs.length >= 2, true);
});

test('viewport helpers zoom, pan, extend negative x-axis, and choose nice tick steps', () => {
  const base = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
  const zoomedIn = zoomViewport(base, 0.5);
  assert.equal(zoomedIn.xMin, -3);
  assert.equal(zoomedIn.xMax, 3);

  const panned = panViewport(base, 2, -1);
  assert.equal(panned.xMin, -4);
  assert.equal(panned.xMax, 8);
  assert.equal(panned.yMin, -7);
  assert.equal(panned.yMax, 5);

  const extended = extendNegativeXAxis(base, 6);
  assert.equal(extended.xMin, -12);
  assert.equal(extended.xMax, 6);

  assert.equal(computeNiceTickStep(12, 6), 2);
});

test('inferGraphActionFromPrompt and applyGraphActionToState handle natural graphing prompts', () => {
  const drawQuad = inferGraphActionFromPrompt('Draw the graph of y = x².', DEFAULT_GRAPH_STATE);
  assert.notEqual(drawQuad, null);
  const s1 = applyGraphActionToState(DEFAULT_GRAPH_STATE, drawQuad!).nextState;
  assert.equal(s1.equations.length, 1);
  assert.equal(s1.equations[0].expression, 'y = x²');

  const addLine = inferGraphActionFromPrompt('Plot y = 2x + 3 on the same graph.', s1);
  assert.notEqual(addLine, null);
  assert.equal(addLine?.mode, 'add');
  const s2 = applyGraphActionToState(s1, addLine!).nextState;
  assert.equal(s2.equations.length, 2);

  const extendNeg = inferGraphActionFromPrompt('Extend the negative side of the x-axis.', s2);
  assert.equal(extendNeg?.extendNegativeX, true);
  const s3 = applyGraphActionToState(s2, extendNeg!).nextState;
  assert.equal(s3.viewport.xMin < s2.viewport.xMin, true);

  const plotPt = inferGraphActionFromPrompt('Plot the point (2, 4) on the graph.', s3);
  const s4 = applyGraphActionToState(s3, plotPt!).nextState;
  assert.equal(s4.points.some((p) => p.x === 2 && p.y === 4), true);
});

test('extractGraphActionsFromAIResponse parses embedded graph_action JSON and strips tag from visible prose', () => {
  const raw =
    'Here is the parabola alongside your line!\n<graph_action>{"mode":"add","equations":["y = 2x + 3"],"extendNegativeX":true}</graph_action>';
  const parsed = extractGraphActionsFromAIResponse(raw);
  assert.equal(parsed.cleanText, 'Here is the parabola alongside your line!');
  assert.equal(parsed.action?.mode, 'add');
  assert.deepEqual(parsed.action?.equations, ['y = 2x + 3']);
  assert.equal(parsed.action?.extendNegativeX, true);
});
