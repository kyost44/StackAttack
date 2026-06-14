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
  pickNumber: null,
});

const initRoster = () => Array.from({ length: 18 }, (_, i) => emptyPick(i + 1));

// ---------------------------------------------------------------------------
// Autocomplete dropdown
// ---------------------------------------------------------------------------
function AutocompleteInput({ value, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const filtered = query.length < 2
    ? []
    : PLAYERS.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  useEffect(() => { setQuery(value || ''); }, [value]);

  // Reset active index when dropdown opens/closes or list changes
  useEffect(() => { setActiveIndex(-1); }, [open, filtered.length]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); };
  const handleSelect = (player) => { setQuery(player.name); onSelect(player); setOpen(false); };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          handleSelect(filtered[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          e.preventDefault();
          handleSelect(filtered[activeIndex]);
        } else {
          setOpen(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => query.length >= 2 && setOpen(true)}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `ac-item-${activeIndex}` : undefined}
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
                   text-white placeholder-slate-500 focus:outline-none focus:border-green-500
                   focus:ring-1 focus:ring-green-500/50 transition-colors"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 top-full left-0 w-56 mt-0.5 bg-slate-800 border border-slate-600
                      rounded shadow-xl overflow-hidden"
        >
          {filtered.map((p, i) => (
            <button
              key={p.name}
              id={`ac-item-${i}`}
              role="option"
              aria-selected={activeIndex === i}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-3 py-1.5 transition-colors
                ${activeIndex === i ? 'bg-slate-700' : 'hover:bg-slate-700/60'}`}
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
  const [draftPosition, setDraftPosition] = useState(1);
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [animatingRounds, setAnimatingRounds] = useState(new Set());

  // Change 1 (this session): BBM7 is a 12-team snake draft.
  // Odd rounds: (round-1)*DRAFT_SIZE + seat; Even rounds: round*DRAFT_SIZE - seat + 1
  // Does not overwrite picks marked as manually entered (_pickManual: true).
  const DRAFT_SIZE = 12;
  useEffect(() => {
    if (!draftPosition) return;
    setRoster(prev => prev.map(pick => {
      if (pick._pickManual) return pick;
      const pn = pick.round % 2 === 1
        ? (pick.round - 1) * DRAFT_SIZE + draftPosition
        : pick.round * DRAFT_SIZE - draftPosition + 1;
      return { ...pick, pickNumber: pn };
    }));
  }, [draftPosition]);

  const updatePick = useCallback((round, field, val) => {
    setRoster(prev => prev.map(p => {
      if (p.round !== round) return p;
      const update = { ...p, [field]: val };
      if (field === 'pickNumber') update._pickManual = true;
      return update;
    }));
  }, []);

  const handlePlayerSelect = useCallback((round, playerObj) => {
    setRoster(prev =>
      prev.map(p =>
        p.round === round
          ? { ...p, name: playerObj.name, team: playerObj.nfl_team, position: playerObj.position, adp: playerObj.adp, overall_pick: playerObj.overall, _pickManual: false }
          : p
      )
    );
    // Trigger pick-confirm row flash animation
    setAnimatingRounds(prev => new Set([...prev, round]));
    setTimeout(() => {
      setAnimatingRounds(prev => {
        const next = new Set(prev);
        next.delete(round);
        return next;
      });
    }, 800);
  }, []);

  const handleAnalyze = () => {
    // Strip internal _pickManual flag before passing to engine
    const filled = roster
      .filter(p => p.name.trim() !== '')
      // eslint-disable-next-line no-unused-vars
      .map(({ _pickManual, ...p }) => p);
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

  const handleClear = () => { setRoster(initRoster()); setDraftDate(''); setDraftPosition(1); setAnimatingRounds(new Set()); };

  const filledCount = roster.filter(p => p.name.trim() !== '').length;

  return (
    <div
      className="bg-slate-900 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255, 107, 53, 0.15)', boxShadow: '0 0 40px rgba(255, 107, 53, 0.05)' }}
    >
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

      {/* Draft options row — date + draft position */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Draft Date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="draft-date" className="text-sm text-slate-400">
              Draft Date <span className="text-slate-600">(optional)</span>
            </label>
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
              Helps calibrate live player timing bonus.
            </p>
          </div>
          {/* Draft Position — Change 4A */}
          <div className="flex flex-col gap-1">
            <label htmlFor="draft-position" className="text-sm text-slate-400">
              Draft Position <span className="text-slate-600">(optional)</span>
            </label>
            <select
              id="draft-position"
              value={draftPosition}
              onChange={(e) => setDraftPosition(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white
                         focus:outline-none focus:border-green-500 transition-colors w-full sm:w-40"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Seat {n} of 12</option>
              ))}
            </select>
            <p className="text-slate-600 text-xs">
              Auto-fills pick # via 12-team snake draft.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="text-left px-2 sm:px-3 py-2 text-slate-400 font-medium w-8 sm:w-12">Rd</th>
              <th className="text-left px-2 sm:px-3 py-2 text-slate-400 font-medium w-12 sm:w-16">Pick #</th>
              <th className="text-left px-2 sm:px-3 py-2 text-slate-400 font-medium">Player</th>
              <th className="text-left px-1 sm:px-3 py-2 text-slate-400 font-medium w-14 sm:w-24">Team</th>
              <th className="text-left px-1 sm:px-3 py-2 text-slate-400 font-medium w-12 sm:w-24">Pos</th>
              <th className="hidden sm:table-cell text-left px-3 py-2 text-slate-400 font-medium w-24">ADP</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((pick) => (
              <tr
                key={pick.round}
                className={`border-b border-slate-800 ${pick.name ? 'bg-slate-900' : 'bg-slate-900/50'} hover:bg-slate-800/40 transition-colors`}
                style={animatingRounds.has(pick.round) ? { animation: 'pick-confirm 0.8s ease forwards' } : undefined}
              >
                <td className="px-2 sm:px-3 py-1.5">
                  <span className="text-slate-500 text-xs font-mono">{pick.round}</span>
                </td>
                {/* Change 4B: Pick number cell — auto-filled or manually editable */}
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={pick.pickNumber ?? ''}
                    onChange={(e) => updatePick(pick.round, 'pickNumber', parseInt(e.target.value) || null)}
                    placeholder="—"
                    min="1"
                    max="216"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs
                               text-slate-300 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors font-mono"
                  />
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
                <td className="hidden sm:table-cell px-2 py-1">
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
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-700 flex items-center gap-3">
        <button
          onClick={handleClear}
          className="shrink-0 px-4 py-2.5 min-h-[44px] text-sm text-slate-400 hover:text-white border border-slate-700
                     hover:border-slate-500 rounded-lg transition-colors"
        >
          Clear
        </button>
        <div className="flex items-center gap-2 flex-1 justify-end">
          {filledCount > 0 && filledCount < 18 && (
            <span className="hidden sm:inline text-slate-500 text-xs">{18 - filledCount} picks remaining</span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading || filledCount < 5}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            className={`flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 rounded-lg font-semibold text-sm
              ${filledCount >= 5 ? 'cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
              ${loading ? 'opacity-50' : ''}`}
            style={filledCount >= 5 ? {
              background: btnHover
                ? 'linear-gradient(135deg, var(--color-orange-light), var(--color-gold-light))'
                : 'linear-gradient(135deg, var(--color-orange), var(--color-gold))',
              color: '#0f1520',
              boxShadow: btnHover
                ? '0 6px 20px rgba(255, 107, 53, 0.45), 0 2px 8px rgba(240, 192, 64, 0.2)'
                : '0 2px 12px rgba(255, 107, 53, 0.25)',
              transform: btnHover ? 'translateY(-1px)' : 'none',
              transition: 'all 0.15s ease',
            } : undefined}
          >
            {loading ? 'Analyzing…' : 'Analyze Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
