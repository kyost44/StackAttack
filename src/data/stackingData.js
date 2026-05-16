/**
 * stackingData.js
 * Week 17 game tier data and QB stack tier classifications for BBM7 (2026 season).
 *
 * Week 17 game tiers are based on projected game environment:
 *   implied total, game importance, offensive coaching quality.
 * S = elite shootout environment, A = strong game, B = good game,
 * C = moderate game, D = low-ceiling or meaningless game.
 *
 * NOTE: 2026 NFL Week 17 schedule releases in May 2026.
 * Update WEEK17_GAMES once official lines/totals are available.
 */

// ---------------------------------------------------------------------------
// Week 17 game tiers (placeholder — update with final schedule + totals)
// Key: "TEAM1-TEAM2" (alphabetical order) or "TEAM" (single team lookup)
// Each entry has: tier, impliedTotal, teams, label
// ---------------------------------------------------------------------------
export const WEEK17_GAMES = [
  // S-tier: elite offense vs elite offense, implied team total 28+
  { tier: 'S', teams: ['BUF', 'KC'],  label: 'Bills vs Chiefs',       impliedTotal: 56 },
  { tier: 'S', teams: ['CIN', 'PHI'], label: 'Bengals vs Eagles',     impliedTotal: 54 },
  { tier: 'S', teams: ['DET', 'BAL'], label: 'Lions vs Ravens',       impliedTotal: 55 },

  // A-tier: high-ceiling game, implied total 48-53
  { tier: 'A', teams: ['LAR', 'SF'],  label: 'Rams vs 49ers',        impliedTotal: 52 },
  { tier: 'A', teams: ['WAS', 'DAL'], label: 'Commanders vs Cowboys',impliedTotal: 51 },
  { tier: 'A', teams: ['MIN', 'GB'],  label: 'Vikings vs Packers',   impliedTotal: 50 },
  { tier: 'A', teams: ['MIA', 'NO'],  label: 'Dolphins vs Saints',   impliedTotal: 50 },
  { tier: 'A', teams: ['HOU', 'IND'], label: 'Texans vs Colts',      impliedTotal: 49 },

  // B-tier: good but not elite game environments
  { tier: 'B', teams: ['SEA', 'LAC'], label: 'Seahawks vs Chargers', impliedTotal: 47 },
  { tier: 'B', teams: ['ATL', 'TB'],  label: 'Falcons vs Buccaneers',impliedTotal: 47 },
  { tier: 'B', teams: ['CHI', 'NE'],  label: 'Bears vs Patriots',    impliedTotal: 46 },
  { tier: 'B', teams: ['ARI', 'DEN'], label: 'Cardinals vs Broncos', impliedTotal: 45 },
  { tier: 'B', teams: ['NYJ', 'LV'],  label: 'Jets vs Raiders',      impliedTotal: 44 },

  // C-tier: moderate game environments
  { tier: 'C', teams: ['CAR', 'TEN'], label: 'Panthers vs Titans',   impliedTotal: 42 },
  { tier: 'C', teams: ['JAX', 'CLE'], label: 'Jaguars vs Browns',    impliedTotal: 40 },
  { tier: 'C', teams: ['NYG', 'PIT'], label: 'Giants vs Steelers',   impliedTotal: 40 },

  // D-tier: low totals or potential meaningless games
  { tier: 'D', teams: ['WAS', 'NYG'], label: 'Commanders vs Giants', impliedTotal: 38 },
];

// ---------------------------------------------------------------------------
// Tier score bonuses for game stack detection
// ---------------------------------------------------------------------------
export const GAME_TIER_BONUS = {
  S: 25,
  A: 20,
  B: 15,
  C: 10,
  D: 5,
};

// ---------------------------------------------------------------------------
// QB stack tier classifications (based on 2026 BBM7 ADP / projected points)
// ELITE = top-3 QB ADP, STRONG = QB4-7, VIABLE = QB8-14, WEAK = QB15+
// ---------------------------------------------------------------------------
export const QB_STACK_TIERS = {
  ELITE: {
    players: ['Josh Allen', 'Lamar Jackson', 'Joe Burrow'],
    teams:   ['BUF',        'BAL',           'CIN'],
    bonus: 20,
    label: 'Elite',
  },
  STRONG: {
    players: ['Jayden Daniels', 'Jalen Hurts', 'Caleb Williams', 'Drake Maye'],
    teams:   ['WAS',            'PHI',         'CHI',            'NE'],
    bonus: 15,
    label: 'Strong',
  },
  VIABLE: {
    players: [
      'Dak Prescott', 'Trevor Lawrence', 'Justin Herbert', 'Jaxson Dart',
      'Patrick Mahomes', 'Brock Purdy', 'Bo Nix',
    ],
    teams: ['DAL', 'JAX', 'LAC', 'NYG', 'KC', 'SF', 'DEN'],
    bonus: 10,
    label: 'Viable',
  },
  WEAK: {
    // Everyone else — still better than no QB stack
    bonus: 5,
    label: 'Weak',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Given a player name, return their QB stack tier key or null. */
export function getQBTier(playerName) {
  for (const [tier, data] of Object.entries(QB_STACK_TIERS)) {
    if (tier === 'WEAK') continue;
    if (data.players.some(p => p.toLowerCase() === playerName.toLowerCase())) {
      return tier;
    }
  }
  return 'WEAK';
}

/** Given an NFL team abbreviation, find the Week 17 game entry (or null). */
export function getWeek17Game(teamAbbr) {
  if (!teamAbbr) return null;
  return WEEK17_GAMES.find(g => g.teams.includes(teamAbbr.toUpperCase())) || null;
}

/** Return the opposing team in a Week 17 matchup for a given team. */
export function getOpponent(teamAbbr) {
  const game = getWeek17Game(teamAbbr);
  if (!game) return null;
  return game.teams.find(t => t !== teamAbbr.toUpperCase()) || null;
}
