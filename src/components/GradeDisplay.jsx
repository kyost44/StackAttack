/**
 * GradeDisplay.jsx
 * Grade report for the new BBM V+VI calibrated engine.
 * Consumes: overallGrade, overallScore, *Score, *Feedback, *Detail,
 *           achievements, topStrengths, topWeaknesses, bbm6Context
 */

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function scoreColor(s) {
  if (s >= 80) return 'text-green-400';
  if (s >= 65) return 'text-blue-400';
  if (s >= 50) return 'text-yellow-400';
  if (s >= 35) return 'text-orange-400';
  return 'text-red-400';
}
function barColor(s) {
  if (s >= 80) return 'bg-green-500';
  if (s >= 65) return 'bg-blue-500';
  if (s >= 50) return 'bg-yellow-500';
  if (s >= 35) return 'bg-orange-500';
  return 'bg-red-500';
}
function gradeTextColor(g) {
  if (g?.startsWith('A')) return 'text-green-400';
  if (g?.startsWith('B')) return 'text-blue-400';
  if (g?.startsWith('C')) return 'text-yellow-400';
  if (g === 'D') return 'text-orange-400';
  return 'text-red-400';
}
function gradeRingColor(g) {
  if (g?.startsWith('A')) return 'ring-green-500/50 shadow-green-900/30';
  if (g?.startsWith('B')) return 'ring-blue-500/50 shadow-blue-900/30';
  if (g?.startsWith('C')) return 'ring-yellow-500/50 shadow-yellow-900/30';
  if (g === 'D') return 'ring-orange-500/50 shadow-orange-900/30';
  return 'ring-red-500/50 shadow-red-900/30';
}

