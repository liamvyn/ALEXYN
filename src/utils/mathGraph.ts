import { compile, type EvalFunction } from 'mathjs';

export interface GraphEquation {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
}

export interface GraphPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
  color: string;
}

export interface GraphViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface GraphState {
  equations: GraphEquation[];
  points: GraphPoint[];
  viewport: GraphViewport;
}

export interface GraphAIAction {
  mode?: 'replace' | 'add' | 'keep';
  equations?: string[];
  addPoints?: Array<{ x: number; y: number; label?: string }>;
  clearPoints?: boolean;
  extendNegativeX?: boolean;
  extendAmount?: number;
  zoomFactor?: number;
  viewport?: Partial<GraphViewport>;
  resetView?: boolean;
}

export const GRAPH_PALETTE = [
  '#5EEAD4',
  '#38BDF8',
  '#FBBF24',
  '#F472B6',
  '#A78BFA',
  '#34D399',
];

export const DEFAULT_GRAPH_VIEWPORT: GraphViewport = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
};

export const DEFAULT_GRAPH_STATE: GraphState = {
  equations: [
    {
      id: 'eq-default-1',
      expression: 'y = x^2 - 1',
      color: GRAPH_PALETTE[0],
      visible: true,
    },
  ],
  points: [
    {
      id: 'pt-default-1',
      x: 0,
      y: -1,
      label: 'Vertex',
      color: '#FBBF24',
    },
  ],
  viewport: { ...DEFAULT_GRAPH_VIEWPORT },
};

