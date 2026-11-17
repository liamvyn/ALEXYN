import type { QuizQuestion, QuizVisualSpec } from '../types/alexyn';
import { compileMathExpression, sampleEquationCurve } from './mathGraph';

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDim(val: number | undefined, unit: string, fallback: string): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `${val} ${unit}`.trim();
  }
  return fallback;
}

function renderSolid3dSvg(spec: QuizVisualSpec): string {
  const shape = (spec.shapeId || 'cone').toLowerCase();
  const dims = spec.dimensions || {};
  const unit = dims.unit || 'cm';
  const rLabel = dims.radius !== undefined ? `r = ${fmtDim(dims.radius, unit, '')}` : '';
  const RLabel = dims.radius !== undefined ? `R = ${fmtDim(dims.radius, unit, '')}` : '';
  const topRLabel = dims.topRadius !== undefined ? `r = ${fmtDim(dims.topRadius, unit, '')}` : '';
  const hLabel = dims.height !== undefined ? `h = ${fmtDim(dims.height, unit, '')}` : '';
  const wLabel = dims.width !== undefined ? `w = ${fmtDim(dims.width, unit, '')}` : '';
  const lLabel = dims.length !== undefined ? `l = ${fmtDim(dims.length, unit, '')}` : dims.slant !== undefined ? `l = ${fmtDim(dims.slant, unit, '')}` : '';

  let body = '';

  if (shape.includes('frustum')) {
    body = `
      <ellipse cx="210" cy="68" rx="46" ry="13" fill="rgba(56,189,248,0.16)" stroke="#5EEAD4" stroke-width="2.4"/>
      <path d="M126,182 A84,22 0 0,0 294,182" fill="none" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M126,182 A84,22 0 0,1 294,182" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-dasharray="5,4"/>
      <line x1="164" y1="68" x2="126" y2="182" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="256" y1="68" x2="294" y2="182" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="210" y1="68" x2="210" y2="182" stroke="#FBBF24" stroke-width="1.6" stroke-dasharray="4,4"/>
      <line x1="210" y1="68" x2="256" y2="68" stroke="#5EEAD4" stroke-width="1.8"/>
      <line x1="210" y1="182" x2="294" y2="182" stroke="#5EEAD4" stroke-width="1.8"/>
      <text x="234" y="61" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(topRLabel || 'r')}</text>
      <text x="242" y="199" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(RLabel || 'R')}</text>
      <text x="172" y="130" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
    `;
  } else if (shape.includes('hemisphere') && shape.includes('cylinder')) {
    body = `
      <path d="M148,96 A62,60 0 0,1 272,96" fill="rgba(94,234,212,0.16)" stroke="#5EEAD4" stroke-width="2.4"/>
      <ellipse cx="210" cy="96" rx="62" ry="15" fill="none" stroke="#5EEAD4" stroke-width="1.6" stroke-dasharray="4,4"/>
      <line x1="148" y1="96" x2="148" y2="186" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="272" y1="96" x2="272" y2="186" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M148,186 A62,16 0 0,0 272,186" fill="none" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M148,186 A62,16 0 0,1 272,186" fill="none" stroke="#38BDF8" stroke-width="1.4" stroke-dasharray="4,4"/>
      <line x1="210" y1="96" x2="272" y2="96" stroke="#5EEAD4" stroke-width="1.8"/>
      <text x="228" y="88" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
      <text x="284" y="146" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
    `;
  } else if (shape.includes('cone') && shape.includes('cylinder')) {
    body = `
      <polygon points="210,36 148,98 272,98" fill="rgba(129,140,248,0.16)" stroke="#818CF8" stroke-width="2.2"/>
      <ellipse cx="210" cy="98" rx="62" ry="15" fill="none" stroke="#5EEAD4" stroke-width="1.6" stroke-dasharray="4,4"/>
      <line x1="148" y1="98" x2="148" y2="188" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="272" y1="98" x2="272" y2="188" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M148,188 A62,16 0 0,0 272,188" fill="none" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="210" y1="98" x2="272" y2="98" stroke="#5EEAD4" stroke-width="1.8"/>
      <text x="226" y="114" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
      <text x="284" y="148" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
    `;
  } else if (shape.includes('hemisphere')) {
    body = `
      <path d="M126,156 A84,84 0 0,1 294,156" fill="rgba(94,234,212,0.16)" stroke="#5EEAD4" stroke-width="2.6"/>
      <ellipse cx="210" cy="156" rx="84" ry="22" fill="rgba(56,189,248,0.12)" stroke="#38BDF8" stroke-width="2.2"/>
      <line x1="210" y1="156" x2="294" y2="156" stroke="#FBBF24" stroke-width="2"/>
      <circle cx="210" cy="156" r="3" fill="#FBBF24"/>
      <text x="242" y="148" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
    `;
  } else if (shape.includes('sphere')) {
    body = `
      <circle cx="210" cy="124" r="72" fill="rgba(56,189,248,0.12)" stroke="#38BDF8" stroke-width="2.5"/>
      <ellipse cx="210" cy="124" rx="72" ry="20" fill="none" stroke="#5EEAD4" stroke-width="1.6" stroke-dasharray="4,4"/>
      <line x1="210" y1="124" x2="282" y2="124" stroke="#FBBF24" stroke-width="2"/>
      <circle cx="210" cy="124" r="3" fill="#FBBF24"/>
      <text x="234" y="116" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
    `;
  } else if (shape.includes('cylinder')) {
    body = `
      <ellipse cx="210" cy="64" rx="68" ry="18" fill="rgba(56,189,248,0.18)" stroke="#5EEAD4" stroke-width="2.4"/>
      <line x1="142" y1="64" x2="142" y2="180" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="278" y1="64" x2="278" y2="180" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M142,180 A68,18 0 0,0 278,180" fill="none" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M142,180 A68,18 0 0,1 278,180" fill="none" stroke="#38BDF8" stroke-width="1.4" stroke-dasharray="4,4"/>
      <line x1="210" y1="64" x2="278" y2="64" stroke="#FBBF24" stroke-width="1.8"/>
      <text x="230" y="57" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
      <text x="288" y="128" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
    `;
  } else if (shape.includes('cone')) {
    body = `
      <line x1="210" y1="44" x2="136" y2="178" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="210" y1="44" x2="284" y2="178" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M136,178 A74,20 0 0,0 284,178" fill="none" stroke="#38BDF8" stroke-width="2.4"/>
      <path d="M136,178 A74,20 0 0,1 284,178" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="4,4"/>
      <line x1="210" y1="44" x2="210" y2="178" stroke="#FBBF24" stroke-width="1.8" stroke-dasharray="4,4"/>
      <line x1="210" y1="178" x2="284" y2="178" stroke="#5EEAD4" stroke-width="2"/>
      <text x="176" y="118" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
      <text x="236" y="195" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(rLabel || 'r')}</text>
      ${lLabel ? `<text x="256" y="106" fill="#C4B5FD" font-size="12" font-weight="700">${escapeXml(lLabel)}</text>` : ''}
    `;
  } else if (shape.includes('pyramid')) {
    body = `
      <polygon points="210,44 132,164 252,190" fill="rgba(129,140,248,0.14)" stroke="#818CF8" stroke-width="2.3"/>
      <polygon points="210,44 252,190 302,150" fill="rgba(56,189,248,0.12)" stroke="#38BDF8" stroke-width="2.3"/>
      <line x1="132" y1="164" x2="184" y2="132" stroke="#38BDF8" stroke-width="1.4" stroke-dasharray="4,4"/>
      <line x1="184" y1="132" x2="302" y2="150" stroke="#38BDF8" stroke-width="1.4" stroke-dasharray="4,4"/>
      <line x1="210" y1="44" x2="217" y2="159" stroke="#FBBF24" stroke-width="1.6" stroke-dasharray="4,4"/>
      <text x="224" y="112" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
      <text x="172" y="198" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(wLabel || lLabel || 'b')}</text>
    `;
  } else if (shape.includes('triangular-prism') || shape.includes('prism')) {
    body = `
      <polygon points="120,176 196,176 158,104" fill="rgba(56,189,248,0.18)" stroke="#38BDF8" stroke-width="2.4"/>
      <polygon points="224,142 300,142 262,70" fill="rgba(94,234,212,0.1)" stroke="#5EEAD4" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="158" y1="104" x2="262" y2="70" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="196" y1="176" x2="300" y2="142" stroke="#38BDF8" stroke-width="2.4"/>
      <line x1="120" y1="176" x2="224" y2="142" stroke="#38BDF8" stroke-width="1.6" stroke-dasharray="4,4"/>
      <text x="148" y="195" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(wLabel || 'b')}</text>
      <text x="252" y="176" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(lLabel || 'L')}</text>
    `;
  } else {
    // Cube / Cuboid default
    body = `
      <rect x="130" y="92" width="118" height="90" fill="rgba(56,189,248,0.16)" stroke="#38BDF8" stroke-width="2.4"/>
      <polygon points="130,92 176,58 294,58 248,92" fill="rgba(94,234,212,0.12)" stroke="#5EEAD4" stroke-width="2.2"/>
      <polygon points="248,92 294,58 294,148 248,182" fill="rgba(129,140,248,0.14)" stroke="#818CF8" stroke-width="2.2"/>
      <text x="174" y="200" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(lLabel || 'l')}</text>
      <text x="275" y="172" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(wLabel || 'w')}</text>
      <text x="102" y="142" fill="#7DD3FC" font-size="12" font-weight="700">${escapeXml(hLabel || 'h')}</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 225" width="420" height="225" role="img" aria-label="${escapeXml(spec.title || `${shape} diagram`)}">
  <rect width="420" height="225" rx="14" fill="#040B1C"/>
  ${spec.title ? `<text x="16" y="24" fill="#93C5FD" font-size="12" font-weight="700">${escapeXml(spec.title)}</text>` : ''}
  ${body}
</svg>`;
}

function renderCoordinateGraphSvg(spec: QuizVisualSpec): string {
  const xMin = -5;
  const xMax = 5;
  const yMin = -5;
  const yMax = 5;
  const toSvg = (x: number, y: number) => ({
    sx: 45 + ((x - xMin) / (xMax - xMin)) * 330,
    sy: 205 - ((y - yMin) / (yMax - yMin)) * 165,
  });

  const gridLines: string[] = [];
  for (let x = -4; x <= 4; x++) {
    const p = toSvg(x, 0);
    gridLines.push(`<line x1="${p.sx.toFixed(1)}" y1="40" x2="${p.sx.toFixed(1)}" y2="205" stroke="${x === 0 ? '#64748B' : 'rgba(148,163,184,0.16)'}" stroke-width="${x === 0 ? '1.8' : '1'}"/>`);
  }
  for (let y = -4; y <= 4; y++) {
    const p = toSvg(0, y);
    gridLines.push(`<line x1="45" y1="${p.sy.toFixed(1)}" x2="375" y2="${p.sy.toFixed(1)}" stroke="${y === 0 ? '#64748B' : 'rgba(148,163,184,0.16)'}" stroke-width="${y === 0 ? '1.8' : '1'}"/>`);
  }

  const colors = ['#38BDF8', '#5EEAD4', '#FBBF24'];
  const curveSvg = (spec.equations || ['y = x']).slice(0, 3).map((expr, idx) => {
    const compiled = compileMathExpression(expr);
    if (!compiled.ok) return '';
    const segments = sampleEquationCurve(
      compiled.evalAt,
      { xMin, xMax, yMin, yMax },
      120
    );
    const paths = segments
      .map((seg) =>
        seg
          .map((pt, pIdx) => {
            const sp = toSvg(pt.x, pt.y);
            return `${pIdx === 0 ? 'M' : 'L'}${sp.sx.toFixed(1)},${sp.sy.toFixed(1)}`;
          })
          .join(' ')
      )
      .filter(Boolean)
      .map((d) => `<path d="${d}" fill="none" stroke="${colors[idx % colors.length]}" stroke-width="2.6"/>`)
      .join('');
    return paths;
  });

  const ptsSvg = (spec.points || []).map((pt) => {
    const sp = toSvg(pt.x, pt.y);
    return `<circle cx="${sp.sx.toFixed(1)}" cy="${sp.sy.toFixed(1)}" r="4.5" fill="#FBBF24"/><text x="${(sp.sx + 7).toFixed(1)}" y="${(sp.sy - 6).toFixed(1)}" fill="#FDE68A" font-size="11" font-weight="700">${escapeXml(pt.label || `(${pt.x}, ${pt.y})`)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 225" width="420" height="225" role="img" aria-label="${escapeXml(spec.title || 'Coordinate Graph')}">
  <defs><clipPath id="plotClip"><rect x="45" y="40" width="330" height="165"/></clipPath></defs>
  <rect width="420" height="225" rx="14" fill="#040B1C"/>
  <text x="16" y="24" fill="#93C5FD" font-size="12" font-weight="700">${escapeXml(spec.title || (spec.equations || []).join(' , '))}</text>
  ${gridLines.join('')}
  <g clip-path="url(#plotClip)">${curveSvg.join('')}</g>
  ${ptsSvg.join('')}
</svg>`;
}

function renderTriangle2dSvg(spec: QuizVisualSpec): string {
  const dims = spec.dimensions || {};
  const unit = dims.unit || 'cm';
  const aText = dims.a ? `${dims.a} ${unit}` : 'a';
  const bText = dims.b ? `${dims.b} ${unit}` : 'b';
  const cText = dims.c ? `${dims.c} ${unit}` : 'c';
  const angleText = dims.angleDeg ? `${dims.angleDeg}°` : 'θ';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="420" height="220" role="img" aria-label="${escapeXml(spec.title || 'Triangle Diagram')}">
  <rect width="420" height="220" rx="14" fill="#040B1C"/>
  <text x="16" y="24" fill="#93C5FD" font-size="12" font-weight="700">${escapeXml(spec.title || 'Triangle Geometry')}</text>
  <polygon points="105,178 305,178 105,58" fill="rgba(56,189,248,0.16)" stroke="#38BDF8" stroke-width="2.6"/>
  <rect x="105" y="160" width="18" height="18" fill="none" stroke="#5EEAD4" stroke-width="1.8"/>
  <path d="M268,178 A38,38 0 0,0 272,158" fill="none" stroke="#FBBF24" stroke-width="2"/>
  <text x="72" y="122" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(aText)}</text>
  <text x="195" y="198" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(bText)}</text>
  <text x="218" y="110" fill="#7DD3FC" font-size="12" font-weight="700">${escapeXml(cText)}</text>
  <text x="242" y="170" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(angleText)}</text>
</svg>`;
}

function renderCircle2dSvg(spec: QuizVisualSpec): string {
  const dims = spec.dimensions || {};
  const unit = dims.unit || 'cm';
  const rText = dims.radius !== undefined ? `r = ${dims.radius} ${unit}` : 'r';
  const angText = dims.angleDeg !== undefined ? `${dims.angleDeg}°` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="420" height="220" role="img" aria-label="${escapeXml(spec.title || 'Circle Diagram')}">
  <rect width="420" height="220" rx="14" fill="#040B1C"/>
  <text x="16" y="24" fill="#93C5FD" font-size="12" font-weight="700">${escapeXml(spec.title || 'Circle Geometry')}</text>
  <circle cx="210" cy="118" r="76" fill="rgba(56,189,248,0.12)" stroke="#38BDF8" stroke-width="2.5"/>
  <path d="M210,118 L286,118 A76,76 0 0,0 248,52 Z" fill="rgba(94,234,212,0.22)" stroke="#5EEAD4" stroke-width="2"/>
  <circle cx="210" cy="118" r="3.5" fill="#FBBF24"/>
  <text x="240" y="134" fill="#5EEAD4" font-size="12" font-weight="700">${escapeXml(rText)}</text>
  ${angText ? `<text x="220" y="102" fill="#FBBF24" font-size="12" font-weight="700">${escapeXml(angText)}</text>` : ''}
</svg>`;
}

