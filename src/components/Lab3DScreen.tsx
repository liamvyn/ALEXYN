import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Atom,
  BookOpen,
  Compass,
  Dna,
  Droplets,
  Leaf,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Shapes,
  Sparkles,
} from 'lucide-react';
import { detectDifferentSubjectWarning } from '../utils/alexynLogic';
import type { EducationProfile, SubjectItem } from '../types/alexyn';

interface Lab3DScreenProps {
  profile: EducationProfile;
  onMakeLabNotes: (topic: string, subject: string) => void;
  scopedSubject?: SubjectItem;
  onBackFromScoped?: () => void;
  onSwitchToSubject?: (subjectName: string) => void;
}

type LabModelId =
  | 'atom'
  | 'solar'
  | 'dna'
  | 'geometry'
  | 'water'
  | 'wave'
  | 'cell'
  | 'custom';

interface LabModelMeta {
  id: LabModelId;
  label: string;
  subject: string;
  formula: string;
  description: string;
  quickPrompts: string[];
  icon: typeof Atom;
}

const LAB_MODELS: LabModelMeta[] = [
  {
    id: 'atom',
    label: 'Bohr Atom',
    subject: 'Chemistry',
    formula: '2n² shell capacity',
    description:
      'Drag to orbit 3D electron shells. Adjust atomic number to watch inner (2) and valence shells fill.',
    quickPrompts: [
      'Can you teach me how electron shells fill?',
      'Why do valence electrons decide bonding?',
    ],
    icon: Atom,
  },
  {
    id: 'water',
    label: 'H₂O Molecule',
    subject: 'Chemistry',
    formula: '104.5° Bent Polar',
    description:
      'Polar covalent oxygen-hydrogen bonds forming the 104.5° tetrahedral bend that enables hydrogen bonding.',
    quickPrompts: [
      'Why is water bent at 104.5 degrees?',
      'Why does ice float on liquid water?',
    ],
    icon: Droplets,
  },
  {
    id: 'dna',
    label: 'DNA Helix',
    subject: 'Biology',
    formula: 'A–T · C–G base pairs',
    description:
      'Double-stranded antiparallel sugar-phosphate backbone joined by complementary hydrogen-bonded bases.',
    quickPrompts: [
      'Can you teach me DNA base pairing with a trick?',
      'How does DNA replicate before cell division?',
    ],
    icon: Dna,
  },
  {
    id: 'cell',
    label: 'Plant Cell 3D',
    subject: 'Biology',
    formula: '6CO₂ + 6H₂O → C₆H₁₂O₆',
    description:
      'Inspect the cell wall, central vacuole, nucleus, and rotating green chloroplasts inside a living plant cell.',
    quickPrompts: [
      'Explain what chloroplasts and mitochondria do!',
      'Compare plant cells vs animal cells simply.',
    ],
    icon: Leaf,
  },
  {
    id: 'solar',
    label: 'Planetary Orbits',
    subject: 'Physics',
    formula: 'T² ∝ r³ (Kepler III)',
    description:
      'Inner planets sweep faster orbital arcs near the Sun while outer planets travel wider gravitational paths.',
    quickPrompts: [
      'Can you teach me Kepler’s laws simply?',
      'Why don’t planets fall into the Sun?',
    ],
    icon: Compass,
  },
  {
    id: 'wave',
    label: '3D Wave Lattice',
    subject: 'Physics',
    formula: 'v = f · λ',
    description:
      'Watch transverse electric & magnetic wave oscillations propagate through 3D space at adjustable speed.',
    quickPrompts: [
      'Explain frequency vs wavelength simply',
      'What is the difference between transverse and longitudinal waves?',
    ],
    icon: Radio,
  },
  {
    id: 'geometry',
    label: '3D Octahedron',
    subject: 'Mathematics',
    formula: 'V − E + F = 2 (Euler)',
    description:
      'Explore 6 vertices, 12 edges, and 8 equilateral triangular faces rotating in 3D space.',
    quickPrompts: [
      'Can you teach me Euler’s formula V - E + F = 2?',
      'What makes a solid Platonic?',
    ],
    icon: Shapes,
  },
  {
    id: 'custom',
    label: 'Custom 3D',
    subject: 'Any Unlimited Topic',
    formula: 'Procedural 3D Engine',
    description:
      'Type ANY concept—Mitochondria, Benzene Ring, Pendulum, Black Hole, Volcano—to render a custom 3D visualization & ask unlimited AI questions.',
    quickPrompts: [
      'Teach me this custom 3D topic step by step',
      'Give me an exam question on this concept',
    ],
    icon: Sparkles,
  },
];

