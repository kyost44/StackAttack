// Canonical test — run with: node test_canonical.mjs

// Inline engine (copy of logic without ES module imports — uses hard-coded data for node test)

const WEEK17_GAMES = [
  { game:"Lions-Bears", teams:["DET","CHI"], tier:"S", leverageMultiplier:undefined },
  { game:"Rams-Buccaneers", teams:["LAR","TB"], tier:"S" },
  { game:"Cowboys-Giants", teams:["DAL","NYG"], tier:"A" },
  { game:"Broncos-Patriots", teams:["DEN","NE"], tier:"A" },
  { game:"Ravens-Bengals", teams:["BAL","CIN"], tier:"A", leverageMultiplier:1.3 },
  { game:"Bills-Dolphins", teams:["BUF","MIA"], tier:"A", window:"Sun 1pm" },
  { game:"Commanders-Jaguars", teams:["WAS","JAX"], tier:"A" },
  { game:"Seahawks-Panthers", teams:["SEA","CAR"], tier:"A" },
  { game:"Texans-Packers", teams:["HOU","GB"], tier:"B", leverageMultiplier:1.15 },
  { game:"Eagles-49ers", teams:["PHI","SF"], tier:"B", leverageMultiplier:1.15 },
  { game:"Colts-Browns", teams:["IND","CLE"], tier:"C" },
  { game:"Chiefs-Chargers", teams:["KC","LAC"], tier:"C" },
  { game:"Steelers-Titans", teams:["PIT","TEN"], tier:"D" },
  { game:"Saints-Falcons", teams:["NO","ATL"], tier:"D" },
  { game:"Vikings-Jets", teams:["MIN","NYJ"], tier:"D" },
  { game:"Raiders-Cardinals", teams:["LV","ARI"], tier:"D" }
];
const WEEK16_GAMES = [
  { game:"Rams-Seahawks", teams:["LAR","SEA"], tier:"S", leverageMultiplier:1.2 },
  { game:"Bills-Broncos", teams:["BUF","DEN"], tier:"S", leverageMultiplier:1.15 },
  { game:"Packers-Bears", teams:["GB","CHI"], tier:"A" },
  { game:"Texans-Eagles", teams:["HOU","PHI"], tier:"A", leverageMultiplier:1.15 },
  { game:"Jaguars-Cowboys", teams:["JAX","DAL"], tier:"A" },
  { game:"Bengals-Colts", teams:["CIN","IND"], tier:"A" },
  { game:"Patriots-Jets", teams:["NE","NYJ"], tier:"A" },
  { game:"Giants-Lions", teams:["NYG","DET"], tier:"B", leverageMultiplier:1.15 },
  { game:"Chargers-Dolphins", teams:["LAC","MIA"], tier:"B" },
  { game:"Buccaneers-Falcons", teams:["TB","ATL"], tier:"B" },
  { game:"Cardinals-Saints", teams:["ARI","NO"], tier:"C" }
];
const WEEK15_GAMES = [
  { game:"Cowboys-Rams", teams:["DAL","LAR"], tier:"S" },
  { game:"Lions-Vikings", teams:["DET","MIN"], tier:"A", leverageMultiplier:1.15 },
  { game:"Bears-Bills", teams:["CHI","BUF"], tier:"A", leverageMultiplier:1.1 },
  { game:"Patriots-Chiefs", teams:["NE","KC"], tier:"A", leverageMultiplier:1.15 },
  { game:"Seahawks-Eagles", teams:["SEA","PHI"], tier:"A" },
  { game:"Chargers-49ers", teams:["LAC","SF"], tier:"A" },
  { game:"Bengals-Panthers", teams:["CIN","CAR"], tier:"A" },
  { game:"Dolphins-Packers", teams:["MIA","GB"], tier:"B" },
  { game:"Ravens-Steelers", teams:["BAL","PIT"], tier:"B" },
  { game:"Browns-Giants", teams:["CLE","NYG"], tier:"B" },
  { game:"Colts-Titans", teams:["IND","TEN"], tier:"C" }
];
const QB_TIERS = {
  ELITE: ["BUF","BAL","DET","PHI","CIN"],
  STRONG: ["SEA","LAR","DAL","KC","HOU","SF"],
  VIABLE: ["GB","DEN","JAX","CHI","NE","MIA","IND","NYG","LAC","WAS"]
};
const BBM6_HIGH_OWNERSHIP = {"Puka Nacua":62.5,"Chris Olave":47.1,"James Cook":45.5,"Kyle Pitts":41.7,"Matthew Stafford":36.2,"Travis Etienne Jr":30.6,"Jaxon Smith-Njigba":29.1,"Jaylen Warren":27.5};
const MEANINGFUL_W17_TEAMS = ["BUF","BAL","DET","PHI","CIN","SEA","LAR","DAL","HOU","GB","SF","MIA","JAX","DEN","KC","LAC","WAS","NE","CHI","NYG","CAR","NO","ATL"];
const DEAD_ZONE_RBS = ["Kyren Williams","Javonte Williams","RJ Harvey","Rachaad White","Zack Moss","Clyde Edwards-Helaire","Dameon Pierce","Miles Sanders","Latavius Murray"];
const ELITE_TES = ["Brock Bowers","Trey McBride","Colston Loveland","Tyler Warren","Tucker Kraft"];