export function normalizeMathExpression(raw: string): string {
  let expr = String(raw || '').trim();
  if (!expr) return '';

  // Strip leading "y =", "f(x) =", "g(x) =" etc.
  expr = expr.replace(/^(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=\s*/i, '');

  // Convert Unicode math symbols and superscripts
  expr = expr
    .replace(/−/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/\bln\s*\(/gi, 'log(')
    .replace(/\|([^|]+)\|/g, 'abs($1)');

  // Allow common implicit forms like "x^2" or "2x" (mathjs natively handles "2x",
  // and handles "x(x+1)"? Let's ensure ")(" -> ")*(" and digit-or-x before "(" when not function name)
  expr = expr.replace(/\)\s*\(/g, ')*(');
  expr = expr.replace(/\bx\s*\(/g, 'x*(');
  expr = expr.replace(/(\d)\s*\(/g, '$1*(');

  return expr.trim();
}

export interface CompiledMathExpression {
  ok: boolean;
  normalized: string;
  error?: string;
  evalAt: (x: number) => number | null;
}

export function compileMathExpression(raw: string): CompiledMathExpression {
  const normalized = normalizeMathExpression(raw);
  if (!normalized) {
    return {
      ok: false,
      normalized: '',
      error: 'Enter an equation such as y = x^2 or y = 2x + 3.',
      evalAt: () => null,
    };
  }

  let compiled: EvalFunction;
  try {
    compiled = compile(normalized);
    // Dry-run evaluation at x = 1 and x = -1 to detect unknown symbols early
    const testVal = compiled.evaluate({ x: 1, e: Math.E, pi: Math.PI });
    if (typeof testVal !== 'number' && typeof testVal !== 'bigint') {
      return {
        ok: false,
        normalized,
        error: 'Expression must return a real number y for each x.',
        evalAt: () => null,
      };
    }
  } catch (err) {
    return {
      ok: false,
      normalized,
      error: err instanceof Error ? err.message : 'Invalid mathematical expression.',
      evalAt: () => null,
    };
  }

  return {
    ok: true,
    normalized,
    evalAt: (x: number) => {
      try {
        const val = compiled.evaluate({ x, e: Math.E, pi: Math.PI });
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          return null;
        }
        return val;
      } catch {
        return null;
      }
    },
  };
}

export function sampleEquationCurve(
  evalAt: (x: number) => number | null,
  viewport: GraphViewport,
  samples = 360
): Array<Array<{ x: number; y: number }>> {
  const spanX = Math.max(1e-6, viewport.xMax - viewport.xMin);
  const spanY = Math.max(1e-6, viewport.yMax - viewport.yMin);
  const jumpThreshold = spanY * 4.5;

  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  let prevY: number | null = null;

  for (let i = 0; i <= samples; i += 1) {
    const x = viewport.xMin + (i / samples) * spanX;
    const y = evalAt(x);
    if (y === null || Math.abs(y) > 1e6) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      prevY = null;
      continue;
    }

    if (prevY !== null && Math.abs(y - prevY) > jumpThreshold) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    }

    current.push({ x, y });
    prevY = y;
  }

  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

export function computeNiceTickStep(span: number, targetTicks = 8): number {
  const safeSpan = Math.max(1e-4, Math.abs(span));
  const rawStep = safeSpan / Math.max(2, targetTicks);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / mag;
  if (residual <= 1.2) return 1 * mag;
  if (residual <= 2.4) return 2 * mag;
  if (residual <= 5.5) return 5 * mag;
  return 10 * mag;
}

export function formatAxisTick(value: number): string {
  if (Math.abs(value) < 1e-9) return '0';
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) {
    return value.toExponential(1);
  }
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function sanitizeViewport(vp: GraphViewport): GraphViewport {
  let xMin = Number.isFinite(vp.xMin) ? vp.xMin : -6;
  let xMax = Number.isFinite(vp.xMax) ? vp.xMax : 6;
  let yMin = Number.isFinite(vp.yMin) ? vp.yMin : -6;
  let yMax = Number.isFinite(vp.yMax) ? vp.yMax : 6;

  if (xMax <= xMin) xMax = xMin + 2;
  if (yMax <= yMin) yMax = yMin + 2;

  const minSpan = 0.2;
  const maxSpan = 2000;
  if (xMax - xMin < minSpan) {
    const mid = (xMin + xMax) / 2;
    xMin = mid - minSpan / 2;
    xMax = mid + minSpan / 2;
  } else if (xMax - xMin > maxSpan) {
    const mid = (xMin + xMax) / 2;
    xMin = mid - maxSpan / 2;
    xMax = mid + maxSpan / 2;
  }

  if (yMax - yMin < minSpan) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - minSpan / 2;
    yMax = mid + minSpan / 2;
  } else if (yMax - yMin > maxSpan) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - maxSpan / 2;
    yMax = mid + maxSpan / 2;
  }

  return {
    xMin: Number(xMin.toFixed(3)),
    xMax: Number(xMax.toFixed(3)),
    yMin: Number(yMin.toFixed(3)),
    yMax: Number(yMax.toFixed(3)),
  };
}

export function zoomViewport(
  vp: GraphViewport,
  factor: number,
  anchorX?: number,
  anchorY?: number
): GraphViewport {
  const cx = anchorX ?? (vp.xMin + vp.xMax) / 2;
  const cy = anchorY ?? (vp.yMin + vp.yMax) / 2;
  return sanitizeViewport({
    xMin: cx - (cx - vp.xMin) * factor,
    xMax: cx + (vp.xMax - cx) * factor,
    yMin: cy - (cy - vp.yMin) * factor,
    yMax: cy + (vp.yMax - cy) * factor,
  });
}

export function panViewport(
  vp: GraphViewport,
  dxWorld: number,
  dyWorld: number
): GraphViewport {
  return sanitizeViewport({
    xMin: vp.xMin + dxWorld,
    xMax: vp.xMax + dxWorld,
    yMin: vp.yMin + dyWorld,
    yMax: vp.yMax + dyWorld,
  });
}

export function extendNegativeXAxis(
  vp: GraphViewport,
  extraUnits?: number
): GraphViewport {
  const currentSpan = Math.max(4, vp.xMax - vp.xMin);
  const step = extraUnits && extraUnits > 0 ? extraUnits : Math.max(4, Math.round(currentSpan * 0.5));
  return sanitizeViewport({
    ...vp,
    xMin: vp.xMin >= 0 ? -Math.max(6, step) : vp.xMin - step,
  });
}

