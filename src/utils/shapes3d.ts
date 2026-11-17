export type ShapeCategory = '2d' | '3d' | 'frustum' | 'compound';

export type ExpandedShapeId =
  | 'triangle'
  | 'rectangle'
  | 'circle'
  | 'cube'
  | 'cuboid'
  | 'sphere'
  | 'hemisphere'
  | 'cylinder'
  | 'cone'
  | 'frustum-cone'
  | 'frustum-pyramid'
  | 'triangular-prism'
  | 'hexagonal-prism'
  | 'pyramid'
  | 'tetrahedron'
  | 'octahedron'
  | 'torus'
  | 'compound-hemisphere-cylinder'
  | 'compound-cone-cylinder'
  | 'compound-cone-hemisphere'
  | 'compound-prism-pyramid';

export interface ShapeCatalogEntry {
  id: ExpandedShapeId;
  name: string;
  category: ShapeCategory;
  aliases: string[];
  shortSummary: string;
  formulaNote: string;
  supportsRatioSlider: boolean;
  defaultAngleOrHeight: number;
  defaultRatio: number;
}

export interface GeometryMetricsReport {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  anglesSummary: string;
  partsBreakdown?: string[];
  formulasUsed: string[];
}

export interface WireframePoint3D {
  x: number;
  y: number;
  z: number;
}

export interface WireframeMesh3D {
  vertices: WireframePoint3D[];
  edges: Array<[number, number]>;
  rings: Array<{
    points: WireframePoint3D[];
    color?: string;
    dashed?: boolean;
  }>;
  accentColor: string;
}

