import { WEEK17_GAMES, WEEK16_GAMES, WEEK15_GAMES, QB_TIERS, DEAD_ZONE_RBS, ELITE_TES, BBM6_HIGH_OWNERSHIP } from '../data/stackingData.js';
import { getPlayerFlag } from '../data/playerFlags.js';

// ── ARCHETYPE METADATA ──
const ARCHETYPES = {
  'The Blueprint':       {tagline:'The roster every drafter is trying to build',description:'All four components strong — construction, value, stack, and risk all above the 75th percentile. The most balanced structural profile in our data. Mean expected W17 ceiling: 164.9 points. This is the rarest archetype (~2% of elite teams).',color:'gold'},
  'The Apex Predator':   {tagline:'Built to compete at the top — stack peaks when it matters',description:'Strong overall score with a dominant stack. Built to make a deep playoff run and convert when the stack hits. Common among rd3 semifinalists.',color:'crimson'},
  'Value Merchant':      {tagline:'Patient drafting rewarded — every pick at or below ADP',description:'Strong ADP efficiency combined with solid construction. The LGrewe50 pattern — wait for value, let the market come to you. Modern data shows this approach is +1.56pp above baseline.',color:'emerald'},
  'The Juggernaut':      {tagline:'High floor, steady force — built to make the playoffs',description:'Strong construction and risk profile with moderate stack. In our data, this archetype had the HIGHEST finals advance rate (10.84%). Reliable, sturdy, gets there.',color:'steel'},
  'Glass Cannon':        {tagline:'Boom or bust — your stack carries this roster',description:'Dominant stack score with structural weaknesses elsewhere. High variance — if the stack hits, this wins. If it doesn\'t, exit early. Most BBM V/VI champions had this archetype.',color:'amber'},
  'The Sentinel':        {tagline:'Beautiful construction, no W17 stack — a contrarian path',description:'Strong build quality with intentional lack of W17 game stacks. Rare archetype — most elite teams stack something. Bets on broad scoring rather than concentrated leverage.',color:'slate'},
  'The Tactician':       {tagline:'Balanced but unremarkable — a solid bet without a story',description:'No standout strength, no glaring weakness. The most common archetype in best ball. Median expected outcome, lower variance than specialist archetypes.',color:'sage'},
  'The Sprinter':        {tagline:'Built for early production, less for the playoff gauntlet',description:'Strong value with weaker risk profile. Likely has roster turnover concerns or stack thinness. Performs well early when players are healthy and predictable.',color:'orange'},
  'Lightning in a Bottle':{tagline:'High variance, high ceiling — needs the bolt to strike',description:'Weaker overall scores with a strong stack. Pure variance play — 20% of actual finalists had this profile. When the stack heats up, this wins. Often, it doesn\'t.',color:'electric'},
  'The Long Shot':       {tagline:'Multiple structural concerns — needs things to break right',description:'Lower overall score with no dominant stack. Doesn\'t predict you\'ll lose — 13.5% of actual finalists had this profile. But the structural foundation is concerning; success will need variance to compensate.',color:'rust'}
};

// ── ARCHETYPE ASSIGNMENT (waterfall — most specific first) ──
function assignArchetype(c, v, s, r, o) {
  if(o>=93&&c>=75&&v>=75&&s>=75&&r>=75) return 'The Blueprint';
  if(o>=90&&s>=90) return 'The Apex Predator';
  if(o>=83&&v>=84) return 'Value Merchant';
  if(o>=83&&r>=86&&c>=80) return 'The Juggernaut';
  if(o>=80&&s>=95&&(c<=78||v<=75)) return 'Glass Cannon';
  if(o>=75&&c>=88&&s<=60) return 'The Sentinel';
  if(o>=80&&v>=80&&r<=75) return 'The Sprinter';
  if(o<78&&s>=92) return 'Lightning in a Bottle';
  if(o<78) return 'The Long Shot';
  return 'The Tactician';
}

export function gradeTeam(roster, options = {}) {
  if (!roster || roster.length === 0) return null;
  const construction = scoreConstruction(roster);
  const value = scoreValue(roster);
  const stack = scoreStack(roster);
  const bbb = scoreBoomBust(roster, stack.achievements, options);
  const overallScore = Math.round(construction.score*0.30 + value.score*0.30 + stack.score*0.25 + bbb.score*0.15);
  const overallGrade = scoreToGrade(overallScore);
  const allAch = [...construction.achievements, ...value.achievements, ...stack.achievements, ...bbb.achievements];
  let archetype = assignArchetype(construction.score, value.score, stack.score, bbb.score, overallScore);
  // Change 2: Post-assignment override — Tactician with dominant stack should be Glass Cannon
  if(archetype==='The Tactician'){
    const hasDomStack=allAch.some(a=>a.id==='FOUR_PLUS_STACKED'||a.id==='BOTH_QBS_STACKED');
    if(hasDomStack) archetype='Glass Cannon';
  }
  const archetypeInfo = ARCHETYPES[archetype];
  // Post-score conditional feedback
  if(archetype==='Lightning in a Bottle'||archetype==='The Long Shot') bbb.feedback.push(`Modern best ball rewards different patterns than 2022-2023 versions. Our calibration is based on BBM V+VI (2024-2025) finalist outcomes.`);
  if(stack.score>=85&&construction.score<75) stack.feedback.push(`Strong stack but weak construction — this is a high-variance "ceiling play." If your stack hits, you can win. If it misses, the construction won't carry you.`);
  const gradeConfidence = computeGradeConfidence(roster);
  const flags = computeFlags(roster, {
    construction: construction.score,
    value: value.score,
    stack: stack.score,
    bbb: bbb.score,
    floorScore: bbb.floorScore,
    ceilingScore: bbb.ceilingScore,
    overall: overallScore,
  }, stack.detail, archetype);
  const improvementSuggestion = computeImprovementSuggestion(
    roster,
    { construction: construction.score, value: value.score, stack: stack.score },
    stack.detail, flags
  );
  return {
    improvementSuggestion,
    overallGrade, overallScore,
    constructionScore:construction.score, valueScore:value.score, stackScore:stack.score,
    riskScore:bbb.score,       // backward-compat alias — UI reads this for the bar
    bbbScore:bbb.score, floorScore:bbb.floorScore, ceilingScore:bbb.ceilingScore, bbbLabel:bbb.label,
    constructionFeedback:construction.feedback, valueFeedback:value.feedback, stackFeedback:stack.feedback,
    riskFeedback:bbb.feedback, // backward-compat alias — DraftDateBadge + Nerd Report accordion
    constructionDetail:construction.detail, valueDetail:value.detail, stackDetail:stack.detail,
    topStrengths:buildStrengths(construction,value,stack,bbb),
    topWeaknesses:buildWeaknesses(construction,value,stack,bbb),
    achievements:allAch,
    bbm6Context:buildBBM6Context(roster),
    archetype, archetypeInfo,
    gradeConfidence,
    strengthFlags: flags.strengths,
    fragilityFlags: flags.fragilities,
  };
}

// LOCKED grade ladder — ported as-is from the Python model (final 5-season
// recalibration, pooled II-VI, ~1.16% A-tier). Note: the old ladder had a D+
// tier (12 grades); Python's has 11 (no D+) — collapsed to match exactly.
function scoreToGrade(s){if(s>=84)return'A+';if(s>=82)return'A';if(s>=81)return'A-';if(s>=79)return'B+';if(s>=78)return'B';if(s>=77)return'B-';if(s>=74)return'C+';if(s>=70)return'C';if(s>=68)return'C-';if(s>=62)return'D';return'F';}

