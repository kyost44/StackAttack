// Underdog Best Ball Mania — League Configuration
// Update exact values once confirmed in the Underdog app

const leagueConfig = {
  name: "Underdog Best Ball Mania",

  // Scoring
  scoring: {
    format: "half-ppr",          // half PPR
    passingTD: 4,
    rushingTD: 6,
    receivingTD: 6,
    passingYards: 0.04,          // 1 pt per 25 yards
    rushingYards: 0.1,           // 1 pt per 10 yards
    receivingYards: 0.1,         // 1 pt per 10 yards
    reception: 0.5,              // half PPR
    interception: -2,
    fumbleLost: -2,
  },

  // Draft
  draft: {
    totalRounds: 18,
    rosterSlots: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX"],
  },

  // Playoffs
  playoffs: {
    weeks: [15, 16, 17],
  },
};

export default leagueConfig;