function renderCircuitSvg(spec: QuizVisualSpec): string {
  const c = spec.circuit || {};
  const v = c.voltage ?? 12;
  const r1 = c.r1 ?? 4;
  const r2 = c.r2 ?? 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="420" height="220" role="img" aria-label="${escapeXml(spec.title || 'Circuit Diagram')}">
  <rect width="420" height="220" rx="14" fill="#040B1C"/>
  <text x="16" y="24" fill="#93C5FD" font-size="12" font-weight="700">${escapeXml(spec.title || 'Electric Circuit')}</text>
  <rect x="84" y="56" width="252" height="122" fill="none" stroke="#38BDF8" stroke-width="2.5"/>
  ${c.mode === 'parallel' ? '<line x1="84" y1="118" x2="336" y2="118" stroke="#38BDF8" stroke-width="2.2"/>' : ''}
  <rect x="70" y="96" width="28" height="40" rx="4" fill="#FBBF24"/>
  <text x="72" y="120" fill="#040B1C" font-size="11" font-weight="800">${v}V</text>
  <rect x="172" y="44" width="64" height="24" rx="4" fill="#0F2654" stroke="#5EEAD4" stroke-width="2"/>
  <text x="184" y="60" fill="#5EEAD4" font-size="11" font-weight="700">R₁=${r1}Ω</text>
  <rect x="172" y="${c.mode === 'parallel' ? '106' : '166'}" width="64" height="24" rx="4" fill="#0F2654" stroke="#818CF8" stroke-width="2"/>
  <text x="184" y="${c.mode === 'parallel' ? '122' : '182'}" fill="#C4B5FD" font-size="11" font-weight="700">R₂=${r2}Ω</text>
</svg>`;
}

export function buildSvgFromVisualSpec(spec: QuizVisualSpec): string {
  switch (spec.kind) {
    case 'solid-3d':
      return renderSolid3dSvg(spec);
    case 'coordinate-graph':
      return renderCoordinateGraphSvg(spec);
    case 'triangle-2d':
      return renderTriangle2dSvg(spec);
    case 'circle-2d':
      return renderCircle2dSvg(spec);
    case 'science-circuit':
      return renderCircuitSvg(spec);
    default:
      return renderSolid3dSvg(spec);
  }
}

export function enrichQuestionWithVisual(q: QuizQuestion): QuizQuestion {
  const existingSvg = q.diagramSpec?.svgMarkup?.trim();
  if (existingSvg) return q;
  if (!q.visualSpec) return q;
  const generatedSvg = buildSvgFromVisualSpec(q.visualSpec);
  return {
    ...q,
    diagramSpec: {
      title: q.diagramSpec?.title || q.visualSpec.title || 'Question Diagram',
      instructions:
        q.diagramSpec?.instructions || 'Use the measurements and labels shown in the diagram above.',
      expectedLabels: q.diagramSpec?.expectedLabels || q.visualSpec.labels,
      svgMarkup: generatedSvg,
    },
  };
}
