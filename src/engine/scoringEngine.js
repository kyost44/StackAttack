/**
 * scoringEngine.js
 * Stackulator grading engine for BBM7 best-ball rosters.
 *
 * Weights calibrated from ~1.6 million teams across BBM II-V and Best Bowl Mania.
 * Deltas represent advance-rate percentage-point swings vs the median bucket.
 * Positive delta = better than median, negative = worse.
 *
 * Final score = Construction×0.35 + Value×0.35 + Stack×0.20 + Risk×0.10
 * Each component is on a 0–100 scale.
 */

import {
  getWeek17Game,
  getOpponent,
  getQBTier,
  QB_STACK_TIERS,
  GAME_TIER_BONUS,
} from '../data/stackingData.js';
import {
  isDeadZoneRB,
  getRB1Penalty,
} from '../data/riskData.js';

// ---------------------------------------------------------------------------
// Calibration data (from bbm_scoring_weights.json)
// ---------------------------------------------------------------------------
const CALIBRATION = {
  baselineAdvanceRate: 15.53,

  construction: {
    WR_through_rd6: {
      0: -2.25, 1: -1.38, 2: -0.35, 3: 0.0, 4: -0.75, 5: -1.9, 6: -2.28,
    },
    WR_through_rd10: {
      0: -5.87, 1: -2.6, 2: -1.37, 3: -0.19, 4: 0.43, 5: 0.0,
      6: -0.63, 7: -1.87, 8: -5.31, 9: -7.62,
    },
    WR_through_rd18: {
      3: -11.62, 4: -5.37, 5: -1.87, 6: 0.21, 7: 0.64, 8: 0.0,
      9: -0.59, 10: -1.84, 11: -5.67, 12: -7.06,
    },
    RB_through_rd6: {
      0: -3.2, 1: -0.24, 2: 0.84, 3: 0.0, 4: -1.34, 5: -2.93, 6: -7.01,
    },
    RB_through_rd10: {
      0: -8.1, 1: -4.71, 2: -2.65, 3: -0.9, 4: 0.0,
      5: 0.25, 6: -2.94, 7: -8.1,
    },
    RB_through_rd18: {
      2: -10.56, 3: -3.95, 4: -0.35, 5: 0.44, 6: 0.0,
      7: -0.83, 8: -2.37, 9: -5.91,
    },
    QB_total: {
      1: -2.59, 2: 1.15, 3: 1.29, 4: 0.0, 5: 3.02, 6: 3.52,
    },
    TE_total: {
      1: -4.28, 2: -1.52, 3: 0.0, 4: -0.87, 5: -2.47,
    },
  },

  adpValue: {
    reached_heavily: 2.23,   // >10 picks early (paying big premium)
    reached_slightly: 3.31,  // 3–10 picks early (trusting the market +)
    near_adp: 0.0,            // within 3 picks either way
    good_value: -4.28,        // 3–15 picks late
    great_value: -9.68,       // 15+ picks late (massive value hunting)
  },

  // Positional capital quartile breakpoints (approx. from calibration percentiles)
  // [Q1_max, Q2_max, Q3_max] — values > Q3_max = Q4
  capitalQuartiles: {
    QB: [5.5, 10.0, 15.0],
    RB: [23.0, 33.0, 44.0],
    WR: [34.0, 44.0, 55.0],
    TE: [4.5, 9.0, 14.5],
  },

  // Positional investment advance-rate deltas by quartile
  // Q2 = baseline (0.0) for QB/RB; Q3 = optimal for WR/TE
  capitalDeltas: {
    QB: { Q1: -19.02, Q2: 0.0, Q3: -3.71, Q4: -20.08 },
    RB: { Q1: -14.87, Q2: 0.0, Q3: -3.44, Q4: -16.94 },
    WR: { Q1: -14.46, Q2: 0.0, Q3: 2.77,  Q4: -5.66  },
    TE: { Q1: -2.13,  Q2: 0.0, Q3: 8.58,  Q4: -10.5  },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to [min, max]. */
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** Look up a value in a delta table — clamp the key to the table's known range. */
function lookupDelta(table, rawKey) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const k = Math.max(keys[0], Math.min(keys[keys.length - 1], rawKey));
  // Exact match first
  if (table[k] !== undefined) return table[k];
  // Find nearest key
  let nearest = keys[0];
  for (const key of keys) {
    if (Math.abs(key - rawKey) < Math.abs(nearest - rawKey)) nearest = key;
  }
  return table[nearest];
}

/** Return 'Q1' | 'Q2' | 'Q3' | 'Q4' for a capital percentage. */
function getCapitalQuartile(pos, pct) {
  const [q1max, q2max, q3max] = CALIBRATION.capitalQuartiles[pos] || [25, 40, 55];
  if (pct <= q1max) return 'Q1';
  if (pct <= q2max) return 'Q2';
  if (pct <= q3max) return 'Q3';
  return 'Q4';
}

/**
 * Classify ADP deviation = (overall_pick - adp).
 * Negative deviation = you drafted the player BEFORE their ADP (reached).
 * Positive deviation = you drafted the player AFTER their ADP (got value).
 *
 * Counterintuitive finding from BBM II/III data:
 *   reached_slightly (3–10 picks early) → +3.31pp advance rate vs baseline
 *   great_value (15+ picks late) → -9.68pp (market efficiency punishes deep value)
 */
function classifyADPDeviation(deviation) {
  if (deviation <= -10) return 'reached_heavily';   // drafted 10+ before ADP
  if (deviation <= -3)  return 'reached_slightly';  // drafted 3–10 before ADP (optimal)
  if (deviation <= 3)   return 'near_adp';           // within ±3 of ADP
  if (deviation <= 15)  return 'good_value';         // drafted 3–15 after ADP
  return 'great_value';                              // drafted 15+ after ADP (worst)
}

// ---------------------------------------------------------------------------
// Component: Construction (35%)
// Measures roster shape vs empirically optimal BBM construction patterns.
//
// Method: 50 base. For each of 8 calibrated construction categories, look up
// the advance-rate delta for the roster's bucket. Apply a 2× multiplier
// (each 1pp of advance rate = 2 score points) then add to base.
// ---------------------------------------------------------------------------
function scoreConstruction(roster) {
  // Count positions by round cutoffs
  const picks = roster.filter(p => p.position && p.round);

  const rd6  = picks.filter(p => p.round <= 6);
  const rd10 = picks.filter(p => p.round <= 10);
  const all  = picks;

  const wrRd6  = rd6.filter(p => p.position === 'WR').length;
  const wrRd10 = rd10.filter(p => p.position === 'WR').length;
  const wrAll  = all.filter(p => p.position === 'WR').length;
  const rbRd6  = rd6.filter(p => p.position === 'RB').length;
  const rbRd10 = rd10.filter(p => p.position === 'RB').length;
  const rbAll  = all.filter(p => p.position === 'RB').length;
  const qbAll  = all.filter(p => p.position === 'QB').length;
  const teAll  = all.filter(p => p.position === 'TE').length;

  const deltas = [
    { cat: 'WR through Rd 6',  val: lookupDelta(CALIBRATION.construction.WR_through_rd6,  wrRd6) },
    { cat: 'WR through Rd 10', val: lookupDelta(CALIBRATION.construction.WR_through_rd10, wrRd10) },
    { cat: 'WR total',         val: lookupDelta(CALIBRATION.construction.WR_through_rd18, wrAll) },
    { cat: 'RB through Rd 6',  val: lookupDelta(CALIBRATION.construction.RB_through_rd6,  rbRd6) },
    { cat: 'RB through Rd 10', val: lookupDelta(CALIBRATION.construction.RB_through_rd10, rbRd10) },
    { cat: 'RB total',         val: lookupDelta(CALIBRATION.construction.RB_through_rd18, rbAll) },
    { cat: 'QB count',         val: lookupDelta(CALIBRATION.construction.QB_total,        qbAll) },
    { cat: 'TE count',         val: lookupDelta(CALIBRATION.construction.TE_total,        teAll) },
  ];

  const totalDelta = deltas.reduce((sum, d) => sum + d.val, 0);

  // 2:1 ratio: each 1pp advance-rate delta = 2 score points
  const score = clamp(50 + totalDelta * 2);

  return {
    score: Math.round(score),
    raw: {
      wrRd6, wrRd10, wrAll, rbRd6, rbRd10, rbAll, qbAll, teAll,
      deltas,
      totalDelta: Math.round(totalDelta * 10) / 10,
    },
  };
}

// ---------------------------------------------------------------------------
// Component: Value (35%)
// 50% based on ADP efficiency + 50% based on positional capital allocation.
//
// ADP efficiency: counterintuitive finding — slightly reaching (+3.31pp)
// outperforms heavy value-hunting (-9.68pp). Explanation: ADP reflects quality.
// Reaching = buying known-good players. Deep value = gambling on sleepers.
//
// Capital allocation: how much draft "spend" went to each position.
// Optimal: QB in Q2, RB in Q2, WR in Q3, TE in Q3.
// ---------------------------------------------------------------------------
function scoreValue(roster) {
  const picks = roster.filter(p => p.position && p.round && p.adp);

  // --- ADP efficiency component ---
  let adpDeltaSum = 0;
  let adpCount = 0;
  const adpBreakdown = [];

  for (const pick of picks) {
    const adpOverall = pick.adp; // Underdog BBM overall ADP
    // Estimate overall pick from round if not provided (mid-round = slot 6 in 12-team)
    const estimatedOverall = (pick.round - 1) * 12 + 6;
    const actualOverall = pick.overall_pick ?? estimatedOverall;
    // deviation = actual_pick - adp: negative = reached, positive = got value
    const deviation = actualOverall - adpOverall;
    const bucket = classifyADPDeviation(deviation);
    const delta = CALIBRATION.adpValue[bucket];
    adpDeltaSum += delta;
    adpCount++;
    adpBreakdown.push({ name: pick.player, deviation: Math.round(deviation * 10) / 10, bucket, delta });
  }

  const avgADPDelta = adpCount > 0 ? adpDeltaSum / adpCount : 0;
  // Scale: neutral = 50, ±10pp delta range → ±20 score points
  const adpScore = clamp(50 + avgADPDelta * 2);

  // --- Positional capital component ---
  const totalCapital = picks.reduce((sum, p) => sum + (19 - p.round), 0) || 1;

  const capitalByPos = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const pick of picks) {
    const pos = pick.position;
    if (capitalByPos[pos] !== undefined) {
      capitalByPos[pos] += (19 - pick.round);
    }
  }

  const capitalPct = {};
  const capitalDetails = [];
  let capitalDeltaSum = 0;

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const pct = (capitalByPos[pos] / totalCapital) * 100;
    const quartile = getCapitalQuartile(pos, pct);
    const delta = CALIBRATION.capitalDeltas[pos][quartile];
    capitalPct[pos] = Math.round(pct * 10) / 10;
    capitalDeltaSum += delta;
    capitalDetails.push({ pos, pct: Math.round(pct * 10) / 10, quartile, delta });
  }

  // Scale: 0 total delta = 50, max negative ~-55pp → score near 0, max positive ~+15pp → score ~65
  const capitalScore = clamp(50 + capitalDeltaSum * 1.5);

  const valueScore = (adpScore * 0.5) + (capitalScore * 0.5);

  return {
    score: Math.round(valueScore),
    raw: {
      adpScore: Math.round(adpScore),
      capitalScore: Math.round(capitalScore),
      avgADPDelta: Math.round(avgADPDelta * 10) / 10,
      adpBreakdown: adpBreakdown.slice(0, 5), // top 5 most extreme picks
      capitalDetails,
    },
  };
}