// ── CONSTRUCTION (30%) ──
function scoreConstruction(roster){
  const byPos=getPos(roster), byRound=getRounds(roster);
  const achievements=[], feedback=[], detail={};
  const wrR6=byRound.r6.filter(p=>p.position==='WR').length;
  const wrR10=byRound.r10.filter(p=>p.position==='WR').length;
  const wrTotal=byPos.WR.length;
  const rbR6=byRound.r6.filter(p=>p.position==='RB').length;
  const rbR10=byRound.r10.filter(p=>p.position==='RB').length;
  const rbTotal=byPos.RB.length;
  const qbTotal=byPos.QB.length, teTotal=byPos.TE.length;
  Object.assign(detail,{wrR6,wrR10,wrTotal,rbR6,rbR10,rbTotal,qbTotal,teTotal});

  const WR_R6={0:1.72,1:1.33,2:0.77,3:0.35,4:-0.46,5:-2.09,6:-3.23,7:-4.73,8:-6.23};
  const WR_R10={0:-0.63,1:0.87,2:0.56,3:0.25,4:-0.19,5:0.1,6:-0.1,7:-0.24,8:-0.38,9:-1.88,10:-3.38};
  const WR_TOT={0:-4.62,1:-6.12,2:-7.62,3:-4.62,4:-3.12,5:-2.39,6:-1.66,7:-0.61,8:0.83,9:1.98,10:2.79,11:1.29,12:-0.21};
  const RB_R6={0:-2.06,1:-0.7,2:0.15,3:0.62,4:0.96,5:1.29,6:-0.21,7:-1.71};
  const RB_R10={0:0.44,1:0.75,2:1.2,3:-0.14,4:-0.33,5:-0.68,6:-0.93,7:-1.17,8:-2.67,9:-4.17};
  const RB_TOT={0:0.55,1:-0.95,2:0.55,3:2.05,4:1.38,5:0.41,6:-0.52,7:-1.29,8:-1.83,9:-2.37,10:-3.87,11:-5.37};
  const TE_TOT={0:0.17,1:1.67,2:0.72,3:-0.63,4:-1.43,5:-1.99,6:-3.49,7:-4.99};
  const CONSTRUCTION_DEFAULTS={WR_R6:-2.5,WR_R10:-3.5,WR_TOT:-3.0,RB_R6:-5.5,RB_R10:-5.5,RB_TOT:-5.5,TE_TOT:-2.0};

  const wrR6D=WR_R6[wrR6]??CONSTRUCTION_DEFAULTS.WR_R6;
  const wrR10D=WR_R10[wrR10]??CONSTRUCTION_DEFAULTS.WR_R10;
  const wrTotD=WR_TOT[wrTotal]??CONSTRUCTION_DEFAULTS.WR_TOT;
  const rbR6D=RB_R6[rbR6]??CONSTRUCTION_DEFAULTS.RB_R6;
  const rbR10D=RB_R10[rbR10]??CONSTRUCTION_DEFAULTS.RB_R10;
  const rbTotD=RB_TOT[rbTotal]??CONSTRUCTION_DEFAULTS.RB_TOT;
  // Change 2 (calibration patch): investment-weighted TE penalty for 3+ TEs.
  // 1-2 TEs keep the count-based TE_TOT delta; 3+ TEs replace the flat penalty
  // with one that scales by where the EXCESS (3rd+) TEs were drafted — a 3rd TE
  // at R5 costs premium capital, a 3rd TE at R16 is a near-free dart.
  const teList=[...byPos.TE].sort((a,b)=>a.round-b.round);
  let teExcessPenalty=0, teD;
  if(teTotal>=3){
    for(let i=2;i<teTotal;i++){
      const rd=teList[i].round||12;
      if(rd<=6) teExcessPenalty+=2.5;
      else if(rd<=10) teExcessPenalty+=1.5;
      else if(rd<=14) teExcessPenalty+=0.7;
      else teExcessPenalty+=0.3;
    }
    teD=-teExcessPenalty;
  } else {
    teD=TE_TOT[teTotal]??CONSTRUCTION_DEFAULTS.TE_TOT;
  }

  // 3-QB construction: edge conditioned on QB3 draft round (cheap QB3 = the structural edge)
  let qbD;
  const qbsByRound=[...byPos.QB].sort((a,b)=>a.round-b.round);
  const qb3Round=qbsByRound.length>=3?qbsByRound[2].round:null;
  if(qbTotal===1) qbD=-2.59;
  else if(qbTotal===2) qbD=0.80;
  else if(qbTotal===3){
    const qb1n=qbsByRound[0]?.name||'QB1', qb2n=qbsByRound[1]?.name||'QB2', qb3n=qbsByRound[2]?.name||'QB3';
    if(qb3Round>=8){qbD=1.80; feedback.push(`3-QB: ${qb1n} + ${qb2n} + ${qb3n} at R${qb3Round} — cheap-QB3 pattern adds +1.80pp. ${qb3n} at R${qb3Round} qualifies for the full structural edge.`);}
    else if(qb3Round>=5){qbD=0.80; feedback.push(`3-QB: ${qb1n} + ${qb2n} + ${qb3n} at R${qb3Round} — partial edge. The 3-QB pattern peaks with QB3 in R8+ (cheap-QB3 advantage). ${qb3n} at R${qb3Round} gets some benefit but not the full gain.`);}
    else{qbD=0.0; feedback.push(`3-QB: ${qb1n} + ${qb2n} + ${qb3n} at R${qb3Round} — no structural edge. The 3-QB pattern works because of CHEAP late QBs. ${qb3n} was drafted too early to capture the value.`);}
  }
  else if(qbTotal>=4) qbD=0.0;
  else qbD=0.0;
  detail.qb3Round=qb3Round;

  const totalDelta=wrR6D+wrR10D+wrTotD+rbR6D+rbR10D+rbTotD+qbD+teD;
  detail.totalDelta=totalDelta;
  Object.assign(detail,{wrR6D,wrR10D,wrTotD,rbR6D,rbR10D,rbTotD,qbD,teD,teExcessPenalty});
  let score=Math.max(0,Math.min(100,Math.round(78+totalDelta*4)));

  // WR count feedback — player-specific
  const wrsSorted=[...byPos.WR].sort((a,b)=>a.round-b.round);
  const wr1n=wrsSorted[0]?.name, lastWRn=wrsSorted[wrsSorted.length-1]?.name, lastWRr=wrsSorted[wrsSorted.length-1]?.round;
  if(wrTotal===9) feedback.push(`9 WRs (${wr1n} through ${lastWRn}) — optimal WR count in modern data (+1.98pp). WR-heavy builds are winning.`);
  else if(wrTotal===8) feedback.push(`8 WRs (${wr1n} through ${lastWRn}) — strong WR room (+0.83pp).`);
  else if(wrTotal===7) feedback.push(`7 WRs — one short of the 8-9 optimal band. ${lastWRn} at R${lastWRr} is your deepest WR; an 8th would improve expected outcome.`);
  else if(wrTotal<=6) feedback.push(`Only ${wrTotal} WRs (through ${lastWRn} at R${lastWRr}) — thin WR room. Modern data shows 8-9 WRs perform best.`);
  else if(wrTotal>=10) feedback.push(`${wrTotal} WRs — diminishing returns past 9. ${lastWRn} at R${lastWRr} and beyond are likely redundant spots.`);

  // RB R6 feedback — player-specific
  const rbsEarly=[...byPos.RB].filter(r=>r.round<=6).sort((a,b)=>a.round-b.round);
  if(rbR6>=3){feedback.push(`${rbsEarly.map(p=>p.name).join(' + ')} — ${rbR6} RBs through R6. Strong early RB foundation; modern data shows 3-4 RBs through R6 is a winning pattern.`); achievements.push({id:'EARLY_RB',label:'EARLY RB INVESTMENT',icon:'⚔️'});}
  else if(rbR6===2){feedback.push(`${rbsEarly.map(p=>p.name).join(' and ')} give you 2 RBs through R6 — the balanced approach. Slightly positive signal (+0.15pp).`); achievements.push({id:'EARLY_RB',label:'EARLY RB INVESTMENT',icon:'⚔️'});}
  else if(rbR6===1) feedback.push(`${rbsEarly[0]?.name} at R${rbsEarly[0]?.round} is your only RB through R6 — slightly negative signal (-0.70pp). Recoverable but starts you behind on RB depth.`);
  else if(rbR6===0) feedback.push(`Zero RB through R6 — high-variance contrarian path. If the BBM7 field overcorrects to early RB, the WRs falling to Zero-RB drafters are better players at better prices. Below average historically but viable with elite WR capital — not catastrophic.`);

  if(rbTotal===4&&rbR6>=1) feedback.push(`4-RB build — high variance; BBM VI 4-RB finalists avg 128.7. Viable outlier, graded accordingly.`);

  // TE count feedback
  if(teTotal===1) feedback.push(`1 TE — modern data shows this is actually a positive signal (+1.67pp) when paired with elite TE.`);
  else if(teTotal===2) feedback.push(`2 TEs — solid (+0.72pp in modern data).`);
  else if(teTotal===3){
    const thirdTE=teList[2];
    if((thirdTE.round||12)<=10) feedback.push(`3 TEs with meaningful early capital — modern data shows 1-2 TEs outperforms when the 3rd costs a premium pick.`);
    else feedback.push(`3 TEs — but your 3rd was a late-round dart (R${thirdTE.round}), which limits the downside of the extra investment.`);
  }

  // WR R6 concentration
  if(wrR6>=5) feedback.push(`${wrR6} WRs in first 6 rounds — heavy early WR investment (-2.09 to -3.23 in modern data). Risk concentration; consider whether RB/TE allocations got squeezed.`);

  // Hero RB
  if(rbR6===1&&rbTotal>=5){feedback.push(`Hero RB build — modern data confirms this works. 1 early RB + 5+ total RBs is a viable contrarian path. Higher variance but with real upside.`); achievements.push({id:'HERO_RB',label:'HERO RB BUILD',icon:'🦸'});}

  if(qbTotal===3) achievements.push({id:'THREE_QB',label:'3-QB STRUCTURE',icon:'🎯'});

  // Sample-size caveat for statistically rare constructions
  if(wrTotal>=11||teTotal>=4||rbTotal===2) feedback.push(`This build is statistically uncommon — fewer than 100 teams in our 17,248-roster sample chose this construction. Grade reflects average outcome for similar builds, but variance is high.`);

  return {score,feedback,detail,achievements};
}