function scoreToGrade(s){if(s>=97)return'A+';if(s>=93)return'A';if(s>=90)return'A-';if(s>=87)return'B+';if(s>=83)return'B';if(s>=80)return'B-';if(s>=77)return'C+';if(s>=73)return'C';if(s>=70)return'C-';if(s>=60)return'D';return'F';}
function getPos(r){return {QB:r.filter(p=>p.position==='QB'),RB:r.filter(p=>p.position==='RB'),WR:r.filter(p=>p.position==='WR'),TE:r.filter(p=>p.position==='TE')};}
function getRounds(r){return {r6:r.filter(p=>p.round<=6),r10:r.filter(p=>p.round<=10)};}
function getCapital(r){const m={};let t=0;for(const p of r){const c=Math.max(0,19-p.round);t+=c;m[p.position]=(m[p.position]||0)+c;}const o={};for(const pos of ['QB','RB','WR','TE'])o[pos]=t>0?Math.round((m[pos]||0)/t*1000)/10:0;return o;}

function scoreConstruction(roster){
  const byPos=getPos(roster),byRound=getRounds(roster);
  const achievements=[],feedback=[],detail={};
  const wrR6=byRound.r6.filter(p=>p.position==='WR').length;
  const wrR10=byRound.r10.filter(p=>p.position==='WR').length;
  const wrTotal=byPos.WR.length;
  const rbR6=byRound.r6.filter(p=>p.position==='RB').length;
  const rbR10=byRound.r10.filter(p=>p.position==='RB').length;
  const rbTotal=byPos.RB.length;
  const qbTotal=byPos.QB.length,teTotal=byPos.TE.length;
  Object.assign(detail,{wrR6,wrR10,wrTotal,rbR6,rbR10,rbTotal,qbTotal,teTotal});
  const WR_R6={0:-2.25,1:-1.38,2:-0.35,3:0.0,4:-0.75,5:-1.90,6:-2.28};
  const WR_R10={0:-5.87,1:-2.60,2:-1.37,3:-0.19,4:0.43,5:0.0,6:-0.63,7:-1.87,8:-5.31,9:-7.62};
  const WR_TOT={3:-11.62,4:-5.37,5:-1.87,6:0.21,7:0.64,8:0.0,9:-0.59,10:-1.84,11:-5.67,12:-7.06};
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
  let qbD;
  const qbsByRound=[...byPos.QB].sort((a,b)=>a.round-b.round);
  const qb3Round=qbsByRound.length>=3?qbsByRound[2].round:null;
  if(qbTotal===1)qbD=-2.59;
  else if(qbTotal===2)qbD=0.80;
  else if(qbTotal===3){
    if(qb3Round>=8)qbD=1.80;
    else if(qb3Round>=5)qbD=0.80;
    else qbD=0.0;
  } else qbD=0.0;
  detail.qb3Round=qb3Round;
  const totalDelta=wrR6D+wrR10D+wrTotD+rbR6D+rbR10D+rbTotD+qbD+teD;
  detail.totalDelta=totalDelta;
  let score=Math.max(0,Math.min(100,Math.round(65+totalDelta*4)));
  if(rbR6>=2) achievements.push({id:'EARLY_RB',label:'EARLY RB INVESTMENT',icon:'⚔️'});
  if(qbTotal===3) achievements.push({id:'THREE_QB',label:'3-QB STRUCTURE',icon:'🎯'});
  if(rbR6===1&&rbTotal>=5) achievements.push({id:'HERO_RB',label:'HERO RB BUILD',icon:'🦸'});
  return {score,feedback,detail,achievements};
}

