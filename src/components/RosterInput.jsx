/**
 * RosterInput.jsx
 * 18-row draft roster entry table with player autocomplete + optional draft date.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import playerReference from '../data/player_reference_2026.json';

const PLAYERS = playerReference.players || [];
const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const NFL_TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB','HOU','IND','JAX','KC',
  'LAC','LAR','LV','MIA','MIN','NE','NO','NYG',
  'NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS',
];

const emptyPick = (round) => ({
  id: round,
  round,
  name: '',
  team: '',
  position: '',
  adp: '',
  overall_pick: (round - 1) * 12 + 6,
});

const initRoster = () => Array.from({ length: 18 }, (_, i) => emptyPick(i + 1));

// ---------------------------------------------------------------------------
// Autocomplete dropdown
// ---------------------------------------------------------------------------
function AutocompleteInput({ value, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef(null);

  const filtered = query.length < 2
    ? []
    : PLAYERS.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); };
  const handleSelect = (player) => { setQuery(player.name); onSelect(player); setOpen(false); };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => query.length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
                   text-white placeholder-slate-500 focus:outline-none focus:border-green-500
                   focus:ring-1 focus:ring-green-500/50 transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 w-56 mt-0.5 bg-slate-800 border border-slate-600
                        rounded shadow-xl overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.name}
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 transition-colors"
            >
              <span className="text-white text-sm font-medium">{p.name}</span>
              <span className="ml-2 text-slate-400 text-xs">{p.position} · {p.nfl_team} · R{p.round}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RosterInput component
// ---------------------------------------------------------------------------
export default function RosterInput({ onAnalyze }) {
  const [roster, setRoster] = useState(initRoster);
  const [draftDate, setDraftDate] = useState('');
  const [loading, setLoading] = useState(false);

  const updatePick = useCallback((round, field, val) => {
    setRoster(prev => prev.map(p => p.round === round ? { ...p, [field]: val } : p));
  }, []);

  const handlePlayerSelect = useCallback((round, playerObj) => {
    setRoster(prev =>
      prev.map(p =>
        p.round === round
          ? { ...p, name: playerObj.name, team: playerObj.nfl_team, position: playerObj.position, adp: playerObj.adp, overall_pick: playerObj.overall }
          : p
      )
    );
  }, []);

  const handleAnalyze = () => {
    const filled = roster.filter(p => p.name.trim() !== '');
    if (filled.length < 5) {
      alert('Please enter at least 5 players before analyzing.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const options = draftDate ? { draftDate } : {};
      onAnalyze(filled, options);
      setLoading(false);
    }, 100);
  };

  const handleClear = () => { setRoster(initRoster()); setDraftDate(''); };

  const filledCount = roster.filter(p => p.name.trim() !== '').length;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Enter Your Roster</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Type a player name to autocomplete · All fields are editable
          </p>
        </div>
        <div className="text-sm text-slate-500">{filledCount}/18 picks</div>
      </div>

      {/* Draft date row */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="draft-date" className="text-sm text-slate-400 flex-shrink-0 min-w-[10rem]">
            Draft Date <span className="text-slate-600">(optional)</span>
          </label>
          <div className="flex flex-col gap-1 flex-1">
            <input
              id="draft-date"
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white
                         focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50
                         transition-colors w-full sm:w-48 cursor-pointer"
            />
            <p className="text-slate-600 text-xs">
              Helps calibrate live player timing bonus. Leave blank if drafting today.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="text-left px-3 py-2 text-slate-400 font-medium w-12">Rd</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Player</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium w-24">Team</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium w-24">Pos</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium w-24">ADP</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((pick) => (
              <tr
                key={pick.round}
                className={`border-b border-slate-800 ${pick.name ? 'bg-slate-900' : 'bg-slate-900/50'} hover:bg-slate-800/40 transition-colors`}
              >
                <td className="px-3 py-1.5">
                  <span className="text-slate-500 text-xs font-mono">{pick.round}</span>
                </td>
                <td className="px-2 py-1">
                  <AutocompleteInput
                    value={pick.name}
                    onChange={(v) => updatePick(pick.round, 'name', v)}
                    onSelect={(p) => handlePlayerSelect(pick.round, p)}
                    placeholder={`Round ${pick.round} pick…`}
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={pick.team}
                    onChange={(e) => updatePick(pick.round, 'team', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
                               text-white focus:outline-none focus:border-green-500 transition-colors"
                  >
                    <option value="">—</option>
                    {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={pick.position}
                    onChange={(e) => updatePick(pick.round, 'position', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
                               text-white focus:outline-none focus:border-green-500 transition-colors"
                  >
                    <option value="">—</option>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={pick.adp}
                    onChange={(e) => updatePick(pick.round, 'adp', parseFloat(e.target.value) || '')}
                    placeholder="—"
                    step="0.1"
                    min="1"
                    max="216"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
                               text-white placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700
                     hover:border-slate-500 rounded-lg transition-colors"
        >
          Clear
        </button>
        <div className="flex items-center gap-3">
          {filledCount > 0 && filledCount < 18 && (
            <span className="text-slate-500 text-xs">{18 - filledCount} picks remaining</span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading || filledCount < 5}
            className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all
              ${filledCount >= 5
                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30 cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
              ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? 'Analyzing…' : 'Analyze Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