// ── VALUE (30%) — 60% ADP / 40% capital; null ADP → capital-only ──
function scoreValue(roster){
  const feedback=[], detail={}, achievements=[];

  // ── Capital (always computed first) ──
  const cap=getCapital(roster); detail.capitalPct=cap;
  const QBQ=[{m:13.5,l:'Q1',d:-0.64},{m:11.7,l:'Q2',d:-0.09},{m:9.9,l:'Q3',d:0.42},{m:0,l:'Q4',d:0.59}];
  const RBQ=[{m:34.5,l:'Q1',d:0.62},{m:31.6,l:'Q2',d:-0.13},{m:28.7,l:'Q3',d:-0.09},{m:0,l:'Q4',d:-1.01}];
  const WRQ=[{m:50.3,l:'Q1',d:-1.28},{m:46.8,l:'Q2',d:-0.57},{m:43.3,l:'Q3',d:0.04},{m:0,l:'Q4',d:0.42}];
  const TEQ=[{m:12.3,l:'Q1',d:0.99},{m:9.9,l:'Q2',d:-0.35},{m:8.2,l:'Q3',d:-0.69},{m:0,l:'Q4',d:-0.62}];
  const gq=(pct,qs)=>{for(const q of qs)if(pct>=q.m)return q; return qs[qs.length-1];};
  const qbQ=gq(cap.QB,QBQ),rbQ=gq(cap.RB,RBQ),wrQ=gq(cap.WR,WRQ),teQ=gq(cap.TE,TEQ);
  Object.assign(detail,{qbQuartile:qbQ,rbQuartile:rbQ,wrQuartile:wrQ,teQuartile:teQ});
  const capDelta=qbQ.d+rbQ.d+wrQ.d+teQ.d;
  const capitalScore=Math.max(0,Math.min(100,Math.round(80+capDelta*12)));

  // QB capital feedback (split Q1/Q4 — opposite directions in modern data)
  if(qbQ.l==='Q2') feedback.push(`QB capital optimal Q2 (${cap.QB.toFixed(1)}%) — modern data shows Q2 QB spend is the best outcome band.`);
  else if(qbQ.l==='Q1') feedback.push(`QB capital Q1 — QB overspend modestly negative (-0.64pp). Modern data rewards efficient QB spending.`);
  else if(qbQ.l==='Q4') feedback.push(`QB capital Q4 — efficient QB spending is slightly positive (+0.59pp) in modern data. Counter-intuitive but consistent across BBM V+VI.`);

  // RB capital feedback
  if(rbQ.l==='Q1') feedback.push(`RB capital Q1 — slight positive signal (+0.62pp). Modern data shows a modest RB capital advantage at the top quartile.`);
  else if(rbQ.l==='Q4') feedback.push(`RB capital Q4 — RB underspend strongly negative (-1.01pp). Heavy devaluation of RB capital is penalized in modern best ball.`);

  // WR capital feedback
  if(wrQ.l==='Q1') feedback.push(`WR capital Q1 — heavy WR overspend modestly negative (-1.28pp). WR allocation signal is weak; extremes are penalized.`);
  else if(wrQ.l==='Q3') feedback.push(`WR capital balanced (Q3) — modern data shows WR allocation is largely outcome-neutral. Q3 is approximately neutral (+0.04pp).`);
  else if(wrQ.l==='Q4') feedback.push(`WR capital Q4 — slightly positive signal (+0.42pp). Leaning WR-light at the margin is a mild modern edge.`);

  // TE capital feedback
  if(teQ.l==='Q1') feedback.push(`TE capital Q1 — positive signal (+0.99pp). Investing heavily in TE has a modest modern edge.`);
  else if(teQ.l==='Q3') feedback.push(`TE capital Q3 — modestly negative (-0.69pp) in modern data. The old +8.58pp figure was BBM II-IV; modern calibration shows TE capital is a weaker signal.`);
  else if(teQ.l==='Q4') feedback.push(`TE underspend — Q4 modestly negative (-0.62pp). Less severe than older data suggested; TE capital signal has weakened in modern best ball.`);

  // Balanced capital check
  if(Math.abs(capDelta)<0.5) feedback.push(`Balanced capital allocation across positions — no extreme concentration. Neutral signal overall.`);

  feedback.push(`Context: BBM VI finalists averaged 46.1% WR capital despite "RB year" framing. WR capital dominance and early-RB edge COEXIST — not competing strategies.`);

  // ── ADP: null → capital-only (no neutral 50 fallback) ──
  const picksAdp=roster.filter(p=>p.adp&&p.adp>0);
  if(picksAdp.length===0){
    detail.capitalScore=capitalScore; detail.adpScore=null;
    return {score:capitalScore,feedback,detail,achievements};
  }
  // Round-weighted deviation — use enhanced pick-number CLV if available, else fall back to round-based
  let totalWeightedDev=0, totalWeight=0;
  for(const p of picksAdp){
    const weight=Math.max(0,19-p.round);
    const dev=p.round-p.adp/12;
    totalWeightedDev+=weight*dev;
    totalWeight+=weight;
  }
  const pickDev=computePickDeviation(roster);
  const avgDev=pickDev!==null?pickDev:(totalWeight>0?totalWeightedDev/totalWeight:null);
  if(avgDev===null){
    detail.capitalScore=capitalScore; detail.adpScore=null;
    return {score:capitalScore,feedback,detail,achievements};
  }
  detail.avgAdpDeviation=avgDev;
  let adpDelta;
  if(avgDev<-0.5)adpDelta=-1.77; else if(avgDev<0)adpDelta=-0.88; else if(avgDev===0)adpDelta=-1.54; else if(avgDev<0.83)adpDelta=0.09; else adpDelta=1.56;
  const adpScore=Math.max(0,Math.min(100,Math.round(80+adpDelta*12)));
  detail.adpDelta=adpDelta;
  // ADP deviation feedback (BBM V+VI calibration — patience wins, reaching is penalized)
  if(avgDev<-0.5) feedback.push(`Heavy reaches detected — modern data penalizes reaching (-1.77pp). BBM V+VI: patience and waiting for value is the winning pattern.`);
  else if(avgDev<0) feedback.push(`Slight reaches — mild negative signal (-0.88pp) in modern data. BBM V+VI show patience outperforms reaching.`);
  else if(avgDev>0&&avgDev<0.83) feedback.push(`Picks slightly after ADP — mild positive signal (+0.09pp). Modern game rewards patience over reaching.`);
  else if(avgDev>=0.83) feedback.push(`Patient drafter — heavy value hunting (+1.56pp) is the modern winning pattern. BBM V champion LGrewe50 famously got every pick at or below ADP. This is the optimal ADP profile.`);
  // Patient drafter achievement (avgDev > 0 = drafting after ADP = patience rewarded)
  if(avgDev>0) achievements.push({id:'PATIENT_DRAFTER',label:'PATIENT DRAFTER',icon:'⏳'});
  const valueScore=Math.round(adpScore*0.60+capitalScore*0.40);
  detail.adpScore=adpScore; detail.capitalScore=capitalScore;
  return {score:valueScore,feedback,detail,achievements};
}

// ─── STACK REALISM HELPERS (Phase 4 LOCKED — matches the Python model exactly) ──
// Team-stack (season-long same-team concentration and every variant tested —
// standalone, orthogonalized, cross-week "steadiness", regular-season mean and
// variance) was rejected: flat-to-negative and sign-unstable in all 4 tests.
// computeCumulativeTeamStacks / singleTeamStackValue / computeWeightedTeamStack /
// getQBTeammateCount are DELETED — no team-stack term exists anywhere in scoring.

