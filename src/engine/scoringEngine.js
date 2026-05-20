import { WEEK17_GAMES, WEEK16_GAMES, WEEK15_GAMES, QB_TIERS, MEANINGFUL_W17_TEAMS, DEAD_ZONE_RBS, ELITE_TES, BBM6_HIGH_OWNERSHIP } from '../data/stackingData.js';

export function gradeTeam(roster, options = {}) {
  if (!roster || roster.length === 0) return null;
  const construction = scoreConstruction(roster);
  const value = scoreValue(roster);
  const stack = scoreStack(roster);
  const risk = scoreRisk(roster, stack.achievements, options);
  const overallScore = Math.round(construction.score*0.35 + value.score*0.35 + stack.score*0.20 + risk.score*0.10);
  const overallGrade = scoreToGrade(overallScore);
  const allAch = [...construction.achievements, ...value.achievements, ...stack.achievements, ...risk.achievements];
  return {
    overallGrade, overallScore,
    constructionScore:construction.score, valueScore:value.score, stackScore:stack.score, riskScore:risk.score,
    constructionFeedback:construction.feedback, valueFeedback:value.feedback, stackFeedback:stack.feedback, riskFeedback:risk.feedback,
    constructionDetail:construction.detail, valueDetail:value.detail, stackDetail:stack.detail,
    topStrengths:buildStrengths(construction,value,stack,risk),
    topWeaknesses:buildWeaknesses(construction,value,stack,risk),
    achievements:allAch,
    bbm6Context:buildBBM6Context(roster)
  };
}

function scoreToGrade(s){if(s>=97)return'A+';if(s>=93)return'A';if(s>=90)return'A-';if(s>=87)return'B+';if(s>=83)return'B';if(s>=80)return'B-';if(s>=77)return'C+';if(s>=73)return'C';if(s>=70)return'C-';if(s>=60)return'D';return'F';}