// ---------------------------------------------------------------------------
// Component: Stack (20%)
// Rewards teams built around a QB + correlated Week 17 assets.
//
// Base: 30 points
// QB quality tier: ELITE +20, STRONG +15, VIABLE +10, WEAK +5, none +0
// Team stack (QB + pass catchers from same team): +7 per player, max +21
// Game stack (QB + player from opposing Week 17 team): tier-based bonus
// Bring-back (WR/TE from opposing team, not direct stack): +5
// ---------------------------------------------------------------------------
function scoreStack(roster) {
  const picks = roster.filter(p => p.position && p.team);
  const qbs = picks.filter(p => p.position === 'QB');

  // Find primary QB (earliest round)
  const primaryQB = qbs.sort((a, b) => (a.round || 99) - (b.round || 99))[0] || null;

  let base = 30;
  let qbBonus = 0;
  let teamStackBonus = 0;
  let gameStackBonus = 0;
  let stackNotes = [];
  let stackedPlayers = [];

  if (!primaryQB) {
    // No QB — no stack scoring beyond base
    return {
      score: Math.round(clamp(base)),
      raw: { noQB: true, stackNotes: ['No QB on roster — stack score severely penalized.'] },
    };
  }

  // QB quality bonus
  const qbTier = getQBTier(primaryQB.player);
  const tierData = QB_STACK_TIERS[qbTier];
  qbBonus = tierData.bonus;
  stackNotes.push(`${primaryQB.player} (${tierData.label} QB) — +${qbBonus} pts`);

  // Team stack: pass catchers from same team as primary QB
  const qbTeam = primaryQB.team?.toUpperCase();
  const teammates = picks.filter(
    p => p.team?.toUpperCase() === qbTeam &&
         p.position !== 'QB' &&
         ['WR', 'TE', 'RB'].includes(p.position)
  );

  const stackCount = teammates.length;
  teamStackBonus = Math.min(stackCount * 7, 21);
  if (stackCount > 0) {
    stackedPlayers = teammates.map(p => `${p.player} (${p.position})`);
    stackNotes.push(
      `Team stack: ${stackCount} ${qbTeam} skill player${stackCount > 1 ? 's' : ''} — +${teamStackBonus} pts`
    );
  } else {
    stackNotes.push(`No same-team stack with ${primaryQB.player}`);
  }

  // Game stack: QB + player from opposing Week 17 team
  const opponent = getOpponent(qbTeam);
  const week17Game = getWeek17Game(qbTeam);

  if (opponent && week17Game) {
    const gamePlayers = picks.filter(
      p => p.team?.toUpperCase() === opponent &&
           p.position !== 'QB'
    );
    if (gamePlayers.length > 0) {
      gameStackBonus = GAME_TIER_BONUS[week17Game.tier] || 0;
      const bringbacks = gamePlayers.map(p => `${p.player} (${p.position})`);
      stackNotes.push(
        `Game stack vs ${opponent} [${week17Game.tier}-tier: ${week17Game.label}] — +${gameStackBonus} pts`
      );
      stackNotes.push(`Bring-back${bringbacks.length > 1 ? 's' : ''}: ${bringbacks.join(', ')}`);
    } else {
      stackNotes.push(
        `${qbTeam} plays ${opponent} in Week 17 [${week17Game.tier}-tier] — no bring-back detected`
      );
    }
  } else {
    stackNotes.push(`${qbTeam} Week 17 game not found in tier list — update stackingData.js`);
  }

  // Second QB stack detection (if roster has 2+ QBs)
  if (qbs.length >= 2) {
    const secondQB = qbs[1];
    const secondQBTeam = secondQB.team?.toUpperCase();
    const secondTier = getQBTier(secondQB.player);
    stackNotes.push(`Secondary QB: ${secondQB.player} (${QB_STACK_TIERS[secondTier].label})`);
  }

  const rawScore = base + qbBonus + teamStackBonus + gameStackBonus;
  const score = clamp(rawScore);

  return {
    score: Math.round(score),
    raw: {
      primaryQB: primaryQB.player,
      qbTier,
      qbTeam,
      opponent,
      week17Game: week17Game ? `${week17Game.label} [${week17Game.tier}-tier]` : null,
      stackCount,
      stackedPlayers,
      bonuses: { base, qbBonus, teamStackBonus, gameStackBonus },
      stackNotes,
    },
  };
}