// PAIR_MULT: position-pair multipliers, PRESENCE-based — each pair TYPE
// contributes its multiplier at most once per game cluster if both positions
// are present, regardless of count (QB+1WR and QB+4WR score identically).
// QB-WR is the only pair with a robust, cross-season-stable positive effect;
// QB-TE/QB-RB are weak-positive; WR-RB tested negative, floored at 0 (don't
// credit, don't penalize). Any pair not listed prices at 0.
const PAIR_MULT = { qbwr: 1.00, qbte: 0.11, qbrb: 0.07, wrrb: 0.0 };
const TIER_BASE = { S: 22, A: 18, B: 14, C: 11, D: 7 };
const BRING_BACK = 1.15;
const GAME_DR = [1.0, 0.5, 0.25, 0.1]; // diminishing returns across multiple games within a week
// Week weights for the STACK combination only (Risk keeps its own weighting,
// unchanged — Risk was not re-derived). W16 tested as pure noise across all
// 4 training seasons (sign-unstable, flat conditional-advancement curve).
const STACK_WEEK_WEIGHTS = { 15: 2.5, 16: 0.4, 17: 4.0 };
const STACK_TWW = STACK_WEEK_WEIGHTS[15] + STACK_WEEK_WEIGHTS[16] + STACK_WEEK_WEIGHTS[17];
// Raw weighted-average stack -> 0-100 transform (matches the locked Python model).
const STACK_SCALE = 2.2, STACK_BASE = 18.0;

// Player quality weight by draft round (proxy for role importance)
function playerQualityByRound(round) {
  if (!round) return 0.35; // unknown round = mid estimate
  if (round <= 2)  return 1.00;
  if (round <= 4)  return 0.90;
  if (round <= 6)  return 0.75;
  if (round <= 8)  return 0.60;
  if (round <= 10) return 0.50;
  if (round <= 12) return 0.40;
  if (round <= 14) return 0.30;
  return 0.20;
}

// Presence-based position-pair units for one game cluster.
function pairUnits(stackPlayers) {
  const nqb = stackPlayers.filter(p => p.position === 'QB').length;
  const nwr = stackPlayers.filter(p => p.position === 'WR').length;
  const nrb = stackPlayers.filter(p => p.position === 'RB').length;
  const nte = stackPlayers.filter(p => p.position === 'TE').length;
  let units = 0;
  if (nqb >= 1 && nwr >= 1) units += PAIR_MULT.qbwr;
  if (nqb >= 1 && nte >= 1) units += PAIR_MULT.qbte;
  if (nqb >= 1 && nrb >= 1) units += PAIR_MULT.qbrb;
  if (nwr >= 1 && nrb >= 1) units += PAIR_MULT.wrrb;
  return units;
}

// Quality-weighted, position-pair-priced game stack value.
// tierLabel: 'S'|'A'|'B'|'C'|'D'; stackPlayers: array of {position,round}
// objects for all roster players in this game; bothSides: true if players
// from both teams in the game are present (bring-back).
function gameStackValue(tierLabel, stackPlayers, bothSides) {
  if (!stackPlayers || stackPlayers.length === 0) return 0;
  const units = pairUnits(stackPlayers);
  if (units <= 0) return 0; // no empirically-supported pair present -> no credit
  const base = TIER_BASE[tierLabel] || 3;
  const avgQuality = stackPlayers.reduce((sum, p) =>
    sum + playerQualityByRound(p.round || p.adp_round), 0) / stackPlayers.length;
  const bringBack = bothSides ? BRING_BACK : 1.00;
  return base * avgQuality * units * bringBack;
}

// Per-week game-stack detection + diminishing returns across multiple games.
// Returns { raw, details } — raw is UNCAPPED (the final 0-100 clip happens
// once, after the week-weighted combination + STACK_SCALE/STACK_BASE).
function computeWeekStack(games, roster) {
  const details = [], values = [];
  for (const g of games) {
    const [t1, t2] = g.teams;
    const a = roster.filter(p => p.team === t1), b = roster.filter(p => p.team === t2);
    const tot = a.length + b.length, both = a.length >= 1 && b.length >= 1;
    if (tot < 2) continue;
    const stackPlayers = [...a, ...b];
    const val = gameStackValue(g.tier, stackPlayers, both);
    if (val > 0) {
      values.push(val);
      details.push({ game: g.game, tier: g.tier, window: g.window, both,
        t1: a.map(p => p.name), t2: b.map(p => p.name), bonus: Math.round(val) });
    }
  }
  const sorted = [...values].sort((a, b) => b - a);
  const raw = sorted.reduce((sum, v, i) => sum + v * (GAME_DR[i] ?? GAME_DR[GAME_DR.length - 1]), 0);
  return { raw, details };
}

// ── STACK (25%) — Phase 4 LOCKED: structurally identical to the Python model.
// score = weighted_avg(w15, w16, w17) * STACK_SCALE + STACK_BASE, clipped 0-100.
// No QB-tier bonus, no team-stack, no dual-QB bonus, no per-week caps — every
// mechanism the locked model tested and rejected is gone, not just de-weighted.
function scoreStack(roster){
  const feedback=[], detail={}, achievements=[];

  // Informational only (feedback/achievements) — NOT part of the score.
  const byPos=getPos(roster);
  let stackedSkill=0; const tsDetails=[];
  for(const qb of byPos.QB){
    const mates=roster.filter(p=>p.team===qb.team&&p.position!=='QB'&&['WR','TE','RB'].includes(p.position));
    if(mates.length>=1){stackedSkill+=mates.length; tsDetails.push({qb:qb.name,team:qb.team,partners:mates.map(p=>p.name),count:mates.length});}
  }
  Object.assign(detail,{teamStackDetails:tsDetails,stackedSkillPlayers:stackedSkill});
  // Legacy display fields — mechanisms removed, kept at 0/false for UI back-compat
  // (GradeDisplay.jsx's Nerd Report reads these; follow-up: retire those rows).
  Object.assign(detail,{qbTierBonus:0,topQbTier:null,teamStackScore:0,teamStackBonus:0,bothQbsStacked:false});
  if(stackedSkill>=4){achievements.push({id:'FOUR_PLUS_STACKED',label:'ELITE STACK DEPTH',icon:'⚡'}); feedback.push(`${stackedSkill} skill players stacked — top BBM VI teams averaged 4+ stacked skill players`);}
  else if(stackedSkill>=2) feedback.push(`${stackedSkill} skill players stacked — aim for 4+ (top team profile)`);
  else if(stackedSkill===0) feedback.push(`No team stacks — top BBM VI teams averaged 4+ stacked skill players`);

  const w17Res=computeWeekStack(WEEK17_GAMES,roster);
  const w16Res=computeWeekStack(WEEK16_GAMES,roster);
  const w15Res=computeWeekStack(WEEK15_GAMES,roster);

  for(const g of w17Res.details) if(g.both) achievements.push({id:`W17_${g.tier}`,label:`WEEK 17 ${g.tier}-TIER GAME STACK`,icon:'🎯'});

  const stackComb=(w15Res.raw*STACK_WEEK_WEIGHTS[15]+w16Res.raw*STACK_WEEK_WEIGHTS[16]+w17Res.raw*STACK_WEEK_WEIGHTS[17])/STACK_TWW;
  let score=Math.round(stackComb*STACK_SCALE+STACK_BASE);
  score=Math.max(0,Math.min(100,score));

  Object.assign(detail,{
    w17StackTotal:Math.round(w17Res.raw), w17GameBonus:Math.round(w17Res.raw), w17GameStackDetails:w17Res.details,
    w16GameBonus:Math.round(w16Res.raw), w16StackDetails:w16Res.details,
    w15GameBonus:Math.round(w15Res.raw), w15StackDetails:w15Res.details,
  });

  if(w17Res.details.length>0){const sorted=[...w17Res.details].sort((a,b)=>b.bonus-a.bonus),top3=sorted.slice(0,3); feedback.push(`Top W17 stack${top3.length>1?'s':''}: ${top3.map(g=>`${g.game} [${g.tier}${g.both?' +bring-back':''}]`).join(' | ')}`);}
  else{feedback.push(`No W17 game stack — biggest single EV lever. Top BBM VI teams had ≥1 W17 stack`);}
  if(w16Res.raw>0) feedback.push(`Week 16 correlation — Leone BBM IV: W15/16 stacking actively underutilized by field`);
  if(w15Res.raw>0) feedback.push(`Week 15 correlation — quarterfinal stacking rarely intentional`);

  return {score,feedback,detail,achievements};
}

// ── RISK (15%) — Phase 4 LOCKED: structurally identical to the Python model.
// Per-week formula: risk_w = clip(60 + rb1Adj + teAdj + meaningfulAdj(w) + qbAdj(w), 0, 100),
// combined via RISK_WEEK_WEIGHTS {15:1, 16:2, 17:4}. rb1Adj/teAdj are roster-level
// (same every week); meaningfulAdj/qbAdj are per-week, from that week's real game
// tiers. No floor/ceiling split — Python's Risk formula never had one.
// REMOVED (not in the Python model — deferred/absent on both sides now, matching
// elite-TE/dead-zone): dead-zone RB penalty, elite-TE bonus, BBM6-chalk penalty,
// draft-date timing modifier, MEANINGFUL_W17_TEAMS-based live-player bonus, the
// "no stack achievements" ceiling demerit. Feedback text tied to each was removed
// too — keeping it would describe a penalty that no longer affects the score.
const TIER_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const RISK_WEEK_WEIGHTS = { 15: 1, 16: 2, 17: 4 }; // unchanged from the original default — Risk was not re-derived
const RISK_TWW = RISK_WEEK_WEIGHTS[15] + RISK_WEEK_WEIGHTS[16] + RISK_WEEK_WEIGHTS[17];