// ── CONSTRUCTION (35%) ──
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

  const WR_R6={0:-2.25,1:-1.38,2:-0.35,3:0.0,4:-0.75,5:-1.90,6:-2.28};
  const WR_R10={0:-5.87,1:-2.60,2:-1.37,3:-0.19,4:0.43,5:0.0,6:-0.63,7:-1.87,8:-5.31,9:-7.62};
  const WR_TOT={3:-11.62,4:-5.37,5:-1.87,6:0.21,7:0.64,8:0.0,9:-0.59,10:-1.84,11:-5.67,12:-7.06};
  // AMENDMENT 9: 2 AND 3 early RBs equal (BBM V optimal=2 avg142.9, BBM VI optimal=3 avg124.7)
  const RB_R6={0:-3.20,1:-1.80,2:1.80,3:1.80,4:2.50,5:-2.93,6:-7.01};
  const RB_R10={0:-8.10,1:-4.71,2:-2.65,3:-0.90,4:0.0,5:0.25,6:-2.94,7:-8.10};
  const RB_TOT={2:-10.56,3:-3.95,4:-0.35,5:0.44,6:0.0,7:-0.83,8:-2.37,9:-5.91};
  const TE_TOT={1:-4.28,2:-1.52,3:0.0,4:-0.87,5:-2.47};

  const wrR6D=WR_R6[Math.min(wrR6,6)]??-2.28;
  const wrR10D=WR_R10[Math.min(wrR10,9)]??-7.62;
  const wrTotD=WR_TOT[Math.min(wrTotal,12)]??-7.06;
  const rbR6D=RB_R6[Math.min(rbR6,6)]??-7.01;
  const rbR10D=RB_R10[Math.min(rbR10,7)]??-8.10;
  const rbTotD=RB_TOT[Math.min(rbTotal,9)]??-5.91;
  const teD=TE_TOT[Math.min(teTotal,5)]??-2.47;

  // AMENDMENT 6: 3-QB bonus conditioned on QB3 draft round (cheap QB3 = the real edge)
  let qbD;
  const qbsByRound=[...byPos.QB].sort((a,b)=>a.round-b.round);
  const qb3Round=qbsByRound.length>=3?qbsByRound[2].round:null;
  if(qbTotal===1) qbD=-2.59;
  else if(qbTotal===2) qbD=0.80;
  else if(qbTotal===3){
    if(qb3Round>=8){qbD=1.80; feedback.push(`3-QB with cheap QB3 (R${qb3Round}) — the BBM VI winning pattern (Purdy/Young/Shough all drafted late)`);}
    else if(qb3Round>=5){qbD=0.80; feedback.push(`3-QB but QB3 at R${qb3Round} — the BBM VI 3-QB edge came from cheap late QBs, not paying up`);}
    else{qbD=0.0; feedback.push(`3-QB but QB3 reached at R${qb3Round} — no structural edge; the edge is cheap-QB3, not QB3 in the abstract`);}
  }
  else if(qbTotal>=4) qbD=0.0;
  else qbD=0.0;
  detail.qb3Round=qb3Round;

  const totalDelta=wrR6D+wrR10D+wrTotD+rbR6D+rbR10D+rbTotD+qbD+teD;
  detail.totalDelta=totalDelta;
  Object.assign(detail,{wrR6D,wrR10D,wrTotD,rbR6D,rbR10D,rbTotD,qbD,teD});
  let score=Math.max(0,Math.min(100,Math.round(65+totalDelta*4)));

  if(wrTotal>=7&&wrTotal<=8) feedback.push(`${wrTotal} total WRs — optimal both BBM V & VI`);
  else if(wrTotal<=5) feedback.push(`Only ${wrTotal} WRs — thin, hurts advance rate`);
  else if(wrTotal>=10) feedback.push(`${wrTotal} WRs — bottom quartile BBM advance`);
  if(rbR6>=3){feedback.push(`${rbR6} RBs through R6 — BBM VI optimal (avg 124.7)`); achievements.push({id:'EARLY_RB',label:'EARLY RB INVESTMENT',icon:'⚔️'});}
  else if(rbR6===2){feedback.push(`2 RBs through R6 — BBM V optimal (avg 142.9), solid foundation`); achievements.push({id:'EARLY_RB',label:'EARLY RB INVESTMENT',icon:'⚔️'});}
  else if(rbR6===1) feedback.push(`1 RB in first 6 rounds — clearly underperformed both years (BBM V 138.7, BBM VI 116.5 vs 142.9/124.7)`);
  else if(rbR6===0) feedback.push(`Zero RB through R6 — high-variance contrarian path. If the BBM7 field overcorrects to early RB (likely given BBM V/VI), the WRs falling to Zero-RB drafters are better players at better prices. Below average historically but viable with elite WR capital — not catastrophic.`);
  if(rbTotal===4&&rbR6>=1) feedback.push(`4-RB build — high variance; BBM VI 4-RB finalists avg 128.7. Viable outlier, graded accordingly.`);
  if(teTotal>=2&&teTotal<=3) feedback.push(`${teTotal} TEs — optimal (3-TE 54.5% BBM VI finalists, BBM V winner had 3)`);
  else if(teTotal===1) feedback.push(`1 TE — significant risk: BBM VI 1-TE finalists avg only 108.4`);
  if(wrR6>=5) feedback.push(`${wrR6} WRs in first 6 rounds — heavy early WR correlated with LOWER scores in BBM VI`);
  // Hero RB (BBM IV: 1 early RB + 5 total = 26.2% advance vs ~16% baseline)
  if(rbR6===1&&rbTotal>=5){feedback.push(`Hero RB build — BBM IV: 1 early RB + strong late RB room hit 26.2% advance rate vs ~16% baseline`); achievements.push({id:'HERO_RB',label:'HERO RB BUILD',icon:'🦸'});}
  if(qbTotal===3) achievements.push({id:'THREE_QB',label:'3-QB STRUCTURE',icon:'🎯'});

  return {score,feedback,detail,achievements};
}