export function extractGraphActionsFromAIResponse(rawText: string): {
  cleanText: string;
  action: GraphAIAction | null;
} {
  const match = rawText.match(/<graph_action>([\s\S]*?)<\/graph_action>/i);
  if (!match) {
    return { cleanText: rawText.trim(), action: null };
  }
  const cleanText = rawText.replace(/<graph_action>[\s\S]*?<\/graph_action>/gi, '').trim();
  try {
    const parsed = JSON.parse(match[1].trim()) as GraphAIAction;
    return { cleanText, action: parsed };
  } catch {
    return { cleanText, action: null };
  }
}

export function inferGraphActionFromPrompt(
  prompt: string,
  _currentState: GraphState
): GraphAIAction | null {
  const text = prompt.trim();
  if (!text) return null;
  const low = text.toLowerCase();

  const action: GraphAIAction = {};
  let touched = false;

  if (/\breset\s+(the\s+)?(view|graph|axes|range)\b/.test(low)) {
    action.resetView = true;
    touched = true;
  }

  // Detect explicit equations: "y = ..." or "f(x) = ..."
  const eqMatches = Array.from(
    text.matchAll(/(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*([^,;\n?!]+?)(?=(?:\s+(?:and|on|with|to|in)\b|[.,;?!]|$))/gi)
  )
    .map((m) => `y = ${m[1].trim()}`)
    .filter((expr) => compileMathExpression(expr).ok);

  if (eqMatches.length > 0) {
    const wantsAdd =
      /\b(same\s+graph|also|add|together|both|alongside|compare)\b/.test(low) ||
      (/\bplot\b/.test(low) && !/\b(only|replace|clear|reset)\b/.test(low) && _currentState.equations.length > 0 && !/\bdraw\b/.test(low));
    action.mode = eqMatches.length > 1 && !wantsAdd ? 'replace' : wantsAdd ? 'add' : 'replace';
    action.equations = eqMatches;
    touched = true;
  } else if (/\b(show\s+both|both\s+equations|same\s+graph)\b/.test(low)) {
    // Keep existing equations visible and ensured on the plane
    action.mode = 'keep';
    touched = true;
  }

  // Detect explicit coordinate points like "(2, 4)" or "(-3, 5)"
  const ptMatches = Array.from(
    text.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)
  );
  if (ptMatches.length > 0) {
    action.addPoints = ptMatches.map((m, idx) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      label: `P${idx + 1}`,
    }));
    touched = true;
  }

  // Detect negative x-axis extension
  if (
    /\b(extend|expand|widen|show\s+more)\b[\s\S]*\bnegative\b[\s\S]*\bx[\s-]*axis\b/.test(low) ||
    /\bnegative\s+side\s+of\s+(?:the\s+)?x[\s-]*axis\b/.test(low)
  ) {
    action.extendNegativeX = true;
    touched = true;
  }

  // Detect explicit range like "x from -12 to 12"
  const xRange = low.match(/\bx\s+(?:from|between)\s+(-?\d+(?:\.\d+)?)\s+(?:to|and)\s+(-?\d+(?:\.\d+)?)/);
  if (xRange) {
    action.viewport = {
      ...(action.viewport || {}),
      xMin: Number(xRange[1]),
      xMax: Number(xRange[2]),
    };
    touched = true;
  }
  const yRange = low.match(/\by\s+(?:from|between)\s+(-?\d+(?:\.\d+)?)\s+(?:to|and)\s+(-?\d+(?:\.\d+)?)/);
  if (yRange) {
    action.viewport = {
      ...(action.viewport || {}),
      yMin: Number(yRange[1]),
      yMax: Number(yRange[2]),
    };
    touched = true;
  }

  if (/\bzoom\s+in\b/.test(low)) {
    action.zoomFactor = 0.7;
    touched = true;
  } else if (/\bzoom\s+out\b/.test(low)) {
    action.zoomFactor = 1.45;
    touched = true;
  }

  return touched ? action : null;
}