// Static roster model adaptation: JS rosters carry ONE fixed `team` per player
// (no per-week team-by-week resolution like the Python/nflverse pipeline), so
// "which tier game is this player's team in this week" uses the same static
// team field for all 3 weeks. Python re-resolves each player's actual team per
// week (handling real trades); this is the honest, unavoidable JS-side analog.
function teamTierForWeek(games, team) {
  for (const g of games) if (g.teams.includes(team)) return g.tier;
  return null;
}

function computeWeekRisk(games, roster) {
  let meaningful = 0, qbBestRank = 0;
  for (const p of roster) {
    const tier = teamTierForWeek(games, p.team);
    if (!tier) continue;
    const rank = TIER_RANK[tier] || 0;
    if (rank >= TIER_RANK.C) meaningful++;
    if (p.position === 'QB') qbBestRank = Math.max(qbBestRank, rank);
  }
  const meaningfulAdj = meaningful >= 14 ? 15 : meaningful >= 11 ? 8 : meaningful < 8 ? -10 : 0;
  const qbAdj = qbBestRank >= TIER_RANK.A ? 8 : 0;
  return { meaningful, qbBestRank, meaningfulAdj, qbAdj };
}

function scoreBoomBust(roster, stackAch, options){
  const byPos=getPos(roster), feedback=[], achievements=[];

  // Roster-level adjustments (identical across all 3 weeks)
  const rbsSorted=[...byPos.RB].sort((a,b)=>a.round-b.round);
  const rb1Round=rbsSorted.length>0?rbsSorted[0].round:99;
  const rb1Adj = rb1Round>9?-25:rb1Round>7?-15:rb1Round<=3?8:0;
  const teAdj = byPos.TE.length===1?-10:0;

  if(rb1Round>9) feedback.push(`RB1 R${rb1Round} — Winks 5-yr: RB1 past R9 catastrophic all 5 seasons`);
  else if(rb1Round>7) feedback.push(`RB1 R${rb1Round} — Winks hard cutoff R7; later hurt advance all 5 seasons`);
  else if(rb1Round<=3) feedback.push(`Elite RB1 R${rb1Round} — bell-cow upside secured early`);
  if(byPos.TE.length===1) feedback.push(`1-TE — live player and injury/turnover exposure.`);

  const w17r=computeWeekRisk(WEEK17_GAMES,roster);
  const w16r=computeWeekRisk(WEEK16_GAMES,roster);
  const w15r=computeWeekRisk(WEEK15_GAMES,roster);

  const weekRiskScore=(wr)=>Math.max(0,Math.min(100,60+rb1Adj+teAdj+wr.meaningfulAdj+wr.qbAdj));
  const risk15=weekRiskScore(w15r), risk16=weekRiskScore(w16r), risk17=weekRiskScore(w17r);

  const riskComb=(risk15*RISK_WEEK_WEIGHTS[15]+risk16*RISK_WEEK_WEIGHTS[16]+risk17*RISK_WEEK_WEIGHTS[17])/RISK_TWW;
  const score=Math.max(0,Math.min(100,Math.round(riskComb)));

  if(w17r.meaningful>=14) feedback.push(`${w17r.meaningful} players in meaningful W17 games — live ceiling elevated`);
  else if(w17r.meaningful>=11) feedback.push(`${w17r.meaningful} players in meaningful W17 teams — solid live base`);
  else if(w17r.meaningful<8) feedback.push(`Only ${w17r.meaningful} players in meaningful W17 teams — live player risk`);

  // floorScore/ceilingScore/bbbLabel: Python's Risk has no floor/ceiling split —
  // it's one unified per-week number. Kept as duplicate aliases of the same
  // score (not independently meaningful anymore) purely so GradeDisplay.jsx's
  // BBBDetail component keeps rendering numbers instead of blank dashes.
  // FLAGGED, not silently resolved: see Phase 6 report for the real tradeoff —
  // showing "Floor: X / Ceiling: X" with identical values is a stale UI concept
  // that should be revisited in GradeDisplay.jsx (out of scope for this pass).
  const floorScore=score, ceilingScore=score;
  const label=score>=80?'Well-Balanced':score>=65?'Boom-Leaning':score>=50?'High Variance':'Extreme Variance';

  return {score,floorScore,ceilingScore,label,feedback,achievements};
}

function getPos(r){return {QB:r.filter(p=>p.position==='QB'),RB:r.filter(p=>p.position==='RB'),WR:r.filter(p=>p.position==='WR'),TE:r.filter(p=>p.position==='TE')};}
function getRounds(r){return {r6:r.filter(p=>p.round<=6),r10:r.filter(p=>p.round<=10),r12:r.filter(p=>p.round<=12),r18:r};}
// Rounds capital% to 2 decimals (was 1) to match the Python model exactly —
// 1-decimal rounding could flip a quartile bucket at a knife-edge boundary
// (e.g. true 46.795% -> JS rounded to 46.8, tipping over a 46.8 threshold that
// Python's 46.78 stayed under), causing up to ~16pt Value swings. Diagnosed
// during the Phase 6 scale-parity check.
function getCapital(r){const m={};let t=0;for(const p of r){const c=Math.max(0,19-p.round);t+=c;m[p.position]=(m[p.position]||0)+c;}const o={};for(const pos of ['QB','RB','WR','TE'])o[pos]=t>0?Math.round((m[pos]||0)/t*10000)/100:0;return o;}
function buildBBM6Context(r){return {highOwnershipPlayers:r.filter(p=>BBM6_HIGH_OWNERSHIP[p.name]).map(p=>({name:p.name,ownership:BBM6_HIGH_OWNERSHIP[p.name]}))};}

// ── PICK NUMBER DEVIATION ──
// Enhanced CLV using actual pick number within the 12-team snake draft.
// Both normalised to round-equivalents: pickNumber/12 vs adp/12.
// Positive = drafted later than ADP round equivalent = patient = value found.
function computePickDeviation(picks){
  const valid=picks.filter(p=>p.adp&&p.adp>0&&p.pickNumber&&p.pickNumber>0);
  if(valid.length===0) return null;
  let totalWeightedDev=0,totalWeight=0;
  for(const p of valid){
    const weight=Math.max(0,19-p.round);
    const dev=p.pickNumber/12-p.adp/12; // positive = picked later than ADP = patient
    totalWeightedDev+=weight*dev;
    totalWeight+=weight;
  }
  return totalWeight>0?totalWeightedDev/totalWeight:null;
}

// ── GRADE CONFIDENCE ──
// High = full data (ADP coverage, full roster, multi-team, all positions)
// Medium = partial data
// Low = limited data (no ADP, thin roster)
function computeGradeConfidence(roster){
  const picksWithAdp=roster.filter(p=>p.adp&&p.adp>0);
  const adpCoverage=roster.length>0?picksWithAdp.length/roster.length:0;
  const teamsRepresented=new Set(roster.map(p=>p.team).filter(Boolean)).size;
  const positions=new Set(roster.map(p=>p.position).filter(Boolean));
  const hasAllPositions=['QB','RB','WR','TE'].every(pos=>positions.has(pos));
  const rosterSize=roster.length;
  let pts=0;
  if(adpCoverage>=0.75) pts+=2; else if(adpCoverage>=0.4) pts+=1;
  if(rosterSize>=16) pts+=1;
  if(teamsRepresented>=8) pts+=1;
  if(hasAllPositions) pts+=1;
  if(pts>=4) return'High';
  if(pts>=2) return'Medium';
  return'Low';
}