function scoreValue(roster){
  const feedback=[],detail={},achievements=[];
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
    if(avgDev<=0) achievements.push({id:'VALUE_SECURED',label:'VALUE SECURED',icon:'💰'});
  }
  const cap=getCapital(roster);detail.capitalPct=cap;
  const QBQ=[{m:18,l:'Q1',d:-19.02},{m:10,l:'Q2',d:0.0},{m:5,l:'Q3',d:-3.71},{m:0,l:'Q4',d:-20.08}];
  const RBQ=[{m:35,l:'Q1',d:-14.87},{m:20,l:'Q2',d:0.0},{m:10,l:'Q3',d:-3.44},{m:0,l:'Q4',d:-16.94}];
  const WRQ=[{m:40,l:'Q1',d:-14.46},{m:28,l:'Q2',d:0.0},{m:18,l:'Q3',d:2.77},{m:0,l:'Q4',d:-5.66}];
  const TEQ=[{m:15,l:'Q1',d:-2.13},{m:8,l:'Q2',d:0.0},{m:4,l:'Q3',d:8.58},{m:0,l:'Q4',d:-10.50}];
  const gq=(pct,qs)=>{for(const q of qs)if(pct>=q.m)return q;return qs[qs.length-1];};
  const qbQ=gq(cap.QB,QBQ),rbQ=gq(cap.RB,RBQ),wrQ=gq(cap.WR,WRQ),teQ=gq(cap.TE,TEQ);
  Object.assign(detail,{qbQuartile:qbQ,rbQuartile:rbQ,wrQuartile:wrQ,teQuartile:teQ});
  const capDelta=qbQ.d+rbQ.d+wrQ.d+teQ.d;
  const capitalScore=Math.max(0,Math.min(100,Math.round(65+capDelta*2.5)));
  const valueScore=Math.round(adpScore*0.60+capitalScore*0.40);
  detail.adpScore=adpScore;detail.capitalScore=capitalScore;
  return {score:valueScore,feedback,detail,achievements};
}

