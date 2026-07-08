# GRADING_SPEC.md — Stackulator Scoring Engine
*Methodology specification. Audited against commit 0d511b5 (5-season cutover), July 8, 2026.*
*Purpose: a future model or developer should be able to rebuild the engine from this document alone.*

---

## 1. Overview

The engine grades an Underdog Best Ball Mania roster (up to 18 players) on structural soundness and correlation — never player-specific projections. Four component scores (0–100) combine into an overall score, mapped to a letter grade.

**Overall = round(Construction×0.30 + Value×0.30 + Stack×0.25 + Risk×0.15)**

> ⚠️ Note: earlier project documents state 35/35/20/10. The shipped code is **30/30/25/15**. Code is authoritative.

**Grade ladder (locked, ported from the Python 5-season recalibration, pooled BBM II–VI, A-tier ≈1.16%):**

| Score | ≥84 | 82–83 | 81 | 79–80 | 78 | 77 | 74–76 | 70–73 | 68–69 | 62–67 | <62 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Grade | A+ | A | A- | B+ | B | B- | C+ | C | C- | D | F |

Note the 1-point-wide bands (A-, B, B-). Combined with integer rounding inside each component, a sub-point change in raw inputs can move a full grade step. This is a known sensitivity (see §7).

---

## 2. Construction (30%)

**What it measures:** whether the positional counts, by round bucket, match the counts that empirically advanced in BBM II–V.

**Formula:** `score = clamp(round(78 + totalDelta × 4), 0, 100)` where `totalDelta` is the sum of seven lookup deltas (percentage-point advance-rate deviations from the 15.53% baseline):

- `WR_R6[count of WRs drafted ≤ R6]`, e.g. 0→+1.72, 4→−0.46, 8→−6.23
- `WR_R10[WRs ≤ R10]`
- `WR_TOT[total WRs]` — peaks at 9 (+2.79) and 8 (+0.83)
- `RB_R6[RBs ≤ R6]` — peaks at 5 (+1.29); 0 → −2.06
- `RB_R10[RBs ≤ R10]`
- `RB_TOT[total RBs]` — peaks at 3 (+2.05)
- `TE_TOT[total TEs]` — peaks at 1 (+1.67); for 3+ TEs the flat delta is replaced by an investment-weighted penalty on the excess TEs (3rd+ TE at R≤6 costs 2.5 each; R7–10 → 1.5; R11–14 → 0.7; R15+ → 0.3)
- QB delta: 1 QB → −2.59; 2 QBs → +0.80; 3 QBs conditioned on QB3 round (R8+ → +1.80 "cheap-QB3 edge"; R5–7 → +0.80; earlier → 0); 4+ QBs → 0.

Out-of-table counts fall back to `CONSTRUCTION_DEFAULTS` (moderate negative constants), so extreme rosters degrade rather than crash.

**Multiplier rationale:** ×4 converts pp-of-advance-rate deltas onto the 0–100 score scale around a 78 anchor. The anchor and multiplier are calibration choices made so the pooled population lands on the intended grade distribution.

## 3. Value (30%)

Two sub-scores, blended **60% ADP-efficiency / 40% positional capital**. If no picks carry ADP, the score is capital-only (no fake neutral 50).

**Capital (40%):** each pick is worth `19 − round` capital points; per-position share of total capital is bucketed into empirically derived quartiles per position, each carrying a pp delta (e.g. QB Q2 optimal −0.09…best band; RB Q4 underspend −1.01; TE Q1 +0.99). `capitalScore = clamp(round(80 + capDelta × 12))`. Capital % is rounded to **2 decimals** to match the Python model exactly (1-decimal rounding could flip a quartile at a knife edge, worth up to ~16 Value points — fixed during Phase 6 parity checks).

**ADP efficiency (60%):** round-capital-weighted mean deviation between where a player was taken and their ADP. If pick numbers are present, uses true CLV (`pickNumber/12 − adp/12`); else falls back to `round − adp/12`. The mean deviation maps to a delta via bins:

| avgDev | < −0.5 | −0.5…0 | = 0 | 0…0.83 | ≥ 0.83 |
|---|---|---|---|---|---|
| delta | −1.77 | −0.88 | **−1.54** | +0.09 | +1.56 |

> ⚠️ Known issue: the bins are **non-monotonic** — exactly-at-ADP (0) is penalized more than a slight reach. Almost certainly a binning artifact; see §7.

