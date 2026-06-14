export const WEEK17_GAMES = [
  { game:"Lions-Bears", teams:["DET","CHI"], total:54.0, window:"NFL Net late Sun", tier:"S" },
  { game:"Rams-Buccaneers", teams:["LAR","TB"], total:52.4, window:"Sun TBD", tier:"S" },
  { game:"Cowboys-Giants", teams:["DAL","NYG"], total:50.1, window:"Sun 1pm", tier:"A" },
  { game:"Broncos-Patriots", teams:["DEN","NE"], total:49.7, window:"Sun TBD", tier:"A" },
  { game:"Ravens-Bengals", teams:["BAL","CIN"], total:49.3, window:"TNF NYE", tier:"A" },
  { game:"Bills-Dolphins", teams:["BUF","MIA"], total:48.7, window:"Sun 1pm", tier:"A" },
  { game:"Commanders-Jaguars", teams:["WAS","JAX"], total:48.6, window:"Sun TBD", tier:"A" },
  { game:"Seahawks-Panthers", teams:["SEA","CAR"], total:48.2, window:"Sun 1pm", tier:"A" },
  { game:"Texans-Packers", teams:["HOU","GB"], total:46.9, window:"MNF", tier:"B" },
  { game:"Eagles-49ers", teams:["PHI","SF"], total:46.6, window:"SNF", tier:"B" },
  { game:"Colts-Browns", teams:["IND","CLE"], total:43.8, window:"Sun 1pm", tier:"C" },
  { game:"Chiefs-Chargers", teams:["KC","LAC"], total:41.9, window:"Sun TBD", tier:"C" },
  { game:"Steelers-Titans", teams:["PIT","TEN"], total:39.1, window:"Sun 1pm", tier:"D" },
  { game:"Saints-Falcons", teams:["NO","ATL"], total:38.8, window:"Sun 1pm", tier:"D" },
  { game:"Vikings-Jets", teams:["MIN","NYJ"], total:37.8, window:"Sun 1pm", tier:"D" },
  { game:"Raiders-Cardinals", teams:["LV","ARI"], total:35.1, window:"Sun 2pm", tier:"D" }
];

export const WEEK16_GAMES = [
  { game:"Rams-Seahawks", teams:["LAR","SEA"], tier:"S", window:"Xmas Night Fox", leverageMultiplier:1.2 },
  { game:"Bills-Broncos", teams:["BUF","DEN"], tier:"S", window:"Xmas Netflix", leverageMultiplier:1.15 },
  { game:"Packers-Bears", teams:["GB","CHI"], tier:"A", window:"Xmas Netflix" },
  { game:"Texans-Eagles", teams:["HOU","PHI"], tier:"A", window:"TNF Xmas Eve", leverageMultiplier:1.15 },
  { game:"Jaguars-Cowboys", teams:["JAX","DAL"], tier:"A", window:"SNF" },
  { game:"Bengals-Colts", teams:["CIN","IND"], tier:"A", window:"Sun TBD" },
  { game:"Patriots-Jets", teams:["NE","NYJ"], tier:"A", window:"Sun TBD" },
  { game:"Giants-Lions", teams:["NYG","DET"], tier:"B", window:"MNF", leverageMultiplier:1.15 },
  { game:"Chargers-Dolphins", teams:["LAC","MIA"], tier:"B", window:"Sun TBD" },
  { game:"Buccaneers-Falcons", teams:["TB","ATL"], tier:"B", window:"Sun TBD" },
  { game:"Cardinals-Saints", teams:["ARI","NO"], tier:"C", window:"Sun TBD" }
];

export const WEEK15_GAMES = [
  { game:"Cowboys-Rams", teams:["DAL","LAR"], tier:"S", window:"Sun late" },
  { game:"Lions-Vikings", teams:["DET","MIN"], tier:"A", window:"SNF", leverageMultiplier:1.15 },
  { game:"Bears-Bills", teams:["CHI","BUF"], tier:"A", window:"Sat CBS", leverageMultiplier:1.1 },
  { game:"Patriots-Chiefs", teams:["NE","KC"], tier:"A", window:"MNF", leverageMultiplier:1.15 },
  { game:"Seahawks-Eagles", teams:["SEA","PHI"], tier:"A", window:"Sat Fox" },
  { game:"Chargers-49ers", teams:["LAC","SF"], tier:"A", window:"TNF" },
  { game:"Bengals-Panthers", teams:["CIN","CAR"], tier:"A", window:"Sun 1pm" },
  { game:"Dolphins-Packers", teams:["MIA","GB"], tier:"B", window:"Sun 1pm" },
  { game:"Ravens-Steelers", teams:["BAL","PIT"], tier:"B", window:"Sun 1pm" },
  { game:"Browns-Giants", teams:["CLE","NYG"], tier:"B", window:"Sun 1pm" },
  { game:"Colts-Titans", teams:["IND","TEN"], tier:"C", window:"Sun 1pm" }
];

// Multi-year insight: value QBs win as often as elite QBs. Tiers reflect stack quality, not prestige.
export const QB_TIERS = {
  ELITE: ["BUF","BAL","DET","PHI","CIN"],
  STRONG: ["SEA","LAR","DAL","KC","HOU","SF"],
  VIABLE: ["GB","DEN","JAX","CHI","NE","MIA","IND","NYG","LAC","WAS"]
};

export const BBM6_HIGH_OWNERSHIP = {
  "Puka Nacua":62.5,"Chris Olave":47.1,"James Cook":45.5,"Kyle Pitts":41.7,
  "Matthew Stafford":36.2,"Travis Etienne Jr":30.6,"Jaxon Smith-Njigba":29.1,"Jaylen Warren":27.5
};

export const MEANINGFUL_W17_TEAMS = ["BUF","BAL","DET","PHI","CIN","SEA","LAR","DAL","HOU","GB","SF","MIA","JAX","DEN","KC","LAC","WAS","NE","CHI","NYG","CAR","NO","ATL"];

export const DEAD_ZONE_RBS = ["Kyren Williams","Javonte Williams","RJ Harvey","Rachaad White","Zack Moss","Clyde Edwards-Helaire","Dameon Pierce","Miles Sanders","Latavius Murray"];

export const ELITE_TES = ["Brock Bowers","Trey McBride","Colston Loveland","Tyler Warren","Tucker Kraft"];
