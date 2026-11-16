import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { SmartNoteAnimationKind, SmartNoteVisual } from '../types/alexyn';
import { sanitizeSvgMarkup } from '../utils/alexynLogic';

interface InteractiveNoteVisualProps {
  visual: SmartNoteVisual;
}

const BUILTIN_ANIMATION_STAGES: Record<
  Exclude<SmartNoteAnimationKind, 'custom'>,
  Array<{ title: string; description: string }>
> = {
  photosynthesis: [
    {
      title: '1. Light Absorption & Water Splitting',
      description:
        'Chlorophyll in thylakoid membranes captures sunlight energy, splitting H₂O into H⁺, electrons, and O₂ gas released via stomata.',
    },
    {
      title: '2. ATP & NADPH Energy Carriers',
      description:
        'Excited electrons power ATP synthase and reduce NADP⁺ into NADPH, carrying high-energy electrons to the stroma.',
    },
    {
      title: '3. Calvin Cycle Carbon Fixation',
      description:
        'CO₂ enters through stomata and reacts with RuBP via RuBisCO in the stroma, producing glucose (C₆H₁₂O₆) and regenerating RuBP.',
    },
  ],
  'cell-division': [
    {
      title: '1. Prophase & Condensation',
      description: 'Chromatin condenses into visible sister chromatids; nuclear envelope breaks down.',
    },
    {
      title: '2. Metaphase Alignment',
      description: 'Spindle fibers attach to centromeres and line chromosomes cleanly along the cell equator.',
    },
    {
      title: '3. Anaphase Separation',
      description: 'Sister chromatids pull apart toward opposite poles to ensure identical genetic sets.',
    },
    {
      title: '4. Telophase & Cytokinesis',
      description: 'Two nuclei reform and cytoplasm divides into two genetically identical daughter cells.',
    },
  ],
  circulation: [
    {
      title: '1. Right Atrium & Ventricle',
      description: 'Deoxygenated blood returns from the body via vena cava into the right heart chambers.',
    },
    {
      title: '2. Pulmonary Gas Exchange',
      description: 'Pulmonary artery carries blood to lungs where CO₂ leaves and O₂ binds hemoglobin.',
    },
    {
      title: '3. Left Heart & Systemic Aorta',
      description: 'Oxygen-rich blood enters the left atrium/ventricle and pumps strongly through the aorta to tissues.',
    },
  ],
  reaction: [
    {
      title: '1. Reactants & Collision Orientation',
      description: 'Reactant molecules collide with sufficient kinetic energy and proper geometry.',
    },
    {
      title: '2. Activation Energy Peak (Transition State)',
      description: 'Existing bonds stretch and begin breaking at the highest energy transition complex.',
    },
    {
      title: '3. New Bond Formation & Product Release',
      description: 'Stable product bonds form, releasing or absorbing net enthalpy (ΔH).',
    },
  ],
  wave: [
    {
      title: '1. Equilibrium & Crest Formation',
      description: 'Oscillating source displaces medium/field upward to peak amplitude (+A).',
    },
    {
      title: '2. Wavelength Span (λ)',
      description: 'Distance between two successive crests or troughs governs wave speed v = f·λ.',
    },
    {
      title: '3. Phase Propagation & Trough',
      description: 'Energy propagates forward smoothly while particles oscillate locally around equilibrium.',
    },
  ],
  orbit: [
    {
      title: '1. Gravitational Centripetal Pull',
      description: 'Central mass pulls body inward along the line of centers (F = GMm / r²).',
    },
    {
      title: '2. Tangential Velocity Balance',
      description: 'Forward tangential inertia prevents falling straight inward, curving path into an ellipse.',
    },
    {
      title: '3. Perihelion Speed-Up (Kepler II)',
      description: 'Closer to focus, orbital speed increases so equal areas are swept in equal times.',
    },
  ],
  timeline: [
    {
      title: '1. Underlying Causes & Context',
      description: 'Economic, social, and political pressures build before the turning point.',
    },
    {
      title: '2. Turning Point Event',
      description: 'Trigger event accelerates structural change across institutions and treaties.',
    },
    {
      title: '3. Long-Term Consequences',
      description: 'Lasting governance, cultural, and historical legacy verified through primary sources.',
    },
  ],
};

