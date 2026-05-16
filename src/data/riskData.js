/**
 * riskData.js
 * Risk signals for the Stackulator scoring engine.
 *
 * Dead zone RBs: Running backs in approximately rounds 8-12 who are backup/committee
 * backs unlikely to provide consistent week-winning upside in BBM formats.
 * This list targets players with split backfield roles or limited opportunity ceilings.
 *
 * NOTE: Update this list as the 2026 season approaches and depth charts clarify.
 */

// ---------------------------------------------------------------------------
// Dead zone RB list — these players incur a risk penalty when used as RB1 or RB2
// Format: { name, team, reason }
// ---------------------------------------------------------------------------
export const DEAD_ZONE_RBS = [
  // Round 8-9 committee/backup types
  { name: 'Blake Corum',              team: 'LAR', reason: 'Backup to Kyren Williams' },
  { name: 'Rico Dowdle',              team: 'PIT', reason: 'Committee back in run-heavy offense' },
  { name: 'Kyle Monangai',            team: 'CHI', reason: 'Committee role behind D\'Andre Swift' },
  { name: 'J.K. Dobbins',             team: 'DEN', reason: 'Injury history, committee risk' },

  // Round 10-11 committee/backup types
  { name: 'Jacory Croskey-Merritt',   team: 'WAS', reason: 'Backup/committee role' },
  { name: 'Chris Rodriguez',          team: 'JAX', reason: 'Deep backup, limited opportunity' },
  { name: 'Kenneth Gainwell',         team: 'TB',  reason: 'Career committee back, limited upside' },
  { name: 'Jordan Mason',             team: 'MIN', reason: 'Backup to Aaron Jones/Jordan Mason split' },
  { name: 'Rachaad White',            team: 'WAS', reason: 'Committee back, TD-dependent' },
  { name: 'Jonathon Brooks',          team: 'CAR', reason: 'Injury recovery, limited floor' },
  { name: 'Zach Charbonnet',          team: 'SEA', reason: 'Committee situation' },

  // Round 11-12 high-injury-risk players
  { name: 'Aaron Jones',              team: 'MIN', reason: 'Age + injury risk in committee' },
  { name: 'Tyrone Tracy',             team: 'NYG', reason: 'Backup, volume inconsistent' },
];

// ---------------------------------------------------------------------------
// Late RB1 thresholds
// If your FIRST RB was taken in round X or later, you lack a true bell-cow
// ---------------------------------------------------------------------------
export const LATE_RB1_THRESHOLDS = {
  safe:     { maxRound: 2,  penalty: 0,   label: 'True bell-cow RB1 (Round 1-2)' },
  slight:   { maxRound: 4,  penalty: -5,  label: 'Decent RB1 (Round 3-4)' },
  moderate: { maxRound: 6,  penalty: -10, label: 'Questionable RB1 (Round 5-6)' },
  late:     { maxRound: 99, penalty: -15, label: 'No true RB1 (Round 7+)' },
};

/** Return the penalty tier for an RB1 based on the round it was drafted */
export function getRB1Penalty(round) {
  if (round <= 2) return LATE_RB1_THRESHOLDS.safe;
  if (round <= 4) return LATE_RB1_THRESHOLDS.slight;
  if (round <= 6) return LATE_RB1_THRESHOLDS.moderate;
  return LATE_RB1_THRESHOLDS.late;
}

// ---------------------------------------------------------------------------
// Injury / suspension risk flags (placeholder — expand as news emerges)
// These add to the risk display but don't affect numerical scoring yet
// ---------------------------------------------------------------------------
export const RISK_FLAGS = {
  injury: [
    'Christian McCaffrey',
    'Zach Charbonnet',
    'Jonathon Brooks',
    'J.K. Dobbins',
  ],
  suspension: [],
  holdout:    [],
};

/** Check if a player name appears in any risk flag category */
export function getRiskFlags(playerName) {
  const flags = [];
  if (!playerName) return flags;
  const name = playerName.toLowerCase();
  if (RISK_FLAGS.injury.some(p => p.toLowerCase() === name))     flags.push('Injury risk');
  if (RISK_FLAGS.suspension.some(p => p.toLowerCase() === name)) flags.push('Suspension risk');
  if (RISK_FLAGS.holdout.some(p => p.toLowerCase() === name))    flags.push('Holdout risk');
  return flags;
}

/** Return true if the player is a dead zone RB */
export function isDeadZoneRB(playerName) {
  if (!playerName) return false;
  return DEAD_ZONE_RBS.some(p => p.name.toLowerCase() === playerName.toLowerCase());
}
