/**
 * RosterSummary.jsx
 * Compact read-only roster display (by position) shown after analysis replaces the full input form.
 */

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE'];

const POSITION_COLORS = {
  QB: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  RB: { bg: 'rgba(52,211,153,0.12)', text: '#34d399' },
  WR: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa' },
  TE: { bg: 'rgba(244,114,182,0.12)', text: '#f472b6' },
};

export default function RosterSummary({ roster, onEdit }) {
  // Group by position
  const byPos = {};
  POSITION_ORDER.forEach(pos => { byPos[pos] = []; });
  const ungrouped = [];

  (roster || []).forEach(p => {
    if (!p.name?.trim()) return;
    if (byPos[p.position] !== undefined) {
      byPos[p.position].push(p);
    } else {
      ungrouped.push(p);
    }
  });

  const totalFilled = (roster || []).filter(p => p.name?.trim()).length;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-300" style={{ fontFamily: 'var(--font-display)' }}>
            Your Roster
          </h3>
          <p className="text-slate-600 text-xs mt-0.5">{totalFilled} picks entered</p>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-green-400 hover:text-green-300 transition-colors px-2 py-1
                       border border-green-900/60 hover:border-green-700 rounded-md"
          >
            Edit →
          </button>
        )}
      </div>

      {/* Position groups */}
      <div className="grid grid-cols-2 gap-4">
        {POSITION_ORDER.map(pos => {
          const players = byPos[pos];
          if (players.length === 0) return null;
          const { bg, text } = POSITION_COLORS[pos];
          return (
            <div key={pos}>
              {/* Position badge */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: bg, color: text }}
                >
                  {pos}
                </span>
                <span className="text-slate-600 text-xs">{players.length}</span>
              </div>
              {/* Players */}
              <ul className="space-y-0.5">
                {players.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate pr-2">{p.name}</span>
                    <span className="text-slate-600 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                      R{p.round}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Ungrouped (no position set) */}
      {ungrouped.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-600 mb-1">No position set</p>
          <ul className="space-y-0.5">
            {ungrouped.map((p, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{p.name}</span>
                <span className="text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>R{p.round}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