function buildStrengths(c,v,s,rk){
  const out=[];
  if(c.score>=70){
    const d=c.detail;
    if(d.rbR6>=2) out.push(`Early RB depth: ${d.rbR6} RBs through R6 — BBM V/VI optimal`);
    if(d.qbTotal===3&&d.qb3Round>=8) out.push(`3-QB w/ cheap QB3 (R${d.qb3Round}) — BBM VI winning pattern`);
    if(d.wrTotal>=8&&d.wrTotal<=9) out.push(`Optimal WR count (${d.wrTotal}) — modern data peak at 8-9 WRs`);
    // 3-TE removed: TE_TOT[3]=-0.63 in new data; 1-2 TE outperforms
  }
  if(v.score>=65){
    const d=v.detail;
    if(d.teQuartile&&d.teQuartile.l==='Q1') out.push(`TE capital Q1 — positive TE investment (+0.99pp)`);
    if(d.qbQuartile&&d.qbQuartile.l==='Q2') out.push(`QB capital optimal Q2 — best QB spend band`);
    if(d.qbQuartile&&d.qbQuartile.l==='Q4') out.push(`Efficient QB spend (Q4) — slightly positive signal (+0.59pp) in modern data`);
    if(d.rbQuartile&&d.rbQuartile.l==='Q1') out.push(`RB capital Q1 — modest positive signal (+0.62pp)`);
    if(d.adpDelta&&d.adpDelta>1.0) out.push(`Patient drafter — heavy value hunting (+1.56pp) modern optimal`);
  }
  if(s.score>=60){
    if(s.detail.bothQbsStacked) out.push(`Both QBs game-stacked — $31.28 EV construct`);
    if(s.detail.stackedSkillPlayers>=4) out.push(`${s.detail.stackedSkillPlayers} stacked skill players — elite profile`);
    if(s.detail.w17GameStackDetails&&s.detail.w17GameStackDetails.length>0) out.push(`W17 ${s.detail.w17GameStackDetails[0].tier}-tier stack: ${s.detail.w17GameStackDetails[0].game}`);
  }
  return out.slice(0,4);
}

function buildWeaknesses(c,v,s,rk){
  const out=[];
  if(s.score<50){
    if(!s.detail.w17GameStackDetails||!s.detail.w17GameStackDetails.length) out.push(`No W17 game stack — biggest single EV gap`);
    if(s.detail.stackedSkillPlayers<4) out.push(`Only ${s.detail.stackedSkillPlayers} stacked skill players — top teams averaged 4+`);
  }
  const d=c.detail;
  if(d.rbR6<=1) out.push(`Thin early RB — fewer than 2 RBs through R6 underperformed both years`);
  // 1-TE removed: TE_TOT[1]=+1.67pp in new data; construction signal is positive
  if(d.qbTotal===1) out.push(`1-QB — only 0.6% BBM VI finalists`);
  if(d.wrTotal>=10) out.push(`${d.wrTotal} WRs — diminishing returns past 9 (bottom quartile advance)`);
  const vd=v.detail;
  if(vd.rbQuartile&&vd.rbQuartile.l==='Q4') out.push(`RB underspend Q4 — strongly negative (-1.01pp)`);
  if(vd.qbQuartile&&vd.qbQuartile.l==='Q1') out.push(`QB overspend Q1 — modestly negative (-0.64pp)`);
  if(vd.teQuartile&&vd.teQuartile.l==='Q4') out.push(`TE underspend Q4 — modestly negative (-0.62pp)`);
  // QB Q4 removed: Q4 QB spend is +0.59pp positive in modern data — not a weakness
  return out.slice(0,4);
}

// ── STRENGTH & FRAGILITY FLAGS ──
export function computeFlags(roster, scores, stackDetail, archetype) {
  const { construction: C, value: V, stack: S, bbb, floorScore, ceilingScore, overall: O } = scores;
  const strengths = [];
  const fragilities = [];

  const byPos = {
    QB: roster.filter(p => p.position === 'QB'),
    RB: roster.filter(p => p.position === 'RB'),
    WR: roster.filter(p => p.position === 'WR'),
    TE: roster.filter(p => p.position === 'TE'),
  };

  // Local expanded set adds GB for fragility check
  const QB_STRONG_EXPANDED = new Set([...QB_TIERS.STRONG, 'GB']);

  const rb1 = [...byPos.RB].sort((a,b) => a.round - b.round)[0];
  const wr1 = [...byPos.WR].sort((a,b) => a.round - b.round)[0];
  const te1 = [...byPos.TE].sort((a,b) => a.round - b.round)[0];
  const rbsThruR6   = byPos.RB.filter(p => p.round <= 6);
  const eliteQBs    = byPos.QB.filter(p => QB_TIERS.ELITE.includes(p.team));
  const eliteTE     = byPos.TE.filter(p => ELITE_TES.includes(p.name));
  const dzRBsFound  = byPos.RB.filter(p => DEAD_ZONE_RBS.includes(p.name) && p.round >= 4 && p.round <= 8);
  const w17Stacks   = stackDetail?.w17GameStackDetails || [];
  const w17Both     = w17Stacks.filter(g => g.both);

  // ── STRENGTHS ──

  // ELITE_WR_ANCHOR — WR1 drafted rounds 1-3
  if (wr1 && wr1.round <= 3) {
    strengths.push({
      id: 'ELITE_WR_ANCHOR',
      label: 'Elite WR Anchor',
      detail: `${wr1.name} (R${wr1.round}) secures an elite WR1 floor regardless of QB outcomes.`,
      source: 'calibrated',
    });
  }

  // STRONG_EARLY_RB / BELL_COW_SECURED
  if (rbsThruR6.length >= 2) {
    strengths.push({
      id: 'STRONG_EARLY_RB',
      label: 'Strong Early RB Foundation',
      detail: `${rbsThruR6.map(p => p.name).join(' + ')} — ${rbsThruR6.length} RBs through R6 matches the BBM V+VI optimal construction pattern.`,
      source: 'calibrated',
    });
  } else if (rb1 && rb1.round <= 3) {
    strengths.push({
      id: 'BELL_COW_SECURED',
      label: 'Bell-Cow Secured Early',
      detail: `${rb1.name} at R${rb1.round} — elite RB1 secured early. Live-player attrition risk reduced.`,
      source: 'calibrated',
    });
  }

  // ELITE_W17_STACK / MULTIPLE_W17_PATHS
  if (w17Both.some(g => g.tier === 'S')) {
    strengths.push({
      id: 'ELITE_W17_STACK',
      label: 'Elite W17 Game Stack',
      detail: 'S-tier bring-back game stack — highest single-game EV in the format.',
      source: 'calibrated',
    });
  } else if (w17Stacks.filter(g => g.tier === 'S' || g.tier === 'A').length >= 2) {
    strengths.push({
      id: 'MULTIPLE_W17_PATHS',
      label: 'Multiple W17 Paths',
      detail: `${w17Stacks.length} Week 17 game stacks (S/A tier) — redundant leverage paths reduce single-game dependency.`,
      source: 'analyst',
    });
  } else if (w17Stacks.length >= 2) {
    strengths.push({
      id: 'MULTIPLE_W17_PATHS',
      label: 'Multiple W17 Paths',
      detail: `${w17Stacks.length} Week 17 game stacks — multiple championship-week correlation paths.`,
      source: 'analyst',
    });
  }

  // ELITE_TE_ANCHOR
  if (eliteTE.length > 0) {
    strengths.push({
      id: 'ELITE_TE_ANCHOR',
      label: 'Elite TE Anchor',
      detail: `${eliteTE.map(p => p.name).join(', ')} — elite TE elevates both floor and weekly ceiling.`,
      source: 'calibrated',
    });
  }

  // QB_VALUE_STRUCTURE — 2+ QBs with at least one in elite/strong tier
  if (byPos.QB.length >= 2 && (eliteQBs.length > 0 || byPos.QB.some(p => QB_TIERS.STRONG.includes(p.team)))) {
    const topTwo = [...byPos.QB].sort((a,b) => a.round - b.round).slice(0, 2);
    strengths.push({
      id: 'QB_VALUE_STRUCTURE',
      label: 'Multi-QB Stack Structure',
      detail: `${topTwo.map(p => p.name).join(' + ')} — dual QB stack structure with championship-week leverage.`,
      source: 'analyst',
    });
  }

  // STRONG_ADP_DISCIPLINE — value score >= 78
  if (V >= 78) {
    strengths.push({
      id: 'STRONG_ADP_DISCIPLINE',
      label: 'Strong ADP Discipline',
      detail: `Value score ${V} — patient drafting pattern captures the +1.56 pts efficiency edge from BBM V+VI calibration.`,
      source: 'calibrated',
    });
  }

  // CLEAN_CONSTRUCTION — construction score >= 82
  if (C >= 82) {
    strengths.push({
      id: 'CLEAN_CONSTRUCTION',
      label: 'Clean Construction',
      detail: `Construction score ${C} — positional allocation aligns with BBM V+VI elite-team patterns.`,
      source: 'model',
    });
  }

  // ── FRAGILITIES ──

  // THIN_WR_ROOM — fewer than 7 WRs
  if (byPos.WR.length < 7) {
    fragilities.push({
      id: 'THIN_WR_ROOM',
      label: 'Thin WR Room',
      detail: `Only ${byPos.WR.length} WRs — below the 8-9 optimal band. Modern data penalizes WR rooms under 7.`,
      source: 'calibrated',
    });
  }

  // THIN_WR_DEPTH — fewer than 2 WRs after round 10 (only if WR count is otherwise OK)
  const wrsAfterR10 = byPos.WR.filter(p => p.round > 10);
  if (byPos.WR.length >= 7 && wrsAfterR10.length < 2) {
    fragilities.push({
      id: 'THIN_WR_DEPTH',
      label: 'Thin WR Depth',
      detail: `Only ${wrsAfterR10.length} WR${wrsAfterR10.length !== 1 ? 's' : ''} after Round 10 — limited late-round depth reduces ceiling redundancy.`,
      source: 'analyst',
    });
  }

  // NO_ELITE_QB — no QB in elite tier
  if (eliteQBs.length === 0) {
    fragilities.push({
      id: 'NO_ELITE_QB',
      label: 'No Elite QB Tier',
      detail: 'No QB from an elite-tier offense — stack ceiling is compressed vs. rosters with elite-game access.',
      source: 'calibrated',
    });
  }

  // DEAD_ZONE_RB
  if (dzRBsFound.length > 0) {
    fragilities.push({
      id: 'DEAD_ZONE_RB',
      label: 'Dead Zone RB Risk',
      detail: `${dzRBsFound.map(p => p.name).join(', ')} — overpriced mid-round RB(s) per 2026 meta signals.`,
      source: 'calibrated',
    });
  }

  // NO_W17_STACK — no Week 17 game stacks
  if (w17Stacks.length === 0) {
    fragilities.push({
      id: 'NO_W17_STACK',
      label: 'No W17 Game Stack',
      detail: 'No Week 17 game correlation — biggest single EV lever in the format. Top teams averaged 1+ W17 stacks.',
      source: 'calibrated',
    });
  }

  // HEAVY_TEAM_CONCENTRATION — any team has 5+ players
  const teamCounts = {};
  for (const p of roster) { if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1; }
  const heavyTeams = Object.entries(teamCounts).filter(([, n]) => n >= 5);
  if (heavyTeams.length > 0) {
    const [team, count] = heavyTeams.sort((a,b) => b[1] - a[1])[0];
    fragilities.push({
      id: 'HEAVY_TEAM_CONCENTRATION',
      label: 'Heavy Team Concentration',
      detail: `${count} players from ${team} — concentrated team exposure creates correlated bust risk.`,
      source: 'analyst',
    });
  }

  // CORELESS_STACK — team stacks exist but no QB in elite/strong tier
  const hasTeamStacks = (stackDetail?.teamStackDetails?.length || 0) > 0 || (stackDetail?.teamStackBonus || 0) > 0;
  if (hasTeamStacks && eliteQBs.length === 0 && !byPos.QB.some(p => QB_STRONG_EXPANDED.has(p.team))) {
    fragilities.push({
      id: 'CORELESS_STACK',
      label: 'Coreless Stack',
      detail: 'Team stacks without an elite/strong QB — correlation exists but ceiling is compressed without a premium QB game environment.',
      source: 'analyst',
    });
  }

  // FRAGILE_TE_ROOM — 1 TE, not elite
  if (byPos.TE.length === 1 && eliteTE.length === 0) {
    fragilities.push({
      id: 'FRAGILE_TE_ROOM',
      label: 'Fragile TE Room',
      detail: '1 TE with no elite-tier player — single-point TE failure risk with no ceiling to offset it.',
      source: 'analyst',
    });
  }

  // LATE_RB1 — RB1 drafted after round 7
  if (rb1 && rb1.round > 7) {
    fragilities.push({
      id: 'LATE_RB1',
      label: 'Late RB1',
      detail: `${rb1.name} at R${rb1.round} — Winks 5-year data: RB1 past R7 hurt advance rates all five seasons.`,
      source: 'calibrated',
    });
  }

  // Sort by source priority: calibrated → analyst → model
  const srcPriority = { calibrated: 0, analyst: 1, model: 2 };
  strengths.sort((a,b)  => srcPriority[a.source] - srcPriority[b.source]);
  fragilities.sort((a,b) => srcPriority[a.source] - srcPriority[b.source]);

  return { strengths, fragilities };
}