// ---------------------------------------------------------------------------
// Component: Risk (10%)
// Penalizes high-variance construction choices that can blow up a roster.
//
// Base: 60 points
// RB1 timing: penalty if first RB taken late
// Dead zone RBs: -8 per dead zone RB that is one of your top-2 RBs
// Week 17 meaningfulness: bonus if QB's team has a high-tier Week 17 game
// Elite QB bonus: having a proven franchise QB reduces variance
// ---------------------------------------------------------------------------
function scoreRisk(roster) {
  const picks = roster.filter(p => p.position && p.round);

  const rbs = picks.filter(p => p.position === 'RB').sort((a, b) => (a.round || 99) - (b.round || 99));
  const qbs = picks.filter(p => p.position === 'QB').sort((a, b) => (a.round || 99) - (b.round || 99));
  const primaryQB = qbs[0] || null;

  let base = 60;
  let riskNotes = [];
  let totalPenalty = 0;
  let totalBonus = 0;

  // --- RB1 round penalty ---
  const rb1 = rbs[0] || null;
  let rb1Penalty = 0;
  if (rb1) {
    const penaltyData = getRB1Penalty(rb1.round);
    rb1Penalty = penaltyData.penalty; // negative or 0
    totalPenalty += rb1Penalty;
    if (rb1Penalty < 0) {
      riskNotes.push(`RB1 (${rb1.player}) taken in Round ${rb1.round}: ${penaltyData.label} [${rb1Penalty} pts]`);
    } else {
      riskNotes.push(`RB1 (${rb1.player}) in Round ${rb1.round} — ${penaltyData.label}`);
    }
  } else {
    totalPenalty -= 15;
    riskNotes.push('No RB taken — maximum risk penalty [-15 pts]');
  }

  // --- Dead zone RB penalty (applies to top-2 RBs only) ---
  const topTwoRBs = rbs.slice(0, 2);
  let deadZoneCount = 0;
  for (const rb of topTwoRBs) {
    if (isDeadZoneRB(rb.player)) {
      totalPenalty -= 8;
      deadZoneCount++;
      riskNotes.push(`Dead zone RB in top-2: ${rb.player} (Round ${rb.round}) [-8 pts]`);
    }
  }

  // --- Week 17 meaningfulness bonus ---
  let week17Bonus = 0;
  if (primaryQB) {
    const qbTeam = primaryQB.team?.toUpperCase();
    const game = getWeek17Game(qbTeam);
    if (game) {
      const bonusByTier = { S: 15, A: 12, B: 8, C: 5, D: 2 };
      week17Bonus = bonusByTier[game.tier] || 0;
      totalBonus += week17Bonus;
      riskNotes.push(
        `QB (${primaryQB.player}) in ${game.tier}-tier W17 game [${game.label}] [+${week17Bonus} pts]`
      );
    } else {
      riskNotes.push(`${primaryQB.player}'s team (${qbTeam}) not found in Week 17 tier list`);
    }
  } else {
    riskNotes.push('No QB found — no Week 17 bonus available');
  }

  // --- Elite QB bonus ---
  let qbBonus = 0;
  if (primaryQB) {
    const tier = getQBTier(primaryQB.player);
    const bonusByTier = { ELITE: 10, STRONG: 6, VIABLE: 3, WEAK: 0 };
    qbBonus = bonusByTier[tier] || 0;
    totalBonus += qbBonus;
    if (qbBonus > 0) {
      riskNotes.push(`${QB_STACK_TIERS[tier].label} QB (${primaryQB.player}) reduces variance [+${qbBonus} pts]`);
    }
  }

  const rawScore = base + totalPenalty + totalBonus;
  const score = clamp(rawScore);

  return {
    score: Math.round(score),
    raw: {
      base,
      totalPenalty,
      totalBonus,
      rb1Round: rb1?.round,
      deadZoneCount,
      week17Bonus,
      qbBonus,
      riskNotes,
    },
  };
}