function scoreStack(roster){
  const byPos=getPos(roster),feedback=[],detail={},achievements=[];
  let score=30;
  let topTier=null;
  for(const qb of byPos.QB){
    if(QB_TIERS.ELITE.includes(qb.team)){if(!topTier||topTier==='VIABLE'||topTier==='STRONG')topTier='ELITE';}
    else if(QB_TIERS.STRONG.includes(qb.team)){if(!topTier||topTier==='VIABLE')topTier='STRONG';}
    else if(!topTier)topTier='VIABLE';
  }
  const qbTierBonus=topTier==='ELITE'?18:topTier==='STRONG'?16:topTier==='VIABLE'?12:0;
  score+=qbTierBonus;detail.qbTierBonus=qbTierBonus;detail.topQbTier=topTier;
  let teamStackBonus=0,stackedSkill=0;const tsDetails=[];
  for(const qb of byPos.QB){
    const mates=roster.filter(p=>p.team===qb.team&&p.position!=='QB'&&['WR','TE','RB'].includes(p.position));
    if(mates.length>=1){teamStackBonus+=7*mates.length;stackedSkill+=mates.length;tsDetails.push({qb:qb.name,team:qb.team,partners:mates.map(p=>p.name),count:mates.length});}
  }
  teamStackBonus=Math.min(teamStackBonus,25);score+=teamStackBonus;
  Object.assign(detail,{teamStackBonus,teamStackDetails:tsDetails,stackedSkillPlayers:stackedSkill});
  if(stackedSkill>=4) achievements.push({id:'FOUR_PLUS_STACKED',label:'ELITE STACK DEPTH',icon:'⚡'});
  let w17=0;const w17D=[];
  for(const g of WEEK17_GAMES){
    const [t1,t2]=g.teams;
    const a=roster.filter(p=>p.team===t1),b=roster.filter(p=>p.team===t2);
    const tot=a.length+b.length,both=a.length>=1&&b.length>=1;
    if(tot>=2){
      const m=g.leverageMultiplier||1.0;
      let bo=g.tier==='S'?(both?25:18):g.tier==='A'?(both?20:14):g.tier==='B'?(both?15:10):g.tier==='C'?(both?8:5):(both?3:2);
      bo=Math.round(bo*m);w17+=bo;
      w17D.push({game:g.game,tier:g.tier,t1:a.map(p=>p.name),t2:b.map(p=>p.name),both,bonus:bo});
      if(both) achievements.push({id:`W17_${g.tier}`,label:`WEEK 17 ${g.tier}-TIER GAME STACK`,icon:'🎯'});
    }
  }
  w17=Math.min(w17,40);score+=w17;Object.assign(detail,{w17GameBonus:w17,w17GameStackDetails:w17D});
  let qbW17=0;
  for(const qb of byPos.QB){
    if(WEEK17_GAMES.some(g=>g.teams.includes(qb.team))&&roster.some(p=>p.team===qb.team&&['WR','TE'].includes(p.position)))qbW17++;
  }
  if(qbW17>=2){score+=10;detail.bothQbsStacked=true;achievements.push({id:'BOTH_QBS_STACKED',label:'DUAL QB GAME STACK',icon:'🔥'});}
  else detail.bothQbsStacked=false;
  let w16=0;const w16D=[];
  for(const g of WEEK16_GAMES){const[t1,t2]=g.teams;const a=roster.filter(p=>p.team===t1),b=roster.filter(p=>p.team===t2);const tot=a.length+b.length,both=a.length>=1&&b.length>=1;if(tot>=2){const m=g.leverageMultiplier||1.0;let bo=g.tier==='S'?(both?12:8):g.tier==='A'?(both?9:6):g.tier==='B'?(both?6:4):(both?3:2);bo=Math.round(bo*m);w16+=bo;w16D.push({game:g.game,tier:g.tier,bonus:bo});}}
  w16=Math.min(w16,15);score+=w16;Object.assign(detail,{w16GameBonus:w16,w16StackDetails:w16D});
  let w15=0;const w15D=[];
  for(const g of WEEK15_GAMES){const[t1,t2]=g.teams;const a=roster.filter(p=>p.team===t1),b=roster.filter(p=>p.team===t2);const tot=a.length+b.length,both=a.length>=1&&b.length>=1;if(tot>=2){const m=g.leverageMultiplier||1.0;let bo=g.tier==='S'?(both?8:5):g.tier==='A'?(both?6:4):g.tier==='B'?(both?4:2):(both?2:1);bo=Math.round(bo*m);w15+=bo;w15D.push({game:g.game,tier:g.tier,bonus:bo});}}
  w15=Math.min(w15,10);score+=w15;Object.assign(detail,{w15GameBonus:w15,w15StackDetails:w15D});
  if(w17D.length===0){score-=15;}
  score=Math.max(0,Math.min(100,score));
  return {score,feedback,detail,achievements};
}

