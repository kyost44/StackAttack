/**
 * GradeDisplay.jsx
 * Renders the full team grade report: letter grade, component score bars,
 * expandable feedback accordions, strengths + weaknesses callout boxes.
 */

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a 0–100 score to a color class. */
function scoreColor(score) {
  if (score >= 80) return 'text-green-400';
  if (score >= 65) return 'text-blue-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 35) return 'text-orange-400';
  return 'text-red-400';
}

/** Map a 0-100 score to a bar fill color (Tailwind bg class). */
function barColor(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 65) return 'bg-blue-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 35) return 'bg-orange-500';
  return 'bg-red-500';
}

/** Map a letter grade to a Tailwind text color. */
function gradeTextColor(letter) {
  if (letter.startsWith('A')) return 'text-green-400';
  if (letter.startsWith('B')) return 'text-blue-400';
  if (letter.startsWith('C')) return 'text-yellow-400';
  if (letter === 'D')          return 'text-orange-400';
  return 'text-red-400';
}

function gradeRingColor(letter) {
  if (letter.startsWith('A')) return 'ring-green-500/50 shadow-green-900/30';
  if (letter.startsWith('B')) return 'ring-blue-500/50 shadow-blue-900/30';
  if (letter.startsWith('C')) return 'ring-yellow-500/50 shadow-yellow-900/30';
  if (letter === 'D')          return 'ring-orange-500/50 shadow-orange-900/30';
  return 'ring-red-500/50 shadow-red-900/30';
}

