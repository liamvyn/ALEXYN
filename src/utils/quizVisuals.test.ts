import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSvgFromVisualSpec, enrichQuestionWithVisual } from './quizVisuals';
import type { QuizQuestion } from '../types/alexyn';

test('buildSvgFromVisualSpec generates labelled SVGs for solids, coordinate graphs, triangles, and circuits', () => {
  const frustumSvg = buildSvgFromVisualSpec({
    kind: 'solid-3d',
    shapeId: 'frustum-cone',
    title: 'Bucket Frustum',
    dimensions: { radius: 10, topRadius: 6, height: 12, unit: 'cm' },
  });
  assert.ok(frustumSvg.startsWith('<svg'));
  assert.ok(frustumSvg.includes('10 cm') && frustumSvg.includes('6 cm') && frustumSvg.includes('12 cm'));

  const graphSvg = buildSvgFromVisualSpec({
    kind: 'coordinate-graph',
    title: 'Quadratic Curve',
    equations: ['y = x^2 - 4'],
    points: [{ x: 2, y: 0, label: '(2,0)' }],
  });
  assert.ok(graphSvg.includes('<path') && graphSvg.includes('(2,0)'));

  const triSvg = buildSvgFromVisualSpec({
    kind: 'triangle-2d',
    dimensions: { a: 6, b: 8, c: 10, angleDeg: 37, unit: 'cm' },
  });
  assert.ok(triSvg.includes('37°') && triSvg.includes('10 cm'));
});

test('enrichQuestionWithVisual attaches crisp diagramSpec.svgMarkup when visualSpec is present without inline svg', () => {
  const q: QuizQuestion = {
    id: 'q1',
    questionType: 'calculation',
    prompt: 'Calculate the volume of the hemisphere of radius 7 cm.',
    topic: 'Mensuration',
    options: [],
    correctIndex: null,
    explanation: 'Use V = 2/3 pi r^3.',
    origin: 'ai-generated',
    visualSpec: {
      kind: 'solid-3d',
      shapeId: 'hemisphere',
      dimensions: { radius: 7, unit: 'cm' },
    },
  };
  const enriched = enrichQuestionWithVisual(q);
  assert.ok(enriched.diagramSpec?.svgMarkup?.includes('r = 7 cm'));
});