export const SHAPES_3D_CATALOG: ShapeCatalogEntry[] = [
  {
    id: 'cube',
    name: 'Cube',
    category: '3d',
    aliases: ['hexahedron', 'square box', 'dice'],
    shortSummary: '6 congruent square faces meeting at 90° edges',
    formulaNote: 'V = s³ · SA = 6s²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'cuboid',
    name: 'Cuboid (Rectangular Prism)',
    category: '3d',
    aliases: ['rectangular prism', 'box', 'brick', 'rectangular solid'],
    shortSummary: '6 rectangular faces with length l, width w, height h',
    formulaNote: 'V = lwh · SA = 2(lw + lh + wh)',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 55,
    defaultRatio: 0.65,
  },
  {
    id: 'sphere',
    name: 'Sphere',
    category: '3d',
    aliases: ['ball', 'globe', 'round 3d'],
    shortSummary: 'Perfectly symmetric 3D surface equidistant from its center',
    formulaNote: 'V = ⁴⁄₃πr³ · SA = 4πr²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'hemisphere',
    name: 'Hemisphere',
    category: '3d',
    aliases: ['half sphere', 'dome', 'bowl'],
    shortSummary: 'Half of a sphere with a circular flat base of radius r',
    formulaNote: 'V = ²⁄₃πr³ · Curved SA = 2πr² · Total SA = 3πr²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'cylinder',
    name: 'Cylinder',
    category: '3d',
    aliases: ['tube', 'can', 'circular prism'],
    shortSummary: 'Two congruent parallel circular bases joined by a curved surface',
    formulaNote: 'V = πr²h · Total SA = 2πr(r + h)',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 65,
    defaultRatio: 0.5,
  },
  {
    id: 'cone',
    name: 'Cone',
    category: '3d',
    aliases: ['circular cone', 'funnel', 'party hat'],
    shortSummary: 'Circular base tapering smoothly to a single apex vertex',
    formulaNote: 'V = ⅓πr²h · SA = πr(r + l) where l = √(r² + h²)',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 65,
    defaultRatio: 0.5,
  },
  {
    id: 'frustum-cone',
    name: 'Frustum of a Cone',
    category: 'frustum',
    aliases: ['frustum', 'truncated cone', 'bucket', 'lampshade', 'cone frustum'],
    shortSummary: 'Portion of a cone remaining after slicing off the top parallel to the base',
    formulaNote: 'V = ⅓πh(R² + Rr + r²) · Curved SA = π(R + r)l',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'frustum-pyramid',
    name: 'Frustum of a Pyramid',
    category: 'frustum',
    aliases: ['square frustum', 'truncated pyramid', 'pyramid frustum', 'hopper'],
    shortSummary: 'Square pyramid with its apex sliced parallel to the square base',
    formulaNote: 'V = ⅓h(A₁ + A₂ + √(A₁A₂))',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'triangular-prism',
    name: 'Triangular Prism',
    category: '3d',
    aliases: ['prism', 'tent', 'wedge', 'glass prism'],
    shortSummary: 'Two parallel congruent triangular ends joined by 3 rectangular faces',
    formulaNote: 'V = (½bh) × L · SA = bh + (b + 2s)L',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'hexagonal-prism',
    name: 'Hexagonal Prism',
    category: '3d',
    aliases: ['hexagon prism', 'honeycomb', 'nut', '6-sided prism'],
    shortSummary: 'Two parallel regular hexagon bases joined by 6 rectangular faces',
    formulaNote: 'V = (3√3 / 2)s²h · SA = 3√3s² + 6sh',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'pyramid',
    name: 'Square Pyramid',
    category: '3d',
    aliases: ['pyramid', 'giza', 'square-based pyramid'],
    shortSummary: 'Square base with 4 triangular faces meeting at one apex',
    formulaNote: 'V = ⅓b²h · SA = b² + 2bl',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'tetrahedron',
    name: 'Triangular Pyramid (Tetrahedron)',
    category: '3d',
    aliases: ['tetrahedron', 'triangular pyramid', '4 faces'],
    shortSummary: 'Pyramid with a triangular base (4 triangular faces, 4 vertices, 6 edges)',
    formulaNote: 'V = s³ / (6√2) · SA = √3 · s²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'octahedron',
    name: 'Octahedron',
    category: '3d',
    aliases: ['regular octahedron', '8 faces', 'diamond'],
    shortSummary: '8 equilateral triangular faces joined cleanly along 12 edges',
    formulaNote: 'V = (√2 / 3)s³ · SA = 2√3 · s²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'torus',
    name: 'Torus (Ring Solid)',
    category: '3d',
    aliases: ['donut', 'ring', 'tube ring'],
    shortSummary: 'Surface of revolution formed by revolving a circle around a coplanar axis',
    formulaNote: 'V = 2π²Rr² · SA = 4π²Rr',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 50,
    defaultRatio: 0.38,
  },
  {
    id: 'compound-hemisphere-cylinder',
    name: 'Hemisphere + Cylinder',
    category: 'compound',
    aliases: ['silo', 'capsule', 'hemisphere on cylinder', 'cylinder with hemisphere', 'boiler'],
    shortSummary: 'Composite solid combining a cylindrical body capped by a hemisphere',
    formulaNote: 'V = πr²h + ⅔πr³ · Exposed SA = πr² + 2πrh + 2πr²',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'compound-cone-cylinder',
    name: 'Cone + Cylinder',
    category: 'compound',
    aliases: ['rocket', 'tower', 'cone on cylinder', 'cylinder with cone', 'pencil'],
    shortSummary: 'Composite solid joining a conical roof onto a circular cylinder base',
    formulaNote: 'V = πr²h_cyl + ⅓πr²h_cone · Exposed SA = πr² + 2πrh_cyl + πrl',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'compound-cone-hemisphere',
    name: 'Cone + Hemisphere',
    category: 'compound',
    aliases: ['ice cream cone', 'buoy', 'top', 'cone on hemisphere', 'hemisphere and cone'],
    shortSummary: 'Composite solid joining a hemisphere base smoothly to a matching cone',
    formulaNote: 'V = ⅔πr³ + ⅓πr²h · Exposed SA = 2πr² + πrl',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'compound-prism-pyramid',
    name: 'Cuboid + Pyramid',
    category: 'compound',
    aliases: ['house', 'cube and pyramid', 'prism and pyramid', 'gable tower'],
    shortSummary: 'Composite solid made of a square cuboid topped by a square pyramid',
    formulaNote: 'V = s²H + ⅓s²h · Exposed SA = s² + 4sH + 2sl',
    supportsRatioSlider: true,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.55,
  },
  {
    id: 'triangle',
    name: 'Triangle (2D)',
    category: '2d',
    aliases: ['2d triangle', 'isosceles triangle', 'polygon'],
    shortSummary: '3-sided polygon with interior angles summing to 180°',
    formulaNote: 'Area = ½bh · Perimeter = b + 2s',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'rectangle',
    name: 'Rectangle (2D)',
    category: '2d',
    aliases: ['2d rectangle', 'quadrilateral', 'square 2d'],
    shortSummary: '4-sided polygon with four 90° right angles',
    formulaNote: 'Area = w × h · Perimeter = 2(w + h)',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
  {
    id: 'circle',
    name: 'Circle (2D)',
    category: '2d',
    aliases: ['2d circle', 'disc', 'disk'],
    shortSummary: 'Set of all points in a plane at distance r from the center',
    formulaNote: 'Area = πr² · Circumference = 2πr',
    supportsRatioSlider: false,
    defaultAngleOrHeight: 60,
    defaultRatio: 0.5,
  },
];

export function searchShapes3D(query: string): ShapeCatalogEntry[] {
  const clean = String(query || '')
    .toLowerCase()
    .replace(/[+,&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return SHAPES_3D_CATALOG;

  const terms = clean.split(' ').filter((t) => t.length >= 2 && !['of', 'on', 'and', 'with', 'the', 'a'].includes(t));
  const scored = SHAPES_3D_CATALOG.map((entry) => {
    const hay = `${entry.name} ${entry.id} ${entry.aliases.join(' ')} ${entry.shortSummary}`.toLowerCase();
    let score = 0;
    if (entry.name.toLowerCase().includes(clean) || entry.id === clean) score += 100;
    if (entry.aliases.some((a) => a.toLowerCase().includes(clean))) score += 70;
    const matchedTerms = terms.filter((t) => hay.includes(t));
    if (terms.length > 0 && matchedTerms.length === terms.length) score += 60;
    else score += matchedTerms.length * 18;
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.entry);
}

export function computeExpandedGeometryMetrics(
  shape: ExpandedShapeId,
  size: number,
  angleOrHeightDeg = 60,
  topRatio = 0.5
): GeometryMetricsReport {
  const s = Math.max(1, size);
  const hFactor = 0.4 + (Math.max(15, Math.min(85, angleOrHeightDeg)) / 90) * 1.1;
  const clampedRatio = Math.max(0.2, Math.min(0.85, topRatio));

  switch (shape) {
    case 'triangle': {
      const base = s;
      const rad = (Math.max(15, Math.min(80, angleOrHeightDeg)) * Math.PI) / 180;
      const height = base * 0.5 * Math.tan(rad);
      const side = Math.hypot(base * 0.5, height);
      const area = 0.5 * base * height;
      const perimeter = base + 2 * side;
      const topAngle = Math.max(1, 180 - 2 * angleOrHeightDeg);
      return {
        primaryLabel: 'Area (½bh)',
        primaryValue: `${area.toFixed(2)} u²`,
        secondaryLabel: 'Perimeter',
        secondaryValue: `${perimeter.toFixed(2)} u`,
        anglesSummary: `Base angles: ${angleOrHeightDeg.toFixed(0)}°, ${angleOrHeightDeg.toFixed(0)}° · Apex: ${topAngle.toFixed(0)}°`,
        formulasUsed: ['Area = ½ × base × height', 'Perimeter = base + 2 × slant'],
      };
    }
    case 'rectangle': {
      const w = s;
      const h = s * (0.5 + angleOrHeightDeg / 180);
      return {
        primaryLabel: 'Area (w×h)',
        primaryValue: `${(w * h).toFixed(2)} u²`,
        secondaryLabel: 'Perimeter',
        secondaryValue: `${(2 * (w + h)).toFixed(2)} u`,
        anglesSummary: '4 interior right angles (90° each · Sum = 360°)',
        formulasUsed: ['Area = w × h', 'Perimeter = 2(w + h)'],
      };
    }
    case 'circle': {
      const r = s / 2;
      return {
        primaryLabel: 'Area (πr²)',
        primaryValue: `${(Math.PI * r * r).toFixed(2)} u²`,
        secondaryLabel: 'Circumference (2πr)',
        secondaryValue: `${(2 * Math.PI * r).toFixed(2)} u`,
        anglesSummary: `Radius r = ${r.toFixed(2)} u · Full angle = 360°`,
        formulasUsed: ['A = πr²', 'C = 2πr'],
      };
    }
    case 'cube': {
      return {
        primaryLabel: 'Volume (s³)',
        primaryValue: `${(s ** 3).toFixed(2)} u³`,
        secondaryLabel: 'Total Surface Area',
        secondaryValue: `${(6 * s * s).toFixed(2)} u²`,
        anglesSummary: 'V = 8, E = 12, F = 6 · V − E + F = 2',
        formulasUsed: ['V = s³', 'SA = 6s²'],
      };
    }
    case 'cuboid': {
      const l = s;
      const w = s * clampedRatio;
      const h = s * hFactor;
      const vol = l * w * h;
      const sa = 2 * (l * w + l * h + w * h);
      return {
        primaryLabel: 'Volume (l×w×h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `l=${l.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)} · V=8, E=12, F=6`,
        formulasUsed: ['V = lwh', 'SA = 2(lw + lh + wh)'],
      };
    }
    case 'sphere': {
      const r = s / 2;
      const vol = (4 / 3) * Math.PI * r ** 3;
      const sa = 4 * Math.PI * r ** 2;
      return {
        primaryLabel: 'Volume (⁴⁄₃πr³)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area (4πr²)',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `Radius r = ${r.toFixed(2)} u · Curved continuous surface (0 edges)`,
        formulasUsed: ['V = ⁴⁄₃πr³', 'SA = 4πr²'],
      };
    }
    case 'hemisphere': {
      const r = s / 2;
      const vol = (2 / 3) * Math.PI * r ** 3;
      const curved = 2 * Math.PI * r ** 2;
      const totalSa = 3 * Math.PI * r ** 2;
      return {
        primaryLabel: 'Volume (⅔πr³)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total SA (3πr²)',
        secondaryValue: `${totalSa.toFixed(2)} u²`,
        anglesSummary: `Curved SA = ${curved.toFixed(2)} u² · Flat circular base = ${(Math.PI * r * r).toFixed(2)} u²`,
        formulasUsed: ['V = ⅔πr³', 'Curved SA = 2πr²', 'Total SA = 3πr²'],
      };
    }
    case 'cylinder': {
      const r = s / 2;
      const h = s * hFactor;
      const vol = Math.PI * r * r * h;
      const sa = 2 * Math.PI * r * (r + h);
      return {
        primaryLabel: 'Volume (πr²h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total SA (2πr(r+h))',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `r = ${r.toFixed(2)} u, h = ${h.toFixed(2)} u · Curved SA = ${(2 * Math.PI * r * h).toFixed(2)} u²`,
        formulasUsed: ['V = πr²h', 'Curved SA = 2πrh', 'Total SA = 2πr² + 2πrh'],
      };
    }
    case 'cone': {
      const r = s / 2;
      const h = s * hFactor;
      const l = Math.hypot(r, h);
      const vol = (Math.PI * r * r * h) / 3;
      const sa = Math.PI * r * (r + l);
      return {
        primaryLabel: 'Volume (⅓πr²h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total SA (πr(r+l))',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `r = ${r.toFixed(2)}, h = ${h.toFixed(2)}, slant l = ${l.toFixed(2)} · 1 circular face, 1 apex`,
        formulasUsed: ['l = √(r² + h²)', 'V = ⅓πr²h', 'Total SA = πr² + πrl'],
      };
    }
    case 'frustum-cone': {
      const R = s / 2;
      const r = R * clampedRatio;
      const h = s * hFactor * 0.85;
      const l = Math.hypot(R - r, h);
      const vol = (Math.PI * h * (R * R + R * r + r * r)) / 3;
      const curved = Math.PI * (R + r) * l;
      const totalSa = curved + Math.PI * R * R + Math.PI * r * r;
      return {
        primaryLabel: 'Volume (⅓πh(R²+Rr+r²))',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total Surface Area',
        secondaryValue: `${totalSa.toFixed(2)} u²`,
        anglesSummary: `R = ${R.toFixed(2)}, r = ${r.toFixed(2)}, h = ${h.toFixed(2)}, l = ${l.toFixed(2)}`,
        partsBreakdown: [
          `Bottom disc πR² = ${(Math.PI * R * R).toFixed(2)} u²`,
          `Top disc πr² = ${(Math.PI * r * r).toFixed(2)} u²`,
          `Slanted curved wrap π(R+r)l = ${curved.toFixed(2)} u²`,
        ],
        formulasUsed: ['l = √((R − r)² + h²)', 'V = ⅓πh(R² + Rr + r²)', 'SA = πR² + πr² + π(R + r)l'],
      };
    }
    case 'frustum-pyramid': {
      const a = s;
      const b = s * clampedRatio;
      const h = s * hFactor * 0.85;
      const slant = Math.hypot((a - b) / 2, h);
      const a1 = a * a;
      const a2 = b * b;
      const vol = (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
      const lat = 4 * (0.5 * (a + b) * slant);
      const totalSa = a1 + a2 + lat;
      return {
        primaryLabel: 'Volume (⅓h(A₁+A₂+√(A₁A₂)))',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total Surface Area',
        secondaryValue: `${totalSa.toFixed(2)} u²`,
        anglesSummary: `Base side=${a.toFixed(1)}, Top side=${b.toFixed(1)}, h=${h.toFixed(1)} · V=8, E=12, F=6`,
        partsBreakdown: [
          `Bottom square = ${a1.toFixed(2)} u²`,
          `Top square = ${a2.toFixed(2)} u²`,
          `4 Trapezoidal faces = ${lat.toFixed(2)} u²`,
        ],
        formulasUsed: ['V = ⅓h(a² + ab + b²)', 'SA = a² + b² + 2(a + b)l'],
      };
    }
    case 'triangular-prism': {
      const b = s;
      const triH = s * 0.65;
      const length = s * hFactor;
      const areaEnd = 0.5 * b * triH;
      const sideEdge = Math.hypot(b / 2, triH);
      const vol = areaEnd * length;
      const sa = 2 * areaEnd + (b + 2 * sideEdge) * length;
      return {
        primaryLabel: 'Volume (½bh × L)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `V = 6, E = 9, F = 5 (2 triangles + 3 rectangles) · V − E + F = 2`,
        formulasUsed: ['Cross-section A = ½bh', 'V = A × L', 'SA = 2A + Perimeter × L'],
      };
    }
    case 'hexagonal-prism': {
      const side = s * 0.52;
      const h = s * hFactor;
      const baseArea = ((3 * Math.sqrt(3)) / 2) * side * side;
      const vol = baseArea * h;
      const sa = 2 * baseArea + 6 * side * h;
      return {
        primaryLabel: 'Volume (Base × h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Total Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 12, E = 18, F = 8 (2 hexagons + 6 rectangles) · V − E + F = 2',
        formulasUsed: ['Hex Base = (3√3/2)s²', 'V = Base × h', 'SA = 2Base + 6sh'],
      };
    }
    case 'pyramid': {
      const h = s * hFactor;
      const vol = (s * s * h) / 3;
      const slant = Math.hypot(s / 2, h);
      const sa = s * s + 2 * s * slant;
      return {
        primaryLabel: 'Volume (⅓b²h)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 5, E = 8, F = 5 · V − E + F = 2',
        formulasUsed: ['V = ⅓b²h', 'SA = b² + 2bl'],
      };
    }
    case 'tetrahedron': {
      const vol = s ** 3 / (6 * Math.SQRT2);
      const sa = Math.sqrt(3) * s * s;
      return {
        primaryLabel: 'Volume (s³/(6√2))',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area (√3s²)',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 4, E = 6, F = 4 (4 equilateral triangles) · V − E + F = 2',
        formulasUsed: ['V = s³/(6√2)', 'SA = √3 · s²'],
      };
    }
    case 'octahedron': {
      const vol = (Math.SQRT2 / 3) * s ** 3;
      const sa = 2 * Math.sqrt(3) * s * s;
      return {
        primaryLabel: 'Volume',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: 'V = 6, E = 12, F = 8 (60° faces) · V − E + F = 2',
        formulasUsed: ['V = (√2/3)s³', 'SA = 2√3s²'],
      };
    }
    case 'torus': {
      const R = s * 0.55;
      const r = s * 0.28 * clampedRatio + s * 0.08;
      const vol = 2 * Math.PI * Math.PI * R * r * r;
      const sa = 4 * Math.PI * Math.PI * R * r;
      return {
        primaryLabel: 'Volume (2π²Rr²)',
        primaryValue: `${vol.toFixed(2)} u³`,
        secondaryLabel: 'Surface Area (4π²Rr)',
        secondaryValue: `${sa.toFixed(2)} u²`,
        anglesSummary: `Major R = ${R.toFixed(2)} u · Tube r = ${r.toFixed(2)} u (Genus 1 surface)`,
        formulasUsed: ['V = 2π²Rr²', 'SA = 4π²Rr'],
      };
    }
    case 'compound-hemisphere-cylinder': {
      const r = s / 2;
      const h = s * hFactor * 0.8;
      const vCyl = Math.PI * r * r * h;
      const vHemi = (2 / 3) * Math.PI * r ** 3;
      const saBase = Math.PI * r * r;
      const saCyl = 2 * Math.PI * r * h;
      const saHemi = 2 * Math.PI * r * r;
      return {
        primaryLabel: 'Combined Volume',
        primaryValue: `${(vCyl + vHemi).toFixed(2)} u³`,
        secondaryLabel: 'Exposed Surface Area',
        secondaryValue: `${(saBase + saCyl + saHemi).toFixed(2)} u²`,
        anglesSummary: `r = ${r.toFixed(2)}, cyl h = ${h.toFixed(2)} · Internal join excluded from SA`,
        partsBreakdown: [
          `Cylinder V = ${vCyl.toFixed(2)} u³`,
          `Hemisphere V = ${vHemi.toFixed(2)} u³`,
          `Exposed SA = Base (${saBase.toFixed(1)}) + Wall (${saCyl.toFixed(1)}) + Dome (${saHemi.toFixed(1)})`,
        ],
        formulasUsed: ['V_total = πr²h + ⅔πr³', 'SA_exposed = πr² + 2πrh + 2πr² = 3πr² + 2πrh'],
      };
    }
    case 'compound-cone-cylinder': {
      const r = s / 2;
      const hCyl = s * hFactor * 0.75;
      const hCone = s * (0.45 + clampedRatio * 0.65);
      const l = Math.hypot(r, hCone);
      const vCyl = Math.PI * r * r * hCyl;
      const vCone = (Math.PI * r * r * hCone) / 3;
      const saBase = Math.PI * r * r;
      const saWall = 2 * Math.PI * r * hCyl;
      const saCone = Math.PI * r * l;
      return {
        primaryLabel: 'Combined Volume',
        primaryValue: `${(vCyl + vCone).toFixed(2)} u³`,
        secondaryLabel: 'Exposed Surface Area',
        secondaryValue: `${(saBase + saWall + saCone).toFixed(2)} u²`,
        anglesSummary: `r = ${r.toFixed(2)}, h_cyl = ${hCyl.toFixed(2)}, h_cone = ${hCone.toFixed(2)}, slant = ${l.toFixed(2)}`,
        partsBreakdown: [
          `Cylinder V = ${vCyl.toFixed(2)} u³ · Cone V = ${vCone.toFixed(2)} u³`,
          `Base πr² = ${saBase.toFixed(2)} u² · Wall 2πrh = ${saWall.toFixed(2)} u²`,
          `Cone roof πrl = ${saCone.toFixed(2)} u²`,
        ],
        formulasUsed: ['V_total = πr²h_cyl + ⅓πr²h_cone', 'SA_exposed = πr² + 2πrh_cyl + πrl'],
      };
    }
    case 'compound-cone-hemisphere': {
      const r = s / 2;
      const hCone = s * hFactor;
      const l = Math.hypot(r, hCone);
      const vHemi = (2 / 3) * Math.PI * r ** 3;
      const vCone = (Math.PI * r * r * hCone) / 3;
      const saHemi = 2 * Math.PI * r * r;
      const saCone = Math.PI * r * l;
      return {
        primaryLabel: 'Combined Volume',
        primaryValue: `${(vHemi + vCone).toFixed(2)} u³`,
        secondaryLabel: 'Exposed Surface Area',
        secondaryValue: `${(saHemi + saCone).toFixed(2)} u²`,
        anglesSummary: `r = ${r.toFixed(2)}, h_cone = ${hCone.toFixed(2)}, slant l = ${l.toFixed(2)} (No flat base exposed)`,
        partsBreakdown: [
          `Hemisphere V = ${vHemi.toFixed(2)} u³ · Cone V = ${vCone.toFixed(2)} u³`,
          `Exposed Dome 2πr² = ${saHemi.toFixed(2)} u² · Cone πrl = ${saCone.toFixed(2)} u²`,
        ],
        formulasUsed: ['V_total = ⅔πr³ + ⅓πr²h', 'SA_exposed = 2πr² + πrl'],
      };
    }
    case 'compound-prism-pyramid': {
      const b = s;
      const hBox = s * hFactor * 0.7;
      const hPyr = s * (0.45 + clampedRatio * 0.6);
      const slant = Math.hypot(b / 2, hPyr);
      const vBox = b * b * hBox;
      const vPyr = (b * b * hPyr) / 3;
      const saExposed = b * b + 4 * b * hBox + 2 * b * slant;
      return {
        primaryLabel: 'Combined Volume',
        primaryValue: `${(vBox + vPyr).toFixed(2)} u³`,
        secondaryLabel: 'Exposed Surface Area',
        secondaryValue: `${saExposed.toFixed(2)} u²`,
        anglesSummary: `Base = ${b.toFixed(1)}×${b.toFixed(1)}, h_box = ${hBox.toFixed(1)}, h_pyr = ${hPyr.toFixed(1)} · V=9, E=16, F=9`,
        partsBreakdown: [
          `Cuboid V = ${vBox.toFixed(2)} u³ · Pyramid V = ${vPyr.toFixed(2)} u³`,
          `Exposed SA = Base (${(b * b).toFixed(1)}) + 4 Walls (${(4 * b * hBox).toFixed(1)}) + 4 Roof Triangles (${(2 * b * slant).toFixed(1)})`,
        ],
        formulasUsed: ['V_total = b²H + ⅓b²h', 'SA_exposed = b² + 4bH + 2bl'],
      };
    }
  }
}

function makeCircleRing(radius: number, y: number, steps = 40): WireframePoint3D[] {
  const pts: WireframePoint3D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push({ x: radius * Math.cos(a), y, z: radius * Math.sin(a) });
  }
  return pts;
}

export function generateShapeWireframeData(
  shape: ExpandedShapeId,
  size: number,
  angleOrHeightDeg = 60,
  topRatio = 0.5
): WireframeMesh3D {
  const s = 48 + size * 7;
  const hFactor = 0.55 + (Math.max(15, Math.min(85, angleOrHeightDeg)) / 90) * 0.7;
  const rRatio = Math.max(0.22, Math.min(0.85, topRatio));

  if (shape === 'triangle') {
    const rad = (Math.max(15, Math.min(80, angleOrHeightDeg)) * Math.PI) / 180;
    const halfBase = s * 0.82;
    const h = Math.min(s * 1.15, halfBase * Math.tan(rad));
    return {
      vertices: [
        { x: -halfBase, y: h * 0.48, z: 0 },
        { x: halfBase, y: h * 0.48, z: 0 },
        { x: 0, y: -h * 0.62, z: 0 },
      ],
      edges: [[0, 1], [1, 2], [2, 0]],
      rings: [],
      accentColor: '#5EEAD4',
    };
  }

  if (shape === 'rectangle') {
    const hw = s * 0.85;
    const hh = s * (0.35 + angleOrHeightDeg / 190);
    return {
      vertices: [
        { x: -hw, y: -hh, z: 0 },
        { x: hw, y: -hh, z: 0 },
        { x: hw, y: hh, z: 0 },
        { x: -hw, y: hh, z: 0 },
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
      rings: [],
      accentColor: '#7DD3FC',
    };
  }

  if (shape === 'circle') {
    return {
      vertices: [{ x: 0, y: 0, z: 0 }, { x: s * 0.9, y: 0, z: 0 }],
      edges: [[0, 1]],
      rings: [{ points: makeCircleRing(s * 0.9, 0, 56).map((p) => ({ x: p.x, y: p.z, z: 0 })), color: '#38BDF8' }],
      accentColor: '#38BDF8',
    };
  }

  if (shape === 'cube' || shape === 'cuboid') {
    const hx = s * 0.72;
    const hz = shape === 'cuboid' ? s * 0.72 * rRatio : hx;
    const hy = shape === 'cuboid' ? s * 0.68 * hFactor : hx;
    return {
      vertices: [
        { x: -hx, y: -hy, z: -hz }, { x: hx, y: -hy, z: -hz },
        { x: hx, y: hy, z: -hz }, { x: -hx, y: hy, z: -hz },
        { x: -hx, y: -hy, z: hz }, { x: hx, y: -hy, z: hz },
        { x: hx, y: hy, z: hz }, { x: -hx, y: hy, z: hz },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ],
      rings: [],
      accentColor: '#38BDF8',
    };
  }

  if (shape === 'sphere') {
    const r = s * 0.88;
    const rings: WireframeMesh3D['rings'] = [];
    for (let lat = -2; lat <= 2; lat++) {
      const phi = (lat / 3) * (Math.PI / 2);
      rings.push({
        points: makeCircleRing(r * Math.cos(phi), r * Math.sin(phi), 44),
        color: lat === 0 ? '#5EEAD4' : 'rgba(56,189,248,0.55)',
      });
    }
    for (let lon = 0; lon < 4; lon++) {
      const ang = (lon / 4) * Math.PI;
      const pts: WireframePoint3D[] = [];
      for (let i = 0; i <= 44; i++) {
        const th = (i / 44) * Math.PI * 2;
        pts.push({
          x: r * Math.sin(th) * Math.cos(ang),
          y: r * Math.cos(th),
          z: r * Math.sin(th) * Math.sin(ang),
        });
      }
      rings.push({ points: pts, color: 'rgba(125,211,252,0.45)' });
    }
    return { vertices: [], edges: [], rings, accentColor: '#38BDF8' };
  }

  if (shape === 'hemisphere') {
    const r = s * 0.92;
    const yBase = r * 0.35;
    const rings: WireframeMesh3D['rings'] = [
      { points: makeCircleRing(r, yBase, 48), color: '#5EEAD4' },
      { points: makeCircleRing(r * 0.86, yBase - r * 0.5, 44), color: 'rgba(56,189,248,0.55)' },
      { points: makeCircleRing(r * 0.5, yBase - r * 0.86, 36), color: 'rgba(56,189,248,0.55)' },
    ];
    for (let lon = 0; lon < 4; lon++) {
      const ang = (lon / 4) * Math.PI;
      const pts: WireframePoint3D[] = [];
      for (let i = 0; i <= 24; i++) {
        const th = (i / 24) * Math.PI;
        pts.push({
          x: r * Math.cos(th) * Math.cos(ang),
          y: yBase - r * Math.sin(th),
          z: r * Math.cos(th) * Math.sin(ang),
        });
      }
      rings.push({ points: pts, color: '#38BDF8' });
    }
    return {
      vertices: [{ x: 0, y: yBase, z: 0 }, { x: r, y: yBase, z: 0 }],
      edges: [[0, 1]],
      rings,
      accentColor: '#5EEAD4',
    };
  }

  if (shape === 'cylinder') {
    const r = s * 0.72;
    const hy = s * 0.72 * hFactor;
    return {
      vertices: [
        { x: -r, y: -hy, z: 0 }, { x: -r, y: hy, z: 0 },
        { x: r, y: -hy, z: 0 }, { x: r, y: hy, z: 0 },
        { x: 0, y: -hy, z: -r }, { x: 0, y: hy, z: -r },
        { x: 0, y: -hy, z: r }, { x: 0, y: hy, z: r },
      ],
      edges: [[0, 1], [2, 3], [4, 5], [6, 7]],
      rings: [
        { points: makeCircleRing(r, -hy, 44), color: '#5EEAD4' },
        { points: makeCircleRing(r, hy, 44), color: '#38BDF8' },
      ],
      accentColor: '#38BDF8',
    };
  }

  if (shape === 'cone') {
    const r = s * 0.8;
    const yBase = s * 0.65;
    const yApex = -s * (0.65 * hFactor + 0.15);
    return {
      vertices: [
        { x: 0, y: yApex, z: 0 },
        { x: -r, y: yBase, z: 0 },
        { x: r, y: yBase, z: 0 },
        { x: 0, y: yBase, z: -r },
        { x: 0, y: yBase, z: r },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [0, 4]],
      rings: [{ points: makeCircleRing(r, yBase, 48), color: '#5EEAD4' }],
      accentColor: '#818CF8',
    };
  }

  if (shape === 'frustum-cone') {
    const R = s * 0.86;
    const r = R * rRatio;
    const hy = s * 0.62 * hFactor;
    return {
      vertices: [
        { x: -r, y: -hy, z: 0 }, { x: -R, y: hy, z: 0 },
        { x: r, y: -hy, z: 0 }, { x: R, y: hy, z: 0 },
        { x: 0, y: -hy, z: -r }, { x: 0, y: hy, z: -R },
        { x: 0, y: -hy, z: r }, { x: 0, y: hy, z: R },
      ],
      edges: [[0, 1], [2, 3], [4, 5], [6, 7]],
      rings: [
        { points: makeCircleRing(r, -hy, 44), color: '#5EEAD4' },
        { points: makeCircleRing(R, hy, 48), color: '#38BDF8' },
      ],
      accentColor: '#5EEAD4',
    };
  }

  if (shape === 'frustum-pyramid') {
    const A = s * 0.8;
    const a = A * rRatio;
    const hy = s * 0.62 * hFactor;
    return {
      vertices: [
        { x: -a, y: -hy, z: -a }, { x: a, y: -hy, z: -a },
        { x: a, y: -hy, z: a }, { x: -a, y: -hy, z: a },
        { x: -A, y: hy, z: -A }, { x: A, y: hy, z: -A },
        { x: A, y: hy, z: A }, { x: -A, y: hy, z: A },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ],
      rings: [],
      accentColor: '#818CF8',
    };
  }

  if (shape === 'triangular-prism') {
    const w = s * 0.75;
    const h = s * 0.65;
    const len = s * 0.72 * hFactor;
    return {
      vertices: [
        { x: -w, y: h * 0.55, z: -len }, { x: w, y: h * 0.55, z: -len }, { x: 0, y: -h * 0.75, z: -len },
        { x: -w, y: h * 0.55, z: len }, { x: w, y: h * 0.55, z: len }, { x: 0, y: -h * 0.75, z: len },
      ],
      edges: [
        [0, 1], [1, 2], [2, 0],
        [3, 4], [4, 5], [5, 3],
        [0, 3], [1, 4], [2, 5],
      ],
      rings: [],
      accentColor: '#5EEAD4',
    };
  }

  if (shape === 'hexagonal-prism') {
    const r = s * 0.74;
    const hy = s * 0.65 * hFactor;
    const verts: WireframePoint3D[] = [];
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      verts.push({ x: r * Math.cos(a), y: -hy, z: r * Math.sin(a) });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      verts.push({ x: r * Math.cos(a), y: hy, z: r * Math.sin(a) });
    }
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      edges.push([i, next], [i + 6, next + 6], [i, i + 6]);
    }
    return { vertices: verts, edges, rings: [], accentColor: '#38BDF8' };
  }

  if (shape === 'pyramid') {
    const hs = s * 0.78;
    const apexY = -s * (0.55 + angleOrHeightDeg / 190);
    return {
      vertices: [
        { x: -hs, y: hs * 0.65, z: -hs },
        { x: hs, y: hs * 0.65, z: -hs },
        { x: hs, y: hs * 0.65, z: hs },
        { x: -hs, y: hs * 0.65, z: hs },
        { x: 0, y: apexY, z: 0 },
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]],
      rings: [],
      accentColor: '#818CF8',
    };
  }

  if (shape === 'tetrahedron') {
    const r = s * 0.82;
    const baseY = s * 0.5;
    const apexY = -s * (0.55 + angleOrHeightDeg / 200);
    const base = [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      return { x: r * Math.cos(a), y: baseY, z: r * Math.sin(a) };
    });
    return {
      vertices: [...base, { x: 0, y: apexY, z: 0 }],
      edges: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]],
      rings: [],
      accentColor: '#A78BFA',
    };
  }

  if (shape === 'octahedron') {
    return {
      vertices: [
        { x: 0, y: -s, z: 0 },
        { x: s, y: 0, z: 0 },
        { x: 0, y: 0, z: s },
        { x: -s, y: 0, z: 0 },
        { x: 0, y: 0, z: -s },
        { x: 0, y: s, z: 0 },
      ],
      edges: [
        [0, 1], [0, 2], [0, 3], [0, 4],
        [5, 1], [5, 2], [5, 3], [5, 4],
        [1, 2], [2, 3], [3, 4], [4, 1],
      ],
      rings: [],
      accentColor: '#38BDF8',
    };
  }

  if (shape === 'torus') {
    const R = s * 0.68;
    const r = s * (0.18 + 0.16 * rRatio);
    const rings: WireframeMesh3D['rings'] = [];
    for (let uIdx = 0; uIdx < 12; uIdx++) {
      const u = (uIdx / 12) * Math.PI * 2;
      const pts: WireframePoint3D[] = [];
      for (let vIdx = 0; vIdx <= 18; vIdx++) {
        const v = (vIdx / 18) * Math.PI * 2;
        const rad = R + r * Math.cos(v);
        pts.push({ x: rad * Math.cos(u), y: r * Math.sin(v), z: rad * Math.sin(u) });
      }
      rings.push({ points: pts, color: 'rgba(94, 234, 212, 0.55)' });
    }
    for (let vIdx = 0; vIdx < 6; vIdx++) {
      const v = (vIdx / 6) * Math.PI * 2;
      const rad = R + r * Math.cos(v);
      rings.push({
        points: makeCircleRing(rad, r * Math.sin(v), 44),
        color: vIdx % 2 === 0 ? '#38BDF8' : 'rgba(56, 189, 248, 0.45)',
      });
    }
    return { vertices: [], edges: [], rings, accentColor: '#5EEAD4' };
  }

  if (shape === 'compound-hemisphere-cylinder') {
    const r = s * 0.66;
    const yMid = -s * 0.18;
    const yBot = s * (0.45 + 0.35 * hFactor);
    const rings: WireframeMesh3D['rings'] = [
      { points: makeCircleRing(r, yBot, 44), color: '#38BDF8' },
      { points: makeCircleRing(r, yMid, 44), color: '#5EEAD4' },
      { points: makeCircleRing(r * 0.72, yMid - r * 0.65, 36), color: 'rgba(94,234,212,0.55)' },
    ];
    for (let lon = 0; lon < 3; lon++) {
      const ang = (lon / 3) * Math.PI;
      const pts: WireframePoint3D[] = [];
      for (let i = 0; i <= 20; i++) {
        const th = (i / 20) * Math.PI;
        pts.push({ x: r * Math.cos(th) * Math.cos(ang), y: yMid - r * Math.sin(th), z: r * Math.cos(th) * Math.sin(ang) });
      }
      rings.push({ points: pts, color: '#5EEAD4' });
    }
    return {
      vertices: [
        { x: -r, y: yMid, z: 0 }, { x: -r, y: yBot, z: 0 },
        { x: r, y: yMid, z: 0 }, { x: r, y: yBot, z: 0 },
        { x: 0, y: yMid, z: -r }, { x: 0, y: yBot, z: -r },
        { x: 0, y: yMid, z: r }, { x: 0, y: yBot, z: r },
      ],
      edges: [[0, 1], [2, 3], [4, 5], [6, 7]],
      rings,
      accentColor: '#5EEAD4',
    };
  }

  if (shape === 'compound-cone-cylinder') {
    const r = s * 0.66;
    const yJoin = -s * 0.1;
    const yBot = s * (0.45 + 0.35 * hFactor);
    const yApex = yJoin - s * (0.45 + 0.65 * rRatio);
    return {
      vertices: [
        { x: 0, y: yApex, z: 0 },
        { x: -r, y: yJoin, z: 0 }, { x: -r, y: yBot, z: 0 },
        { x: r, y: yJoin, z: 0 }, { x: r, y: yBot, z: 0 },
        { x: 0, y: yJoin, z: -r }, { x: 0, y: yBot, z: -r },
        { x: 0, y: yJoin, z: r }, { x: 0, y: yBot, z: r },
      ],
      edges: [
        [0, 1], [0, 3], [0, 5], [0, 7],
        [1, 2], [3, 4], [5, 6], [7, 8],
      ],
      rings: [
        { points: makeCircleRing(r, yJoin, 44), color: '#5EEAD4' },
        { points: makeCircleRing(r, yBot, 44), color: '#38BDF8' },
      ],
      accentColor: '#818CF8',
    };
  }

  if (shape === 'compound-cone-hemisphere') {
    const r = s * 0.7;
    const yJoin = s * 0.1;
    const yApex = yJoin - s * (0.75 * hFactor + 0.35);
    const rings: WireframeMesh3D['rings'] = [
      { points: makeCircleRing(r, yJoin, 44), color: '#5EEAD4' },
      { points: makeCircleRing(r * 0.72, yJoin + r * 0.65, 36), color: 'rgba(56,189,248,0.55)' },
    ];
    for (let lon = 0; lon < 3; lon++) {
      const ang = (lon / 3) * Math.PI;
      const pts: WireframePoint3D[] = [];
      for (let i = 0; i <= 20; i++) {
        const th = (i / 20) * Math.PI;
        pts.push({ x: r * Math.cos(th) * Math.cos(ang), y: yJoin + r * Math.sin(th), z: r * Math.cos(th) * Math.sin(ang) });
      }
      rings.push({ points: pts, color: '#38BDF8' });
    }
    return {
      vertices: [
        { x: 0, y: yApex, z: 0 },
        { x: -r, y: yJoin, z: 0 }, { x: r, y: yJoin, z: 0 },
        { x: 0, y: yJoin, z: -r }, { x: 0, y: yJoin, z: r },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [0, 4]],
      rings,
      accentColor: '#5EEAD4',
    };
  }

  // compound-prism-pyramid
  const hs = s * 0.68;
  const yJoin = -s * 0.05;
  const yBot = s * (0.45 + 0.32 * hFactor);
  const yApex = yJoin - s * (0.45 + 0.65 * rRatio);
  return {
    vertices: [
      { x: -hs, y: yJoin, z: -hs }, { x: hs, y: yJoin, z: -hs },
      { x: hs, y: yJoin, z: hs }, { x: -hs, y: yJoin, z: hs },
      { x: -hs, y: yBot, z: -hs }, { x: hs, y: yBot, z: -hs },
      { x: hs, y: yBot, z: hs }, { x: -hs, y: yBot, z: hs },
      { x: 0, y: yApex, z: 0 },
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [0, 8], [1, 8], [2, 8], [3, 8],
    ],
    rings: [],
    accentColor: '#38BDF8',
  };
}
