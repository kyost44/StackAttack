"""
BBM Calibration Analysis v2
Fixes:
  1. ADP value computed from position-occurrence baselines derived from the data
  2. Cross-tab verification for positional investment quartiles
  3. Temporal weighting: BBM IV=0.9, BBM V=1.0, Best Bowl Mania=1.1
  4. Side-by-side unweighted vs weighted results

Two-pass approach:
  Pass 1 — stream all files to build:
            a) position-occurrence pick baselines (median via mean approx)
            b) team_data with all stats except ADP value
  Pass 2 — re-stream to compute per-team ADP value using baselines
"""

import os
import sys
import json
from collections import defaultdict

DATA_DIR = "C:/Users/Kyle/OneDrive/Documents/StackAttack/bbm-data"
OUTPUT_TXT = os.path.join(DATA_DIR, "bbm_calibration_analysis.txt")
OUTPUT_JSON = os.path.join(DATA_DIR, "bbm_scoring_weights.json")

SKIP_FILES = {
    "best_ball_mania_v_rd1.csv",
    "best_ball_mania_v_rd1(2).csv",
    "best_ball_mania_v_rd2(1).csv",
    "Best Bowl Mania Rd 1(1).csv",
}

# Temporal weights by BBM version
def file_weight(filename):
    f = filename.lower()
    if "best bowl mania" in f:      return 1.1   # Best Bowl Mania (newest)
    if "best_ball_mania_v" in f:    return 1.0   # BBM V 2024
    if "best_ball_mania_iv" in f:   return 0.9   # BBM IV 2023
    return 1.0  # default

def file_version(filename):
    f = filename.lower()
    if "best bowl mania" in f:   return "Best Bowl Mania"
    if "best_ball_mania_v" in f: return "BBM V (2024)"
    if "best_ball_mania_iv" in f: return "BBM IV (2023)"
    return "Unknown"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_int(v, default=0):
    try:
        s = str(v).strip()
        return int(float(s)) if s else default
    except:
        return default

def safe_float(v, default=0.0):
    try:
        s = str(v).strip()
        return float(s) if s else default
    except:
        return default

def adv_rate(n_adv, n_total):
    if n_total == 0:
        return None
    return round(n_adv / n_total * 100, 2)

def wadv_rate(w_adv, w_total):
    """Weighted advance rate."""
    if w_total == 0:
        return None
    return round(w_adv / w_total * 100, 2)

def pct(rate):
    return f"{rate:.2f}%" if rate is not None else "N/A"

def fmt_table(headers, rows, col_width=22):
    sep = "+" + "+".join("-" * (col_width + 2) for _ in headers) + "+"
    hdr = "| " + " | ".join(h.ljust(col_width) for h in headers) + " |"
    lines = [sep, hdr, sep]
    for row in rows:
        lines.append("| " + " | ".join(str(v).ljust(col_width) for v in row) + " |")
    lines.append(sep)
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# File list
# ---------------------------------------------------------------------------

def get_csv_files():
    return [
        os.path.join(DATA_DIR, f)
        for f in sorted(os.listdir(DATA_DIR))
        if f.lower().endswith(".csv") and f not in SKIP_FILES
    ]

def get_col_indices(headers):
    h = [x.strip().strip('"').lower() for x in headers]
    def find(*names):
        for n in names:
            if n in h:
                return h.index(n)
        return None
    return {
        "team_id":      find("draft_entry_id", "entry_id"),
        "advanced":     find("made_playoffs", "advanced", "advance"),
        "draft_round":  find("team_pick_number", "pick_round", "round_number", "round"),
        "overall_pick": find("overall_pick_number", "overall_pick", "pick_no"),
        "position":     find("position_name", "position", "pos"),
    }

# ---------------------------------------------------------------------------
# PASS 1 — Build position-occurrence baselines + team_data (no ADP value yet)
# ---------------------------------------------------------------------------

