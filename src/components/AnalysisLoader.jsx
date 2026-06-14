/**
 * AnalysisLoader.jsx
 * ~7.4s animated loading sequence (per-step durations) while gradeTeam runs.
 * Change 2: longer durations, dramatic orange badge reveal, ⚡ header.
 * Change 6: accepts achievements prop, reveals badges per step.
 * Calls onComplete when the final step finishes.
 */

import { useState, useEffect, useRef } from 'react';

// Per-step durations (ms) — total ~7.4s + 600ms hold
const STEPS = [
  { label: 'Reading your draft picks',        icon: '📋', duration: 800  },
  { label: 'Scanning construction patterns',  icon: '🏗️', duration: 1000 },
  { label: 'Calibrating ADP efficiency',      icon: '📊', duration: 900  },
  { label: 'Analyzing capital allocation',    icon: '💰', duration: 900  },
  { label: 'Computing stack configuration',   icon: '⚡', duration: 1100 },
  { label: 'Scoring Week 17 matchups',        icon: '🗓️', duration: 1000 },
  { label: 'Evaluating live player risk',     icon: '🎲', duration: 900  },
  { label: 'Finalizing grade',               icon: '🎯', duration: 800  },
];

// Map step index → achievement IDs revealed at that step.
// '__remaining__' at the last step reveals anything not yet shown.
const ACHIEVEMENT_STEP_MAP = {
  1: ['EARLY_RB', 'HERO_RB', 'THREE_QB'],
  2: ['PATIENT_DRAFTER'],
  4: ['FOUR_PLUS_STACKED', 'BOTH_QBS_STACKED'],
  5: ['W17_S', 'W17_A', 'W17_B', 'W17_C'],
  6: ['LIVE_PLAYERS', 'ELITE_TE'],
  7: '__remaining__',
};

export default function AnalysisLoader({ onComplete, achievements = [] }) {
  const [step, setStep] = useState(0);
  const [revealedAchievements, setRevealedAchievements] = useState([]);
  const onCompleteRef = useRef(onComplete);
  const revealedIdsRef = useRef(new Set());

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Advance steps using per-step duration; hold 600ms at end before completing
  useEffect(() => {
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onCompleteRef.current?.(), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(s => s + 1), STEPS[step].duration);
    return () => clearTimeout(t);
  }, [step]);

  // Reveal achievements as each step completes
  useEffect(() => {
    if (!achievements || achievements.length === 0) return;
    const ids = ACHIEVEMENT_STEP_MAP[step];
    if (!ids) return;

    const toReveal = [];
    const candidates = ids === '__remaining__'
      ? achievements
      : achievements.filter(a => ids.includes(a.id));

    for (const a of candidates) {
      if (!revealedIdsRef.current.has(a.id)) {
        revealedIdsRef.current.add(a.id);
        toReveal.push(a);
      }
    }

    if (toReveal.length > 0) {
      setRevealedAchievements(prev => [...prev, ...toReveal]);
    }
  }, [step, achievements]);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <span className="text-5xl analysis-pulse" role="img" aria-label="lightning">⚡</span>
        </div>
        <h2
          className="text-xl font-bold text-white mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Analyzing Your Team
        </h2>
        <p className="text-slate-400 text-sm">
          Running BBM V+VI calibrated scoring model
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #16a34a, #4ade80)',
              boxShadow: '0 0 12px rgba(74, 222, 128, 0.45)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-600"
             style={{ fontFamily: 'var(--font-mono)' }}>
          <span>{progress}%</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {STEPS.map((s, i) => {
          const done   = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-400
                ${active ? 'bg-green-950/40 border border-green-800/40' : 'border border-transparent'}
                ${done ? 'opacity-35' : active ? 'opacity-100' : 'opacity-20'}`}
            >
              <span className="text-base w-6 text-center flex-shrink-0 transition-all duration-300">
                {done ? '✓' : s.icon}
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  active ? 'text-green-300 font-medium' :
                  done   ? 'text-slate-500' :
                           'text-slate-400'
                }`}
              >
                {s.label}
              </span>
              {active && (
                <span className="ml-auto flex gap-0.5" aria-hidden>
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-bounce"
                        style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Accolade badge unlock section — orange, larger, more dramatic */}
      {revealedAchievements.length > 0 && (
        <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          {/* "ACCOLADES UNLOCKED" header fades in with first badge */}
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-orange)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: '12px',
            animation: 'fade-in 0.3s ease forwards',
          }}>
            ⚡ Accolades Unlocked
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'flex-start',
            minHeight: '40px',
          }}>
            {revealedAchievements.map(a => (
              <div
                key={a.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: '24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'rgba(255, 107, 53, 0.15)',
                  border: '2px solid var(--color-orange)',
                  color: 'var(--color-orange)',
                  animation: 'badge-unlock 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, badge-flash 0.8s ease-out 0.4s forwards',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 12px rgba(255, 107, 53, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