// ---------------------------------------------------------------------------
// Grade mapping
// ---------------------------------------------------------------------------
const GRADE_THRESHOLDS = [
  { min: 92, letter: 'A+', color: '#22c55e' },
  { min: 87, letter: 'A',  color: '#22c55e' },
  { min: 82, letter: 'A-', color: '#4ade80' },
  { min: 77, letter: 'B+', color: '#60a5fa' },
  { min: 72, letter: 'B',  color: '#60a5fa' },
  { min: 67, letter: 'B-', color: '#93c5fd' },
  { min: 62, letter: 'C+', color: '#facc15' },
  { min: 57, letter: 'C',  color: '#facc15' },
  { min: 52, letter: 'C-', color: '#fde047' },
  { min: 42, letter: 'D',  color: '#f97316' },
  { min: 0,  letter: 'F',  color: '#ef4444' },
];

function getLetterGrade(score) {
  return GRADE_THRESHOLDS.find(t => score >= t.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
}

// ---------------------------------------------------------------------------
// Feedback generation
// Produces human-readable strengths and weaknesses based on component scores.
// ---------------------------------------------------------------------------
function generateFeedback(constructionRaw, valueRaw, stackRaw, riskRaw) {
  const strengths = [];
  const weaknesses = [];
  const tips = [];

  // Construction feedback
  const { wrRd6, wrRd10, wrAll, rbRd6, rbRd10, rbAll, qbAll, teAll } = constructionRaw;

  if (qbAll >= 5) strengths.push(`Heavy QB stacking (${qbAll} QBs) — data shows +3pp advance rate for 5-6 QB rosters`);
  if (qbAll === 1) weaknesses.push(`Single QB roster — historically -2.6pp vs 2-QB rosters. Consider 2-QB build.`);
  if (teAll >= 3) strengths.push(`Loaded TE room (${teAll} TEs) hits the optimal TE construction bucket`);
  if (teAll === 1) weaknesses.push(`1 TE is the worst TE configuration (-4.3pp vs 3-TE baseline)`);
  if (wrRd6 >= 3) strengths.push(`${wrRd6} WRs through Round 6 — early WR investment is optimal in BBM`);
  if (wrRd6 <= 1) weaknesses.push(`Only ${wrRd6} WR(s) through Round 6 — extreme scarcity at your primary scoring position`);
  if (rbRd6 === 2 || rbRd6 === 3) strengths.push(`${rbRd6} RBs through Round 6 hits the optimal early-RB construction zone`);
  if (rbRd6 >= 5) weaknesses.push(`${rbRd6} RBs through Round 6 — overcrowding the early RB room limits WR upside`);

  // Value feedback
  const { capitalDetails, avgADPDelta } = valueRaw;
  if (avgADPDelta > 1) strengths.push(`Slight ADP reaches (avg ${avgADPDelta > 0 ? '+' : ''}${avgADPDelta}pp) — data shows teams that trust ADP slightly advance at higher rates`);
  if (avgADPDelta < -5) weaknesses.push(`Heavy value-hunting (avg ADP delta: ${avgADPDelta}pp) — teams reaching for perceived value historically underperform`);

  for (const c of capitalDetails) {
    if (c.delta >= 2.77) strengths.push(`${c.pos} capital in optimal ${c.quartile} zone (${c.pct}% of draft spend) [+${c.delta}pp]`);
    if (c.delta <= -10) weaknesses.push(`${c.pos} capital in ${c.quartile} zone (${c.pct}%) — major underperformer [-${Math.abs(c.delta)}pp]`);
  }

  // Stack feedback
  if (!stackRaw.noQB) {
    const { primaryQB, qbTier, stackCount, week17Game, opponent } = stackRaw;
    if (qbTier === 'ELITE') strengths.push(`Elite QB (${primaryQB}) provides a Week 17 ceiling others can't replicate`);
    if (stackCount >= 2) strengths.push(`${stackCount}-man team stack maximizes correlated upside in the playoffs`);
    if (stackCount === 0) weaknesses.push(`No same-team pass catchers with ${primaryQB} — missing correlated upside`);
    if (!week17Game && opponent === null) tips.push('Update stackingData.js with final 2026 Week 17 schedule once released');
  } else {
    weaknesses.push('No QB on roster — stacking is impossible without a QB anchor');
  }

  // Risk feedback
  const { riskNotes, deadZoneCount, rb1Round } = riskRaw;
  if (deadZoneCount > 0) weaknesses.push(`${deadZoneCount} dead-zone RB(s) in your top-2 RBs — committee backs with limited floor`);
  if (rb1Round && rb1Round <= 2) strengths.push(`Elite RB1 secured in Round ${rb1Round} — provides a high floor each week`);
  if (rb1Round && rb1Round >= 5) weaknesses.push(`RB1 not secured until Round ${rb1Round} — risky in a position-scarce format`);

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    tips,
  };
}