// ── VALUE (35%) — AMENDMENT 3: 60% ADP / 40% capital ──
function scoreValue(roster){
  const feedback=[], detail={}, achievements=[];
  const picksAdp=roster.filter(p=>p.adp&&p.adp>0);
  let adpScore=50;
  if(picksAdp.length>0){
    const devs=picksAdp.map(p=>p.round-p.adp);
    const avgDev=devs.reduce((a,b)=>a+b,0)/devs.length;
    detail.avgAdpDeviation=avgDev;
    let adpDelta;
    if(avgDev<-5)adpDelta=2.23; else if(avgDev<0)adpDelta=3.31; else if(avgDev===0)adpDelta=0.0; else if(avgDev<10)adpDelta=-4.28; else adpDelta=-9.68;
    adpScore=Math.max(0,Math.min(100,Math.round(65+adpDelta*7)));
    detail.adpDelta=adpDelta;
    if(avgDev<-3) feedback.push(`Slight reaches — BBM II-III: slight reaches advance +3.31pp (ADP reflects quality, not value traps)`);
    else if(avgDev>8) feedback.push(`Heavy value hunting — waiting for value underperformed -9.68pp. ADP is efficient`);
    else if(avgDev>2) feedback.push(`Picks slightly after ADP — mild negative signal`);
    // AMENDMENT 4: VALUE_SECURED achievement
    if(avgDev<=0){achievements.push({id:'VALUE_SECURED',label:'VALUE SECURED',icon:'💰'}); feedback.push(`ADP efficiency positive — LGrewe50 (BBM V champion, $1.5M) famously got EVERY pick at/below ADP, the single most-cited factor in his win`);}
    feedback.push(`Note: ADP value calibrated from BBM II-IV. BBM V/VI public datasets had null ADP.`);
  }
  const cap=getCapital(roster); detail.capitalPct=cap;
  const QBQ=[{m:18,l:'Q1',d:-19.02},{m:10,l:'Q2',d:0.0},{m:5,l:'Q3',d:-3.71},{m:0,l:'Q4',d:-20.08}];
  const RBQ=[{m:35,l:'Q1',d:-14.87},{m:20,l:'Q2',d:0.0},{m:10,l:'Q3',d:-3.44},{m:0,l:'Q4',d:-16.94}];
  const WRQ=[{m:40,l:'Q1',d:-14.46},{m:28,l:'Q2',d:0.0},{m:18,l:'Q3',d:2.77},{m:0,l:'Q4',d:-5.66}];
  const TEQ=[{m:15,l:'Q1',d:-2.13},{m:8,l:'Q2',d:0.0},{m:4,l:'Q3',d:8.58},{m:0,l:'Q4',d:-10.50}];
  const gq=(pct,qs)=>{for(const q of qs)if(pct>=q.m)return q; return qs[qs.length-1];};
  const qbQ=gq(cap.QB,QBQ),rbQ=gq(cap.RB,RBQ),wrQ=gq(cap.WR,WRQ),teQ=gq(cap.TE,TEQ);
  Object.assign(detail,{qbQuartile:qbQ,rbQuartile:rbQ,wrQuartile:wrQ,teQuartile:teQ});
  const capDelta=qbQ.d+rbQ.d+wrQ.d+teQ.d;
  const capitalScore=Math.max(0,Math.min(100,Math.round(65+capDelta*2.5)));
  if(qbQ.l==='Q2') feedback.push(`QB capital optimal Q2 (${cap.QB.toFixed(1)}%)`);
  else if(qbQ.l==='Q1'||qbQ.l==='Q4') feedback.push(`QB capital ${qbQ.l} — both over/underspend at QB heavily penalized`);
  if(rbQ.l==='Q1') feedback.push(`RB overspend — extremes hurt (BBM VI top scorers 33.0% vs bottom 32.2%)`);
  if(wrQ.l==='Q3') feedback.push(`WR capital Q3 (+2.77pp) — sweet spot for WR allocation`);
  if(teQ.l==='Q3') feedback.push(`TE capital Q3 (+8.58pp) — strongest single positive capital signal in dataset`);
  else if(teQ.l==='Q4') feedback.push(`TE underspend — Q4 TE (-10.50pp) most penalized allocation`);
  // AMENDMENT 8: WR capital coexistence note
  feedback.push(`Context: BBM VI finalists averaged 46.1% WR capital despite "RB year" framing. WR capital dominance and early-RB edge COEXIST — not competing strategies.`);
  // AMENDMENT 3: 60/40 weighting
  const valueScore=Math.round(adpScore*0.60 + capitalScore*0.40);
  detail.adpScore=adpScore; detail.capitalScore=capitalScore;
  return {score:valueScore,feedback,detail,achievements};
}

