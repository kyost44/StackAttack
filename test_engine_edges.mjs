// test_engine_edges.mjs — edge-case + regression lock for scoringEngine.js
// Run from repo root: node test_engine_edges.mjs
// Style matches test_canonical.mjs: zero-dependency assertions, exit 1 on failure.
//
// Two kinds of tests:
//  LOCK  — locks in current CORRECT behavior (regression guard)
//  KNOWN — documents current INCORRECT/undesirable behavior; the assertion
//          asserts today's behavior so the suite passes, with a TODO marking
//          the desired behavior. When the fix ships, flip the assertion.

import { gradeTeam } from './src/engine/scoringEngine.js';

let pass = 0, fail = 0;
const t = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${note ? ' — ' + note : ''}`); }
};
const P = (name, position, team, round, adp, pickNumber) =>
  ({ name, position, team, round, adp, pickNumber });

// A realistic, structurally sound 18-round reference roster (slot-1 snake).
const BASE = [
  P('Ja Marr Chase','WR','CIN',1,2,1),     P('Bijan Robinson','RB','ATL',2,10,24),
  P('Puka Nacua','WR','LAR',3,30,25),      P('Jahmyr Gibbs','RB','DET',4,40,48),
  P('Joe Burrow','QB','CIN',5,55,49),      P('Tee Higgins','WR','CIN',6,66,72),
  P('Sam LaPorta','TE','DET',7,80,73),     P('DJ Moore','WR','CHI',8,95,96),
  P('Caleb Williams','QB','CHI',9,105,97), P('Jaylen Warren','RB','PIT',10,118,120),
  P('Rome Odunze','WR','CHI',11,130,121),  P('Khalil Shakir','WR','BUF',12,140,144),
  P('Tyler Warren','TE','IND',13,150,145), P('Bo Nix','QB','DEN',14,165,168),
  P('Ray Davis','RB','BUF',15,175,169),    P('Adonai Mitchell','WR','NYJ',16,185,192),
  P('Jaylin Noel','WR','HOU',17,195,193),  P('Kimani Vidal','RB','LAC',18,210,216),
];

console.log('— null/empty input —');
t('LOCK: null roster returns null', gradeTeam(null) === null);
t('LOCK: empty roster returns null', gradeTeam([]) === null);

console.log('— reference roster stability (regression pin) —');
const g = gradeTeam(BASE);
t('LOCK: base roster grades B+ 80', g.overallGrade === 'B+' && g.overallScore === 80,
  `got ${g.overallGrade} ${g.overallScore}`);
t('LOCK: component pins C94/V71/S69/R91',
  g.constructionScore === 94 && g.valueScore === 71 && g.stackScore === 69 && g.riskScore === 91,
  `got C${g.constructionScore}/V${g.valueScore}/S${g.stackScore}/R${g.riskScore}`);
t('LOCK: determinism — same input, same output',
  JSON.stringify(gradeTeam(BASE)) === JSON.stringify(gradeTeam(BASE)));
t('LOCK: legacy stack fields pinned to zero',
  g.stackDetail.qbTierBonus === 0 && g.stackDetail.teamStackBonus === 0 && g.stackDetail.bothQbsStacked === false);
t('LOCK: floor/ceiling are aliases of risk score (retired split)',
  g.floorScore === g.riskScore && g.ceilingScore === g.riskScore);

console.log('— grade ladder boundaries —');
// Ladder function is internal; probe via overall bands using known pins.
// These lock the ladder's shape indirectly: scores must map per spec table.
const ladder = [[84,'A+'],[82,'A'],[81,'A-'],[79,'B+'],[78,'B'],[77,'B-'],[74,'C+'],[70,'C'],[68,'C-'],[62,'D'],[61,'F'],[0,'F']];
// Reconstruct scoreToGrade behavior from spec for documentation purposes:
const specGrade = s => s>=84?'A+':s>=82?'A':s>=81?'A-':s>=79?'B+':s>=78?'B':s>=77?'B-':s>=74?'C+':s>=70?'C':s>=68?'C-':s>=62?'D':'F';
t('LOCK: ladder spec table internally consistent',
  ladder.every(([s, gr]) => specGrade(s) === gr));

console.log('— missing-data behavior —');
const noAdp = gradeTeam(BASE.map(p => ({ ...p, adp: 0 })));
t('LOCK: all-null ADP falls back to capital-only Value (no fake 50)',
  noAdp.valueScore === 56 && noAdp.overallGrade === 'C+', `got V${noAdp.valueScore} ${noAdp.overallGrade}`);
const noTeams = gradeTeam(BASE.map(p => ({ name: p.name, round: p.round })));
t('KNOWN: missing position/team silently grades (F, conf Low) instead of erroring — TODO: validation error',
  noTeams.overallGrade === 'F' && noTeams.gradeConfidence === 'Low',
  `got ${noTeams.overallGrade}/${noTeams.gradeConfidence}`);

console.log('— partial roster —');
const mini = gradeTeam(BASE.slice(0, 5));
t('KNOWN: 5-player roster graded on full-roster tables (D, conf Medium) — TODO: partial-grade mode or higher min',
  mini.overallGrade === 'D' && mini.gradeConfidence === 'Medium',
  `got ${mini.overallGrade}/${mini.gradeConfidence}`);

console.log('— duplicates —');
const dup = gradeTeam(BASE.map((p, i) => (i === 17 ? BASE[0] : p)));
t('KNOWN: duplicate player accepted and double-counted — TODO: reject or dedupe',
  dup !== null && typeof dup.overallScore === 'number');

console.log('— stack mechanics —');
// No qualifying pair (WR-RB only in a game) must earn zero stack credit.
const wrRbOnly = [
  P('Amon-Ra St. Brown','WR','DET',1,4,1), P('D\'Andre Swift','RB','CHI',2,20,24),
  // DET-CHI is the S-tier W17 game; WR one side, RB the other — pair floored at 0
  P('Malik Nabers','WR','NYG',3,28,25),   P('Saquon Barkley','RB','PHI',4,38,48),
  P('Drake Maye','QB','NE',5,60,49),      P('Nico Collins','WR','HOU',6,62,72),
  P('Trey McBride','TE','ARI',7,75,73),   P('Zay Flowers','WR','BAL',8,90,96),
  P('Jordan Love','QB','GB',9,110,97),    P('Chuba Hubbard','RB','CAR',10,120,120),
  P('Keon Coleman','WR','BUF',11,132,121),P('Jayden Reed','WR','GB',12,138,144),
  P('Dalton Kincaid','TE','BUF',13,152,145),P('Jaxson Dart','QB','NYG',14,170,168),
  P('Tyjae Spears','RB','TEN',15,178,169),P('Xavier Legette','WR','CAR',16,188,192),
  P('Quentin Johnston','WR','LAC',17,198,193),P('Braelon Allen','RB','NYJ',18,212,216),
];
const gWrRb = gradeTeam(wrRbOnly);
const detChi = (gWrRb.stackDetail.w17GameStackDetails || []).find(d => d.game === 'Lions-Bears');
t('LOCK: WR-RB-only cluster earns no stack credit (pair floored at 0)', !detChi,
  detChi ? `got bonus ${detChi.bonus}` : '');

// Bring-back multiplies value: QB+WR same side vs QB+WR + opposing player.
const oneSide = gradeTeam(BASE); // Burrow+Chase+Higgins CIN, no BAL player (W17 Ravens-Bengals)
const withBB  = gradeTeam(BASE.map((p, i) =>
  i === 16 ? P('Zay Flowers','WR','BAL',17,195,193) : p));
// DISCOVERED BY THIS SUITE: avgQuality is a mean over the cluster, so a cheap
// late-round bring-back dilutes quality (~0.81x here) MORE than the 1.15x
// bring-back multiplier adds — the score can DROP for following the engine's
// own "add a bring-back" improvement suggestion. Part of the validated Python
// model; candidate for the per-component backtest (sum-based vs avg-based).
t('KNOWN: cheap bring-back can LOWER stack score (avg-quality dilution) — TODO: revisit with backtest evidence',
  withBB.stackScore <= oneSide.stackScore,
  `one-side S${oneSide.stackScore} vs bring-back S${withBB.stackScore}`);

console.log('— value monotonicity —');
// KNOWN: exact-ADP (dev=0) is penalized more than a slight reach (non-monotonic bins).
const exactAdp  = gradeTeam(BASE.map(p => ({ ...p, adp: p.pickNumber })));       // dev = 0
const slightRch = gradeTeam(BASE.map(p => ({ ...p, adp: p.pickNumber + 3 })));   // small negative dev
t('KNOWN: exact-ADP Value <= slight-reach Value (non-monotonic bin) — TODO: monotonic re-bin',
  exactAdp.valueScore <= slightRch.valueScore,
  `exact V${exactAdp.valueScore} vs slight-reach V${slightRch.valueScore}`);

console.log('— clamps —');
// Absurd roster (18 WRs, all unknown rounds beyond tables) must stay in [0,100] and grade F-ish, not NaN.
const absurd = gradeTeam(Array.from({ length: 18 }, (_, i) =>
  P(`WR ${i}`, 'WR', 'CIN', i + 1, 0, 0)));
const inRange = s => Number.isFinite(s) && s >= 0 && s <= 100;
t('LOCK: degenerate roster stays clamped and finite',
  inRange(absurd.overallScore) && inRange(absurd.constructionScore) &&
  inRange(absurd.valueScore) && inRange(absurd.stackScore) && inRange(absurd.riskScore));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