// ── IMPROVEMENT SUGGESTION ──
// Surfaces the single highest-impact structural improvement as a positive,
// forward-looking "path to a better grade" (priority-ranked, first match wins).
export function computeImprovementSuggestion(roster, scores, stackDetail, flags) {
  const byPos = {
    QB: roster.filter(p => p.position === 'QB'),
    RB: roster.filter(p => p.position === 'RB'),
    WR: roster.filter(p => p.position === 'WR'),
    TE: roster.filter(p => p.position === 'TE'),
  };

  const w17Stacks = stackDetail?.w17GameStackDetails || [];
  const bestW17 = [...w17Stacks].sort((a, b) => (b.bonus || 0) - (a.bonus || 0))[0];
  const fragIds = (flags?.fragilities || []).map(f => f.id);

  // Priority-ranked checks — return the FIRST that applies (highest impact first)

  // 1. No meaningful W17 stack at all — biggest ceiling problem
  if (!w17Stacks.length || (bestW17?.bonus || 0) < 6) {
    return {
      type: 'structural',
      headline: 'Add a Week 17 game stack',
      detail: 'Your roster has no meaningful championship-week correlation. ' +
        'Adding two players from the same Week 17 game — ideally one of your ' +
        'QBs plus a target — is the single biggest ceiling improvement available.',
    };
  }

  // 2. Best stack is in a low-tier game — ceiling capped by environment
  const bestTier = bestW17?.tier;
  if (bestTier === 'C' || bestTier === 'D') {
    return {
      type: 'structural',
      headline: 'Raise your Week 17 game environment',
      detail: `Your top stack is in a ${bestTier}-tier game — solid structure, ` +
        'but a lower-scoring projected environment caps your ceiling. A stack in ' +
        'an S or A-tier game (higher projected shootout) would raise your ' +
        'championship-week upside most.',
    };
  }

  // 3. QB with no stack partner
  const qbTeams = new Set(byPos.QB.map(q => q.team).filter(Boolean));
  const hasQBStack = byPos.QB.some(qb =>
    roster.some(p => p.team === qb.team && p.position !== 'QB')
  );
  if (!hasQBStack && byPos.QB.length > 0) {
    const topQB = [...byPos.QB].sort((a, b) => a.round - b.round)[0];
    return {
      type: 'structural',
      headline: 'Stack your QB',
      detail: `${topQB?.name || 'Your QB'} has no pass-catcher from his team on ` +
        'your roster. Pairing your QB with his WR1 is the highest-correlation ' +
        'move in best ball and would meaningfully lift your ceiling.',
    };
  }

  // 4. Best stack has no bring-back
  if (bestW17 && !bestW17.both) {
    return {
      type: 'structural',
      headline: 'Complete your stack with a bring-back',
      detail: `Your ${bestW17.game} stack only covers one side. Adding a player ` +
        'from the opposing team captures the full shootout — bring-backs are a ' +
        'common thread among championship rosters.',
    };
  }

  // 5. Thin WR room
  if (byPos.WR.length < 8) {
    return {
      type: 'structural',
      headline: `Add an ${byPos.WR.length === 7 ? '8th' : 'additional'} WR`,
      detail: `You have ${byPos.WR.length} WRs — below the 8-9 optimal band our ` +
        'data validates. Another WR is the single biggest structural improvement ' +
        'to your construction.',
    };
  }

  // 6. Late RB1
  const rb1 = [...byPos.RB].sort((a, b) => a.round - b.round)[0];
  if (!rb1 || rb1.round > 9) {
    return {
      type: 'structural',
      headline: 'Secure an earlier RB',
      detail: 'Your first RB came late, which historically lowers floor. An ' +
        'earlier-round RB would stabilize your weekly baseline.',
    };
  }

  // 7. Heavy/early TE investment
  const teList = [...byPos.TE].sort((a, b) => a.round - b.round);
  if (teList.length >= 3 && teList[2]?.round <= 10) {
    return {
      type: 'structural',
      headline: 'Reallocate premium TE capital',
      detail: `Your 3rd TE (${teList[2]?.name}, R${teList[2]?.round}) used a ` +
        'meaningful pick. Modern data favors 1-2 TEs — that capital often ' +
        'returns more at WR.',
    };
  }

  // Fallback — roster is strong, suggest the marginal edge
  return {
    type: 'structural',
    headline: 'Push for a premium stack',
    detail: 'This is a well-built roster. The marginal edge to contender status ' +
      'is deepening your best stack — an additional high-quality player in your ' +
      'top Week 17 game raises ceiling without sacrificing structure.',
  };
}

// ── NARRATIVE GENERATOR ──
/**
 * Generates the archetype-specific narrative paragraph for Straight Talk.
 * Uses player enrichment flags to create specific, roster-aware commentary.
 * @param {Array}  roster       — submitted roster array
 * @param {Object} scores       — { construction, value, stack, risk, overall }
 * @param {string} archetype    — archetype name
 * @param {Object} archetypeInfo — ARCHETYPES[archetype]
 * @param {Object} stackData    — result.stackDetail (has w17GameStackDetails)
 */
