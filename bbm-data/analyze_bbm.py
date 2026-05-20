"""
BBM Pick-by-Pick CSV Analysis Script
Produces: bbm_calibration_analysis.txt + bbm_scoring_weights.json

Column mapping (confirmed from file preview):
  draft_entry_id       -> team identifier
  made_playoffs        -> advance flag (0/1)
  team_pick_number     -> draft round (1-18)
  overall_pick_number  -> overall pick position in draft
  position_name        -> QB / RB / WR / TE / K / DEF
  projection_adp       -> projected ADP for ADP value analysis
  (no NFL team column  -> stacking analysis skipped)
  (no bye week column  -> bye week analysis skipped)
"""

import os
import sys
import json
from collections import defaultdict

DATA_DIR = "C:/Users/Kyle/OneDrive/Documents/StackAttack/bbm-data"
OUTPUT_TXT = os.path.join(DATA_DIR, "bbm_calibration_analysis.txt")
OUTPUT_JSON = os.path.join(DATA_DIR, "bbm_scoring_weights.json")

# Files to skip (empty or confirmed duplicates)
SKIP_FILES = {
    "best_ball_mania_v_rd1.csv",          # empty
    "best_ball_mania_v_rd1(2).csv",        # duplicate of (1)
    "best_ball_mania_v_rd2(1).csv",        # duplicate of rd2
    "Best Bowl Mania Rd 1(1).csv",         # duplicate of rd1
}

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

def fmt_table(headers, rows, col_width=24):
    sep = "+" + "+".join("-" * (col_width + 2) for _ in headers) + "+"
    hdr = "| " + " | ".join(h.ljust(col_width) for h in headers) + " |"
    lines = [sep, hdr, sep]
    for row in rows:
        lines.append("| " + " | ".join(str(v).ljust(col_width) for v in row) + " |")
    lines.append(sep)
    return "\n".join(lines)

def pct(rate):
    return f"{rate:.2f}%" if rate is not None else "N/A"

# ---------------------------------------------------------------------------
# File list
# ---------------------------------------------------------------------------

def get_csv_files():
    all_files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.lower().endswith(".csv") and f not in SKIP_FILES
    ])
    return [os.path.join(DATA_DIR, f) for f in all_files]

# ---------------------------------------------------------------------------
# Column index resolver — works for both 22-col and 24-col schemas
# ---------------------------------------------------------------------------

def get_col_indices(headers):
    h = [x.strip().strip('"').lower() for x in headers]
    def find(*names):
        for n in names:
            if n in h:
                return h.index(n)
        return None

    return {
        "team_id":      find("draft_entry_id", "entry_id"),
        "advanced":     find("made_playoffs", "advanced", "advance", "playoff"),
        "draft_round":  find("team_pick_number", "pick_round", "round_number", "round"),
        "overall_pick": find("overall_pick_number", "overall_pick", "pick_no"),
        "position":     find("position_name", "position", "pos"),
        "proj_adp":     find("projection_adp", "proj_adp", "adp"),
    }

# ---------------------------------------------------------------------------
# Main streaming processor
#
# Per-team aggregated counters (memory efficient — no full pick list stored):
#   advance, wr6/10/18, rb6/10/18, qb_total, te_total,
#   adp_diff_sum, adp_diff_n,
#   cap_qb/rb/wr/te/total  (sum of overall_pick_number by position)
# ---------------------------------------------------------------------------

