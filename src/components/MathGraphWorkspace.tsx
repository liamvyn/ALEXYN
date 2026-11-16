import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  LineChart,
  MapPin,
  MoveHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  compileMathExpression,
  computeNiceTickStep,
  DEFAULT_GRAPH_VIEWPORT,
  extendNegativeXAxis,
  formatAxisTick,
  GRAPH_PALETTE,
  panViewport,
  sampleEquationCurve,
  sanitizeViewport,
  zoomViewport,
  type GraphEquation,
  type GraphPoint,
  type GraphState,
  type GraphViewport,
} from '../utils/mathGraph';

interface MathGraphWorkspaceProps {
  graphState: GraphState;
  onChangeGraphState: (updater: GraphState | ((prev: GraphState) => GraphState)) => void;
  onAskTutorAboutGraph?: (prompt: string) => void;
}

const PRESET_EQUATIONS = [
  'y = x^2',
  'y = 2x + 3',
  'y = x^3 - 3x',
  'y = -x^2 + 4',
  'y = sin(x)',
  'y = 1/x',
];

export function MathGraphWorkspace({
  graphState,
  onChangeGraphState,
  onAskTutorAboutGraph,
}: MathGraphWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startViewport: GraphViewport;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startViewport: graphState.viewport,
  });

  const [newEqInput, setNewEqInput] = useState('');
  const [newPtX, setNewPtX] = useState('2');
  const [newPtY, setNewPtY] = useState('4');
  const [newPtLabel, setNewPtLabel] = useState('');
  const [pointError, setPointError] = useState<string | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  const [rangeInputs, setRangeInputs] = useState({
    xMin: String(graphState.viewport.xMin),
    xMax: String(graphState.viewport.xMax),
    yMin: String(graphState.viewport.yMin),
    yMax: String(graphState.viewport.yMax),
  });

  useEffect(() => {
    setRangeInputs({
      xMin: String(graphState.viewport.xMin),
      xMax: String(graphState.viewport.xMax),
      yMin: String(graphState.viewport.yMin),
      yMax: String(graphState.viewport.yMax),
    });
  }, [
    graphState.viewport.xMin,
    graphState.viewport.xMax,
    graphState.viewport.yMin,
    graphState.viewport.yMax,
  ]);

  const compiledEquations = useMemo(
    () =>
      graphState.equations.map((eq) => ({
        eq,
        compiled: compileMathExpression(eq.expression),
      })),
    [graphState.equations]
  );

  const newEqCheck = useMemo(() => {
    if (!newEqInput.trim()) return null;
    return compileMathExpression(newEqInput);
  }, [newEqInput]);

  // Render crisp interactive coordinate plane
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(260, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background gradient matching ALEXYN dark navy lab theme
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      10,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    bgGrad.addColorStop(0, '#0C1A42');
    bgGrad.addColorStop(1, '#040A1A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const vp = graphState.viewport;
    const spanX = Math.max(1e-6, vp.xMax - vp.xMin);
    const spanY = Math.max(1e-6, vp.yMax - vp.yMin);

    const toPxX = (x: number) => ((x - vp.xMin) / spanX) * width;
    const toPxY = (y: number) => height - ((y - vp.yMin) / spanY) * height;

    const majorStepX = computeNiceTickStep(spanX, Math.max(5, Math.floor(width / 70)));
    const majorStepY = computeNiceTickStep(spanY, Math.max(4, Math.floor(height / 58)));
    const minorStepX = majorStepX / 2;
    const minorStepY = majorStepY / 2;

    // Minor gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const startMinorX = Math.floor(vp.xMin / minorStepX) * minorStepX;
    for (let x = startMinorX; x <= vp.xMax + minorStepX * 0.1; x += minorStepX) {
      const px = toPxX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    const startMinorY = Math.floor(vp.yMin / minorStepY) * minorStepY;
    for (let y = startMinorY; y <= vp.yMax + minorStepY * 0.1; y += minorStepY) {
      const py = toPxY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // Major gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    const startMajorX = Math.floor(vp.xMin / majorStepX) * majorStepX;
    for (let x = startMajorX; x <= vp.xMax + majorStepX * 0.1; x += majorStepX) {
      const px = toPxX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    const startMajorY = Math.floor(vp.yMin / majorStepY) * majorStepY;
    for (let y = startMajorY; y <= vp.yMax + majorStepY * 0.1; y += majorStepY) {
      const py = toPxY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // Positive & Negative Axes
    const xAxisY = toPxY(0);
    const yAxisX = toPxX(0);
    const clampedXAxisY = Math.max(14, Math.min(height - 18, xAxisY));
    const clampedYAxisX = Math.max(24, Math.min(width - 14, yAxisX));

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.lineWidth = 1.8;
    if (xAxisY >= -2 && xAxisY <= height + 2) {
      ctx.beginPath();
      ctx.moveTo(0, xAxisY);
      ctx.lineTo(width, xAxisY);
      ctx.stroke();
    }
    if (yAxisX >= -2 && yAxisX <= width + 2) {
      ctx.beginPath();
      ctx.moveTo(yAxisX, 0);
      ctx.lineTo(yAxisX, height);
      ctx.stroke();
    }

    // Axis ticks & numeric labels (both positive & negative)
    ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = startMajorX; x <= vp.xMax + majorStepX * 0.1; x += majorStepX) {
      if (Math.abs(x) < majorStepX * 0.05) continue;
      const px = toPxX(x);
      if (px < 16 || px > width - 16) continue;
      const tickY = xAxisY >= 0 && xAxisY <= height ? clampedXAxisY : height - 16;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, tickY - 3);
      ctx.lineTo(px, tickY + 3);
      ctx.stroke();
      const labelY = tickY > height - 22 ? tickY - 14 : tickY + 5;
      ctx.fillText(formatAxisTick(x), px, labelY);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = startMajorY; y <= vp.yMax + majorStepY * 0.1; y += majorStepY) {
      if (Math.abs(y) < majorStepY * 0.05) continue;
      const py = toPxY(y);
      if (py < 12 || py > height - 12) continue;
      const tickX = yAxisX >= 0 && yAxisX <= width ? clampedYAxisX : 34;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tickX - 3, py);
      ctx.lineTo(tickX + 3, py);
      ctx.stroke();
      const labelX = tickX < 38 ? tickX + 26 : tickX - 6;
      ctx.textAlign = tickX < 38 ? 'left' : 'right';
      ctx.fillText(formatAxisTick(y), labelX, py);
    }

    // Origin label
    if (xAxisY >= 10 && xAxisY <= height - 14 && yAxisX >= 14 && yAxisX <= width - 10) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('0', yAxisX - 5, xAxisY + 4);
    }

    // Axis end labels (-X, +X, +Y, -Y)
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#7DD3FC';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('−x', 6, Math.max(14, clampedXAxisY - 5));
    ctx.textAlign = 'right';
    ctx.fillText('+x', width - 6, Math.max(14, clampedXAxisY - 5));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('+y', Math.min(width - 20, clampedYAxisX + 6), 6);
    ctx.textBaseline = 'bottom';
    ctx.fillText('−y', Math.min(width - 20, clampedYAxisX + 6), height - 6);

    // Plot all visible equations
    for (const { eq, compiled } of compiledEquations) {
      if (!eq.visible || !compiled.ok) continue;
      const segments = sampleEquationCurve(compiled.evalAt, vp, Math.max(360, width));
      ctx.strokeStyle = eq.color;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const seg of segments) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        seg.forEach((pt, idx) => {
          const px = toPxX(pt.x);
          const py = toPxY(pt.y);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    }

    // Plot coordinate points
    for (const pt of graphState.points) {
      const px = toPxX(pt.x);
      const py = toPxY(pt.y);
      if (px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = pt.color || '#FBBF24';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#040A1A';
      ctx.stroke();

      const tag = pt.label
        ? `${pt.label} (${pt.x}, ${pt.y})`
        : `(${pt.x}, ${pt.y})`;
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
      const tw = ctx.measureText(tag).width;
      const bx = Math.min(width - tw - 12, Math.max(4, px + 8));
      const by = Math.max(6, py - 20);
      ctx.fillStyle = 'rgba(4, 10, 26, 0.85)';
      ctx.fillRect(bx - 3, by - 2, tw + 6, 15);
      ctx.fillStyle = '#FDE68A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(tag, bx, by);
    }

    // Hover crosshair + live world coordinate readout
    if (hoverCoords) {
      const hx = toPxX(hoverCoords.x);
      const hy = toPxY(hoverCoords.y);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.moveTo(0, hy);
      ctx.lineTo(width, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [compiledEquations, graphState.points, graphState.viewport, hoverCoords]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => drawGraph());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawGraph]);

  const pixelToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const vp = graphState.viewport;
    const x = vp.xMin + (px / Math.max(1, rect.width)) * (vp.xMax - vp.xMin);
    const y = vp.yMax - (py / Math.max(1, rect.height)) * (vp.yMax - vp.yMin);
    return { x, y, width: rect.width, height: rect.height };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startViewport: graphState.viewport,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const world = pixelToWorld(e.clientX, e.clientY);
    if (world) {
      setHoverCoords({
        x: Number(world.x.toFixed(2)),
        y: Number(world.y.toFixed(2)),
      });
    }
    if (!panDragRef.current.active || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPx = e.clientX - panDragRef.current.startX;
    const dyPx = e.clientY - panDragRef.current.startY;
    const base = panDragRef.current.startViewport;
    const dxWorld = -(dxPx / Math.max(1, rect.width)) * (base.xMax - base.xMin);
    const dyWorld = (dyPx / Math.max(1, rect.height)) * (base.yMax - base.yMin);
    onChangeGraphState((prev) => ({
      ...prev,
      viewport: panViewport(base, dxWorld, dyWorld),
    }));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    panDragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const world = pixelToWorld(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    onChangeGraphState((prev) => ({
      ...prev,
      viewport: zoomViewport(prev.viewport, factor, world?.x, world?.y),
    }));
  };

  const addEquation = (exprText?: string) => {
    const raw = (exprText ?? newEqInput).trim();
    if (!raw) return;
    const normalizedDisplay = /^y\s*=|^f\s*\(\s*x\s*\)\s*=/i.test(raw)
      ? raw
      : `y = ${raw}`;
    const eq: GraphEquation = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      expression: normalizedDisplay,
      color: GRAPH_PALETTE[graphState.equations.length % GRAPH_PALETTE.length],
      visible: true,
    };
    onChangeGraphState((prev) => ({
      ...prev,
      equations: [...prev.equations, eq],
    }));
    if (!exprText) setNewEqInput('');
  };

  const updateEquationExpression = (id: string, expression: string) => {
    onChangeGraphState((prev) => ({
      ...prev,
      equations: prev.equations.map((e) => (e.id === id ? { ...e, expression } : e)),
    }));
  };

  const toggleEquationVisible = (id: string) => {
    onChangeGraphState((prev) => ({
      ...prev,
      equations: prev.equations.map((e) =>
        e.id === id ? { ...e, visible: !e.visible } : e
      ),
    }));
  };

  const removeEquation = (id: string) => {
    onChangeGraphState((prev) => ({
      ...prev,
      equations: prev.equations.filter((e) => e.id !== id),
    }));
  };

  const handleAddPoint = () => {
    const x = Number(newPtX);
    const y = Number(newPtY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setPointError('Enter valid numbers for both x and y coordinates.');
      return;
    }
    setPointError(null);
    const pt: GraphPoint = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x,
      y,
      label: newPtLabel.trim() || undefined,
      color: '#FBBF24',
    };
    onChangeGraphState((prev) => ({
      ...prev,
      points: [...prev.points, pt],
    }));
    setNewPtLabel('');
  };

  const applyRangeInputs = () => {
    const xMin = Number(rangeInputs.xMin);
    const xMax = Number(rangeInputs.xMax);
    const yMin = Number(rangeInputs.yMin);
    const yMax = Number(rangeInputs.yMax);
    if (
      !Number.isFinite(xMin) ||
      !Number.isFinite(xMax) ||
      !Number.isFinite(yMin) ||
      !Number.isFinite(yMax)
    ) {
      return;
    }
    onChangeGraphState((prev) => ({
      ...prev,
      viewport: sanitizeViewport({ xMin, xMax, yMin, yMax }),
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* INTERACTIVE GRAPHING CANVAS */}
      <div className="space-y-3 lg:col-span-7">
        <div className="overflow-hidden rounded-3xl border border-[var(--alexyn-border)] bg-[#050C21]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--alexyn-border)] bg-[#08122E] px-3.5 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#7DD3FC]">
              <LineChart className="h-4 w-4 text-[#5EEAD4]" />
              <span>Interactive Coordinate Plane</span>
              {hoverCoords && (
                <span className="rounded-md bg-[#060E24] px-2 py-0.5 font-mono text-[11px] text-slate-200">
                  x: {hoverCoords.x}, y: {hoverCoords.y}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChangeGraphState((prev) => ({
                    ...prev,
                    viewport: zoomViewport(prev.viewport, 0.72),
                  }))
                }
                aria-label="Zoom in graph"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--alexyn-border)] bg-[#0E1E46] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-[#38BDF8] hover:text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span>Zoom +</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeGraphState((prev) => ({
                    ...prev,
                    viewport: zoomViewport(prev.viewport, 1.38),
                  }))
                }
                aria-label="Zoom out graph"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--alexyn-border)] bg-[#0E1E46] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-[#38BDF8] hover:text-white"
              >
                <ZoomOut className="h-3.5 w-3.5" />
                <span>Zoom −</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeGraphState((prev) => ({
                    ...prev,
                    viewport: extendNegativeXAxis(prev.viewport),
                  }))
                }
                aria-label="Extend negative x-axis"
                className="inline-flex items-center gap-1 rounded-lg border border-[#2E8BFF]/40 bg-[#122658] px-2.5 py-1 text-[11px] font-semibold text-[#7DD3FC] hover:bg-[#193372]"
              >
                <MoveHorizontal className="h-3.5 w-3.5" />
                <span>Extend −X</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeGraphState((prev) => ({
                    ...prev,
                    viewport: { ...DEFAULT_GRAPH_VIEWPORT },
                  }))
                }
                aria-label="Reset graph view"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            data-testid="math-graph-canvas"
            data-equations={graphState.equations.filter((e) => e.visible).length}
            data-points={graphState.points.length}
            data-xmin={graphState.viewport.xMin}
            data-xmax={graphState.viewport.xMax}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              panDragRef.current.active = false;
              setHoverCoords(null);
            }}
            onWheel={handleWheel}
            className="h-[320px] w-full cursor-grab touch-none active:cursor-grabbing sm:h-[400px]"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--alexyn-border)] bg-[#071026] px-3.5 py-2 text-[11px] text-slate-400">
            <span>Drag canvas to pan · Scroll wheel to zoom</span>
            <span className="font-mono text-[#7DD3FC]">
              X: [{graphState.viewport.xMin}, {graphState.viewport.xMax}] · Y: [
              {graphState.viewport.yMin}, {graphState.viewport.yMax}]
            </span>
          </div>
        </div>
      </div>

      {/* EQUATIONS, POINTS & AXIS RANGE PANEL */}
      <aside className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5 lg:col-span-5">
        <div>
          <p className="text-xs font-medium text-[#7DD3FC]">
            Mathematics · <span className="font-mono">Multi-Function Grapher</span>
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-white">Interactive Function Plotter</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Plot multiple linear, quadratic, cubic, trig, or rational equations together, plot coordinates (x, y), and adjust axes live.
          </p>
        </div>

        {/* EQUATIONS LIST */}
        <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Equations ({graphState.equations.length})
            </span>
            {onAskTutorAboutGraph && graphState.equations.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onAskTutorAboutGraph(
                    `Explain how the equation(s) ${graphState.equations
                      .filter((e) => e.visible)
                      .map((e) => e.expression)
                      .join(' and ')} behave on the graph, including intercepts and what happens when coefficients change.`
                  )
                }
                className="text-[11px] font-semibold text-[#5EEAD4] hover:underline"
              >
                Explain Graph with AI →
              </button>
            )}
          </div>

          <div className="space-y-2">
            {graphState.equations.map((eq, idx) => {
              const compiled = compiledEquations[idx]?.compiled;
              return (
                <div
                  key={eq.id}
                  className="rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] p-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: eq.color }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={eq.expression}
                      onChange={(e) => updateEquationExpression(eq.id, e.target.value)}
                      aria-label={`Equation ${idx + 1}`}
                      placeholder="y = x^2"
                      className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleEquationVisible(eq.id)}
                      aria-label={eq.visible ? `Hide ${eq.expression}` : `Show ${eq.expression}`}
                      className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      {eq.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEquation(eq.id)}
                      aria-label={`Remove ${eq.expression}`}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {compiled && !compiled.ok && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-rose-300">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{compiled.error}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ADD NEW EQUATION */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newEqInput}
              onChange={(e) => setNewEqInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addEquation();
                }
              }}
              aria-label="Add equation expression"
              placeholder="Add equation (e.g. y = 2x + 3, y = x^3 - 3x)"
              className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addEquation()}
              disabled={!newEqInput.trim() || Boolean(newEqCheck && !newEqCheck.ok)}
              aria-label="Plot equation"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl bg-[#2E8BFF] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-45"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Plot</span>
            </button>
          </div>
          {newEqCheck && !newEqCheck.ok && (
            <p className="text-[11px] text-amber-300">{newEqCheck.error}</p>
          )}

          {/* QUICK PRESET EQUATIONS */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_EQUATIONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addEquation(preset)}
                className="rounded-lg border border-[var(--alexyn-border)] bg-[#08122E] px-2 py-1 font-mono text-[10px] text-[#7DD3FC] hover:border-[#38BDF8] hover:text-white"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* COORDINATE POINTS */}
        <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-[#FBBF24]" />
            <span>Coordinate Points ({graphState.points.length})</span>
          </span>

          <div className="grid grid-cols-12 gap-1.5">
            <input
              type="number"
              step="any"
              value={newPtX}
              onChange={(e) => setNewPtX(e.target.value)}
              aria-label="Point X coordinate"
              placeholder="x"
              className="col-span-3 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 font-mono text-xs text-white"
            />
            <input
              type="number"
              step="any"
              value={newPtY}
              onChange={(e) => setNewPtY(e.target.value)}
              aria-label="Point Y coordinate"
              placeholder="y"
              className="col-span-3 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 font-mono text-xs text-white"
            />
            <input
              type="text"
              value={newPtLabel}
              onChange={(e) => setNewPtLabel(e.target.value)}
              aria-label="Point label optional"
              placeholder="Label (opt)"
              className="col-span-4 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleAddPoint}
              aria-label="Add coordinate point"
              className="col-span-2 flex items-center justify-center rounded-xl bg-[#13295E] text-xs font-bold text-[#FDE68A] hover:bg-[#1B3A82]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {pointError && <p className="text-[11px] text-rose-300">{pointError}</p>}

          {graphState.points.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {graphState.points.map((pt) => (
                <span
                  key={pt.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-[#060E24] px-2.5 py-1 font-mono text-[11px] text-amber-200"
                >
                  <span>
                    {pt.label ? `${pt.label}: ` : ''}({pt.x}, {pt.y})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeGraphState((prev) => ({
                        ...prev,
                        points: prev.points.filter((item) => item.id !== pt.id),
                      }))
                    }
                    aria-label={`Remove point (${pt.x}, ${pt.y})`}
                    className="text-slate-400 hover:text-rose-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AXIS BOUNDS */}
        <div className="space-y-2 border-t border-[var(--alexyn-border)] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Axis Range (Negative & Positive)
            </span>
            <button
              type="button"
              onClick={applyRangeInputs}
              className="rounded-lg bg-[#142A5E] px-2.5 py-1 text-[11px] font-semibold text-[#7DD3FC] hover:bg-[#1D3C82]"
            >
              Apply Range
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[10px] text-slate-400">
            <div>
              <label htmlFor="graphXMin" className="block">xMin</label>
              <input
                id="graphXMin"
                type="number"
                step="any"
                value={rangeInputs.xMin}
                onChange={(e) => setRangeInputs((r) => ({ ...r, xMin: e.target.value }))}
                onBlur={applyRangeInputs}
                className="mt-0.5 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2 py-1 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="graphXMax" className="block">xMax</label>
              <input
                id="graphXMax"
                type="number"
                step="any"
                value={rangeInputs.xMax}
                onChange={(e) => setRangeInputs((r) => ({ ...r, xMax: e.target.value }))}
                onBlur={applyRangeInputs}
                className="mt-0.5 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2 py-1 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="graphYMin" className="block">yMin</label>
              <input
                id="graphYMin"
                type="number"
                step="any"
                value={rangeInputs.yMin}
                onChange={(e) => setRangeInputs((r) => ({ ...r, yMin: e.target.value }))}
                onBlur={applyRangeInputs}
                className="mt-0.5 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2 py-1 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="graphYMax" className="block">yMax</label>
              <input
                id="graphYMax"
                type="number"
                step="any"
                value={rangeInputs.yMax}
                onChange={(e) => setRangeInputs((r) => ({ ...r, yMax: e.target.value }))}
                onBlur={applyRangeInputs}
                className="mt-0.5 w-full rounded-lg border border-[var(--alexyn-border)] bg-[#060E24] px-2 py-1 font-mono text-xs text-white"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