function project3D(
  x: number,
  y: number,
  z: number,
  rotX: number,
  rotY: number,
  zoom: number,
  cx: number,
  cy: number
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x * cosY - z * sinY;
  const z1 = z * cosY + x * sinY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y * cosX - z1 * sinX;
  const z2 = z1 * cosX + y * sinX;

  const scale = (360 * zoom) / (360 + z2);
  return {
    sx: cx + x1 * scale,
    sy: cy + y2 * scale,
    scale,
    depth: z2,
  };
}

interface LabChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function Lab3DScreen({
  profile,
  onMakeLabNotes,
  scopedSubject,
  onBackFromScoped,
  onSwitchToSubject,
}: Lab3DScreenProps) {
  const defaultModel: LabModelId = (() => {
    if (!scopedSubject) return 'atom';
    const match = LAB_MODELS.find(
      (m) => m.subject.toLowerCase() === scopedSubject.name.toLowerCase()
    );
    return match ? match.id : 'custom';
  })();

  const [activeModel, setActiveModel] = useState<LabModelId>(defaultModel);
  const [customConcept, setCustomConcept] = useState(
    scopedSubject ? `${scopedSubject.name} Structure` : 'Mitochondria Powerhouse'
  );
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [electronCount, setElectronCount] = useState(6);

  const [labQuestion, setLabQuestion] = useState('');
  const [labMessages, setLabMessages] = useState<LabChatMessage[]>([]);
  const [askingLab, setAskingLab] = useState(false);
  const [subjectWarning, setSubjectWarning] = useState<{
    recommendedSubject: string;
    message: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tutorMessagesEndRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: 0.38, y: 0.45 });
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const timeRef = useRef(0);

  const availableModels = scopedSubject
    ? LAB_MODELS.filter(
        (m) =>
          m.subject.toLowerCase() === scopedSubject.name.toLowerCase() ||
          m.id === 'custom'
      )
    : LAB_MODELS;

  const currentMeta =
    LAB_MODELS.find((m) => m.id === activeModel) || availableModels[0] || LAB_MODELS[0];

  const activeSubjectLabel =
    scopedSubject?.name ||
    (currentMeta.id === 'custom' ? 'Unlimited 3D Science' : currentMeta.subject);

  useEffect(() => {
    tutorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [labMessages.length, askingLab]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if (playing) {
        timeRef.current += dt * speed;
        if (!dragRef.current.active) {
          rotRef.current.y += dt * 0.25 * speed;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width));
      const height = Math.max(240, Math.floor(rect.height));

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        12,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.6
      );
      grad.addColorStop(0, '#0E1F4F');
      grad.addColorStop(1, '#040A1A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const t = timeRef.current;
      const rx = rotRef.current.x;
      const ry = rotRef.current.y;

      if (activeModel === 'atom') {
        const nuc = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
        const nucGlow = ctx.createRadialGradient(nuc.sx, nuc.sy, 2, nuc.sx, nuc.sy, 24 * zoom);
        nucGlow.addColorStop(0, '#7DD3FC');
        nucGlow.addColorStop(1, 'rgba(46, 139, 255, 0)');
        ctx.fillStyle = nucGlow;
        ctx.beginPath();
        ctx.arc(nuc.sx, nuc.sy, 24 * zoom, 0, Math.PI * 2);
        ctx.fill();

        const shells = [
          { r: 58, max: 2, tiltX: 0.4, tiltZ: 0.2, color: '#38BDF8' },
          { r: 96, max: 8, tiltX: -0.5, tiltZ: 0.6, color: '#818CF8' },
          { r: 132, max: 8, tiltX: 0.8, tiltZ: -0.4, color: '#5EEAD4' },
        ];

        let remaining = electronCount;
        shells.forEach((shell, sIdx) => {
          const count = Math.min(remaining, shell.max);
          remaining -= count;

          ctx.beginPath();
          for (let a = 0; a <= 48; a++) {
            const ang = (a / 48) * Math.PI * 2;
            const px = shell.r * Math.cos(ang);
            const py = shell.r * Math.sin(ang) * Math.sin(shell.tiltX);
            const pz = shell.r * Math.sin(ang) * Math.cos(shell.tiltZ);
            const p = project3D(px, py, pz, rx, ry, zoom, cx, cy);
            if (a === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          for (let e = 0; e < count; e++) {
            const ang = (e / Math.max(1, count)) * Math.PI * 2 + t * (1.2 - sIdx * 0.22);
            const px = shell.r * Math.cos(ang);
            const py = shell.r * Math.sin(ang) * Math.sin(shell.tiltX);
            const pz = shell.r * Math.sin(ang) * Math.cos(shell.tiltZ);
            const p = project3D(px, py, pz, rx, ry, zoom, cx, cy);
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 5.5 * p.scale, 0, Math.PI * 2);
            ctx.fillStyle = shell.color;
            ctx.fill();
          }
        });
      } else if (activeModel === 'water') {
        const angleRad = (104.5 * Math.PI) / 180;
        const bond = 84;
        const oPos = project3D(0, -14, 0, rx, ry, zoom, cx, cy);
        const h1Pos = project3D(
          -bond * Math.sin(angleRad / 2),
          bond * Math.cos(angleRad / 2) - 14,
          18,
          rx,
          ry,
          zoom,
          cx,
          cy
        );
        const h2Pos = project3D(
          bond * Math.sin(angleRad / 2),
          bond * Math.cos(angleRad / 2) - 14,
          -18,
          rx,
          ry,
          zoom,
          cx,
          cy
        );

        [h1Pos, h2Pos].forEach((hp) => {
          ctx.beginPath();
          ctx.moveTo(oPos.sx, oPos.sy);
          ctx.lineTo(hp.sx, hp.sy);
          ctx.strokeStyle = '#7DD3FC';
          ctx.lineWidth = 5;
          ctx.stroke();
        });

        ctx.beginPath();
        ctx.arc(oPos.sx, oPos.sy, 22 * oPos.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();

        [h1Pos, h2Pos].forEach((hp) => {
          ctx.beginPath();
          ctx.arc(hp.sx, hp.sy, 14 * hp.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
        });
      } else if (activeModel === 'cell') {
        // Plant cell 3D bounding box + vacuole + rotating chloroplasts
        const s = 92;
        const corners = [
          [-s, -60, -s * 0.7], [s, -60, -s * 0.7], [s, 60, -s * 0.7], [-s, 60, -s * 0.7],
          [-s, -60, s * 0.7], [s, -60, s * 0.7], [s, 60, s * 0.7], [-s, 60, s * 0.7],
        ].map(([x, y, z]) => project3D(x, y, z, rx, ry, zoom, cx, cy));
        const edges = [
          [0,1],[1,2],[2,3],[3,0],
          [4,5],[5,6],[6,7],[7,4],
          [0,4],[1,5],[2,6],[3,7],
        ];
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        edges.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(corners[a].sx, corners[a].sy);
          ctx.lineTo(corners[b].sx, corners[b].sy);
          ctx.stroke();
        });
        const nuc = project3D(-34, -8, 12, rx, ry, zoom, cx, cy);
        ctx.beginPath();
        ctx.arc(nuc.sx, nuc.sy, 18 * nuc.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#818CF8';
        ctx.fill();
        for (let c = 0; c < 6; c++) {
          const ang = (c / 6) * Math.PI * 2 + t * 0.6;
          const cp = project3D(Math.cos(ang) * 58, Math.sin(ang * 2) * 28, Math.sin(ang) * 42, rx, ry, zoom, cx, cy);
          ctx.beginPath();
          ctx.arc(cp.sx, cp.sy, 9 * cp.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#22C55E';
          ctx.fill();
        }
      } else if (activeModel === 'wave') {
        ctx.beginPath();
        for (let i = -16; i <= 16; i++) {
          const x = i * 9;
          const y = Math.sin(i * 0.42 - t * 3) * 48;
          const z = Math.cos(i * 0.42 - t * 3) * 18;
          const p = project3D(x, y, z, rx, ry, zoom, cx, cy);
          if (i === -16) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (activeModel === 'solar') {
        const sun = project3D(0, 0, 0, rx, ry, zoom, cx, cy);
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(sun.sx, sun.sy, 18 * sun.scale, 0, Math.PI * 2);
        ctx.fill();

        const planets = [
          { r: 50, size: 5.5, speed: 1.5, color: '#38BDF8' },
          { r: 80, size: 7.5, speed: 1.0, color: '#5EEAD4' },
          { r: 112, size: 6.5, speed: 0.72, color: '#F87171' },
          { r: 144, size: 10, speed: 0.46, color: '#A78BFA' },
        ];

        planets.forEach((pl) => {
          ctx.beginPath();
          for (let a = 0; a <= 48; a++) {
            const ang = (a / 48) * Math.PI * 2;
            const op = project3D(pl.r * Math.cos(ang), 0, pl.r * Math.sin(ang), rx, ry, zoom, cx, cy);
            if (a === 0) ctx.moveTo(op.sx, op.sy);
            else ctx.lineTo(op.sx, op.sy);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.stroke();

          const ang = t * pl.speed;
          const p = project3D(pl.r * Math.cos(ang), 0, pl.r * Math.sin(ang), rx, ry, zoom, cx, cy);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, pl.size * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = pl.color;
          ctx.fill();
        });
      } else if (activeModel === 'dna') {
        const steps = 16;
        for (let i = 0; i < steps; i++) {
          const y = (i - steps / 2) * 14;
          const phase = i * 0.48 + t * 1.4;
          const radius = 56;
          const pA = project3D(radius * Math.cos(phase), y, radius * Math.sin(phase), rx, ry, zoom, cx, cy);
          const pB = project3D(radius * Math.cos(phase + Math.PI), y, radius * Math.sin(phase + Math.PI), rx, ry, zoom, cx, cy);

          ctx.beginPath();
          ctx.moveTo(pA.sx, pA.sy);
          ctx.lineTo(pB.sx, pB.sy);
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(94, 234, 212, 0.45)' : 'rgba(129, 140, 248, 0.45)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pA.sx, pA.sy, 5 * pA.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pB.sx, pB.sy, 5 * pB.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#A855F7';
          ctx.fill();
        }
      } else if (activeModel === 'custom') {
        // Procedural unlimited 3D harmonic torus-knot / lattice seeded by customConcept
        const seed = customConcept.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const lobes = 2 + (seed % 4);
        const pts: Array<{ sx: number; sy: number; scale: number }> = [];
        for (let i = 0; i <= 72; i++) {
          const u = (i / 72) * Math.PI * 2;
          const rad = 70 + 28 * Math.cos(lobes * u + t);
          const x = rad * Math.cos(u);
          const y = 44 * Math.sin(lobes * u + t);
          const z = rad * Math.sin(u);
          pts.push(project3D(x, y, z, rx, ry, zoom, cx, cy));
        }
        ctx.beginPath();
        pts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        });
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        pts.filter((_, idx) => idx % 6 === 0).forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 4.5 * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();
        });
      } else {
        const s = 88;
        const vertices = [
          [0, -s, 0], [s, 0, 0], [0, 0, s], [-s, 0, 0], [0, 0, -s], [0, s, 0],
        ];
        const edges = [
          [0, 1], [0, 2], [0, 3], [0, 4],
          [5, 1], [5, 2], [5, 3], [5, 4],
          [1, 2], [2, 3], [3, 4], [4, 1],
        ];
        const projected = vertices.map(([vx, vy, vz]) => project3D(vx, vy, vz, rx, ry, zoom, cx, cy));
        edges.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(projected[a].sx, projected[a].sy);
          ctx.lineTo(projected[b].sx, projected[b].sy);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        });
        projected.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 5.5 * p.scale, 0, Math.PI * 2);
          ctx.fillStyle = '#BAE6FD';
          ctx.fill();
        });
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [activeModel, customConcept, playing, speed, zoom, electronCount]);

  const askInlineLabTutor = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || askingLab) return;

    if (scopedSubject) {
      const warning = detectDifferentSubjectWarning(q, scopedSubject.name);
      if (warning) {
        setSubjectWarning(warning);
        return;
      }
    }
    setSubjectWarning(null);

    const modelTitle = activeModel === 'custom' ? customConcept : currentMeta.label;
    const userItem: LabChatMessage = {
      id: `lab-u-${Date.now()}`,
      role: 'user',
      text: q,
    };
    setLabMessages((prev) => [...prev, userItem]);
    setLabQuestion('');
    setAskingLab(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(16000),
        body: JSON.stringify({
          message: `We are currently exploring the 3D Lab model "${modelTitle}" (${activeSubjectLabel}, formula: ${currentMeta.formula}). Learner asks: ${q}`,
          history: labMessages.slice(-4).map((m) => ({ role: m.role, text: m.text })),
          subjectFocus: activeSubjectLabel,
          strictScope: Boolean(scopedSubject),
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach 3D Lab AI tutor.');
      }
      setLabMessages((prev) => [
        ...prev,
        { id: `lab-a-${Date.now()}`, role: 'assistant', text: data.reply },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI right now.';
      setLabMessages((prev) => [
        ...prev,
        {
          id: `lab-e-${Date.now()}`,
          role: 'assistant',
          text: `${msg} Tip: ${currentMeta.description}`,
        },
      ]);
    } finally {
      setAskingLab(false);
    }
  };

  const handleLabSubmit = (e: FormEvent) => {
    e.preventDefault();
    askInlineLabTutor(labQuestion);
  };

  const displayModelTitle = activeModel === 'custom' ? customConcept : currentMeta.label;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-24 pt-5 md:px-8">
      {scopedSubject && onBackFromScoped && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--alexyn-border)] bg-[#08122E] px-4 py-2.5">
          <button
            type="button"
            onClick={onBackFromScoped}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#0E1B3E] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-[#2E8BFF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {scopedSubject.name}</span>
          </button>
          <span className="text-xs font-semibold text-[#7DD3FC]">
            {scopedSubject.name} 3D Lab · No Bottom Nav
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[#7DD3FC]">
          {scopedSubject ? `${scopedSubject.name} Interactive 3D Space` : 'Unlimited Interactive 3D Science Space'}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
          3D Lab · Explore {scopedSubject ? scopedSubject.name : 'Anything Unlimited'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Drag directly on the 3D stage, load unlimited custom concepts, and ask the embedded AI tutor to teach you.
        </p>
      </div>

      {/* MODEL SWITCHER CARDS */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {availableModels.map((model) => {
          const Icon = model.icon;
          const active = model.id === activeModel;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                setActiveModel(model.id);
                setLabMessages([]);
                setSubjectWarning(null);
              }}
              className={`flex min-h-[48px] items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                active
                  ? 'border-[#38BDF8] bg-[#13295E] text-white shadow-[0_6px_20px_rgba(46,139,255,0.2)]'
                  : 'border-[var(--alexyn-border)] bg-[#0A1532] text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#38BDF8]" />
              <div className="min-w-0">
                <p className="truncate font-bold">{model.label}</p>
                <p className="truncate text-[10px] text-slate-400">
                  {scopedSubject && model.id === 'custom' ? scopedSubject.name : model.subject}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {activeModel === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#38BDF8]/40 bg-[#0A1532] p-3.5">
          <Plus className="h-4 w-4 text-[#5EEAD4]" />
          <input
            type="text"
            value={customConcept}
            onChange={(e) => setCustomConcept(e.target.value)}
            placeholder="Type ANY 3D concept (e.g. Mitochondria, Benzene Ring, Pendulum)..."
            aria-label="Custom unlimited 3D concept"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() =>
              askInlineLabTutor(`Can you teach me "${customConcept}" using this 3D visualization?`)
            }
            className="rounded-xl bg-[#16306E] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#1E4090]"
          >
            Teach Custom Model
          </button>
        </div>
      )}

      {/* 3D STAGE + CONTROLS CARD */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-[var(--alexyn-border)] bg-[#050C21]">
            <canvas
              ref={canvasRef}
              data-testid="lab-3d-canvas"
              onPointerDown={(e) => {
                dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.lastX;
                const dy = e.clientY - dragRef.current.lastY;
                dragRef.current.lastX = e.clientX;
                dragRef.current.lastY = e.clientY;
                rotRef.current.y += dx * 0.01;
                rotRef.current.x = Math.max(-1.4, Math.min(1.4, rotRef.current.x + dy * 0.01));
              }}
              onPointerUp={() => {
                dragRef.current.active = false;
              }}
              onPointerLeave={() => {
                dragRef.current.active = false;
              }}
              className="h-[280px] w-full cursor-grab touch-none active:cursor-grabbing sm:h-[360px]"
            />
          </div>
        </div>

        <aside className="space-y-4 rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5 lg:col-span-5">
          <div>
            <p className="text-xs font-medium text-[#7DD3FC]">
              {activeSubjectLabel} · <span className="font-mono">{currentMeta.formula}</span>
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-white">{displayModelTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {currentMeta.description}
            </p>
          </div>

          <div className="space-y-3 border-t border-[var(--alexyn-border)] pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#142A5E] px-3 py-2 text-xs font-semibold text-white"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  rotRef.current = { x: 0.38, y: 0.45 };
                  setZoom(1);
                  setSpeed(1);
                }}
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#07112B] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset View</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300">
                <label htmlFor="labZoom">Zoom Scale</label>
                <span className="font-mono tabular-nums">{zoom.toFixed(1)}x</span>
              </div>
              <input
                id="labZoom"
                type="range"
                min="0.4"
                max="2.4"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full accent-[#2E8BFF]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300">
                <label htmlFor="labSpeed">Orbit Speed</label>
                <span className="font-mono tabular-nums">{speed.toFixed(1)}x</span>
              </div>
              <input
                id="labSpeed"
                type="range"
                min="0.1"
                max="4"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="mt-1 w-full accent-[#2E8BFF]"
              />
            </div>

            {activeModel === 'atom' && (
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <label htmlFor="labElectrons">Electrons (Atomic Number)</label>
                  <span className="font-mono tabular-nums">{electronCount} e⁻</span>
                </div>
                <input
                  id="labElectrons"
                  type="range"
                  min="1"
                  max="18"
                  step="1"
                  value={electronCount}
                  onChange={(e) => setElectronCount(Number(e.target.value))}
                  className="mt-1 w-full accent-[#5EEAD4]"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onMakeLabNotes(displayModelTitle, activeSubjectLabel)}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2.5 text-xs font-bold text-white"
          >
            <BookOpen className="h-4 w-4" />
            <span>Make Smart Notes on {displayModelTitle}</span>
          </button>
        </aside>
      </div>

      {/* EMBEDDED UNLIMITED AI TUTOR RIGHT INSIDE 3D LAB */}
      <section
        aria-label="3D Lab AI Tutor"
        className="rounded-3xl border border-[var(--alexyn-border)] bg-[#0A1532] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#132960] text-[#38BDF8]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                3D Lab AI Tutor · Ask about {displayModelTitle}
              </h2>
              <p className="text-xs text-slate-400">
                Ask unlimited questions right here while exploring the 3D stage.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              askInlineLabTutor(`Can you teach me ${displayModelTitle} simply?`)
            }
            disabled={askingLab}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3.5 py-1.5 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193272]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Can you teach me this?</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {currentMeta.quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => askInlineLabTutor(qp)}
              className="rounded-xl border border-[var(--alexyn-border)] bg-[#07112B] px-3 py-1.5 text-xs text-slate-200 hover:border-[#2E8BFF]"
            >
              {qp}
            </button>
          ))}
        </div>

        {subjectWarning && (
          <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="space-y-2">
                <p>{subjectWarning.message}</p>
                {onSwitchToSubject && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = subjectWarning.recommendedSubject;
                      setSubjectWarning(null);
                      onSwitchToSubject(target);
                    }}
                    className="rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30"
                  >
                    Switch to {subjectWarning.recommendedSubject} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {labMessages.length > 0 && (
          <div className="mt-4 max-h-60 space-y-2.5 overflow-y-auto rounded-2xl border border-[var(--alexyn-border)] bg-[#060E24] p-3.5">
            {labMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-8 bg-[#2157BD] text-white'
                    : 'mr-4 border border-[var(--alexyn-border)] bg-[#0E1B3D] text-slate-100 whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {askingLab && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#38BDF8]" />
                <span>ALEXYN is explaining {displayModelTitle}...</span>
              </div>
            )}
            <div ref={tutorMessagesEndRef} />
          </div>
        )}

        <form onSubmit={handleLabSubmit} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={labQuestion}
            onChange={(e) => setLabQuestion(e.target.value)}
            placeholder={`Ask ALEXYN about ${displayModelTitle}...`}
            aria-label={`Ask ALEXYN about ${displayModelTitle}`}
            className="min-w-0 flex-1 rounded-xl border border-[var(--alexyn-border)] bg-[#060E24] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#2E8BFF] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!labQuestion.trim() || askingLab}
            aria-label="Ask 3D Lab Tutor"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 text-xs font-bold text-white disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </section>
    </div>
  );
}