// ---------------------------------------------------------------------------
// Main export: gradeTeam
//
// @param {Array} roster — array of up to 18 picks:
//   { player: string, team: string, position: string, round: number,
//     adp: number, overall_pick?: number }
// @returns {Object} full grade object
// ---------------------------------------------------------------------------
export function gradeTeam(roster) {
  if (!roster || roster.length === 0) {
    return { error: 'No roster provided' };
  }

  const validPicks = roster.filter(p => p && p.player && p.position);

  const construction = scoreConstruction(validPicks);
  const value        = scoreValue(validPicks);
  const stack        = scoreStack(validPicks);
  const risk         = scoreRisk(validPicks);

  const weightedScore =
    construction.score * 0.35 +
    value.score        * 0.35 +
    stack.score        * 0.20 +
    risk.score         * 0.10;

  const total = Math.round(clamp(weightedScore));
  const grade = getLetterGrade(total);
  const feedback = generateFeedback(construction.raw, value.raw, stack.raw, risk.raw);

  return {
    letter:     grade.letter,
    color:      grade.color,
    total,
    components: {
      construction: construction.score,
      value:        value.score,
      stack:        stack.score,
      risk:         risk.score,
    },
    raw: {
      construction: construction.raw,
      value:        value.raw,
      stack:        stack.raw,
      risk:         risk.raw,
    },
    feedback,
    strengths:  feedback.strengths,
    weaknesses: feedback.weaknesses,
    tips:       feedback.tips,
  };
}

export { CALIBRATION, getLetterGrade, GRADE_THRESHOLDS };