// ---------------------------------------------------------------------------
// Score bar component
// ---------------------------------------------------------------------------
function ScoreBar({ label, score, weight, description }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">{label}</span>
          <span className="text-slate-500 text-xs">({Math.round(weight * 100)}%)</span>
        </div>
        <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {description && (
        <p className="text-slate-500 text-xs">{description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------
function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60
                   hover:bg-slate-700/60 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>{icon}</span>
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-slate-900/60 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Construction detail accordion content
// ---------------------------------------------------------------------------
function ConstructionDetail({ raw }) {
  if (!raw) return null;
  const { wrRd6, wrRd10, wrAll, rbRd6, rbRd10, rbAll, qbAll, teAll, deltas, totalDelta } = raw;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { label: 'WRs through Rd 6',  val: wrRd6 },
          { label: 'WRs through Rd 10', val: wrRd10 },
          { label: 'Total WRs',         val: wrAll },
          { label: 'RBs through Rd 6',  val: rbRd6 },
          { label: 'RBs through Rd 10', val: rbRd10 },
          { label: 'Total RBs',         val: rbAll },
          { label: 'Total QBs',         val: qbAll },
          { label: 'Total TEs',         val: teAll },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between bg-slate-800/60 rounded px-2 py-1">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-mono font-semibold">{val}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-700 pt-2">
        <p className="text-xs text-slate-500 mb-2">Advance-rate deltas vs median bucket:</p>
        <div className="space-y-1">
          {deltas?.map(d => (
            <div key={d.cat} className="flex justify-between text-xs">
              <span className="text-slate-400">{d.cat}</span>
              <span className={d.val >= 0 ? 'text-green-400' : 'text-red-400'}>
                {d.val >= 0 ? '+' : ''}{d.val}pp
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs font-semibold mt-2 pt-2 border-t border-slate-700">
          <span className="text-slate-300">Total delta</span>
          <span className={totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
            {totalDelta >= 0 ? '+' : ''}{totalDelta}pp
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value detail accordion content
// ---------------------------------------------------------------------------
function ValueDetail({ raw }) {
  if (!raw) return null;
  const { adpScore, capitalScore, capitalDetails } = raw;
  const ADP_BUCKET_LABELS = {
    reached_heavily: 'Reached (10+ picks early) — slight bonus',
    reached_slightly: 'Reached (3–10 early) — optimal',
    near_adp: 'Near ADP — neutral',
    good_value: 'Good value (3–15 late) — penalty',
    great_value: 'Great value (15+ late) — big penalty',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/60 rounded px-3 py-2">
          <p className="text-slate-400">ADP Efficiency</p>
          <p className={`text-lg font-bold ${scoreColor(adpScore)}`}>{adpScore}</p>
        </div>
        <div className="bg-slate-800/60 rounded px-3 py-2">
          <p className="text-slate-400">Capital Allocation</p>
          <p className={`text-lg font-bold ${scoreColor(capitalScore)}`}>{capitalScore}</p>
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-slate-800/40 rounded p-2">
        <span className="text-yellow-400 font-medium">⚡ Counterintuitive finding: </span>
        BBM II/III data shows teams that reached slightly (3–10 picks early) advanced at +3.3pp vs baseline.
        Heavy value-hunting underperformed by −9.7pp. ADP reflects player quality — reaching = buying the known-good players.
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400">Positional Capital</p>
        {capitalDetails?.map(c => (
          <div key={c.pos} className="flex items-center justify-between text-xs">
            <span className="text-slate-300 w-8">{c.pos}</span>
            <span className="text-slate-400 flex-1 px-2">{c.pct}% of draft ({c.quartile})</span>
            <span className={c.delta >= 0 ? 'text-green-400' : 'text-red-400'}>
              {c.delta >= 0 ? '+' : ''}{c.delta}pp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack detail accordion content
// ---------------------------------------------------------------------------
function StackDetail({ raw }) {
  if (!raw) return null;
  const { noQB, stackNotes, bonuses, primaryQB, qbTier, stackCount, week17Game } = raw;

  return (
    <div className="space-y-2">
      {noQB && (
        <p className="text-red-400 text-xs font-medium">⚠️ No QB on roster</p>
      )}
      {!noQB && bonuses && (
        <div className="grid grid-cols-4 gap-1 text-xs">
          {[
            { label: 'Base',      val: bonuses.base },
            { label: 'QB Tier',   val: `+${bonuses.qbBonus}` },
            { label: 'Team Stack',val: `+${bonuses.teamStackBonus}` },
            { label: 'Game Stack',val: `+${bonuses.gameStackBonus}` },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-800/60 rounded px-2 py-1.5 text-center">
              <p className="text-slate-500 text-xs">{label}</p>
              <p className="text-white font-semibold">{val}</p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {stackNotes?.map((note, i) => (
          <p key={i} className="text-xs text-slate-400">• {note}</p>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk detail accordion content
// ---------------------------------------------------------------------------
function RiskDetail({ raw }) {
  if (!raw) return null;
  const { riskNotes, base, totalPenalty, totalBonus } = raw;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 text-xs">
        {[
          { label: 'Base', val: base },
          { label: 'Penalties', val: totalPenalty, colored: true },
          { label: 'Bonuses', val: `+${totalBonus}`, colored: true, positive: true },
        ].map(({ label, val, colored, positive }) => (
          <div key={label} className="bg-slate-800/60 rounded px-2 py-1.5 text-center">
            <p className="text-slate-500 text-xs">{label}</p>
            <p className={`font-semibold ${colored ? (positive ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
              {val}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {riskNotes?.map((note, i) => (
          <p key={i} className="text-xs text-slate-400">• {note}</p>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GradeDisplay component
// ---------------------------------------------------------------------------
export default function GradeDisplay({ result, onReset }) {
  if (!result || result.error) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-slate-400">{result?.error || 'No result to display.'}</p>
        {onReset && (
          <button onClick={onReset} className="mt-4 text-green-400 hover:text-green-300 text-sm">
            ← Enter a roster
          </button>
        )}
      </div>
    );
  }

  const { letter, total, components, raw, strengths, weaknesses, tips } = result;

  return (
    <div className="space-y-5">
      {/* Grade card */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-6">
          {/* Letter grade */}
          <div
            className={`w-24 h-24 rounded-2xl ring-2 shadow-xl flex flex-col items-center
                        justify-center flex-shrink-0 bg-slate-800 ${gradeRingColor(letter)}`}
          >
            <span className={`text-4xl font-black leading-none ${gradeTextColor(letter)}`}>
              {letter}
            </span>
            <span className="text-slate-500 text-xs mt-1 font-mono">{total}/100</span>
          </div>

          {/* Summary */}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">Team Grade</h2>
            <p className="text-slate-400 text-sm mb-4">
              Calibrated from 1.6M BBM rosters across 5 tournament seasons.
            </p>

            {/* Component scores inline */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[
                { k: 'construction', label: 'Construction', w: 0.35 },
                { k: 'value',        label: 'Value',        w: 0.35 },
                { k: 'stack',        label: 'Stack',        w: 0.20 },
                { k: 'risk',         label: 'Risk',         w: 0.10 },
              ].map(({ k, label, w }) => (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-24 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(components[k])}`}
                      style={{ width: `${components[k]}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-semibold w-8 text-right ${scoreColor(components[k])}`}>
                    {components[k]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        {strengths?.length > 0 && (
          <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-4">
            <h3 className="text-green-400 font-semibold text-sm mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Strengths
            </h3>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-green-200/80 flex gap-2">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses?.length > 0 && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
            <h3 className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Weaknesses
            </h3>
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-red-200/80 flex gap-2">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tips */}
      {tips?.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-700/40 rounded-xl px-4 py-3">
          <p className="text-yellow-400 text-xs font-semibold mb-1">💡 Notes</p>
          {tips.map((t, i) => (
            <p key={i} className="text-xs text-yellow-200/70">{t}</p>
          ))}
        </div>
      )}

      {/* Detailed component breakdowns */}
      <div className="space-y-3">
        <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider px-1">
          Score Breakdowns
        </h3>

        <Accordion title="Construction" icon="🏗️" defaultOpen={false}>
          <ConstructionDetail raw={raw?.construction} />
        </Accordion>

        <Accordion title="Value" icon="💰" defaultOpen={false}>
          <ValueDetail raw={raw?.value} />
        </Accordion>

        <Accordion title="Stack" icon="⚡" defaultOpen={true}>
          <StackDetail raw={raw?.stack} />
        </Accordion>

        <Accordion title="Risk" icon="🎲" defaultOpen={false}>
          <RiskDetail raw={raw?.risk} />
        </Accordion>
      </div>

      {/* Reset button */}
      {onReset && (
        <div className="pt-2">
          <button
            onClick={onReset}
            className="w-full py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700
                       hover:border-slate-500 rounded-lg transition-colors"
          >
            ← Grade Another Team
          </button>
        </div>
      )}
    </div>
  );
}
