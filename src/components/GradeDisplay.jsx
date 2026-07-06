/**
 * GradeDisplay.jsx
 * Grade report for the BBM V+VI calibrated engine.
 * Patch 3C: narrative system, Straight Talk restructure, visual color fixes,
 *           richer achievement tooltips, generic bullet filtering.
 */

import { useState, useEffect, useRef } from 'react';
import ArchetypeCard from './ArchetypeCard';
import TabLayout from './TabLayout';
import FeedbackList from './FeedbackList';
import Tooltip from './Tooltip';
import { generateNarrative } from '../engine/scoringEngine';

// ---------------------------------------------------------------------------
// Archetype accent color map (matches CSS vars in index.css)
// ---------------------------------------------------------------------------
const ARCHETYPE_ACCENT = {
  'The Blueprint':         'var(--archetype-blueprint)',
  'The Apex Predator':     'var(--archetype-apex)',
  'Value Merchant':        'var(--archetype-value-merchant)',
  'The Juggernaut':        'var(--archetype-juggernaut)',
  'Glass Cannon':          'var(--archetype-glass-cannon)',
  'The Sentinel':          'var(--archetype-sentinel)',
  'The Tactician':         'var(--archetype-tactician)',
  'The Sprinter':          'var(--archetype-sprinter)',
  'Lightning in a Bottle': 'var(--archetype-lightning)',
  'The Long Shot':         'var(--archetype-long-shot)',
};

// ---------------------------------------------------------------------------
// Tooltip content — component scores
// ---------------------------------------------------------------------------
const COMPONENT_TOOLTIPS = {
  construction: 'WR/RB/QB/TE count patterns — calibrated from 1,078 BBM V+VI finalist rosters',
  value:        'ADP efficiency (60%) + positional capital allocation (40%)',
  stack:        'QB tier quality + team stack + Week 17 game stacks (diminishing returns applied)',
  boomBust:     'Floor (40%) — RB1 timing, live players, TE depth. Ceiling (60%) — W17 leverage, QB tier.',
};

// ---------------------------------------------------------------------------
// Achievement tooltip content — rich objects keyed by ENGINE achievement IDs
// ---------------------------------------------------------------------------
const ACHIEVEMENT_TOOLTIPS = {
  PATIENT_DRAFTER: {
    title: 'Patient Drafter',
    impact: '+1.56 pts above baseline playoff advance rate',
    body: 'Your average pick was taken at or after its ADP. Drafters who do this advance to playoffs at +1.56 points per 100 teams above field average — the strongest positive ADP signal in BBM V+VI data.',
  },
  EARLY_RB: {
    title: 'Early RB Investment',
    impact: 'Bell-cow RB1 secured — live-player attrition reduced',
    body: 'You secured RB depth through R6. Bell-cow backs drafted this early have the highest expected production per opportunity and significantly reduce Week 17 role-change risk.',
  },
  ELITE_TE: {
    title: 'Elite TE Secured',
    impact: '+1.36 pts above baseline vs. non-elite TE build',
    body: 'You drafted an elite-tier TE (Bowers, McBride, Loveland, Warren, or Kraft). Elite TE pairing makes 1-TE construction viable and adds meaningful expected value per BBM V+VI calibration.',
  },
  W17_S: {
    title: 'Week 17 S-Tier Stack',
    impact: '+25 stack score — highest single-game leverage in the format',
    body: 'You have 2+ players from a marquee Week 17 game (DET-CHI). S-tier stacks are the highest-leverage single position in the championship week. When the game pops, your roster pops.',
  },
  W17_A: {
    title: 'Week 17 A-Tier Stack',
    impact: '+20 stack score — strong W17 leverage',
    body: 'You have 2+ players from a strong Week 17 matchup. A-tier games (BUF-MIA, BAL-CIN, DAL-NYG, etc.) deliver reliable playoff-week leverage.',
  },
  W17_B: {
    title: 'Week 17 B-Tier Stack',
    impact: '+15 stack score — moderate W17 leverage',
    body: 'You have 2+ players from a B-tier Week 17 game. Useful leverage, less concentrated than S/A-tier matchups.',
  },
  W17_C: {
    title: 'Week 17 C-Tier Stack',
    impact: '+8 stack score — limited W17 leverage',
    body: 'You have 2+ players from a lower-leverage Week 17 game. Some correlation value but not a primary championship path.',
  },
  LIVE_PLAYERS: {
    title: 'High Live Player Potential',
    impact: '+15 risk score — live ceiling elevated',
    body: '14+ of your players are in meaningful Week 17 games. More live games means higher championship-week ceiling when the format narrows.',
  },
  THREE_QB: {
    title: '3-QB Structure',
    impact: '+1.80 pts above baseline when QB3 is R8 or later',
    body: 'You drafted 3 QBs. Modern data shows this pattern adds +1.80 pts above baseline when QB3 is in round 8 or later — the edge comes from cheap late-round QB exposure, not the 3-QB count itself.',
  },
  BOTH_QBS_STACKED: {
    title: 'Dual QB Game Stack',
    impact: 'Both QBs in the same W17 game — maximum single-game leverage',
    body: 'Both of your primary QBs are in the same Week 17 game. When that game goes high-scoring, your roster has multiple scoring paths from the same source.',
  },
  FOUR_PLUS_STACKED: {
    title: 'Elite Stack Depth',
    impact: 'Multiple W17 game stacks — redundant leverage paths',
    body: "You have 4+ skill players stacked. Redundant leverage paths mean you don't need a single game to go nuclear — you just need one of several to deliver.",
  },
  HERO_RB: {
    title: 'Hero RB Build',
    impact: '1 early RB + 5+ total RBs — viable contrarian path',
    body: 'You have 1 elite early RB anchoring the position plus late-round depth. Modern data confirms this works — higher variance but with real upside when the anchor stays healthy.',
  },
};