def pass1(csv_files, log):
    """
    Returns:
      team_data: dict of per-team counters (advance, weights, roster construction, cap)
      pos_occ_baseline: {pos: {occ_num: mean_pick_number}}
    """
    # Baseline accumulation: pos -> occ_num -> [sum, count]
    pos_occ_raw = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))

    # Per-team position occurrence counters (for baseline bucketing)
    team_pos_occ = defaultdict(lambda: defaultdict(int))

    # Main team data
    team_data = {}

    total_rows = 0

    for filepath in csv_files:
        fname = os.path.basename(filepath)
        fsize = os.path.getsize(filepath) / 1e9
        w = file_weight(fname)
        ver = file_version(fname)
        msg = f"\n  [Pass 1] {fname}  ({fsize:.3f} GB)  version={ver}  weight={w}"
        print(msg); log.append(msg)

        file_rows = 0
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                headers = f.readline().rstrip("\n").split(",")
                idx = get_col_indices(headers)

                for line in f:
                    parts = line.rstrip("\n").split(",")

                    def g(key, default=""):
                        i = idx.get(key)
                        if i is None or i >= len(parts):
                            return default
                        return parts[i].strip().strip('"')

                    team_id = g("team_id")
                    if not team_id:
                        continue

                    adv_raw = g("advanced", "0").lower()
                    adv = 1 if adv_raw in ("1", "true", "yes", "t") else 0
                    draft_round = safe_int(g("draft_round", "0"))
                    overall_pick = safe_int(g("overall_pick", "0"))
                    pos = g("position", "").upper().strip()
                    if pos not in ("QB", "RB", "WR", "TE", "K", "DEF"):
                        pos = "OTHER"

                    # Position-occurrence baseline
                    if pos in ("QB", "RB", "WR", "TE") and overall_pick > 0:
                        team_pos_occ[team_id][pos] += 1
                        occ = team_pos_occ[team_id][pos]
                        pos_occ_raw[pos][occ][0] += overall_pick
                        pos_occ_raw[pos][occ][1] += 1

                    # Team record
                    if team_id not in team_data:
                        team_data[team_id] = {
                            "advance": adv, "weight": w,
                            "wr6": 0, "wr10": 0, "wr18": 0,
                            "rb6": 0, "rb10": 0, "rb18": 0,
                            "qb_total": 0, "te_total": 0,
                            "cap_qb": 0, "cap_rb": 0,
                            "cap_wr": 0, "cap_te": 0, "cap_total": 0,
                            "adp_diff_sum": 0.0, "adp_diff_n": 0,
                        }
                    else:
                        if adv == 1:
                            team_data[team_id]["advance"] = 1

                    td = team_data[team_id]

                    if pos == "WR":
                        if draft_round <= 6:  td["wr6"]  += 1
                        if draft_round <= 10: td["wr10"] += 1
                        td["wr18"] += 1
                    elif pos == "RB":
                        if draft_round <= 6:  td["rb6"]  += 1
                        if draft_round <= 10: td["rb10"] += 1
                        td["rb18"] += 1
                    elif pos == "QB":
                        td["qb_total"] += 1
                    elif pos == "TE":
                        td["te_total"] += 1

                    if overall_pick > 0:
                        td["cap_total"] += overall_pick
                        if pos == "QB":   td["cap_qb"] += overall_pick
                        elif pos == "RB": td["cap_rb"] += overall_pick
                        elif pos == "WR": td["cap_wr"] += overall_pick
                        elif pos == "TE": td["cap_te"] += overall_pick

                    file_rows += 1
                    if file_rows % 1_000_000 == 0:
                        print(f"    ...{file_rows:,} rows  |  {len(team_data):,} teams")

        except Exception as e:
            err = f"  ERROR {fname}: {e}"
            print(err); log.append(err)
            import traceback; traceback.print_exc()

        total_rows += file_rows
        msg = f"    Done: {file_rows:,} rows, {len(team_data):,} teams total"
        print(msg); log.append(msg)

    # Compute baselines from raw sums
    pos_occ_baseline = {}
    for pos, occ_data in pos_occ_raw.items():
        pos_occ_baseline[pos] = {}
        for occ, (s, c) in occ_data.items():
            if c >= 100:   # only use buckets with enough data
                pos_occ_baseline[pos][occ] = s / c

    # Print baseline summary
    log.append("\n  Position-Occurrence Baselines (mean expected pick number):")
    for pos in sorted(pos_occ_baseline):
        picks = sorted(pos_occ_baseline[pos].items())
        log.append(f"  {pos}: " + ", ".join(f"#{occ}={mean:.1f}" for occ, mean in picks[:8]))

    # Free pass-1-only data
    del team_pos_occ, pos_occ_raw

    total_teams = len(team_data)
    total_adv = sum(td["advance"] for td in team_data.values())
    msg = f"\n  Pass 1 complete: {total_rows:,} rows, {total_teams:,} teams, {total_adv:,} advanced"
    print(msg); log.append(msg)

    return team_data, pos_occ_baseline