// ── STACK (20%) ──
function scoreStack(roster){
  const byPos=getPos(roster), feedback=[], detail={}, achievements=[];
  let score=30;
  let topTier=null;
  for(const qb of byPos.QB){
    if(QB_TIERS.ELITE.includes(qb.team)){if(!topTier||topTier==='VIABLE'||topTier==='STRONG')topTier='ELITE';}
    else if(QB_TIERS.STRONG.includes(qb.team)){if(!topTier||topTier==='VIABLE')topTier='STRONG';}
    else if(!topTier)topTier='VIABLE';
  }
  // AMENDMENT 10: compressed tier gap (value QBs win as often as elite — both years' data)
  const qbTierBonus=topTier==='ELITE'?18:topTier==='STRONG'?16:topTier==='VIABLE'?12:0;
  score+=qbTierBonus; detail.qbTierBonus=qbTierBonus; detail.topQbTier=topTier;

  let teamStackBonus=0, stackedSkill=0; const tsDetails=[];
  for(const qb of byPos.QB){
    const mates=roster.filter(p=>p.team===qb.team&&p.position!=='QB'&&['WR','TE','RB'].includes(p.position));
    if(mates.length>=1){teamStackBonus+=7*mates.length; stackedSkill+=mates.length; tsDetails.push({qb:qb.name,team:qb.team,partners:mates.map(p=>p.name),count:mates.length});}
  }
  teamStackBonus=Math.min(teamStackBonus,25); score+=teamStackBonus;
  Object.assign(detail,{teamStackBonus,teamStackDetails:tsDetails,stackedSkillPlayers:stackedSkill});
  if(stackedSkill>=4){achievements.push({id:'FOUR_PLUS_STACKED',label:'ELITE STACK DEPTH',icon:'⚡'}); feedback.push(`${stackedSkill} skill players stacked — 80% of BBM VI elite teams had 4+`);}
  else if(stackedSkill>=2) feedback.push(`${stackedSkill} skill players stacked — aim for 4+ (elite team profile)`);
  else if(stackedSkill===0) feedback.push(`No team stacks — 80% of BBM VI elite teams had 4+ stacked skill players`);

  let w17=0; const w17D=[];
  for(const g of WEEK17_GAMES){
    const [t1,t2]=g.teams;
    const a=roster.filter(p=>p.team===t1), b=roster.filter(p=>p.team===t2);
    const tot=a.length+b.length, both=a.length>=1&&b.length>=1;
    if(tot>=2){
      const m=g.leverageMultiplier||1.0;
      let bo=g.tier==='S'?(both?25:18):g.tier==='A'?(both?20:14):g.tier==='B'?(both?15:10):g.tier==='C'?(both?8:5):(both?3:2);
      bo=Math.round(bo*m); w17+=bo;
      w17D.push({game:g.game,tier:g.tier,window:g.window,t1:a.map(p=>p.name),t2:b.map(p=>p.name),both,bonus:bo});
      if(both) achievements.push({id:`W17_${g.tier}`,label:`WEEK 17 ${g.tier}-TIER GAME STACK`,icon:'🎯'});
    }
  }
  w17=Math.min(w17,40); score+=w17; Object.assign(detail,{w17GameBonus:w17,w17GameStackDetails:w17D});

  let qbW17Stacked=0;
  for(const qb of byPos.QB){
    if(WEEK17_GAMES.some(g=>g.teams.includes(qb.team)) && roster.some(p=>p.team===qb.team&&['WR','TE'].includes(p.position))) qbW17Stacked++;
  }
  if(qbW17Stacked>=2){score+=10; detail.bothQbsStacked=true; achievements.push({id:'BOTH_QBS_STACKED',label:'DUAL QB GAME STACK',icon:'🔥'}); feedback.push(`Both QBs game-stacked W17 — the $31.28 EV construct (highest EV QB structure per ETR Manifesto)`);}
  else detail.bothQbsStacked=false;
  detail.qbsWithW17GameStack=qbW17Stacked;

  let w16=0; const w16D=[];
  for(const g of WEEK16_GAMES){
    const [t1,t2]=g.teams; const a=roster.filter(p=>p.team===t1),b=roster.filter(p=>p.team===t2);
    const tot=a.length+b.length, both=a.length>=1&&b.length>=1;
    if(tot>=2){const m=g.leverageMultiplier||1.0; let bo=g.tier==='S'?(both?12:8):g.tier==='A'?(both?9:6):g.tier==='B'?(both?6:4):(both?3:2); bo=Math.round(bo*m); w16+=bo; w16D.push({game:g.game,tier:g.tier,bonus:bo,both,window:g.window});}
  }
  w16=Math.min(w16,15); score+=w16; Object.assign(detail,{w16GameBonus:w16,w16StackDetails:w16D});

  let w15=0; const w15D=[];
  for(const g of WEEK15_GAMES){
    const [t1,t2]=g.teams; const a=roster.filter(p=>p.team===t1),b=roster.filter(p=>p.team===t2);
    const tot=a.length+b.length, both=a.length>=1&&b.length>=1;
    if(tot>=2){const m=g.leverageMultiplier||1.0; let bo=g.tier==='S'?(both?8:5):g.tier==='A'?(both?6:4):g.tier==='B'?(both?4:2):(both?2:1); bo=Math.round(bo*m); w15+=bo; w15D.push({game:g.game,tier:g.tier,bonus:bo,both,window:g.window});}
  }
  w15=Math.min(w15,10); score+=w15; Object.assign(detail,{w15GameBonus:w15,w15StackDetails:w15D});

  if(w17D.length>0){const best=[...w17D].sort((a,b)=>b.bonus-a.bonus)[0]; feedback.push(`Top W17 stack: ${best.game} [${best.tier}, ${best.window}]${best.both?' — bring-back detected':' — no bring-back'}`);}
  else{feedback.push(`No W17 game stack — biggest single EV lever. 80% of BBM VI elite teams had ≥1 W17 stack`); score-=15;}
  if(w16>0) feedback.push(`Week 16 correlation — Leone BBM IV: W15/16 stacking actively underutilized by field`);
  if(w15>0) feedback.push(`Week 15 correlation — quarterfinal stacking rarely intentional`);
  score=Math.max(0,Math.min(100,score));
  return {score,feedback,detail,achievements};
}