export function generateNarrative(roster, scores, archetype, archetypeInfo, stackData) {
  const { construction: C, value: V, stack: S, risk: R, overall: O } = scores;

  // Key players by position, sorted by draft round
  const qbs = roster.filter(p => p.position === 'QB').sort((a,b) => a.round - b.round);
  const rbs = roster.filter(p => p.position === 'RB').sort((a,b) => a.round - b.round);
  const wrs = roster.filter(p => p.position === 'WR').sort((a,b) => a.round - b.round);
  const tes = roster.filter(p => p.position === 'TE').sort((a,b) => a.round - b.round);

  const qb1 = qbs[0], rb1 = rbs[0], wr1 = wrs[0], te1 = tes[0];

  // Player flags
  const qb1Flag = qb1 ? getPlayerFlag(qb1.name) : null;
  const te1Flag  = te1  ? getPlayerFlag(te1.name)  : null;

  // Top W17 stack (by bonus, highest first)
  const w17Details = (stackData?.w17GameStackDetails || []).slice().sort((a,b) => b.bonus - a.bonus);
  const topStack     = w17Details[0] || null;
  const topStackGame = topStack?.game  || null;
  const topStackTier = topStack?.tier  || null;

  // QB1's team stacks (non-QB teammates in roster)
  const qb1Team      = qb1?.team || null;
  const qb1Mates     = qb1Team ? roster.filter(p => p.team === qb1Team && p.position !== 'QB') : [];
  const qb1MateNames = qb1Mates.map(p => p.name).join(', ');

  const hook     = _buildHook(archetype, qb1, qbs.length);
  const body     = _buildBody(archetype, {
    qb1, rb1, wr1, te1, qb1Flag, te1Flag,
    topStackGame, topStackTier, qb1MateNames,
    qbs, wrs, rbs, tes, C, V, S, R, O,
  });
  const weakness = _buildWeaknessNote(archetype, { C, V, S, R, wrs, rbs, tes });

  return { hook, body, weakness };
}

function _buildHook(archetype, qb1, qbCount) {
  const hooks = {
    'The Blueprint':        'This is the roster everyone else is trying to build.',
    'The Apex Predator':    'The field will second-guess this roster. Let them.',
    'Value Merchant':       "You let the market come to you. Most drafters reach. You didn't.",
    'The Juggernaut':       'High floor. Steady force. Built to make the playoffs.',
    'Glass Cannon':         "You didn't come here to make the playoffs. You came here to win.",
    'The Sentinel':         'No conventional stack. No apology.',
    'The Tactician':        'Balanced. No glaring weakness. No dominant strength.',
    'The Sprinter':         'Built for early production. The question is December.',
    'Lightning in a Bottle':'High variance. High ceiling. Needs the bolt to strike.',
    'The Long Shot':        'This roster needs things to break right. Here is what that looks like.',
  };
  if (archetype === 'The Apex Predator' && qbCount >= 3) {
    return `The field will second-guess a ${qbCount}-QB build. Let them.`;
  }
  return hooks[archetype] || hooks['The Tactician'];
}

function _buildBody(archetype, ctx) {
  const { qb1, rb1, wr1, te1, qb1Flag, te1Flag,
    topStackGame, topStackTier, qb1MateNames,
    qbs, wrs, rbs, tes, C, V, S, R, O } = ctx;

  const qb1Name  = qb1?.name  || 'your QB';
  const qb1Round = qb1?.round || '?';
  const rb1Name  = rb1?.name  || 'your RB1';
  const wr1Name  = wr1?.name  || 'your WR1';
  const te1Name  = te1?.name  || 'your TE';

  const qb1Hook    = qb1Flag?.narrative_hook  || `${qb1Name} at R${qb1Round} as your primary QB.`;
  const te1Hook    = te1Flag?.narrative_hook  || `${te1Name} as your TE anchor.`;
  const te1Risk    = te1Flag?.role_risk  ? ` The qualifier: ${te1Flag.role_risk}.`  : '';
  const qb1Risk    = qb1Flag?.role_risk  ? ` Note: ${qb1Flag.role_risk}.`          : '';
  const qb1Weapon  = qb1Flag?.weapon_context ? ` Context: ${qb1Flag.weapon_context}.` : '';

  const stackLine  = topStackGame
    ? `${topStackGame} Week 17 is your highest-leverage game${topStackTier ? ` [${topStackTier}-tier]` : ''}.`
    : 'Your W17 stack profile drives your ceiling.';

  switch (archetype) {
    case 'The Blueprint':
      return `${qb1Hook} ${rb1Name} anchoring your early rounds, ${te1Name} as your TE1.${te1Risk} Four components above the 75th percentile. Only 2.5% of elite teams reach this tier. ${stackLine}`;

    case 'The Apex Predator': {
      const multiQB = qbs.length >= 3
        ? `Two quarterbacks with real paths: ${qb1Name} at R${qb1Round}${qb1Weapon ? ' — ' + qb1Flag.weapon_context : ''} and ${qbs[1]?.name} at R${qbs[1]?.round} as your ceiling play.`
        : `${qb1Name} at R${qb1Round} as your stack driver.${qb1Weapon}`;
      return `${multiQB} ${wr1Name} at R${wr1?.round} gives you elite WR1 production regardless of QB room outcomes. ${te1Hook}${te1Risk} ${stackLine}`;
    }

    case 'Value Merchant':
      return `${qb1Hook}${qb1Risk} ${rb1Name} gives you construction backbone with the value discipline maintained throughout. ADP patience across the board — the round-weighted deviation shows consistent discipline where others tend to panic. ${stackLine}`;

    case 'The Juggernaut':
      return `${rb1Name} secured early, ${te1Name} as your TE anchor.${te1Risk} ${qb1Hook}${qb1Risk} Strong construction and risk profile throughout — this roster doesn't rely on variance to be competitive. ${stackLine}`;

    case 'Glass Cannon':
      return `${qb1Name} stacked with ${qb1MateNames || 'primary stack targets'}. ${stackLine} ${te1Hook}${te1Risk} This roster has one mode — if the stack detonates, nothing else matters.`;

    case 'The Sentinel':
      return `${qb1Hook} ${rb1Name} anchoring your backfield, elite construction discipline throughout. This is a contrarian path — broad scoring production rather than W17 concentration. If the S-tier stacks bust and your balanced roster keeps producing, this looks like the right call.`;

    case 'The Tactician':
      return `${qb1Hook}${qb1Risk} ${rb1Name} early, ${te1Name} as your TE. Construction and value both in the expected range. ${stackLine} This roster doesn't rely on any single thing going right — and doesn't have a ceiling play that breaks it open.`;

    case 'The Sprinter':
      return `${qb1Hook} ${rb1Name} giving you early foundation. The risk score flags durability concerns — watch the R7-R12 range where Sprinter rosters typically show attrition. If key players stay healthy through December, the value captured early pays off.`;

    case 'Lightning in a Bottle':
      return `${qb1Name} at R${qb1Round} with ${qb1MateNames || 'stack targets'} as your primary W17 path.${qb1Risk} Construction and value scores are lower — but ${topStackGame || 'your top stack'} is a real leverage play. Twenty percent of BBM V+VI finalists had this structural profile. Lightning does hit.`;

    case 'The Long Shot':
      return `${qb1Name} at R${qb1Round} as your QB anchor.${qb1Risk}${qb1Weapon} The engine sees lower scores across construction and risk. But 13.5% of BBM VI finalists had this exact structural profile — variance is a real path. ${stackLine}`;

    default:
      return `${qb1Hook} ${stackLine}`;
  }
}

function _buildWeaknessNote(archetype, ctx) {
  const { C, V, S, R, wrs, rbs, tes } = ctx;
  const wrCount = wrs.length, rbCount = rbs.length, teCount = tes.length;

  if (wrCount < 8) {
    return `${wrCount} WRs is one short of the 8-9 optimal band our data validates. That is the difference between this grade and a higher one. Not a crisis — just where points were left on the table.`;
  }
  if (teCount > 2) {
    return `${teCount} TEs uses roster space that modern data shows performs better as additional WR depth. 1-2 TEs outperforms 3-TE construction in BBM V+VI.`;
  }
  if (C < 75) {
    return `Construction score flags a positional allocation concern — review where the early-round capital went versus the optimal distribution.`;
  }
  if (S < 75) {
    return `Stack score indicates limited W17 game concentration. The championship week leverage is thinner than the top archetypes.`;
  }
  if (R < 75) {
    return `Risk score flags live-player attrition concerns — watch the roster for role changes through August camp.`;
  }
  return `Value score (${V}) is the area with the most room to grow — ADP discipline in the middle rounds is where the next tier of improvement lives.`;
}