# ---------------------------------------------------------------------------
# PASS 2 — Compute per-team ADP value using baselines
# ---------------------------------------------------------------------------

def pass2(csv_files, team_data, pos_occ_baseline, log):
    """Stream all files again; compute ADP value per team using baselines."""
    team_pos_occ = defaultdict(lambda: defaultdict(int))
    total_rows = 0

    for filepath in csv_files:
        fname = os.path.basename(filepath)
        fsize = os.path.getsize(filepath) / 1e9
        msg = f"\n  [Pass 2] {fname}  ({fsize:.3f} GB)"
        print(msg); log.append(msg)

        file_rows = 0
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                headers = f.readline().rstrip("\n").split(",")
                idx = get_col_indices(headers)

                for line in f:
                    parts = line.rstrip("\n").split(",")

                    def g(key, default=""):
                        i = idx.get(key)
                        if i is None or i >= len(parts):
                            return default
                        return parts[i].strip().strip('"')

                    team_id = g("team_id")
                    if not team_id or team_id not in team_data:
                        continue

                    overall_pick = safe_int(g("overall_pick", "0"))
                    pos = g("position", "").upper().strip()

                    if pos in ("QB", "RB", "WR", "TE") and overall_pick > 0:
                        team_pos_occ[team_id][pos] += 1
                        occ = team_pos_occ[team_id][pos]
                        baseline = pos_occ_baseline.get(pos, {}).get(occ)
                        if baseline is not None:
                            # positive = drafted later than expected = value
                            diff = baseline - overall_pick
                            team_data[team_id]["adp_diff_sum"] += diff
                            team_data[team_id]["adp_diff_n"] += 1

                    file_rows += 1
                    if file_rows % 1_000_000 == 0:
                        print(f"    ...{file_rows:,} rows")

        except Exception as e:
            err = f"  ERROR {fname}: {e}"
            print(err); log.append(err)

        total_rows += file_rows
        msg = f"    Done: {file_rows:,} rows"
        print(msg); log.append(msg)

    teams_with_adp = sum(1 for td in team_data.values() if td["adp_diff_n"] > 0)
    msg = f"\n  Pass 2 complete: {total_rows:,} rows, {teams_with_adp:,} teams have ADP values"
    print(msg); log.append(msg)


# ---------------------------------------------------------------------------
# Bucket helpers — support both weighted and unweighted simultaneously
# ---------------------------------------------------------------------------

class DualBucket:
    """Accumulates both unweighted and weighted (advance, total) counts."""
    def __init__(self):
        self.d = defaultdict(lambda: [0, 0, 0.0, 0.0])
        # key -> [n_total, n_adv, w_total, w_adv]

    def add(self, key, adv, weight):
        self.d[key][0] += 1
        self.d[key][1] += adv
        self.d[key][2] += weight
        self.d[key][3] += adv * weight

    def rate_uw(self, key):
        v = self.d[key]
        return adv_rate(v[1], v[0])

    def rate_w(self, key):
        v = self.d[key]
        return wadv_rate(v[3], v[2])

    def keys_sorted(self):
        return sorted(self.d.keys())

    def n_uw(self, key):
        return self.d[key][0]

    def n_w(self, key):
        return self.d[key][2]


# ---------------------------------------------------------------------------
# Analysis 1 — Roster Construction
# ---------------------------------------------------------------------------