`adpScore = clamp(round(80 + adpDelta × 12))`; `value = round(adpScore×0.6 + capitalScore×0.4)`.

## 4. Stack (25%)

**What it measures:** quality-weighted correlation concentrated in real playoff-week game environments (W15/16/17 from the actual 2026 NFL schedule via nflverse).

Per week, for each listed game with ≥2 rostered players:
`gameValue = TIER_BASE[tier] × avgQuality × pairUnits × bringBack`
- `TIER_BASE`: S=22, A=18, B=14, C=11, D=7
- `avgQuality`: mean of round-based player quality weights (R1–2→1.00 … R15+→0.20; unknown round→0.35)
- `pairUnits` (presence-based, each pair type counted once per game): QB-WR=1.00, QB-TE=0.11, QB-RB=0.07, WR-RB=0.00 (tested negative; floored). No qualifying pair → 0 credit regardless of player count.
- `bringBack`: ×1.15 if both teams in the game are represented.

Within a week, game values are sorted descending and multiplied by diminishing returns [1.0, 0.5, 0.25, 0.1].

Weeks combine with empirically derived weights **W15=2.5, W16=0.4, W17=4.0** (W16 tested as noise across all four training seasons; retained at near-zero weight). Then:
`score = clamp(round(weightedAvg × 2.2 + 18.0), 0, 100)`

**Removed by testing (not merely down-weighted):** QB-tier bonus, team-stack term (five variants tested — flat-to-negative and sign-unstable; also fixed a double-count with game stacks in the old engine), dual-QB bonus, per-week caps. Legacy detail fields (`qbTierBonus`, `teamStackBonus`, `bothQbsStacked`) are pinned to 0/false for UI back-compat and slated for removal from the Nerd Report.

Team-stack counts are still computed for **informational feedback and achievements only** — they never touch the score. (One exception affecting presentation: the `FOUR_PLUS_STACKED` achievement can flip a Tactician archetype label to Glass Cannon. See §7.)

## 5. Risk (15%)

> ⚠️ Status: **not re-derived** in the 5-season rebuild. Structure was ported to match the Python model, but its constants are judgment values, not fitted weights. This is the engine's weakest-evidence component.

Per-week formula: `risk_w = clamp(60 + rb1Adj + teAdj + meaningfulAdj(w) + qbAdj(w), 0, 100)`
- `rb1Adj` (roster-level): RB1 round >9 → −25; >7 → −15; ≤3 → +8; else 0. (Winks 5-yr RB1-timing finding.)
- `teAdj` (roster-level): exactly 1 TE → −10 (attrition/live-player exposure).
- `meaningfulAdj(w)`: count of players whose team is in a C-tier-or-better game that week: ≥14 → +15; ≥11 → +8; <8 → −10; else 0.
- `qbAdj(w)`: any QB in an A-tier-or-better game that week → +8.

Weeks combine with `RISK_WEEK_WEIGHTS {15:1, 16:2, 17:4}` (original defaults, never re-derived). `floorScore`/`ceilingScore` are duplicate aliases of the single score, kept so the UI renders; the floor/ceiling split is a retired concept pending a GradeDisplay cleanup.

JS-side limitation (documented in code): players carry one static `team`, so week-tier lookups can't account for real-season trades the way the Python/nflverse pipeline does.

## 6. Presentation layer (does not affect the score)

- **Archetypes:** a waterfall over (C, V, S, R, Overall) assigns one of ten labels (The Blueprint → The Long Shot), plus a post-hoc override: Tactician with a `FOUR_PLUS_STACKED` or `BOTH_QBS_STACKED` achievement becomes Glass Cannon.
- **Strength/fragility flags, narrative generator, improvement suggestion ("Path to a Better Grade"):** priority-ranked heuristics over the component details; first match wins. All narrative-only.
- **Grade confidence (High/Medium/Low):** points for ADP coverage ≥75%/≥40%, roster size ≥16, ≥8 NFL teams represented, all four positions present.

## 7. Known limitations & open issues (audit, July 2026)