function scoreRisk(roster,stackAch,options){
  const byPos=getPos(roster),feedback=[],achievements=[];
  let score=60,penalties=0,bonuses=0;
  const rbs=[...byPos.RB].sort((a,b)=>a.round-b.round);
  const rb1=rbs.length>0?rbs[0].round:99;
  if(rb1>9)penalties+=25; else if(rb1>7)penalties+=15; else if(rb1<=3)bonuses+=8;
  const dz=byPos.RB.filter(p=>DEAD_ZONE_RBS.includes(p.name)&&p.round>=4&&p.round<=8);
  if(dz.length>0)penalties+=dz.length*8;
  const eTE=byPos.TE.filter(p=>ELITE_TES.includes(p.name));
  if(eTE.length>0){bonuses+=10;achievements.push({id:'ELITE_TE',label:'ELITE TE SECURED',icon:'✦'});}
  if(byPos.TE.length===1)penalties+=10;
  const meaningful=roster.filter(p=>MEANINGFUL_W17_TEAMS.includes(p.team)).length;
  if(meaningful>=14){bonuses+=15;achievements.push({id:'LIVE_PLAYERS',label:'HIGH LIVE PLAYER POTENTIAL',icon:'🔋'});}
  else if(meaningful>=11)bonuses+=8;
  else if(meaningful<8)penalties+=10;
  if(byPos.QB.filter(p=>QB_TIERS.ELITE.includes(p.team)).length>0)bonuses+=8;
  if(!stackAch||stackAch.length===0)penalties+=5;
  if(options&&options.draftDate){
    const m=new Date(options.draftDate).getMonth()+1;
    if(m===7||m===8){bonuses+=8;feedback.push(`Drafted ${m===7?'July':'August'} — optimal window for live players & ADP value per BBM II-IV`);}
    else if(m<=6){penalties+=5;feedback.push(`Early draft (${['','Jan','Feb','Mar','Apr','May','Jun'][m]}) — May/June ~52% less likely to have 18 live players vs August (BBM III)`);}
    else if(m>=9)feedback.push(`Late draft — closing-line ADP value more predictive but live player benefit reduced`);
  }
  score=Math.max(0,Math.min(100,score-penalties+bonuses));
  return {score,feedback,achievements};
}

function buildBBM6Context(r){return {highOwnershipPlayers:r.filter(p=>BBM6_HIGH_OWNERSHIP[p.name]).map(p=>({name:p.name,ownership:BBM6_HIGH_OWNERSHIP[p.name]}))};}

function buildStrengths(c,v,s,rk){
  const out=[];
  if(c.score>=70){const d=c.detail;if(d.rbR6>=2)out.push(`Early RB depth: ${d.rbR6} RBs R6`);if(d.qbTotal===3&&d.qb3Round>=8)out.push(`3-QB w/ cheap QB3`);if(d.wrTotal>=7&&d.wrTotal<=8)out.push(`Optimal WR count (${d.wrTotal})`);if(d.teTotal===3)out.push(`3-TE`);}
  if(v.score>=65){const d=v.detail;if(d.teQuartile&&d.teQuartile.l==='Q3')out.push(`TE capital Q3`);if(d.qbQuartile&&d.qbQuartile.l==='Q2')out.push(`QB capital Q2`);if(d.adpDelta&&d.adpDelta>2)out.push(`Positive ADP efficiency`);}
  if(s.score>=60){if(s.detail.bothQbsStacked)out.push(`Both QBs W17 stacked`);if(s.detail.stackedSkillPlayers>=4)out.push(`${s.detail.stackedSkillPlayers} stacked skill players`);if(s.detail.w17GameStackDetails&&s.detail.w17GameStackDetails.length>0)out.push(`W17 ${s.detail.w17GameStackDetails[0].tier}-tier: ${s.detail.w17GameStackDetails[0].game}`);}
  return out.slice(0,4);
}
function buildWeaknesses(c,v,s,rk){
  const out=[];
  if(s.score<50){if(!s.detail.w17GameStackDetails||!s.detail.w17GameStackDetails.length)out.push(`No W17 game stack`);if(s.detail.stackedSkillPlayers<4)out.push(`Only ${s.detail.stackedSkillPlayers} stacked skill players`);}
  const d=c.detail;
  if(d.rbR6<=1)out.push(`Thin early RB`);
  if(d.teTotal===1)out.push(`1-TE`);
  if(d.qbTotal===1)out.push(`1-QB`);
  if(d.wrTotal>=10)out.push(`${d.wrTotal} WRs — bottom quartile`);
  const vd=v.detail;
  if(vd.teQuartile&&vd.teQuartile.l==='Q4')out.push(`TE underspend Q4`);
  if(vd.qbQuartile&&vd.qbQuartile.l==='Q4')out.push(`QB underspend Q4`);
  return out.slice(0,4);
}