def roster_construction_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("1. ROSTER CONSTRUCTION ANALYSIS")
    out.append("=" * 80)
    out.append("  Columns: Unweighted Rate | n | Weighted Rate | Weighted-n")

    configs = [
        ("WR", "Through Round 6",   "wr6"),
        ("WR", "Through Round 10",  "wr10"),
        ("WR", "All 18 Rounds",     "wr18"),
        ("RB", "Through Round 6",   "rb6"),
        ("RB", "Through Round 10",  "rb10"),
        ("RB", "All 18 Rounds",     "rb18"),
    ]
    for pos, label, key in configs:
        b = DualBucket()
        for td in team_data.values():
            b.add(td[key], td["advance"], td["weight"])

        out.append(f"\n{pos}s {label}:")
        headers = [f"{pos}s Drafted", "Unwgt Rate", "n", "Wgt Rate", "Wgt-n"]
        rows = []
        for cnt in b.keys_sorted():
            n_uw = b.n_uw(cnt)
            if n_uw < 10:
                continue
            rows.append([
                f"{cnt} {pos}s",
                pct(b.rate_uw(cnt)),
                f"{n_uw:,}",
                pct(b.rate_w(cnt)),
                f"{b.n_w(cnt):,.0f}",
            ])
        out.append(fmt_table(headers, rows, col_width=18))

    for pos, key in [("QB", "qb_total"), ("TE", "te_total")]:
        b = DualBucket()
        for td in team_data.values():
            b.add(td[key], td["advance"], td["weight"])

        out.append(f"\n{pos}s Total Drafted:")
        headers = [f"{pos}s Drafted", "Unwgt Rate", "n", "Wgt Rate", "Wgt-n"]
        rows = []
        for cnt in b.keys_sorted():
            n_uw = b.n_uw(cnt)
            if n_uw < 10:
                continue
            rows.append([
                f"{cnt} {pos}s",
                pct(b.rate_uw(cnt)),
                f"{n_uw:,}",
                pct(b.rate_w(cnt)),
                f"{b.n_w(cnt):,.0f}",
            ])
        out.append(fmt_table(headers, rows, col_width=18))


# ---------------------------------------------------------------------------
# Analysis 2 — ADP Value (position-occurrence baseline)
# ---------------------------------------------------------------------------

def adp_value_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("2. ADP VALUE ANALYSIS  (position-occurrence baseline)")
    out.append("=" * 80)
    out.append("  Baseline: for each position, mean pick# of the Nth occurrence across all teams")
    out.append("  Value = baseline_pick - actual_pick  (positive = drafted later = value)")

    groups = [
        ("Reached Heavily  (< -10)",   float('-inf'), -10),
        ("Reached Slightly (-10 to -3)", -10,          -3),
        ("Near Baseline    (-3 to +3)",  -3,            3),
        ("Good Value       (+3 to +10)",  3,            10),
        ("Great Value      (> +10)",     10, float('inf')),
    ]

    b = DualBucket()
    no_data = 0
    for td in team_data.values():
        if td["adp_diff_n"] == 0:
            no_data += 1
            continue
        avg = td["adp_diff_sum"] / td["adp_diff_n"]
        for gname, lo, hi in groups:
            if lo <= avg < hi:
                b.add(gname, td["advance"], td["weight"])
                break

    out.append(f"\n  Teams with baseline ADP data: {len(team_data) - no_data:,}  |  No data: {no_data:,}")
    headers = ["ADP Group", "Unwgt Rate", "n", "Wgt Rate", "Wgt-n"]
    rows = []
    for gname, lo, hi in groups:
        n_uw = b.n_uw(gname)
        rows.append([
            gname,
            pct(b.rate_uw(gname)),
            f"{n_uw:,}",
            pct(b.rate_w(gname)),
            f"{b.n_w(gname):,.0f}",
        ])
    out.append(fmt_table(headers, rows, col_width=26))

    return b, groups


# ---------------------------------------------------------------------------
# Analysis 3 — Positional Investment + Cross-tab
# ---------------------------------------------------------------------------