def process_files(csv_files, log):
    # team_data[team_id] = dict of counters
    team_data = {}

    total_rows = 0

    for filepath in csv_files:
        fname = os.path.basename(filepath)
        fsize = os.path.getsize(filepath) / 1e9
        msg = f"\n  Processing: {fname}  ({fsize:.3f} GB)"
        print(msg); log.append(msg)

        file_rows = 0

        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                header_line = f.readline()
                headers = header_line.rstrip("\n").split(",")
                idx = get_col_indices(headers)

                missing = [k for k, v in idx.items() if v is None]
                if missing:
                    m = f"    WARNING: Missing columns: {missing}"
                    print(m); log.append(m)

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

                    # Advance flag
                    adv_raw = g("advanced", "0").lower()
                    adv = 1 if adv_raw in ("1", "true", "yes", "t") else 0

                    # Draft round (team_pick_number = pick 1-18 within this team's draft)
                    draft_round = safe_int(g("draft_round", "0"))
                    overall_pick = safe_int(g("overall_pick", "0"))
                    pos = g("position", "").upper().strip()
                    proj_adp = safe_float(g("proj_adp", "0"))

                    # Init team record
                    if team_id not in team_data:
                        team_data[team_id] = {
                            "advance": adv,
                            "wr6": 0, "wr10": 0, "wr18": 0,
                            "rb6": 0, "rb10": 0, "rb18": 0,
                            "qb_total": 0, "te_total": 0,
                            "adp_diff_sum": 0.0, "adp_diff_n": 0,
                            "cap_qb": 0, "cap_rb": 0, "cap_wr": 0, "cap_te": 0,
                            "cap_total": 0,
                        }
                    else:
                        if adv == 1:
                            team_data[team_id]["advance"] = 1

                    td = team_data[team_id]

                    # Roster construction counters
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

                    # ADP value
                    if proj_adp > 0 and overall_pick > 0:
                        td["adp_diff_sum"] += (proj_adp - overall_pick)
                        td["adp_diff_n"] += 1

                    # Positional capital
                    if overall_pick > 0:
                        td["cap_total"] += overall_pick
                        if pos == "QB": td["cap_qb"] += overall_pick
                        elif pos == "RB": td["cap_rb"] += overall_pick
                        elif pos == "WR": td["cap_wr"] += overall_pick
                        elif pos == "TE": td["cap_te"] += overall_pick

                    file_rows += 1
                    if file_rows % 1_000_000 == 0:
                        print(f"    ...{file_rows:,} rows  |  {len(team_data):,} teams so far")

        except Exception as e:
            err = f"  ERROR in {fname}: {e}"
            print(err); log.append(err)
            import traceback; traceback.print_exc()

        total_rows += file_rows
        msg = f"    Done. {file_rows:,} rows. Teams so far: {len(team_data):,}"
        print(msg); log.append(msg)

    msg = f"\n  Total rows: {total_rows:,} | Total unique teams: {len(team_data):,}"
    print(msg); log.append(msg)
    return team_data

# ---------------------------------------------------------------------------
# Analysis: Roster Construction
# ---------------------------------------------------------------------------

def roster_construction_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("1. ROSTER CONSTRUCTION ANALYSIS")
    out.append("=" * 80)

    # WR and RB by round cutoff
    for pos in ("WR", "RB"):
        for cutoff_label, key in [("Through Round 6", f"{pos.lower()}6"),
                                   ("Through Round 10", f"{pos.lower()}10"),
                                   ("All 18 Rounds", f"{pos.lower()}18")]:
            bucket = defaultdict(lambda: [0, 0])
            for td in team_data.values():
                cnt = td[key]
                bucket[cnt][0] += 1
                bucket[cnt][1] += td["advance"]

            out.append(f"\n{pos}s {cutoff_label}:")
            rows = []
            for cnt in sorted(bucket.keys()):
                total, adv = bucket[cnt]
                rows.append([f"{cnt} {pos}s", pct(adv_rate(adv, total)), f"n={total:,}"])
            out.append(fmt_table([f"{pos}s Drafted", "Advance Rate", "Sample Size"], rows))

    # QB and TE totals
    for pos, key in [("QB", "qb_total"), ("TE", "te_total")]:
        bucket = defaultdict(lambda: [0, 0])
        for td in team_data.values():
            cnt = td[key]
            bucket[cnt][0] += 1
            bucket[cnt][1] += td["advance"]

        out.append(f"\n{pos}s Total Drafted:")
        rows = []
        for cnt in sorted(bucket.keys()):
            total, adv = bucket[cnt]
            rows.append([f"{cnt} {pos}s", pct(adv_rate(adv, total)), f"n={total:,}"])
        out.append(fmt_table([f"{pos}s Drafted", "Advance Rate", "Sample Size"], rows))

# ---------------------------------------------------------------------------
# Analysis: ADP Value
# ---------------------------------------------------------------------------

def adp_value_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("2. ADP VALUE ANALYSIS")
    out.append("=" * 80)
    out.append("  (positive avg diff = picked later than ADP = value; negative = reached)")

    groups = [
        ("Reached Heavily  (avg < -10)", float('-inf'), -10),
        ("Reached Slightly (-10 to -3)", -10,           -3),
        ("Near ADP         (-3 to +3)",  -3,             3),
        ("Good Value       (+3 to +10)",  3,             10),
        ("Great Value      (> +10)",     10,  float('inf')),
    ]
    buckets = {g[0]: [0, 0] for g in groups}

    no_adp = 0
    for td in team_data.values():
        adv = td["advance"]
        if td["adp_diff_n"] == 0:
            no_adp += 1
            continue
        avg_diff = td["adp_diff_sum"] / td["adp_diff_n"]
        for gname, lo, hi in groups:
            if lo <= avg_diff < hi:
                buckets[gname][0] += 1
                buckets[gname][1] += adv
                break

    out.append(f"\n  Teams with ADP data: {len(team_data) - no_adp:,}  |  No ADP data: {no_adp:,}")
    out.append("\n  Team Average ADP Diff vs Advance Rate:")
    rows = []
    adp_rates = {}
    for gname, lo, hi in groups:
        total, adv = buckets[gname]
        rate = adv_rate(adv, total)
        adp_rates[gname] = rate
        rows.append([gname, pct(rate), f"n={total:,}"])
    out.append(fmt_table(["ADP Group", "Advance Rate", "Sample Size"], rows))
    return adp_rates

