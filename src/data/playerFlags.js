// Player enrichment flags for narrative generation
// Update this file when player situations change (injuries, role changes, etc.)
// Flags are keyed by EXACT player name as it appears in player_reference_2026.json

export const PLAYER_FLAGS = {
  // QBs — Stack drivers
  "Josh Allen": {
    tier: "ELITE",
    stack_context: "BUF offense is the highest-floor W17 stack. Shakir is his primary BBM stack target.",
    week17_game: "BUF-MIA [A-tier]",
    narrative_hook: "Josh Allen gives your roster a floor that most stacks can't match.",
    role_risk: null
  },
  "Lamar Jackson": {
    tier: "ELITE",
    stack_context: "BAL W17 game is high-leverage. Flowers and Agholor are primary stack targets.",
    week17_game: "BAL-CIN [A-tier, high leverage]",
    narrative_hook: "Lamar Jackson is the most complete best-ball QB in recent memory.",
    role_risk: null
  },
  "Jalen Hurts": {
    tier: "ELITE",
    stack_context: "PHI stack. Smith and Brown as stack targets — Brown injury history adds variance.",
    week17_game: "PHI-SF [B-tier]",
    narrative_hook: "Hurts brings elite rushing floor that makes any stack safer.",
    role_risk: null
  },
  "Joe Burrow": {
    tier: "ELITE",
    stack_context: "CIN stack with Chase is the most explosive pairing in the format.",
    week17_game: "BAL-CIN [A-tier, high leverage]",
    narrative_hook: "Burrow-Chase is the premium best-ball pairing — ceiling is limitless if healthy.",
    role_risk: "injury history — missed significant time in 2023"
  },
  "Patrick Mahomes": {
    tier: "STRONG",
    stack_context: "KC pass game has volume but lacks elite stack targets. Kelce age is a factor.",
    week17_game: "KC-LAC [C-tier]",
    narrative_hook: "Mahomes carries the floor but KC's W17 game is C-tier leverage.",
    role_risk: null
  },
  "Brock Purdy": {
    tier: "VIABLE",
    stack_context: "SF weapon turnover is real. Pearsall is emerging as primary stack target.",
    week17_game: "PHI-SF [B-tier]",
    narrative_hook: "Purdy's 2026 upside depends heavily on Pearsall emerging as a true WR1.",
    weapon_context: "Lost Deebo reliability; Pearsall untested as full WR1",
    role_risk: "offensive context downgraded from 2024 peak"
  },
  "Jordan Love": {
    tier: "STRONG",
    stack_context: "GB stack with Kraft and Reed is one of the highest-upside combinations. HOU-GB W17 is solid.",
    week17_game: "HOU-GB [B-tier]",
    narrative_hook: "Jordan Love plus GB trifecta is a legitimate championship path.",
    role_risk: null
  },
  "Caleb Williams": {
    tier: "VIABLE",
    stack_context: "CHI W17 is S-tier game. Odunze and Keenan as primary targets.",
    week17_game: "DET-CHI [S-tier]",
    narrative_hook: "Williams in the DET-CHI S-tier game is the highest-leverage non-elite QB stack.",
    role_risk: "sophomore year — real upside or real bust potential"
  },
  "Bo Nix": {
    tier: "VIABLE",
    stack_context: "DEN stack is unproven. Sutton is reliable but W17 game is limited.",
    week17_game: "DEN-NE [A-tier]",
    narrative_hook: "Nix in year 2 — upside is real but the offense hasn't proven it yet.",
    role_risk: "unproven NFL starter with volatile supporting cast"
  },
  "Jared Goff": {
    tier: "STRONG",
    stack_context: "DET W17 is S-tier game — DET-CHI is the highest-leverage game in the format.",
    week17_game: "DET-CHI [S-tier]",
    narrative_hook: "Goff in the DET-CHI S-tier game makes this stack elite regardless of tier.",
    role_risk: null
  },
  "Dak Prescott": {
    tier: "STRONG",
    stack_context: "DAL-NYG W17 is A-tier. Lamb is the obvious stack target.",
    week17_game: "DAL-NYG [A-tier]",
    narrative_hook: "Prescott-Lamb is a proven BBM stack — DAL W17 consistency is real.",
    role_risk: "injury history in recent seasons"
  },
  // RBs
  "Bijan Robinson": {
    tier: "RB_ELITE",
    role_risk: null,
    narrative_hook: "Bijan Robinson is the closest thing to a safe bet at RB in this format.",
    week17_relevance: "WAS-JAX [A-tier] — legitimate W17 upside"
  },
  "Jahmyr Gibbs": {
    tier: "RB_ELITE",
    role_risk: "David Montgomery present but Gibbs is clear RB1",
    narrative_hook: "Gibbs in the S-tier DET-CHI game is the most explosive RB stack in the format.",
    week17_relevance: "DET-CHI [S-tier] — highest RB W17 leverage in the format"
  },
  "De'Von Achane": {
    tier: "RB_STRONG",
    role_risk: "committee concerns in MIA but Achane is the clear pass-game back",
    narrative_hook: "Achane's receiving upside makes him dangerous in any game script.",
    week17_relevance: "BUF-MIA [A-tier] — strong W17 leverage as pass-game back"
  },
  "Josh Jacobs": {
    tier: "RB_STRONG",
    stack_context: "GB backfield — pairs with Jordan Love stack for trifecta upside",
    narrative_hook: "Jacobs anchors the GB trifecta as the rushing floor in Love's offense.",
    week17_relevance: "HOU-GB [B-tier]",
    role_risk: null
  },
  "Cam Skattebo": {
    tier: "RB_VIABLE",
    role_risk: "NYG backfield competition — role not fully secured entering 2026",
    narrative_hook: "Skattebo has real upside if he wins the NYG job outright.",
    week17_relevance: "DAL-NYG [A-tier]"
  },
  "David Montgomery": {
    tier: "RB_VIABLE",
    role_risk: "HOU backfield — Montgomery is the committee veteran",
    narrative_hook: "Montgomery in HOU is a reliable workhorse floor with W17 upside.",
    week17_relevance: "HOU-GB [B-tier]"
  },
  // WRs
  "Ja'Marr Chase": {
    tier: "WR_ELITE",
    stack_context: "CIN stack with Burrow — elite pairing",
    narrative_hook: "Chase is the single highest-ceiling WR in the format.",
    role_risk: null
  },
  "CeeDee Lamb": {
    tier: "WR_ELITE",
    stack_context: "DAL-NYG A-tier W17 game",
    narrative_hook: "Lamb remains the most reliable WR1 floor in best ball.",
    role_risk: null
  },
  "A.J. Brown": {
    tier: "WR_ELITE",
    stack_context: "PHI stack — pairs with Hurts",
    narrative_hook: "Brown is elite when healthy — that's always the qualifier.",
    role_risk: "injury history is real — missed significant time in 2023-2024"
  },
  "Marvin Harrison Jr.": {
    tier: "WR_STRONG",
    stack_context: "ARI stack — W17 game is weaker",
    narrative_hook: "Harrison has elite talent but ARI's offense hasn't unlocked it yet.",
    role_risk: "sophomore year — offense still developing around him"
  },
  "Ricky Pearsall": {
    tier: "WR_STRONG",
    stack_context: "SF stack — emerging as Purdy's WR1",
    narrative_hook: "Pearsall is the upside bet on Purdy stacks — if he emerges as WR1, the SF stack is real.",
    role_risk: "untested as full-season WR1 — Purdy weapon turnover context"
  },
  "Rome Odunze": {
    tier: "WR_STRONG",
    stack_context: "CHI stack with Williams — DET-CHI S-tier game",
    narrative_hook: "Odunze in the DET-CHI S-tier game is legitimate leverage if Williams develops.",
    role_risk: "Williams development pace affects Odunze ceiling"
  },
  // TEs
  "Brock Bowers": {
    tier: "TE_ELITE",
    narrative_hook: "Brock Bowers is the safest elite TE in the format — elite floor, elite ceiling.",
    role_risk: null
  },
  "Trey McBride": {
    tier: "TE_ELITE",
    narrative_hook: "McBride gives you top-3 TE floor in a pass-heavy ARI system.",
    role_risk: null
  },
  "Colston Loveland": {
    tier: "TE_ELITE",
    narrative_hook: "Loveland is the highest-upside TE in the class — CHI DET-CHI S-tier game stack upside.",
    week17_relevance: "DET-CHI [S-tier] — elite W17 leverage for a TE",
    role_risk: "rookie — higher variance than proven veterans"
  },
  "Tyler Warren": {
    tier: "TE_ELITE",
    narrative_hook: "Warren in IND system is a clear TE1 with target-share upside in a pass-first offense.",
    role_risk: null
  },
  "Tucker Kraft": {
    tier: "TE_ELITE_BORDERLINE",
    narrative_hook: "Tucker Kraft at R7 is elite TE ceiling — the qualifier is a clean return from his 2024 knee injury.",
    role_risk: "recovering from significant 2024 knee injury — August health status is critical",
    injury_flag: "2024 knee injury, recovery timeline unclear entering 2026",
    stack_context: "GB TE — pairs with Love stack for significant upside if healthy"
  },
  "Sam LaPorta": {
    tier: "TE_STRONG",
    narrative_hook: "LaPorta is a solid floor in a DET S-tier game.",
    week17_relevance: "DET-CHI [S-tier]",
    role_risk: "DET run-heavy tendencies limit ceiling"
  }
};

// Get flag for a player (returns null if not found — engine handles gracefully)
export function getPlayerFlag(playerName) {
  return PLAYER_FLAGS[playerName] || null;
}

// Get narrative hook for a player (returns short contextual note)
export function getPlayerHook(playerName) {
  const flag = PLAYER_FLAGS[playerName];
  return flag ? flag.narrative_hook : null;
}

// Get risk note for a player (returns null if no known risk)
export function getPlayerRisk(playerName) {
  const flag = PLAYER_FLAGS[playerName];
  return flag && flag.role_risk && flag.role_risk !== 'none' && flag.role_risk !== null
    ? flag.role_risk : null;
}