function buildAchievementTooltip(achievement) {
  const data = ACHIEVEMENT_TOOLTIPS[achievement.id];
  if (!data) return achievement.label;
  if (typeof data === 'string') return data;
  return (
    <div style={{ minWidth: '200px', maxWidth: '260px' }}>
      <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px', fontSize: '12px' }}>
        {data.title}
      </div>
      <div style={{ color: 'var(--color-orange)', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
        {data.impact}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5 }}>
        {data.body}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change 5: AnimatedScore — counts up from 0 to target over `duration` ms
// ---------------------------------------------------------------------------
function AnimatedScore({ target, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    setDisplay(0);
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{display}</>;
}

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

// Change 3: Heat gradient bar fill
function getHeatGradient(score) {
  if (score >= 90) return 'linear-gradient(90deg, #f0c040, #ffd700)';
  if (score >= 80) return 'linear-gradient(90deg, #ff6b35, #f0c040)';
  if (score >= 65) return 'linear-gradient(90deg, #7ec8e3, #ff6b35)';
  return 'linear-gradient(90deg, #5ba4be, #7ec8e3)';
}
function getHeatGlow(score) {
  if (score >= 90) return '0 0 16px rgba(240, 192, 64, 0.5)';
  if (score >= 80) return '0 0 12px rgba(255, 107, 53, 0.4)';
  if (score >= 65) return '0 0 8px rgba(126, 200, 227, 0.25)';
  return 'none';
}
function getGradeGlow(score) {
  if (score >= 90) return '0 0 30px rgba(240, 192, 64, 0.6), 0 0 60px rgba(240, 192, 64, 0.3)';
  if (score >= 85) return '0 0 24px rgba(255, 107, 53, 0.5), 0 0 48px rgba(255, 107, 53, 0.2)';
  if (score >= 80) return '0 0 20px rgba(255, 107, 53, 0.4)';
  if (score >= 70) return '0 0 16px rgba(126, 200, 227, 0.3)';
  return 'none';
}

// ---------------------------------------------------------------------------
// Replace "pp" with "pts above baseline" in feedback strings
// ---------------------------------------------------------------------------
function transformPP(str) {
  if (!str) return str;
  return str.replace(/([+-]?\d+\.?\d*)pp/g, '$1 pts above baseline');
}
function transformFeedback(items) {
  return (items || []).map(transformPP);
}

// ---------------------------------------------------------------------------
// Patterns to suppress from Straight Talk Key Takeaways (too generic)
// ---------------------------------------------------------------------------
const GENERIC_PATTERNS = [
  /^Context: BBM VI finalists/,
  /^Market context:/,
  /Modern best ball rewards different patterns/,
];

function filterTakeaways(items) {
  return (items || []).filter(f => !GENERIC_PATTERNS.some(p => p.test(f)));
}

// ---------------------------------------------------------------------------
// Achievement badges (with rich tooltips)
// ---------------------------------------------------------------------------
function AchievementBadges({ achievements }) {
  if (!achievements || achievements.length === 0) return null;
  const seen = new Set();
  const unique = achievements.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  return (
    <div className="flex flex-wrap gap-2">
      {unique.map(a => (
        <Tooltip key={a.id} content={buildAchievementTooltip(a)}>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                       bg-slate-700 border border-slate-600 text-slate-200 cursor-help"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </span>
        </Tooltip>
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
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 py-3 bg-slate-900/60 space-y-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion feedback bullets (internal — used inside accordions only)
// ---------------------------------------------------------------------------
function FeedbackBullets({ items }) {
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
  const {
    wrR6, wrR10, wrTotal, rbR6, rbR10, rbTotal, qbTotal, teTotal, totalDelta,
    wrR6D, wrR10D, wrTotD, rbR6D, rbR10D, rbTotD, qbD, teD,
  } = detail;
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
          {totalDelta >= 0 ? '+' : ''}{totalDelta?.toFixed(2)} pts
        </span>
      </div>
      <FeedbackBullets items={feedback} />
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
              {c.q?.d >= 0 ? '+' : ''}{c.q?.d} pts above baseline
            </span>
          </div>
        ))}
      </div>
      <FeedbackBullets items={transformFeedback(feedback)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack accordion content
// ---------------------------------------------------------------------------
function stackTypeLabel(g) {
  if (g.both) return 'bring-back stack';
  if (g.t1?.length > 0 && g.t2?.length > 0) return 'two-sided game stack';
  return 'game stack';
}

function StackDetail({ detail, feedback }) {
  if (!detail) return null;
  const {
    qbTierBonus, teamStackBonus, w17GameBonus, w16GameBonus, w15GameBonus,
    w17GameStackDetails, w16StackDetails, w15StackDetails, bothQbsStacked, teamStackDetails,
  } = detail;

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
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400">Team Stacks</p>
          {teamStackDetails.map((s, i) => (
            <div key={i} className="text-xs bg-slate-800/40 rounded px-2 py-1.5">
              <span className="text-slate-600 uppercase tracking-wider text-[10px] font-semibold mr-2">
                team stack
              </span>
              <span className="text-slate-300">
                {s.qb} ({s.team}) + {s.partners.join(', ')}
              </span>
            </div>
          ))}
        </div>
      )}
      {w17GameStackDetails?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400">Week 17 Game Stacks</p>
          {w17GameStackDetails.map((g, i) => (
            <div key={i} className="text-xs bg-slate-800/40 rounded px-2 py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${
                  g.tier === 'S' ? 'text-green-400' :
                  g.tier === 'A' ? 'text-blue-400' :
                  g.tier === 'B' ? 'text-yellow-400' : 'text-slate-400'
                }`}>[{g.tier}]</span>
                <span className="text-white font-medium">{g.game}</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
                  {stackTypeLabel(g)}
                </span>
                <span className="ml-auto text-green-400 font-semibold">+{g.bonus}</span>
              </div>
              {g.t1?.length > 0 && <p className="text-slate-400 mt-0.5 pl-1">Side 1: {g.t1.join(', ')}</p>}
              {g.t2?.length > 0 && <p className="text-slate-400 pl-1">Side 2: {g.t2.join(', ')}</p>}
              {g.both && <p className="text-green-400/70 pl-1">✓ Bring-back detected</p>}
            </div>
          ))}
        </div>
      )}
      {((w16StackDetails?.length > 0) || (w15StackDetails?.length > 0)) && (
        <details className="text-xs">
          <summary className="text-slate-500 cursor-pointer hover:text-slate-400 transition-colors select-none py-1">
            Week 15 / 16 Stacks ({(w16StackDetails?.length ?? 0) + (w15StackDetails?.length ?? 0)} games)
          </summary>
          <div className="mt-2 space-y-1 pl-2">
            {w16StackDetails?.map((g, i) => (
              <div key={`w16-${i}`} className="text-slate-400 flex justify-between bg-slate-800/30 rounded px-2 py-1">
                <span>W16 · {g.game} [{g.tier}]</span>
                <span className="text-green-400">+{g.bonus}</span>
              </div>
            ))}
            {w15StackDetails?.map((g, i) => (
              <div key={`w15-${i}`} className="text-slate-400 flex justify-between bg-slate-800/30 rounded px-2 py-1">
                <span>W15 · {g.game} [{g.tier}]</span>
                <span className="text-green-400">+{g.bonus}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <FeedbackBullets items={feedback} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boom Bust Balance accordion content
// ---------------------------------------------------------------------------
function BBBDetail({ feedback, floorScore, ceilingScore, bbbLabel }) {
  return (
    <div className="space-y-3">
      {(floorScore != null || ceilingScore != null) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800/60 rounded px-3 py-2">
            <p className="text-slate-400">Floor Score (40%)</p>
            <p className={`text-lg font-bold ${scoreColor(floorScore ?? 50)}`}>{floorScore ?? '—'}</p>
            <p className="text-slate-600 text-[10px] mt-0.5">RB1 timing · live players · TE depth</p>
          </div>
          <div className="bg-slate-800/60 rounded px-3 py-2">
            <p className="text-slate-400">Ceiling Score (60%)</p>
            <p className={`text-lg font-bold ${scoreColor(ceilingScore ?? 50)}`}>{ceilingScore ?? '—'}</p>
            <p className="text-slate-600 text-[10px] mt-0.5">W17 stacks (DR) · QB tier</p>
          </div>
        </div>
      )}
      {bbbLabel && (
        <p className="text-xs text-slate-400">
          Variance profile: <span className="text-white font-medium">{bbbLabel}</span>
        </p>
      )}
      <FeedbackBullets items={feedback} />
    </div>
  );
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
        Differentiation flag only — prior-year finalist concentration doesn't transfer.
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
    f.includes('Early draft') || f.includes('June draft') || f.includes('July draft') || f.includes('August draft') || f.includes('Late draft')
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
// Narrative block (Straight Talk only)
// ---------------------------------------------------------------------------
function NarrativeBlock({ narrative, accentColor }) {
  if (!narrative) return null;
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      borderLeft: `3px solid ${accentColor}`,
    }}>
      {/* Hook — single sentence, display font */}
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '17px',
        fontWeight: 700,
        color: 'var(--color-cream, #fdfaf5)',
        marginBottom: '10px',
        lineHeight: 1.3,
      }}>
        {narrative.hook}
      </p>
      {/* Body — analyst paragraph */}
      <p style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: narrative.weakness ? '10px' : 0,
      }}>
        {narrative.body}
      </p>
      {/* Weakness note — specific construction gap */}
      {narrative.weakness && (
        <p style={{
          fontSize: '13px',
          color: 'var(--color-text-light, #8a8aaa)',
          fontStyle: 'italic',
          marginTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '10px',
        }}>
          {narrative.weakness}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GradeDisplay
// ---------------------------------------------------------------------------
export default function GradeDisplay({ result, roster = [], onReset }) {
  if (!result) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-slate-400">No result to display.</p>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-4 text-sm transition-colors"
            style={{ color: 'var(--color-orange)' }}
          >
            ← Enter a roster
          </button>
        )}
      </div>
    );
  }

  const {
    overallGrade, overallScore,
    constructionScore, valueScore, stackScore, riskScore,
    bbbScore, floorScore, ceilingScore, bbbLabel,
    constructionFeedback, valueFeedback, stackFeedback, riskFeedback,
    constructionDetail, valueDetail, stackDetail,
    topStrengths, topWeaknesses,
    achievements, bbm6Context,
    archetype, archetypeInfo,
    gradeConfidence,
    strengthFlags, fragilityFlags,
  } = result;

  // Archetype accent color — drives narrative border + grade letter tint
  const accentColor = ARCHETYPE_ACCENT[archetype] || 'var(--color-blue-light)';

  const components = [
    { k: 'construction', label: 'Construction',      score: constructionScore, w: '30%' },
    { k: 'value',        label: 'Value',             score: valueScore,        w: '30%' },
    { k: 'stack',        label: 'Stack',             score: stackScore,        w: '25%' },
    { k: 'boomBust',     label: 'Boom Bust Balance', score: riskScore,         w: '15%' },
  ];

  // Generate narrative (needs roster; gracefully handles empty)
  const scores = {
    construction: constructionScore, value: valueScore,
    stack: stackScore, risk: riskScore, overall: overallScore,
  };
  const narrative = roster.length > 0
    ? generateNarrative(roster, scores, archetype, archetypeInfo, stackDetail)
    : null;

  // Combined feedback for Straight Talk — filter generic bullets, cap at 5
  const combinedFeedback = [
    ...(constructionFeedback || []),
    ...(valueFeedback || []),
    ...(stackFeedback || []),
    ...(riskFeedback || []),
  ];
  const takeawayBullets = filterTakeaways(combinedFeedback).slice(0, 5);

  // ── SIMPLE GRADE CARD (Straight Talk — no bars, archetype accent color) ──
  const SimpleGradeCard = (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
      <div className="flex flex-col items-center text-center py-2">
        {/* Dominant letter grade — 96px, archetype accent color, grade-reveal animation */}
        <div
          key={overallGrade}
          className="font-black leading-none mb-3 grade-letter"
          style={{ fontFamily: 'var(--font-display)', fontSize: '96px', lineHeight: 1, color: accentColor, filter: `drop-shadow(${getGradeGlow(overallScore)})` }}
        >
          {overallGrade}
        </div>
        <div
          className="text-slate-300 text-xl font-semibold mb-1.5"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <AnimatedScore target={overallScore} />
          <span className="text-slate-500 text-sm font-normal">/100</span>
        </div>
        <p className="text-slate-500 text-xs">
          BBM V+VI calibrated · 1.6M teams · 1,078 finalists
        </p>
        {gradeConfidence && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700"
                style={{ color: gradeConfidence === 'High' ? '#4ade80' : gradeConfidence === 'Medium' ? '#facc15' : '#94a3b8' }}>
            {gradeConfidence === 'High' ? '●' : gradeConfidence === 'Medium' ? '◐' : '○'} {gradeConfidence} confidence
          </span>
        )}
      </div>
      {riskFeedback && (
        <div className="mt-3 flex justify-center">
          <DraftDateBadge riskFeedback={riskFeedback} />
        </div>
      )}
    </div>
  );

  // ── FULL GRADE CARD (Nerd Report — bars in separate region) ──
  const FullGradeCard = (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 mb-4">
      <AchievementBadges achievements={achievements} />
      {achievements?.length > 0 && <div className="mb-4" />}

      <div className="flex items-center gap-5 mb-4">
        <div
          key={overallGrade}
          className="font-black leading-none flex-shrink-0 grade-letter"
          style={{ fontFamily: 'var(--font-display)', fontSize: '80px', lineHeight: 1, color: accentColor, filter: `drop-shadow(${getGradeGlow(overallScore)})` }}
        >
          {overallGrade}
        </div>
        <div>
          <div className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
            <AnimatedScore target={overallScore} />
            <span className="text-slate-500 text-sm font-normal">/100</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            BBM V+VI calibrated · 1.6M teams · 1,078 finalists
          </p>
          {gradeConfidence && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700"
                  style={{ color: gradeConfidence === 'High' ? '#4ade80' : gradeConfidence === 'Medium' ? '#facc15' : '#94a3b8' }}>
              {gradeConfidence === 'High' ? '●' : gradeConfidence === 'Medium' ? '◐' : '○'} {gradeConfidence} confidence
            </span>
          )}
        </div>
      </div>

      {/* Bars — separate region */}
      <div className="border-t border-slate-800 pt-4 space-y-2.5">
        {components.map(({ k, label, score }) => (
          <div key={k} className="flex items-center gap-3 text-sm">
            <Tooltip content={COMPONENT_TOOLTIPS[k]}>
              <span className="text-slate-400 w-24 flex-shrink-0 cursor-help border-b border-dashed border-slate-700/60">
                {label}
              </span>
            </Tooltip>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${score}%`,
                  background: getHeatGradient(score),
                  boxShadow: getHeatGlow(score),
                  transition: 'width 0.6s ease-out',
                }}
              />
            </div>
            <span
              className={`text-xs font-semibold w-8 text-right ${scoreColor(score)}`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {score}
            </span>
          </div>
        ))}
      </div>

      {/* How calculated */}
      <details className="mt-4">
        <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors select-none">
          How is this grade calculated?
        </summary>
        <div className="mt-2 pl-3 border-l-2 border-slate-800 space-y-1">
          {components.map(({ label, w }) => (
            <div key={label} className="flex justify-between text-xs text-slate-500">
              <span>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{w} weight</span>
            </div>
          ))}
          <p className="text-xs text-slate-600 italic mt-1">
            Weights calibrated from BBM V+VI finalist advance rates.
          </p>
        </div>
      </details>

      {riskFeedback && (
        <div className="mt-3">
          <DraftDateBadge riskFeedback={riskFeedback} />
        </div>
      )}
    </div>
  );

  // ── STRAIGHT TALK TAB ──
  // Order: archetype → achievements → grade card → narrative → takeaways → strengths/weaknesses
  const StraightTalk = (
    <div className="space-y-4">
      {archetype && (
        <ArchetypeCard
          archetype={archetype}
          tagline={archetypeInfo?.tagline}
          description={archetypeInfo?.description}
          showFull={false}
        />
      )}

      {/* Achievement badges as separate row */}
      {achievements?.length > 0 && <AchievementBadges achievements={achievements} />}

      {/* Grade card — no bars */}
      {SimpleGradeCard}

      {/* Change 4: Strength + Fragility flag pills */}
      {((strengthFlags?.length > 0) || (fragilityFlags?.length > 0)) && (
        <div className="space-y-2">
          {strengthFlags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {strengthFlags.map(f => (
                <Tooltip
                  key={f.id}
                  content={
                    <div style={{ minWidth: '180px', maxWidth: '240px' }}>
                      <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {f.source} signal
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', lineHeight: 1.5 }}>
                        {f.detail}
                      </div>
                    </div>
                  }
                >
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help"
                    style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80' }}
                  >
                    ✦ {f.label}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
          {fragilityFlags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fragilityFlags.map(f => (
                <Tooltip
                  key={f.id}
                  content={
                    <div style={{ minWidth: '180px', maxWidth: '240px' }}>
                      <div style={{ color: '#f87171', fontSize: '11px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {f.source} signal
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', lineHeight: 1.5 }}>
                        {f.detail}
                      </div>
                    </div>
                  }
                >
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help"
                    style={{ backgroundColor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}
                  >
                    ⚠ {f.label}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Improvement suggestion — actionable "path to a better grade" */}
      {result.improvementSuggestion && (
        <div style={{
          marginTop: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
          padding: '16px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(126,200,227,0.10), rgba(126,200,227,0.04))',
          border: '1px solid rgba(126,200,227,0.35)',
          boxShadow: '0 0 12px rgba(126,200,227,0.10)',
        }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-blue-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span>↗</span> Your Path to a Better Grade
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--color-cream)',
            marginBottom: '6px',
            fontFamily: 'var(--font-display)',
          }}>
            {result.improvementSuggestion.headline}
          </div>
          <div style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.75)',
          }}>
            {result.improvementSuggestion.detail}
          </div>

          {/* Placeholder slot for future analyst-informed note — renders nothing now */}
          {result.improvementSuggestion.analystNote && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.75)',
            }}>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-orange)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '4px',
              }}>
                Analyst Lens
              </span>
              {result.improvementSuggestion.analystNote}
            </div>
          )}
        </div>
      )}

      {/* Narrative paragraph */}
      <NarrativeBlock narrative={narrative} accentColor={accentColor} />

      {/* Key Takeaways — roster-specific bullets only */}
      {takeawayBullets.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Key Takeaways
          </h3>
          <FeedbackList items={takeawayBullets} accentColor="var(--color-blue-light)" />
        </div>
      )}

      {/* Strengths & Watch Outs */}
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
              Watch Outs
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

      <BBM6ChalkAlert bbm6Context={bbm6Context} />
    </div>
  );

  // ── NERD REPORT TAB ──
  const NerdReport = (
    <div className="space-y-4">
      {archetype && (
        <ArchetypeCard
          archetype={archetype}
          tagline={archetypeInfo?.tagline}
          description={archetypeInfo?.description}
          showFull={true}
        />
      )}

      {FullGradeCard}

      {/* Change 4: Full Flag Report */}
      {((strengthFlags?.length > 0) || (fragilityFlags?.length > 0)) && (
        <details className="border border-slate-700 rounded-lg overflow-hidden">
          <summary className="flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 transition-colors cursor-pointer select-none">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              🚩 Full Flag Report
              <span className="text-xs font-normal text-slate-500">
                {(strengthFlags?.length || 0)} strength{(strengthFlags?.length || 0) !== 1 ? 's' : ''} · {(fragilityFlags?.length || 0)} fragilit{(fragilityFlags?.length || 0) !== 1 ? 'ies' : 'y'}
              </span>
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 py-3 bg-slate-900/60 space-y-4">
            {strengthFlags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Strengths</p>
                <div className="space-y-2.5">
                  {strengthFlags.map(f => (
                    <div key={f.id} className="flex gap-3 text-xs">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✦</span>
                      <div>
                        <span className="text-green-200 font-semibold">{f.label}</span>
                        <span className="text-slate-600 ml-2 text-[10px] uppercase tracking-wider font-medium">{f.source}</span>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fragilityFlags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Fragilities</p>
                <div className="space-y-2.5">
                  {fragilityFlags.map(f => (
                    <div key={f.id} className="flex gap-3 text-xs">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                      <div>
                        <span className="text-red-200 font-semibold">{f.label}</span>
                        <span className="text-slate-600 ml-2 text-[10px] uppercase tracking-wider font-medium">{f.source}</span>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

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
        <Accordion title="Boom Bust Balance" icon="⚖️">
          <BBBDetail
            feedback={riskFeedback}
            floorScore={floorScore}
            ceilingScore={ceilingScore}
            bbbLabel={bbbLabel}
          />
        </Accordion>
      </div>

      <BBM6ChalkAlert bbm6Context={bbm6Context} />

      {/* Data source legend */}
      <div className="border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-0.5">
        <p className="text-slate-500 font-semibold mb-1">Data Sources</p>
        <p>Calibrated from BBM V + VI (2024–2025) · 1,078 finalist rosters · 1.6M total entries</p>
        <p>Score weights: 60% BBM VI / 40% BBM V · Recalibrated annually</p>
        <p>Not affiliated with Underdog Fantasy</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <TabLayout tabs={[
        { id: 'straight-talk', label: 'Straight Talk', content: StraightTalk },
        { id: 'nerd-report',   label: 'Nerd Report',   content: NerdReport   },
      ]} />

      {onReset && (
        <div className="pt-2">
          <button
            onClick={onReset}
            className="w-full py-2.5 text-sm border rounded-lg transition-colors text-slate-400 hover:text-white border-slate-700 hover:border-slate-500"
          >
            ← Grade Another Team
          </button>
        </div>
      )}
    </div>
  );
}