# ---------------------------------------------------------------------------
# Analysis: Positional Investment
# ---------------------------------------------------------------------------

def positional_investment_analysis(team_data, out):
    out.append("\n" + "=" * 80)
    out.append("3. POSITIONAL INVESTMENT ANALYSIS")
    out.append("=" * 80)
    out.append("  (draft capital = sum of pick numbers; lower pick# = earlier = more capital)")
    out.append("  (% of capital = position pick total / all pick totals for team)")

    for pos, cap_key in [("QB", "cap_qb"), ("RB", "cap_rb"),
                          ("WR", "cap_wr"), ("TE", "cap_te")]:
        data = []
        for td in team_data.values():
            if td["cap_total"] == 0:
                continue
            pct_cap = td[cap_key] / td["cap_total"] * 100
            data.append((pct_cap, td["advance"]))

        if not data:
            continue

        data.sort(key=lambda x: x[0])
        n = len(data)
        q = n // 4

        out.append(f"\n{pos} Draft Capital % — Advance Rate by Quartile:")
        rows = []
        for qi in range(4):
            s = qi * q
            e = (qi + 1) * q if qi < 3 else n
            chunk = data[s:e]
            total = len(chunk)
            adv_count = sum(a for _, a in chunk)
            lo = chunk[0][0]; hi = chunk[-1][0]
            avg = sum(p for p, _ in chunk) / total
            rate = adv_rate(adv_count, total)
            rows.append([
                f"Q{qi+1}  ({lo:.1f}% – {hi:.1f}%)",
                f"{avg:.1f}% avg",
                pct(rate),
                f"n={total:,}"
            ])
        out.append(fmt_table(["Quartile (Range)", "Avg % Capital", "Advance Rate", "Sample Size"], rows))

# ---------------------------------------------------------------------------
# Generate scoring weights JSON
# ---------------------------------------------------------------------------