function gradeTeam(roster, options={}){
  if(!roster||roster.length===0)return null;
  const construction=scoreConstruction(roster);
  const value=scoreValue(roster);
  const stack=scoreStack(roster);
  const risk=scoreRisk(roster,stack.achievements,options);
  const overallScore=Math.round(construction.score*0.35+value.score*0.35+stack.score*0.20+risk.score*0.10);
  const overallGrade=scoreToGrade(overallScore);
  const allAch=[...construction.achievements,...value.achievements,...stack.achievements,...risk.achievements];
  return {
    overallGrade,overallScore,
    constructionScore:construction.score,valueScore:value.score,stackScore:stack.score,riskScore:risk.score,
    riskFeedback:risk.feedback,
    topStrengths:buildStrengths(construction,value,stack,risk),
    topWeaknesses:buildWeaknesses(construction,value,stack,risk),
    achievements:allAch,
    bbm6Context:buildBBM6Context(roster),
    _detail:{construction:construction.detail,value:value.detail,stack:stack.detail}
  };
}

// ── TEST ROSTER ──
const testRoster = [
  {name:"Ja'Marr Chase",team:"CIN",position:"WR",adp:3.1,round:1,pick:3},
  {name:"Jahmyr Gibbs",team:"DET",position:"RB",adp:14,round:1,pick:14},
  {name:"Josh Allen",team:"BUF",position:"QB",adp:29.8,round:3,pick:29},
  {name:"Brock Bowers",team:"LV",position:"TE",adp:21.9,round:2,pick:21},
  {name:"Puka Nacua",team:"LAR",position:"WR",adp:4.1,round:1,pick:4},
  {name:"De'Von Achane",team:"MIA",position:"RB",adp:13.9,round:2,pick:13},
  {name:"Malik Nabers",team:"NYG",position:"WR",adp:17.6,round:2,pick:17},
  {name:"Jalen Hurts",team:"PHI",position:"QB",adp:68.3,round:6,pick:68},
  {name:"Kenneth Walker",team:"KC",position:"RB",adp:15.9,round:2,pick:15},
  {name:"Jaylen Waddle",team:"MIA",position:"WR",adp:32.1,round:3,pick:32},
  {name:"Tee Higgins",team:"CIN",position:"WR",adp:45.2,round:4,pick:45},
  {name:"Chase Brown",team:"CIN",position:"RB",adp:19,round:2,pick:19},
  {name:"DeVonta Smith",team:"PHI",position:"WR",adp:31.3,round:3,pick:31},
  {name:"Tucker Kraft",team:"GB",position:"TE",adp:81.9,round:7,pick:81},
  {name:"Tua Tagovailoa",team:"MIA",position:"QB",adp:88.4,round:8,pick:88},
  {name:"Rhamondre Stevenson",team:"NE",position:"RB",adp:95.1,round:8,pick:95},
  {name:"Tyler Warren",team:"IND",position:"TE",adp:68.7,round:6,pick:68},
  {name:"Tyquan Thornton",team:"NE",position:"WR",adp:188,round:16,pick:188}
];

