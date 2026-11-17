import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExpandedGeometryMetrics,
  generateShapeWireframeData,
  searchShapes3D,
  SHAPES_3D_CATALOG,
} from './shapes3d';

test('SHAPES_3D_CATALOG includes cubes, cones, spheres, hemispheres, frustums, prisms, torus, and compounds', () => {
  const ids = new Set(SHAPES_3D_CATALOG.map((s) => s.id));
  for (const required of [
    'cube',
    'cuboid',
    'sphere',
    'hemisphere',
    'cylinder',
    'cone',
    'frustum-cone',
    'frustum-pyramid',
    'triangular-prism',
    'hexagonal-prism',
    'pyramid',
    'tetrahedron',
    'octahedron',
    'torus',
    'compound-hemisphere-cylinder',
    'compound-cone-cylinder',
    'compound-cone-hemisphere',
    'compound-prism-pyramid',
  ] as const) {
    assert.ok(ids.has(required), `Missing ${required}`);
  }
});

test('searchShapes3D matches natural shape queries including frustums and compound shapes', () => {
  const frustums = searchShapes3D('frustum');
  assert.ok(frustums.length >= 2);
  assert.ok(frustums[0].id.startsWith('frustum'));

  const compound = searchShapes3D('hemisphere cylinder');
  assert.equal(compound[0].id, 'compound-hemisphere-cylinder');

  const prism = searchShapes3D('triangular prism');
  assert.equal(prism[0].id, 'triangular-prism');
});

test('computeExpandedGeometryMetrics and generateShapeWireframeData return accurate formulas and geometry', () => {
  const frustumMetrics = computeExpandedGeometryMetrics('frustum-cone', 10, 60, 0.5);
  assert.ok(frustumMetrics.primaryValue.endsWith('u³'));
  assert.ok((frustumMetrics.partsBreakdown || []).length === 3);

  const hemiCylMetrics = computeExpandedGeometryMetrics('compound-hemisphere-cylinder', 8, 60, 0.5);
  assert.ok(hemiCylMetrics.formulasUsed.some((f) => f.includes('2πrh')));

  const mesh = generateShapeWireframeData('frustum-cone', 6, 60, 0.5);
  assert.ok(mesh.vertices.length > 0 && mesh.rings.length === 2);
});