def generate_weights(team_data):
    w = {
        "_description": (
            "Suggested scoring weights from BBM advance rate analysis. "
            "Values are advance rate deltas vs. median bucket (in percentage points). "
            "Positive = bonus, negative = penalty."
        ),
        "roster_construction": {},
        "adp_value": {},
        "positional_investment": {}
    }

    # Roster construction weights
    for pos in ("WR", "RB"):
        for cutoff_label, key in [("rd6", f"{pos.lower()}6"),
                                   ("rd10", f"{pos.lower()}10"),
                                   ("rd18", f"{pos.lower()}18")]:
            bucket = defaultdict(lambda: [0, 0])
            for td in team_data.values():
                cnt = td[key]
                bucket[cnt][0] += 1
                bucket[cnt][1] += td["advance"]
            # Filter to buckets with >= 100 teams
            valid = {cnt: v for cnt, v in bucket.items() if v[0] >= 100}
            if not valid:
                continue
            sorted_cnts = sorted(valid.keys())
            median_cnt = sorted_cnts[len(sorted_cnts) // 2]
            baseline_total, baseline_adv = valid[median_cnt]
            baseline = adv_rate(baseline_adv, baseline_total)
            if baseline is None:
                continue
            section = {}
            for cnt in sorted_cnts:
                total, adv = valid[cnt]
                rate = adv_rate(adv, total)
                if rate is not None:
                    section[f"{cnt}_{pos}s"] = round(rate - baseline, 2)
            if section:
                w["roster_construction"][f"{pos}_through_{cutoff_label}"] = section

    for pos, key in [("QB", "qb_total"), ("TE", "te_total")]:
        bucket = defaultdict(lambda: [0, 0])
        for td in team_data.values():
            cnt = td[key]
            bucket[cnt][0] += 1
            bucket[cnt][1] += td["advance"]
        valid = {cnt: v for cnt, v in bucket.items() if v[0] >= 100}
        if not valid:
            continue
        sorted_cnts = sorted(valid.keys())
        median_cnt = sorted_cnts[len(sorted_cnts) // 2]
        baseline = adv_rate(valid[median_cnt][1], valid[median_cnt][0])
        if baseline is None:
            continue
        section = {}
        for cnt in sorted_cnts:
            total, adv = valid[cnt]
            rate = adv_rate(adv, total)
            if rate is not None:
                section[f"{cnt}_{pos}s"] = round(rate - baseline, 2)
        if section:
            w["roster_construction"][f"{pos}_total"] = section

    # ADP value weights
    groups = [
        ("reached_heavily",  float('-inf'), -10),
        ("reached_slightly", -10,           -3),
        ("near_adp",         -3,             3),
        ("good_value",        3,             10),
        ("great_value",      10,  float('inf')),
    ]
    adp_buckets = {g[0]: [0, 0] for g in groups}
    for td in team_data.values():
        if td["adp_diff_n"] == 0:
            continue
        avg_diff = td["adp_diff_sum"] / td["adp_diff_n"]
        for gname, lo, hi in groups:
            if lo <= avg_diff < hi:
                adp_buckets[gname][0] += 1
                adp_buckets[gname][1] += td["advance"]
                break
    baseline_total, baseline_adv = adp_buckets["near_adp"]
    baseline = adv_rate(baseline_adv, baseline_total)
    if baseline is not None:
        for gname, lo, hi in groups:
            total, adv = adp_buckets[gname]
            if total >= 100:
                rate = adv_rate(adv, total)
                if rate is not None:
                    w["adp_value"][gname] = round(rate - baseline, 2)

    # Positional investment weights (Q1 vs median quartile)
    for pos, cap_key in [("QB", "cap_qb"), ("RB", "cap_rb"),
                          ("WR", "cap_wr"), ("TE", "cap_te")]:
        data = []
        for td in team_data.values():
            if td["cap_total"] == 0:
                continue
            data.append((td[cap_key] / td["cap_total"] * 100, td["advance"]))
        data.sort(key=lambda x: x[0])
        n = len(data)
        q = n // 4
        quartile_rates = []
        for qi in range(4):
            s = qi * q; e = (qi + 1) * q if qi < 3 else n
            chunk = data[s:e]
            rate = adv_rate(sum(a for _, a in chunk), len(chunk))
            quartile_rates.append(rate)
        baseline = quartile_rates[1]  # Q2 as baseline
        if baseline is not None:
            section = {}
            for qi, rate in enumerate(quartile_rates):
                if rate is not None:
                    section[f"Q{qi+1}"] = round(rate - baseline, 2)
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
        size = os.path.getsize(f) / 1e9
        print(f"  {os.path.basename(f)}  ({size:.3f} GB)")

    print(f"\nSkipping (duplicates/empty): {sorted(SKIP_FILES)}")

    # ---- Column preview ----
    print("\n" + "=" * 60)
    print("STEP 1 — FILE STRUCTURE PREVIEW")

    out = []
    out.append("BBM CALIBRATION ANALYSIS")
    out.append("=" * 80)
    out.append("STEP 1 — FILE STRUCTURE")
    out.append("=" * 80)
    out.append(f"Files skipped (duplicates/empty): {sorted(SKIP_FILES)}")

    for filepath in csv_files:
        fname = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            header = f.readline().rstrip("\n")
            cols = [c.strip().strip('"') for c in header.split(",")]
            row1 = f.readline().rstrip("\n")
        print(f"\n  {fname}  — {len(cols)} columns")
        print(f"  {cols}")
        out.append(f"\nFile: {fname}  ({len(cols)} columns)")
        out.append(f"Columns: {cols}")

    # ---- Process ----
    print("\n" + "=" * 60)
    print("STEP 2 — PROCESSING (streaming, line by line)")
    print("=" * 60)

    out.append("\n" + "=" * 80)
    out.append("STEP 2 — PROCESSING LOG")
    out.append("=" * 80)

    team_data = process_files(csv_files, out)

    total_teams = len(team_data)
    total_adv = sum(td["advance"] for td in team_data.values())
    overall = adv_rate(total_adv, total_teams)

    summary = (f"\nTotal unique teams: {total_teams:,} | "
               f"Advanced: {total_adv:,} | "
               f"Overall advance rate: {pct(overall)}")
    print(summary); out.append(summary)

    # ---- Analyses ----
    print("\nRunning analyses...")
    out.append("\n" + "=" * 80)
    out.append("ANALYSIS RESULTS")
    out.append("=" * 80)
    out.append(f"\nOverall advance rate (baseline): {pct(overall)}  (n={total_teams:,})")
    out.append("NOTE: Stacking analysis and bye week analysis skipped — NFL team and")
    out.append("      bye week columns not present in these CSV files.")

    roster_construction_analysis(team_data, out)
    print("  Roster construction done.")

    adp_value_analysis(team_data, out)
    print("  ADP value analysis done.")

    positional_investment_analysis(team_data, out)
    print("  Positional investment done.")

    # ---- Write outputs ----
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"\n  Saved: {OUTPUT_TXT}")

    weights = generate_weights(team_data)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(weights, f, indent=2)
    print(f"  Saved: {OUTPUT_JSON}")

    print("\nDone!")

if __name__ == "__main__":
    main()