console.log('\n══════════════════════════════════════════');
console.log('RUN (a): gradeTeam(testRoster)');
console.log('══════════════════════════════════════════');
const a = gradeTeam(testRoster);
console.log(`overallGrade:      ${a.overallGrade}`);
console.log(`overallScore:      ${a.overallScore}`);
console.log(`constructionScore: ${a.constructionScore}`);
console.log(`valueScore:        ${a.valueScore}`);
console.log(`stackScore:        ${a.stackScore}`);
console.log(`riskScore:         ${a.riskScore}`);
console.log(`achievements:      ${a.achievements.map(x=>`${x.icon}${x.id}`).join(' | ')}`);
console.log(`topStrengths:      ${JSON.stringify(a.topStrengths, null, 2)}`);
console.log(`topWeaknesses:     ${JSON.stringify(a.topWeaknesses, null, 2)}`);
console.log(`bbm6Chalk:         ${a.bbm6Context.highOwnershipPlayers.map(p=>`${p.name}(${p.ownership}%)`).join(', ')}`);

// Detail
const d = a._detail;
console.log(`\n── Construction detail ──`);
console.log(`  WR(${d.construction.wrR6}/${d.construction.wrR10}/${d.construction.wrTotal}) RB(${d.construction.rbR6}/${d.construction.rbR10}/${d.construction.rbTotal}) QB(${d.construction.qbTotal}) TE(${d.construction.teTotal}) totalDelta=${d.construction.totalDelta?.toFixed(2)}`);
console.log(`── Stack detail ──`);
console.log(`  QB tier: ${d.stack.topQbTier} (+${d.stack.qbTierBonus})`);
console.log(`  Team stack bonus: +${d.stack.teamStackBonus}, stacked skill: ${d.stack.stackedSkillPlayers}`);
console.log(`  W17 bonus: +${d.stack.w17GameBonus}, W16: +${d.stack.w16GameBonus}, W15: +${d.stack.w15GameBonus}`);
console.log(`  bothQbsStacked: ${d.stack.bothQbsStacked}`);
console.log(`  W17 stacks: ${d.stack.w17GameStackDetails.map(g=>`${g.game}[${g.tier}]+${g.bonus}`).join(' | ')}`);
console.log(`  W16 stacks: ${d.stack.w16StackDetails.map(g=>`${g.game}[${g.tier}]+${g.bonus}`).join(' | ')}`);
console.log(`  W15 stacks: ${d.stack.w15StackDetails.map(g=>`${g.game}[${g.tier}]+${g.bonus}`).join(' | ')}`);
console.log(`── Value detail ──`);
console.log(`  avgAdpDev=${d.value.avgAdpDeviation?.toFixed(2)} adpScore=${d.value.adpScore} capitalScore=${d.value.capitalScore}`);
console.log(`  QB cap: ${d.value.capitalPct?.QB}% (${d.value.qbQuartile?.l}) | RB: ${d.value.capitalPct?.RB}% (${d.value.rbQuartile?.l}) | WR: ${d.value.capitalPct?.WR}% (${d.value.wrQuartile?.l}) | TE: ${d.value.capitalPct?.TE}% (${d.value.teQuartile?.l})`);

console.log('\n══════════════════════════════════════════');
console.log('RUN (b): gradeTeam(testRoster, { draftDate: "2026-07-15" })');
console.log('══════════════════════════════════════════');
const b = gradeTeam(testRoster, { draftDate: "2026-07-15" });
console.log(`overallGrade:      ${b.overallGrade}`);
console.log(`overallScore:      ${b.overallScore}`);
console.log(`constructionScore: ${b.constructionScore}`);
console.log(`valueScore:        ${b.valueScore}`);
console.log(`stackScore:        ${b.stackScore}`);
console.log(`riskScore:         ${b.riskScore}`);
console.log(`riskFeedback timing line: "${b.riskFeedback.find(f=>f.includes('Drafted')||f.includes('Early')||f.includes('Late'))}"`);
console.log(`achievements:      ${b.achievements.map(x=>`${x.icon}${x.id}`).join(' | ')}`);

const expected = ['B','B+','B-','B'];
const grade = a.overallGrade;
const inRange = grade==='B'||grade==='B+'||grade==='B-';
console.log(`\n── Grade check ──`);
console.log(`Grade: ${grade} — ${inRange ? '✅ IN EXPECTED RANGE (B to B+)' : '❌ OUT OF EXPECTED RANGE — STOP BEFORE COMMITTING'}`);