// ---------------------------------------------------------------------------
// Achievement badge row
// ---------------------------------------------------------------------------
function AchievementBadges({ achievements }) {
  if (!achievements || achievements.length === 0) return null;
  // Deduplicate by id
  const seen = new Set();
  const unique = achievements.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {unique.map(a => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                     bg-slate-700 border border-slate-600 text-slate-200"
        >
          <span>{a.icon}</span>
          <span>{a.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------
function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>{icon}</span>{title}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 py-3 bg-slate-900/60 space-y-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback list (used inside accordions)
// ---------------------------------------------------------------------------
function FeedbackList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-1">
      {items.map((f, i) => (
        <li key={i} className="text-xs text-slate-400 flex gap-2">
          <span className="text-slate-600 flex-shrink-0 mt-0.5">•</span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Construction accordion content
// ---------------------------------------------------------------------------
function ConstructionDetail({ detail, feedback }) {
  if (!detail) return null;
  const { wrR6, wrR10, wrTotal, rbR6, rbR10, rbTotal, qbTotal, teTotal, totalDelta,
    wrR6D, wrR10D, wrTotD, rbR6D, rbR10D, rbTotD, qbD, teD } = detail;
  const cats = [
    { label: 'WR through R6',  val: wrR6,    delta: wrR6D  },
    { label: 'WR through R10', val: wrR10,   delta: wrR10D },
    { label: 'WR total',       val: wrTotal, delta: wrTotD },
    { label: 'RB through R6',  val: rbR6,    delta: rbR6D  },
    { label: 'RB through R10', val: rbR10,   delta: rbR10D },
    { label: 'RB total',       val: rbTotal, delta: rbTotD },
    { label: 'QB total',       val: qbTotal, delta: qbD    },
    { label: 'TE total',       val: teTotal, delta: teD    },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 text-xs">
        {cats.map(c => (
          <div key={c.label} className="flex justify-between bg-slate-800/60 rounded px-2 py-1">
            <span className="text-slate-400">{c.label}</span>
            <span className="font-mono text-white font-semibold">{c.val}</span>
            <span className={`font-mono text-xs ${c.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {c.delta >= 0 ? '+' : ''}{c.delta?.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-slate-700">
        <span className="text-slate-300">Total delta</span>
        <span className={totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
          {totalDelta >= 0 ? '+' : ''}{totalDelta?.toFixed(2)}pp
        </span>
      </div>
      <FeedbackList items={feedback} />
      <p className="text-xs text-slate-600 italic border-t border-slate-800 pt-2">
        Construction weights calibrated from BBM V &amp; VI ground-truth finalist data (1,078 finalist rosters).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value accordion content
// ---------------------------------------------------------------------------
function ValueDetail({ detail, feedback }) {
  if (!detail) return null;
  const { adpScore, capitalScore, capitalPct, qbQuartile, rbQuartile, wrQuartile, teQuartile } = detail;
  const capitals = [
    { pos: 'QB', pct: capitalPct?.QB, q: qbQuartile },
    { pos: 'RB', pct: capitalPct?.RB, q: rbQuartile },
    { pos: 'WR', pct: capitalPct?.WR, q: wrQuartile },
    { pos: 'TE', pct: capitalPct?.TE, q: teQuartile },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/60 rounded px-3 py-2">
          <p className="text-slate-400">ADP Efficiency (60%)</p>
          <p className={`text-lg font-bold ${scoreColor(adpScore ?? 50)}`}>{adpScore ?? '—'}</p>
        </div>
        <div className="bg-slate-800/60 rounded px-3 py-2">
          <p className="text-slate-400">Capital Alloc (40%)</p>
          <p className={`text-lg font-bold ${scoreColor(capitalScore ?? 50)}`}>{capitalScore ?? '—'}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400">Positional Capital</p>
        {capitals.map(c => (
          <div key={c.pos} className="flex items-center justify-between text-xs">
            <span className="text-slate-300 w-8">{c.pos}</span>
            <span className="text-slate-400 flex-1 px-2">{c.pct}% ({c.q?.l ?? '—'})</span>
            <span className={c.q?.d >= 0 ? 'text-green-400' : 'text-red-400'}>
              {c.q?.d >= 0 ? '+' : ''}{c.q?.d}pp
            </span>
          </div>
        ))}
      </div>
      <FeedbackList items={feedback} />
      <p className="text-xs text-slate-600 italic border-t border-slate-800 pt-2">
        ADP efficiency calibrated from BBM II-IV. BBM V/VI public datasets had null ADP.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack accordion content
// ---------------------------------------------------------------------------
function StackDetail({ detail, feedback }) {
  if (!detail) return null;
  const { topQbTier, qbTierBonus, teamStackBonus, w17GameBonus, w16GameBonus, w15GameBonus,
    w17GameStackDetails, w16StackDetails, w15StackDetails, bothQbsStacked, teamStackDetails } = detail;

  return (
    <div className="space-y-3">
      {bothQbsStacked && (
        <div className="bg-orange-950/40 border border-orange-700/40 rounded px-3 py-2 text-xs text-orange-300 font-semibold">
          🔥 Both QBs game-stacked W17 — the $31.28 EV construct
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 text-xs">
        {[
          { label: 'QB Tier',    val: `+${qbTierBonus ?? 0}` },
          { label: 'Team Stack', val: `+${teamStackBonus ?? 0}` },
          { label: 'W17 Stack',  val: `+${w17GameBonus ?? 0}` },
          { label: 'W15/16',     val: `+${(w16GameBonus ?? 0) + (w15GameBonus ?? 0)}` },
        ].map(({ label, val }) => (
          <div key={label} className="bg-slate-800/60 rounded px-2 py-1.5 text-center">
            <p className="text-slate-500">{label}</p>
            <p className="text-white font-semibold">{val}</p>
          </div>
        ))}
      </div>

      {teamStackDetails?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">Team Stacks</p>
          {teamStackDetails.map((s, i) => (
            <p key={i} className="text-xs text-slate-400">
              {s.qb} ({s.team}) + {s.partners.join(', ')}
            </p>
          ))}
        </div>
      )}

      {w17GameStackDetails?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">Week 17 Game Stacks</p>
          {w17GameStackDetails.map((g, i) => (
            <div key={i} className="text-xs bg-slate-800/40 rounded px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${g.tier === 'S' ? 'text-green-400' : g.tier === 'A' ? 'text-blue-400' : g.tier === 'B' ? 'text-yellow-400' : 'text-slate-400'}`}>
                  [{g.tier}]
                </span>
                <span className="text-white font-medium">{g.game}</span>
                <span className="text-slate-500">{g.window}</span>
                <span className="ml-auto text-green-400 font-semibold">+{g.bonus}</span>
              </div>
              {g.t1.length > 0 && <p className="text-slate-400 mt-0.5 pl-1">Side 1: {g.t1.join(', ')}</p>}
              {g.t2.length > 0 && <p className="text-slate-400 pl-1">Side 2: {g.t2.join(', ')}</p>}
              {g.both && <p className="text-green-400/70 pl-1">✓ Bring-back detected</p>}
            </div>
          ))}
        </div>
      )}

      {w16StackDetails?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">Week 16 Game Stacks</p>
          {w16StackDetails.map((g, i) => (
            <div key={i} className="text-xs text-slate-400 flex justify-between bg-slate-800/30 rounded px-2 py-1">
              <span>{g.game} [{g.tier}] {g.window}</span>
              <span className="text-green-400">+{g.bonus}</span>
            </div>
          ))}
        </div>
      )}

      {w15StackDetails?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400">Week 15 Game Stacks</p>
          {w15StackDetails.map((g, i) => (
            <div key={i} className="text-xs text-slate-400 flex justify-between bg-slate-800/30 rounded px-2 py-1">
              <span>{g.game} [{g.tier}] {g.window}</span>
              <span className="text-green-400">+{g.bonus}</span>
            </div>
          ))}
        </div>
      )}

      <FeedbackList items={feedback} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk accordion content
// ---------------------------------------------------------------------------
function RiskDetail({ feedback }) {
  return <FeedbackList items={feedback} />;
}

// ---------------------------------------------------------------------------
// BBM6 chalk alert
// ---------------------------------------------------------------------------
function BBM6ChalkAlert({ bbm6Context }) {
  if (!bbm6Context?.highOwnershipPlayers?.length) return null;
  return (
    <div className="bg-yellow-950/30 border border-yellow-700/40 rounded-xl px-4 py-3">
      <p className="text-yellow-400 text-xs font-semibold mb-1.5">⚠️ BBM VI Chalk Alert</p>
      <ul className="space-y-0.5">
        {bbm6Context.highOwnershipPlayers.map(p => (
          <li key={p.name} className="text-xs text-yellow-200/70">
            {p.name} — {p.ownership}% finalist ownership
          </li>
        ))}
      </ul>
      <p className="text-xs text-yellow-300/50 italic mt-2">
        This is a differentiation flag, not a quality signal — prior-year finalist concentration doesn't transfer.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft date badge
// ---------------------------------------------------------------------------
function DraftDateBadge({ riskFeedback }) {
  if (!riskFeedback) return null;
  const timingLine = riskFeedback.find(f =>
    f.includes('Drafted') || f.includes('Early draft') || f.includes('Late draft')
  );
  if (!timingLine) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                    bg-slate-700/60 border border-slate-600 text-slate-300">
      📅 {timingLine}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GradeDisplay
// ---------------------------------------------------------------------------
export default function GradeDisplay({ result, onReset }) {
  if (!result) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-slate-400">No result to display.</p>
        {onReset && (
          <button onClick={onReset} className="mt-4 text-green-400 hover:text-green-300 text-sm">
            ← Enter a roster
          </button>
        )}
      </div>
    );
  }

  const {
    overallGrade, overallScore,
    constructionScore, valueScore, stackScore, riskScore,
    constructionFeedback, valueFeedback, stackFeedback, riskFeedback,
    constructionDetail, valueDetail, stackDetail,
    topStrengths, topWeaknesses,
    achievements, bbm6Context,
  } = result;

  const components = [
    { k: 'construction', label: 'Construction', score: constructionScore, w: 0.35 },
    { k: 'value',        label: 'Value',        score: valueScore,        w: 0.35 },
    { k: 'stack',        label: 'Stack',        score: stackScore,        w: 0.20 },
    { k: 'risk',         label: 'Risk',         score: riskScore,         w: 0.10 },
  ];

  return (
    <div className="space-y-5">
      {/* Grade card */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        {/* Achievement badges above grade */}
        <AchievementBadges achievements={achievements} />

        <div className="flex items-center gap-6">
          {/* Letter grade box */}
          <div
            className={`w-24 h-24 rounded-2xl ring-2 shadow-xl flex flex-col items-center
                        justify-center flex-shrink-0 bg-slate-800 ${gradeRingColor(overallGrade)}`}
          >
            <span className={`text-4xl font-black leading-none ${gradeTextColor(overallGrade)}`}>
              {overallGrade}
            </span>
            <span className="text-slate-500 text-xs mt-1 font-mono">{overallScore}/100</span>
          </div>

          {/* Summary + component bars */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white mb-1">Team Grade</h2>
            <p className="text-slate-400 text-sm mb-3">
              BBM V &amp; VI calibrated · 1,078 finalist rosters
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {components.map(({ k, label, score, w }) => (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-24 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
                  </div>
                  <span className={`text-xs font-mono font-semibold w-8 text-right ${scoreColor(score)}`}>
                    {score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Draft date badge (only if timing line exists) */}
        <div className="mt-3">
          <DraftDateBadge riskFeedback={riskFeedback} />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topStrengths?.length > 0 && (
          <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-4">
            <h3 className="text-green-400 font-semibold text-sm mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Strengths
            </h3>
            <ul className="space-y-1.5">
              {topStrengths.map((s, i) => (
                <li key={i} className="text-xs text-green-200/80 flex gap-2">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topWeaknesses?.length > 0 && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
            <h3 className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Weaknesses
            </h3>
            <ul className="space-y-1.5">
              {topWeaknesses.map((w, i) => (
                <li key={i} className="text-xs text-red-200/80 flex gap-2">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* BBM6 chalk alert */}
      <BBM6ChalkAlert bbm6Context={bbm6Context} />

      {/* Score breakdowns */}
      <div className="space-y-3">
        <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider px-1">
          Score Breakdowns
        </h3>
        <Accordion title="Construction" icon="🏗️">
          <ConstructionDetail detail={constructionDetail} feedback={constructionFeedback} />
        </Accordion>
        <Accordion title="Value" icon="💰">
          <ValueDetail detail={valueDetail} feedback={valueFeedback} />
        </Accordion>
        <Accordion title="Stack" icon="⚡" defaultOpen={true}>
          <StackDetail detail={stackDetail} feedback={stackFeedback} />
        </Accordion>
        <Accordion title="Risk" icon="🎲">
          <RiskDetail feedback={riskFeedback} />
        </Accordion>
      </div>

      {/* Reset */}
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