1. **Documentation drift:** component weights 30/30/25/15 in code vs 35/35/20/10 in older docs. Code wins; docs must be corrected.
2. **Non-monotonic ADP bins:** avgDev = 0 delta (−1.54) is worse than slight-reach (−0.88). Needs re-derivation or smoothing; a drafter taking every player exactly at ADP is currently penalized more than a mild reacher.
3. **Risk constants unvalidated:** rb1Adj/teAdj magnitudes and {1,2,4} week weights are judgment values. Risk is 15% of the grade on the weakest evidence. Candidate for the next calibration pass; per-component backtest attribution should decide whether it earns its weight.
4. **Conflicting TE signals:** 1 TE is +1.67pp in Construction and −10 in Risk. Defensible (advance-rate vs. attrition are different constructs) but the Risk side is unfitted; net effect on the pooled population unmeasured.
5. **Grade-band sensitivity:** three 1-point-wide bands (A-, B, B-) plus per-component integer rounding means small input changes can move a full grade step near boundaries.
6. **Silent degradation on bad input:** players with missing position/team silently vanish from positional counts and stacks — a no-team roster grades F with confidence "Low" rather than erroring. Duplicate players are accepted and double-counted. A 5-player roster (UI minimum) is graded on 18-round construction tables, producing a meaningless D. All should be validation errors or explicit partial-grade modes.
7. **Draft-slot default corrupts CLV:** pick numbers auto-fill from draft position, which defaults to slot 1. A slot-12 drafter who never sets the control gets systematically wrong pick-level deviations feeding 60% of Value.
8. **Archetype/score inconsistency:** the Glass Cannon override fires on team-stack achievements — a mechanism scoring explicitly rejected — so a roster with Stack 69 can be narrated as "if the stack detonates, nothing else matters."
9. **Data provenance/staleness:** `player_reference_2026.json` is Underdog ADP as of May 2, 2026 (266 players; late-round names beyond it silently lack data). `stackingData.js` W15/16/17 tiers carry no source or as-of date; totals are projection-based (no real Vegas lines exist yet) and must be refreshed as analyst rankings update.
10. **Dead/conflicting files:** `riskData.js` (a *different*, contradictory dead-zone RB list than the one the engine imports from `stackingData.js`) and `final_analysis.json` (old archetype names) are imported by nothing; `final_analysis_20260705.bak.json` is a stray backup. Repo hygiene.
11. **Bring-back dilution paradox:** `avgQuality` is a mean over all players in the game cluster, so adding a cheap late-round bring-back can *lower* the game's stack value (quality dilution outweighs the 1.15× multiplier) — directly contradicting the engine's own "complete your stack with a bring-back" improvement suggestion. Behavior is inherited from the validated Python model; the per-component backtest should compare avg-based vs. sum-based quality before any change.
12. **Stale narrative constants:** BBM VI-era references ($31.28 EV line can never fire; BBM6 ownership context; "17,248-roster sample" caveat predates the 2.63M rebuild).

## 8. Backtest evidence

From the Phase 5 out-of-sample validation on the walled-off BBM VI season (2,629,295 rosters total across II–VI; VI never used in training):
- AUC 0.566 vs 0.553 in-training (no degradation out of sample)
- Top-decile vs bottom-decile advance lift: 2.03×
- A-tier finals lift: 2.17×
- Grade ladder monotonic A- through F

> **[PENDING INDEPENDENT RE-VERIFICATION + PER-COMPONENT ATTRIBUTION — see backtest task spec. Results to be inserted here: re-computed AUC/lifts, component-ablation AUCs, and where in the grade range the model is most/least predictive.]**

Honest framing constraint (locked): grades predict *advancement rates at the population level*, not champions — most finalists graded C; variance dominates individual outcomes. Marketing claims are limited to the validated statements above.

## 9. Design-choice rationale index

- **Advance-rate deltas as the unit** — every structural signal is priced in the same currency (pp vs 15.53% baseline), making components comparable and auditable.
- **Round as quality proxy** — draft round is known at grade time for any roster including hypothetical ones; projections are deliberately excluded (product principle: structure only).
- **Presence-based pair pricing** — counting pair *types* once per game prevents piling players into one game to farm score; diminishing returns across games prevents farming breadth.
- **Holdout discipline** — BBM VI walled off before any weight was derived; the cutover was gated on the out-of-sample result. If a future recalibration is run, wall off the newest season the same way.
- **No silent partial mechanisms** — rejected mechanisms are deleted, not zero-weighted (except UI-compat display fields pinned to 0), so the spec and the code can't drift apart quietly.