def positional_investment_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("3. POSITIONAL INVESTMENT ANALYSIS")
    out.append("=" * 80)
    out.append("  Draft capital = sum of pick numbers  (lower = earlier = more expensive)")
    out.append("  % of capital = position pick total / all picks for team")

    positions = [("QB", "cap_qb"), ("RB", "cap_rb"), ("WR", "cap_wr"), ("TE", "cap_te")]

    # Store quartile assignments for cross-tab
    quartile_map = {}   # team_id -> {pos: quartile_index}
    all_quartile_results = {}

    for pos, cap_key in positions:
        # Build (pct, advance, weight, team_id) list
        data = []
        for tid, td in team_data.items():
            if td["cap_total"] == 0:
                continue
            pct_cap = td[cap_key] / td["cap_total"] * 100
            data.append((pct_cap, td["advance"], td["weight"], tid))

        data.sort(key=lambda x: x[0])
        n = len(data)
        q = n // 4

        out.append(f"\n{pos} Draft Capital % — Advance Rate by Quartile:")
        headers = ["Quartile (Range)", "Avg % Cap", "Unwgt Rate", "n", "Wgt Rate", "Wgt-n"]
        rows = []
        quartile_results = []

        for qi in range(4):
            s = qi * q
            e = (qi + 1) * q if qi < 3 else n
            chunk = data[s:e]
            total = len(chunk)
            adv_count = sum(a for _, a, _, _ in chunk)
            w_total = sum(wt for _, _, wt, _ in chunk)
            w_adv = sum(a * wt for _, a, wt, _ in chunk)
            lo = chunk[0][0]; hi = chunk[-1][0]
            avg = sum(p for p, _, _, _ in chunk) / total

            uw_rate = adv_rate(adv_count, total)
            w_rate = wadv_rate(w_adv, w_total)

            rows.append([
                f"Q{qi+1} ({lo:.1f}%-{hi:.1f}%)",
                f"{avg:.1f}%",
                pct(uw_rate),
                f"{total:,}",
                pct(w_rate),
                f"{w_total:,.0f}",
            ])
            quartile_results.append((qi+1, lo, hi, avg, uw_rate, w_rate, total))

            for _, _, _, tid in chunk:
                if tid not in quartile_map:
                    quartile_map[tid] = {}
                quartile_map[tid][pos] = qi + 1

        out.append(fmt_table(headers, rows, col_width=20))
        all_quartile_results[pos] = quartile_results

    # --- Cross-tab: positional investment vs ADP data availability ---
    out.append("\n" + "-" * 80)
    out.append("  CROSS-TAB: Positional Investment Quartiles vs ADP Data Availability")
    out.append("  (Verifies positional investment results are not distorted by ADP data gap)")
    out.append("  'Has ADP' = team has baseline ADP value computed  |  'No ADP' = missing")

    for pos, cap_key in positions:
        data = []
        for tid, td in team_data.items():
            if td["cap_total"] == 0:
                continue
            pct_cap = td[cap_key] / td["cap_total"] * 100
            has_adp = 1 if td["adp_diff_n"] > 0 else 0
            data.append((pct_cap, td["advance"], has_adp))

        data.sort(key=lambda x: x[0])
        n = len(data)
        q = n // 4

        out.append(f"\n{pos} — Quartile breakdown by ADP data presence:")
        headers = ["Quartile", "Has-ADP n", "Has-ADP Rate", "No-ADP n", "No-ADP Rate", "Distortion?"]
        rows = []
        for qi in range(4):
            s = qi * q; e = (qi + 1) * q if qi < 3 else n
            chunk = data[s:e]
            has = [(a, h) for _, a, h in chunk if h == 1]
            nope = [(a, h) for _, a, h in chunk if h == 0]
            has_rate = adv_rate(sum(a for a, _ in has), len(has))
            nope_rate = adv_rate(sum(a for a, _ in nope), len(nope))
            if has_rate is not None and nope_rate is not None:
                diff = abs(has_rate - nope_rate)
                flag = "YES - review" if diff > 5 else "No"
            else:
                flag = "N/A"
            rows.append([
                f"Q{qi+1}",
                f"{len(has):,}",
                pct(has_rate),
                f"{len(nope):,}",
                pct(nope_rate),
                flag,
            ])
        out.append(fmt_table(headers, rows, col_width=16))

    return all_quartile_results


# ---------------------------------------------------------------------------
# Analysis 4 — Version distribution summary
# ---------------------------------------------------------------------------