export function applyGraphActionToState(
  current: GraphState,
  action: GraphAIAction
): { nextState: GraphState; changeSummary: string | null } {
  let nextEquations = [...current.equations];
  let nextPoints = [...current.points];
  let nextViewport = { ...current.viewport };
  const changes: string[] = [];

  if (action.clearPoints) {
    nextPoints = [];
  }

  if (Array.isArray(action.equations) && action.equations.length > 0) {
    const validExprs = action.equations
      .map((raw) => {
        const trimmed = raw.trim();
        return /^y\s*=|^f\s*\(\s*x\s*\)\s*=/i.test(trimmed) ? trimmed : `y = ${trimmed}`;
      })
      .filter((expr) => compileMathExpression(expr).ok);

    if (validExprs.length > 0) {
      if (action.mode === 'replace') {
        nextEquations = validExprs.map((expr, idx) => ({
          id: `eq-${Date.now()}-${idx}`,
          expression: expr,
          color: GRAPH_PALETTE[idx % GRAPH_PALETTE.length],
          visible: true,
        }));
        changes.push(`Plotted ${validExprs.join(', ')}`);
      } else {
        for (const expr of validExprs) {
          const norm = normalizeMathExpression(expr);
          const alreadyIdx = nextEquations.findIndex(
            (e) => normalizeMathExpression(e.expression) === norm
          );
          if (alreadyIdx >= 0) {
            nextEquations[alreadyIdx] = { ...nextEquations[alreadyIdx], visible: true };
          } else {
            nextEquations.push({
              id: `eq-${Date.now()}-${nextEquations.length}`,
              expression: expr,
              color: GRAPH_PALETTE[nextEquations.length % GRAPH_PALETTE.length],
              visible: true,
            });
          }
        }
        changes.push(`Added ${validExprs.join(', ')} to graph`);
      }
    }
  } else if (action.mode === 'keep' && nextEquations.length > 0) {
    nextEquations = nextEquations.map((eq) => ({ ...eq, visible: true }));
    changes.push(`Showing all ${nextEquations.length} equation(s) together`);
  }

  if (Array.isArray(action.addPoints) && action.addPoints.length > 0) {
    for (const pt of action.addPoints) {
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        nextPoints.push({
          id: `pt-${Date.now()}-${nextPoints.length}`,
          x: pt.x,
          y: pt.y,
          label: pt.label || `(${pt.x}, ${pt.y})`,
          color: '#FBBF24',
        });
      }
    }
    changes.push(
      `Plotted point(s): ${action.addPoints.map((p) => `(${p.x}, ${p.y})`).join(', ')}`
    );
  }

  if (action.resetView) {
    nextViewport = { ...DEFAULT_GRAPH_VIEWPORT };
    changes.push('Reset view to [-6, 6]');
  }

  if (action.extendNegativeX) {
    nextViewport = extendNegativeXAxis(nextViewport, action.extendAmount);
    changes.push(`Extended negative x-axis to x = ${nextViewport.xMin}`);
  }

  if (action.viewport) {
    nextViewport = sanitizeViewport({
      xMin: action.viewport.xMin ?? nextViewport.xMin,
      xMax: action.viewport.xMax ?? nextViewport.xMax,
      yMin: action.viewport.yMin ?? nextViewport.yMin,
      yMax: action.viewport.yMax ?? nextViewport.yMax,
    });
    changes.push(
      `Adjusted range to X:[${nextViewport.xMin}, ${nextViewport.xMax}], Y:[${nextViewport.yMin}, ${nextViewport.yMax}]`
    );
  }

  if (action.zoomFactor && Number.isFinite(action.zoomFactor) && action.zoomFactor > 0) {
    nextViewport = zoomViewport(nextViewport, action.zoomFactor);
    changes.push(action.zoomFactor < 1 ? 'Zoomed in' : 'Zoomed out');
  }

  return {
    nextState: {
      equations: nextEquations,
      points: nextPoints,
      viewport: nextViewport,
    },
    changeSummary: changes.length > 0 ? changes.join(' · ') : null,
  };
}