export const InteractiveNoteVisual: React.FC<InteractiveNoteVisualProps> = ({ visual }) => {
  const safeSvg = useMemo(() => sanitizeSvgMarkup(visual.svgMarkup), [visual.svgMarkup]);

  const stages = useMemo(() => {
    if (visual.interactiveStages && visual.interactiveStages.length > 0) {
      return visual.interactiveStages;
    }
    if (visual.animationKind && visual.animationKind !== 'custom') {
      return BUILTIN_ANIMATION_STAGES[visual.animationKind].map((s, idx) => ({
        id: `stage-${idx}`,
        title: s.title,
        description: s.description,
      }));
    }
    return [];
  }, [visual.interactiveStages, visual.animationKind]);

  const hasAnimation = stages.length > 0 || Boolean(visual.animationKind);
  const [stageIdx, setStageIdx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isAnimating || stages.length <= 1) return;
    const id = window.setInterval(() => {
      setStageIdx((prev) => (prev + 1) % stages.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [isAnimating, stages.length]);

  const currentStage = stages[stageIdx];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050C20] overflow-hidden shadow-inner">
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{visual.title}</p>
          <span className="text-[10px] uppercase tracking-wider text-teal-300">
            {visual.kind.replace('-', ' ')}
            {visual.animationKind ? ` · Interactive ${visual.animationKind}` : ''}
          </span>
        </div>

        {hasAnimation && stages.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAnimating((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                isAnimating
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : 'border-teal-400/35 bg-teal-500/15 text-teal-200 hover:bg-teal-500/25'
              }`}
            >
              {isAnimating ? (
                <>
                  <Pause className="w-3 h-3" /> Pause Stage Loop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" /> Animate Stages
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAnimating(false);
                setStageIdx(0);
              }}
              className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
              title="Reset to Stage 1"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Rendered SVG Diagram with smooth stage highlight pulse */}
      <div className="relative p-3 flex justify-center bg-[#040A19]">
        {safeSvg ? (
          <div
            className={`w-full max-w-2xl transition-all duration-500 [&_svg]:w-full [&_svg]:h-auto [&_svg]:rounded-xl ${
              isAnimating ? 'ring-1 ring-teal-400/40 rounded-xl shadow-[0_0_24px_rgba(94,234,212,0.12)]' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: safeSvg }}
          />
        ) : null}

        {hasAnimation && stages.length > 0 && (
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-[#091536]/90 border border-teal-400/35 text-[10px] font-semibold text-teal-200 flex items-center gap-1 shadow">
            <Sparkles className="w-3 h-3 text-teal-300" />
            Stage {stageIdx + 1} / {stages.length}
          </div>
        )}
      </div>

      {/* Interactive Clickable Stage Stepper */}
      {stages.length > 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-[#07112B]/90 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsAnimating(false);
                setStageIdx((prev) => (prev - 1 + stages.length) % stages.length);
              }}
              className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
              aria-label="Previous stage"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-wrap gap-1.5 flex-1">
              {stages.map((st, idx) => (
                <button
                  key={st.id || idx}
                  type="button"
                  onClick={() => {
                    setIsAnimating(false);
                    setStageIdx(idx);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                    idx === stageIdx
                      ? 'bg-sky-500/25 border border-sky-400/50 text-white'
                      : 'bg-white/[0.04] border border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {idx + 1}. {st.title.replace(/^\d+\.\s*/, '').slice(0, 24)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsAnimating(false);
                setStageIdx((prev) => (prev + 1) % stages.length);
              }}
              className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
              aria-label="Next stage"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentStage && (
            <div className="rounded-xl border border-teal-400/25 bg-teal-500/[0.06] px-3 py-2 text-xs text-slate-200 leading-relaxed">
              <p className="font-semibold text-teal-200">{currentStage.title}</p>
              <p className="mt-0.5 text-slate-300">{currentStage.description}</p>
            </div>
          )}
        </div>
      )}

      {visual.caption && (
        <p className="px-4 py-2 border-t border-white/10 text-[11px] text-slate-400 bg-white/[0.015]">
          {visual.caption}
        </p>
      )}
    </div>
  );
};