def version_summary(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("4. DATASET VERSION SUMMARY (Temporal Weighting Reference)")
    out.append("=" * 80)

    by_weight = defaultdict(lambda: [0, 0])  # weight -> [total, adv]
    for td in team_data.values():
        by_weight[td["weight"]][0] += 1
        by_weight[td["weight"]][1] += td["advance"]

    version_labels = {
        0.9: "BBM IV (2023)",
        1.0: "BBM V (2024)",
        1.1: "Best Bowl Mania",
    }
    headers = ["Version", "Weight", "Teams", "Advanced", "Unwgt Adv Rate"]
    rows = []
    for w in sorted(by_weight.keys()):
        total, adv = by_weight[w]
        rows.append([
            version_labels.get(w, f"weight={w}"),
            str(w),
            f"{total:,}",
            f"{adv:,}",
            pct(adv_rate(adv, total)),
        ])
    out.append(fmt_table(headers, rows, col_width=20))


# ---------------------------------------------------------------------------
# Generate scoring weights JSON (weighted rates)
# ---------------------------------------------------------------------------

def generate_weights(team_data, adp_groups):
    w = {
        "_description": (
            "Scoring weights from BBM analysis. Values are advance rate deltas vs. "
            "median/baseline bucket (percentage points). Positive = bonus, negative = penalty. "
            "Uses temporally-weighted rates (BBM IV=0.9, BBM V=1.0, Best Bowl Mania=1.1)."
        ),
        "_baseline_advance_rate": None,
        "roster_construction": {},
        "adp_value": {},
        "positional_investment": {},
    }

    total = len(team_data)
    adv = sum(td["advance"] for td in team_data.values())
    w_total = sum(td["weight"] for td in team_data.values())
    w_adv = sum(td["advance"] * td["weight"] for td in team_data.values())
    w["_baseline_advance_rate"] = round(wadv_rate(w_adv, w_total), 2)

    # Roster construction
    for pos in ("WR", "RB"):
        for label, key in [("rd6", f"{pos.lower()}6"), ("rd10", f"{pos.lower()}10"),
                            ("rd18", f"{pos.lower()}18")]:
            b = DualBucket()
            for td in team_data.values():
                b.add(td[key], td["advance"], td["weight"])
            valid = {k: v for k, v in b.d.items() if v[0] >= 100}
            if not valid:
                continue
            sorted_keys = sorted(valid.keys())
            median_key = sorted_keys[len(sorted_keys) // 2]
            baseline = b.rate_w(median_key)
            if baseline is None:
                continue
            section = {}
            for cnt in sorted_keys:
                rate = b.rate_w(cnt)
                if rate is not None:
                    section[f"{cnt}_{pos}s"] = round(rate - baseline, 2)
            if section:
                w["roster_construction"][f"{pos}_through_{label}"] = section

    for pos, key in [("QB", "qb_total"), ("TE", "te_total")]:
        b = DualBucket()
        for td in team_data.values():
            b.add(td[key], td["advance"], td["weight"])
        valid = {k: v for k, v in b.d.items() if v[0] >= 100}
        if not valid:
            continue
        sorted_keys = sorted(valid.keys())
        median_key = sorted_keys[len(sorted_keys) // 2]
        baseline = b.rate_w(median_key)
        if baseline is None:
            continue
        section = {}
        for cnt in sorted_keys:
            rate = b.rate_w(cnt)
            if rate is not None:
                section[f"{cnt}_{pos}s"] = round(rate - baseline, 2)
        if section:
            w["roster_construction"][f"{pos}_total"] = section

    # ADP value weights
    groups_meta = adp_groups  # list of (name, lo, hi)
    b_adp = DualBucket()
    for td in team_data.values():
        if td["adp_diff_n"] == 0:
            continue
        avg = td["adp_diff_sum"] / td["adp_diff_n"]
        for gname, lo, hi in groups_meta:
            if lo <= avg < hi:
                b_adp.add(gname, td["advance"], td["weight"])
                break
    near_baseline = b_adp.rate_w("Near Baseline    (-3 to +3)")
    if near_baseline is not None:
        for gname, lo, hi in groups_meta:
            rate = b_adp.rate_w(gname)
            n_uw = b_adp.n_uw(gname)
            if rate is not None and n_uw >= 100:
                slug = gname.split("(")[0].strip().lower().replace(" ", "_")
                w["adp_value"][slug] = round(rate - near_baseline, 2)

    # Positional investment weights (weighted rates, Q2 as baseline)
    for pos, cap_key in [("QB", "cap_qb"), ("RB", "cap_rb"),
                          ("WR", "cap_wr"), ("TE", "cap_te")]:
        data = sorted(
            [(td[cap_key] / td["cap_total"] * 100, td["advance"], td["weight"])
             for td in team_data.values() if td["cap_total"] > 0],
            key=lambda x: x[0]
        )
        n = len(data)
        q = n // 4
        quartile_rates = []
        for qi in range(4):
            s = qi * q; e = (qi + 1) * q if qi < 3 else n
            chunk = data[s:e]
            w_adv = sum(a * wt for _, a, wt in chunk)
            w_tot = sum(wt for _, _, wt in chunk)
            quartile_rates.append(wadv_rate(w_adv, w_tot))
        baseline_q2 = quartile_rates[1]
        if baseline_q2 is not None:
            section = {}
            for qi, rate in enumerate(quartile_rates):
                if rate is not None:
                    section[f"Q{qi+1}"] = round(rate - baseline_q2, 2)
            w["positional_investment"][f"{pos}_capital_pct"] = section

    return w


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log = []
    csv_files = get_csv_files()

    if not csv_files:
        print(f"No CSV files found in {DATA_DIR}")
        sys.exit(1)

    print(f"\nFound {len(csv_files)} file(s) to process:")
    for f in csv_files:
        fname = os.path.basename(f)
        size = os.path.getsize(f) / 1e9
        print(f"  {fname}  ({size:.3f} GB)  weight={file_weight(fname)}  [{file_version(fname)}]")

    # === PASS 1 ===
    print("\n" + "=" * 60)
    print("PASS 1 — Building baselines + team data")
    print("=" * 60)
    log.append("=" * 80)
    log.append("PASS 1 — Building position-occurrence baselines + team data")
    log.append("=" * 80)

    team_data, pos_occ_baseline = pass1(csv_files, log)

    # === PASS 2 ===
    print("\n" + "=" * 60)
    print("PASS 2 — Computing ADP value using baselines")
    print("=" * 60)
    log.append("\n" + "=" * 80)
    log.append("PASS 2 — Computing ADP value per team")
    log.append("=" * 80)

    pass2(csv_files, team_data, pos_occ_baseline, log)

    # === Analyses ===
    total_teams = len(team_data)
    total_adv = sum(td["advance"] for td in team_data.values())
    w_total = sum(td["weight"] for td in team_data.values())
    w_adv = sum(td["advance"] * td["weight"] for td in team_data.values())
    uw_rate = adv_rate(total_adv, total_teams)
    wt_rate = wadv_rate(w_adv, w_total)

    out = []
    out.append("BBM CALIBRATION ANALYSIS v2")
    out.append("=" * 80)
    out.append(f"Total teams analyzed: {total_teams:,}")
    out.append(f"Total teams advanced: {total_adv:,}")
    out.append(f"Overall unweighted advance rate: {pct(uw_rate)}")
    out.append(f"Overall weighted advance rate:   {pct(wt_rate)}")
    out.append(f"\nTemporal weights applied: BBM IV=0.9, BBM V=1.0, Best Bowl Mania=1.1")
    out.append(f"ADP method: position-occurrence baseline (mean pick# for Nth pick at position)")
    out += log

    print("\nRunning analyses...")
    version_summary(team_data, out)
    roster_construction_analysis(team_data, out)
    print("  Roster construction done.")

    adp_groups = [
        ("Reached Heavily  (< -10)",    float('-inf'), -10),
        ("Reached Slightly (-10 to -3)", -10,           -3),
        ("Near Baseline    (-3 to +3)",  -3,             3),
        ("Good Value       (+3 to +10)",  3,            10),
        ("Great Value      (> +10)",     10, float('inf')),
    ]
    adp_b, _ = adp_value_analysis(team_data, out)
    print("  ADP value analysis done.")

    positional_investment_analysis(team_data, out)
    print("  Positional investment + cross-tab done.")

    # Write TXT
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"\n  Saved: {OUTPUT_TXT}")

    # Generate and write JSON
    weights = generate_weights(team_data, adp_groups)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(weights, f, indent=2)
    print(f"  Saved: {OUTPUT_JSON}")

    print("\nDone!")

if __name__ == "__main__":
    main()