// ── RISK (10%) ──
function scoreRisk(roster, stackAch, options){
  const byPos=getPos(roster), feedback=[], achievements=[];
  let score=60, penalties=0, bonuses=0;
  const rbs=[...byPos.RB].sort((a,b)=>a.round-b.round);
  const rb1=rbs.length>0?rbs[0].round:99;
  if(rb1>9){penalties+=25; feedback.push(`RB1 R${rb1} — Winks 5-yr: RB1 past R9 catastrophic all 5 seasons`);}
  else if(rb1>7){penalties+=15; feedback.push(`RB1 R${rb1} — Winks hard cutoff R7; later hurt advance all 5 seasons`);}
  else if(rb1<=3){bonuses+=8; feedback.push(`Elite RB1 R${rb1} — bell-cow upside secured early`);}
  const dz=byPos.RB.filter(p=>DEAD_ZONE_RBS.includes(p.name)&&p.round>=4&&p.round<=8);
  if(dz.length>0){penalties+=dz.length*8; feedback.push(`Dead zone RB: ${dz.map(p=>p.name).join(', ')} — overpriced mid-round per 2026 meta`);}
  const eTE=byPos.TE.filter(p=>ELITE_TES.includes(p.name));
  if(eTE.length>0){bonuses+=10; feedback.push(`Elite TE: ${eTE.map(p=>p.name).join(', ')} — TE capital Q3 strongest positive signal (+8.58pp)`); achievements.push({id:'ELITE_TE',label:'ELITE TE SECURED',icon:'✦'});}
  if(byPos.TE.length===1){penalties+=10; feedback.push(`1-TE — BBM VI 1-TE finalists avg only 108.4; live player & ceiling risk`);}
  const meaningful=roster.filter(p=>MEANINGFUL_W17_TEAMS.includes(p.team)).length;
  if(meaningful>=14){bonuses+=15; feedback.push(`${meaningful} players in meaningful W17 games — live ceiling elevated`); achievements.push({id:'LIVE_PLAYERS',label:'HIGH LIVE PLAYER POTENTIAL',icon:'🔋'});}
  else if(meaningful>=11){bonuses+=8; feedback.push(`${meaningful} players in meaningful W17 teams — solid live base`);}
  else if(meaningful<8){penalties+=10; feedback.push(`Only ${meaningful} players in meaningful W17 teams — live player risk`);}
  if(byPos.QB.filter(p=>QB_TIERS.ELITE.includes(p.team)).length>0) bonuses+=8;
  if(!stackAch||stackAch.length===0) penalties+=5;
  const chalk=roster.filter(p=>BBM6_HIGH_OWNERSHIP[p.name]&&BBM6_HIGH_OWNERSHIP[p.name]>=40);
  if(chalk.length>=3) feedback.push(`High BBM VI chalk: ${chalk.map(p=>`${p.name} (${BBM6_HIGH_OWNERSHIP[p.name]}%)`).join(', ')} — reduces differentiation. NOTE: prior-year finalist concentration does NOT transfer; their 2026 ADP has corrected. This is a differentiation flag, not a quality signal.`);
  // AMENDMENT 2: draft timing (Leone BBM IV)
  if(options&&options.draftDate){
    const m=new Date(options.draftDate).getMonth()+1;
    if(m===7||m===8){bonuses+=8; feedback.push(`Drafted ${m===7?'July':'August'} — optimal window for live players & ADP value per BBM II-IV`);}
    else if(m<=6){penalties+=5; feedback.push(`Early draft (${['','Jan','Feb','Mar','Apr','May','Jun'][m]}) — May/June ~52% less likely to have 18 live players vs August (BBM III)`);}
    else if(m>=9) feedback.push(`Late draft — closing-line ADP value more predictive but live player benefit reduced`);
  }
  // AMENDMENT 5: overcorrection market context
  feedback.push(`Market context: BBM overcorrection pattern — BBM V RB-heavy wins → field overloads RB in BBM VI → edge compresses. BBM7 drafters may be overweighting early RB. Consider whether this build zigs when the field zags.`);
  score=Math.max(0,Math.min(100,score-penalties+bonuses));
  return {score,feedback,achievements};
}

function getPos(r){return {QB:r.filter(p=>p.position==='QB'),RB:r.filter(p=>p.position==='RB'),WR:r.filter(p=>p.position==='WR'),TE:r.filter(p=>p.position==='TE')};}
function getRounds(r){return {r6:r.filter(p=>p.round<=6),r10:r.filter(p=>p.round<=10),r12:r.filter(p=>p.round<=12),r18:r};}
function getCapital(r){const m={};let t=0;for(const p of r){const c=Math.max(0,19-p.round);t+=c;m[p.position]=(m[p.position]||0)+c;}const o={};for(const pos of ['QB','RB','WR','TE'])o[pos]=t>0?Math.round((m[pos]||0)/t*1000)/10:0;return o;}
function buildBBM6Context(r){return {highOwnershipPlayers:r.filter(p=>BBM6_HIGH_OWNERSHIP[p.name]).map(p=>({name:p.name,ownership:BBM6_HIGH_OWNERSHIP[p.name]}))};}

function buildStrengths(c,v,s,rk){
  const out=[];
  if(c.score>=70){const d=c.detail; if(d.rbR6>=2)out.push(`Early RB depth: ${d.rbR6} RBs through R6 — BBM V/VI optimal`); if(d.qbTotal===3&&d.qb3Round>=8)out.push(`3-QB w/ cheap QB3 — BBM VI winning pattern`); if(d.wrTotal>=7&&d.wrTotal<=8)out.push(`Optimal WR count (${d.wrTotal})`); if(d.teTotal===3)out.push(`3-TE — 54.5% BBM VI finalists`);}
  if(v.score>=65){const d=v.detail; if(d.teQuartile&&d.teQuartile.l==='Q3')out.push(`TE capital Q3 (+8.58pp) strongest signal`); if(d.qbQuartile&&d.qbQuartile.l==='Q2')out.push(`QB capital optimal Q2`); if(d.adpDelta&&d.adpDelta>2)out.push(`Positive ADP efficiency`);}
  if(s.score>=60){if(s.detail.bothQbsStacked)out.push(`Both QBs game-stacked — $31.28 EV construct`); if(s.detail.stackedSkillPlayers>=4)out.push(`${s.detail.stackedSkillPlayers} stacked skill players — elite profile`); if(s.detail.w17GameStackDetails&&s.detail.w17GameStackDetails.length>0)out.push(`W17 ${s.detail.w17GameStackDetails[0].tier}-tier stack: ${s.detail.w17GameStackDetails[0].game}`);}
  return out.slice(0,4);
}

function buildWeaknesses(c,v,s,rk){
  const out=[];
  if(s.score<50){if(!s.detail.w17GameStackDetails||!s.detail.w17GameStackDetails.length)out.push(`No W17 game stack — biggest single EV gap`); if(s.detail.stackedSkillPlayers<4)out.push(`Only ${s.detail.stackedSkillPlayers} stacked skill players — elite avg 4+`);}
  const d=c.detail;
  if(d.rbR6<=1)out.push(`Thin early RB — 1 early RB underperformed both years vs 2-3`);
  if(d.teTotal===1)out.push(`1-TE — 108.4 avg BBM VI, highest-risk TE construction`);
  if(d.qbTotal===1)out.push(`1-QB — only 0.6% BBM VI finalists`);
  if(d.wrTotal>=10)out.push(`${d.wrTotal} WRs — bottom quartile advance`);
  const vd=v.detail;
  if(vd.teQuartile&&vd.teQuartile.l==='Q4')out.push(`TE underspend Q4 (-10.50pp) most penalized`);
  if(vd.qbQuartile&&vd.qbQuartile.l==='Q4')out.push(`QB underspend Q4 (-20.08pp) near max penalty`);
  return out.slice(0,4);
}
