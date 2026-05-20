"""
BBM Calibration Analysis v3
Datasets: BBM II (0.6), BBM III (0.75), BBM IV (0.9), BBM V (1.0), Best Bowl Mania (1.1)

Key design decisions:
  - BBM II: regular season only; team_id = tournament_entry_id; advance = playoff_team (correct in file)
  - BBM III: regular season only; team_id = tournament_entry_id; advance IMPUTED via pre-pass
              (regular season playoff_team = 0 for all rows; must cross-ref with QF tournament_entry_ids)
  - BBM IV/V/BBM: draft_entry_id as team_id; made_playoffs as advance flag
  - ADP value:
      BBM II/III: projection_adp - overall_pick_number (real, populated ADP data)
      BBM IV/V/BBM: position-occurrence baseline (projection_adp unreliable)
  - Bye week analysis: BBM II/III only (column not present in IV/V/BBM)

Passes:
  Pass 0 (pre-pass): read BBM III quarterfinals files → build set of advancing tournament_entry_ids
  Pass 1: stream all regular season files → build position-occurrence baselines + team_data
  Pass 2: stream again → compute per-team ADP values
"""

import os, sys, json
from collections import defaultdict

DATA_DIR = "C:/Users/Kyle/OneDrive/Documents/StackAttack/bbm-data"
OUTPUT_TXT  = os.path.join(DATA_DIR, "bbm_calibration_analysis.txt")
OUTPUT_JSON = os.path.join(DATA_DIR, "bbm_scoring_weights.json")

# ---------------------------------------------------------------------------
# File sets
# ---------------------------------------------------------------------------

# Files to process (regular season only for BBM II/III)
PROCESS_FILES = {
    "BBM II":            {"weight": 0.6,  "files": ["bbm2_regular.csv"]},
    "BBM III":           {"weight": 0.75, "files": [f"bbm3_regular_part{i:02d}.csv" for i in range(12)]},
    "BBM IV (2023)":     {"weight": 0.9,  "files": [
        "best_ball_mania_iv_2023_r1_results_pick_by_pick.csv",
        "best_ball_mania_iv_2023_r2_results_pick_by_pick.csv",
        "best_ball_mania_iv_2023_r3_results_pick_by_pick.csv",
        "best_ball_mania_iv_2023_r4_results_pick_by_pick.csv",
    ]},
    "BBM V (2024)":      {"weight": 1.0,  "files": [
        "best_ball_mania_v_rd1(1).csv",
        "best_ball_mania_v_rd2.csv",
        "best_ball_mania_v_rd3.csv",
        "best_ball_mania_v_rd4.csv",
    ]},
    "Best Bowl Mania":   {"weight": 1.1,  "files": [
        "Best Bowl Mania Rd 1.csv",
        "Best Bowl Mania Rd 2.csv",
        "Best Bowl Mania Rd 3.csv",
        "Best Bowl Mania Rd 4.csv",
    ]},
}

# BBM III quarterfinals files used only for advance flag imputation (not added to team_data)
BBM3_QF_FILES = [
    "bbm3_quarterfinals_part00.csv",
    "bbm3_quarterfinals_part01.csv",
    "bbm3_quarterfinals_part02.csv",
]

# Per-file version lookup
def get_version(fname):
    for ver, meta in PROCESS_FILES.items():
        if fname in meta["files"]:
            return ver, meta["weight"]
    return "Unknown", 1.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_int(v, d=0):
    try: return int(float(str(v).strip())) if str(v).strip() else d
    except: return d

def safe_float(v, d=0.0):
    try: return float(str(v).strip()) if str(v).strip() else d
    except: return d

def adv_rate(n_adv, n_total):
    return round(n_adv / n_total * 100, 2) if n_total else None

def wadv_rate(w_adv, w_total):
    return round(w_adv / w_total * 100, 2) if w_total else None

def pct(r): return f"{r:.2f}%" if r is not None else "N/A"

def fmt_table(headers, rows, cw=22):
    sep = "+" + "+".join("-"*(cw+2) for _ in headers) + "+"
    hdr = "| " + " | ".join(h.ljust(cw) for h in headers) + " |"
    lines = [sep, hdr, sep]
    for row in lines + [sep]: pass  # keep ref
    lines = [sep, hdr, sep]
    for r in rows:
        lines.append("| " + " | ".join(str(v).ljust(cw) for v in r) + " |")
    lines.append(sep)
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Column resolver — handles all schema variants
# ---------------------------------------------------------------------------

def get_idx(headers):
    h = [x.strip().strip('"').lower() for x in headers]
    def find(*names):
        for n in names:
            if n in h: return h.index(n)
        return None
    return {
        "team_id_draft":  find("draft_entry_id", "entry_id"),
        "team_id_tourn":  find("tournament_entry_id"),
        "advanced":       find("made_playoffs", "playoff_team", "advanced"),
        "draft_round":    find("team_pick_number", "pick_round", "round_number"),
        "overall_pick":   find("overall_pick_number", "overall_pick", "pick_no"),
        "position":       find("position_name", "position", "pos"),
        "proj_adp":       find("projection_adp", "proj_adp", "adp"),
        "bye_week":       find("bye_week", "bye"),
    }

# ---------------------------------------------------------------------------
# PASS 0 — BBM III advance flag imputation
# ---------------------------------------------------------------------------

def pass0_bbm3_advance(log):
    """Read BBM III quarterfinals files; return set of advancing tournament_entry_ids."""
    advancing = set()
    for fname in BBM3_QF_FILES:
        path = os.path.join(DATA_DIR, fname)
        if not os.path.exists(path):
            msg = f"  [Pass0] MISSING: {fname} — flagged as data quality issue"
            print(msg); log.append(msg); continue
        msg = f"  [Pass0] {fname} ..."
        print(msg, flush=True)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            headers = f.readline().rstrip("\n").split(",")
            idx = get_idx(headers)
            for line in f:
                parts = line.rstrip("\n").split(",")
                tid = idx.get("team_id_tourn")
                if tid is not None and tid < len(parts):
                    advancing.add(parts[tid].strip().strip('"'))
    msg = f"  [Pass0] BBM III advancing tournament_entry_ids: {len(advancing):,}"
    print(msg); log.append(msg)
    return advancing

# ---------------------------------------------------------------------------
# Dual bucket (unweighted + weighted simultaneously)
# ---------------------------------------------------------------------------

class DB:
    def __init__(self): self.d = defaultdict(lambda: [0,0,0.0,0.0])
    def add(self, key, adv, w): v=self.d[key]; v[0]+=1; v[1]+=adv; v[2]+=w; v[3]+=adv*w
    def uw(self, k): v=self.d[k]; return adv_rate(v[1],v[0])
    def wt(self, k): v=self.d[k]; return wadv_rate(v[3],v[2])
    def n_uw(self, k): return self.d[k][0]
    def n_wt(self, k): return self.d[k][2]
    def keys(self): return sorted(self.d.keys())

# ---------------------------------------------------------------------------
# PASS 1 — build position-occurrence baselines + team_data
# ---------------------------------------------------------------------------

def pass1(bbm3_advancing, log):
    pos_occ_raw = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    team_pos_occ = defaultdict(lambda: defaultdict(int))
    team_data = {}
    total_rows = 0
    data_flags = []

    for ver, meta in PROCESS_FILES.items():
        for fname in meta["files"]:
            path = os.path.join(DATA_DIR, fname)
            if not os.path.exists(path):
                msg = f"  ⚠ FILE NOT FOUND: {fname} (version={ver}) — SKIPPING"
                print(msg); log.append(msg); data_flags.append(msg); continue

            fsize = os.path.getsize(path)/1e9
            w = meta["weight"]
            msg = f"\n  [Pass1] {fname}  ({fsize:.3f}GB)  ver={ver}  wt={w}"
            print(msg, flush=True); log.append(msg)

            is_bbm2 = ver == "BBM II"
            is_bbm3 = ver == "BBM III"
            has_real_adp = is_bbm2 or is_bbm3

            file_rows = 0
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    headers = f.readline().rstrip("\n").split(",")
                    idx = get_idx(headers)

                    # Warn about missing columns
                    for col in ["draft_round","overall_pick","position","advanced"]:
                        if idx.get(col) is None:
                            m = f"    WARNING: col '{col}' not found in {fname}"
                            print(m); log.append(m); data_flags.append(m)

                    for line in f:
                        parts = line.rstrip("\n").split(",")

                        def g(key, default=""):
                            i = idx.get(key)
                            return parts[i].strip().strip('"') if (i is not None and i < len(parts)) else default

                        # Team ID: BBM II/III use tournament_entry_id; others use draft_entry_id
                        if is_bbm2 or is_bbm3:
                            team_id = g("team_id_tourn")
                        else:
                            team_id = g("team_id_draft")
                        if not team_id: continue

                        # Advance flag
                        if is_bbm3:
                            adv = 1 if team_id in bbm3_advancing else 0
                        else:
                            raw = g("advanced","0").lower()
                            adv = 1 if raw in ("1","true","yes","t") else 0

                        draft_round  = safe_int(g("draft_round","0"))
                        overall_pick = safe_int(g("overall_pick","0"))
                        pos          = g("position","").upper().strip()
                        proj_adp     = safe_float(g("proj_adp","0"))
                        bye_week     = safe_int(g("bye_week","0"))

                        if pos not in ("QB","RB","WR","TE","K","DEF"): pos = "OTHER"

                        # Position-occurrence baseline (used for BBM IV/V/BBM ADP)
                        if pos in ("QB","RB","WR","TE") and overall_pick > 0:
                            team_pos_occ[team_id][pos] += 1
                            occ = team_pos_occ[team_id][pos]
                            pos_occ_raw[pos][occ][0] += overall_pick
                            pos_occ_raw[pos][occ][1] += 1

                        # Init or update team record
                        if team_id not in team_data:
                            team_data[team_id] = {
                                "advance":0, "weight":w, "version":ver,
                                "has_real_adp": has_real_adp,
                                "wr6":0,"wr10":0,"wr18":0,
                                "rb6":0,"rb10":0,"rb18":0,
                                "qb_total":0,"te_total":0,
                                "cap_qb":0,"cap_rb":0,"cap_wr":0,"cap_te":0,"cap_total":0,
                                "adp_real_sum":0.0,"adp_real_n":0,   # BBM II/III: proj_adp - pick
                                "adp_base_sum":0.0,"adp_base_n":0,   # BBM IV/V/BBM: baseline method
                                # bye week
                                "pos_bye": None,  # will be set on first bye_week encounter
                            }
                        else:
                            if adv == 1: team_data[team_id]["advance"] = 1

                        td = team_data[team_id]

                        # Roster construction
                        if pos == "WR":
                            if draft_round <= 6:  td["wr6"]  += 1
                            if draft_round <= 10: td["wr10"] += 1
                            td["wr18"] += 1
                        elif pos == "RB":
                            if draft_round <= 6:  td["rb6"]  += 1
                            if draft_round <= 10: td["rb10"] += 1
                            td["rb18"] += 1
                        elif pos == "QB": td["qb_total"] += 1
                        elif pos == "TE": td["te_total"] += 1

                        # Capital
                        if overall_pick > 0:
                            td["cap_total"] += overall_pick
                            if pos == "QB":   td["cap_qb"] += overall_pick
                            elif pos == "RB": td["cap_rb"] += overall_pick
                            elif pos == "WR": td["cap_wr"] += overall_pick
                            elif pos == "TE": td["cap_te"] += overall_pick

                        # Real ADP (BBM II/III)
                        if has_real_adp and proj_adp > 0 and overall_pick > 0:
                            td["adp_real_sum"] += (proj_adp - overall_pick)
                            td["adp_real_n"]   += 1

                        # Bye week (BBM II/III)
                        if (is_bbm2 or is_bbm3) and bye_week > 0 and pos in ("QB","RB","WR","TE"):
                            if td["pos_bye"] is None:
                                td["pos_bye"] = defaultdict(lambda: defaultdict(int))
                            td["pos_bye"][pos][bye_week] += 1

                        file_rows += 1
                        if file_rows % 1_000_000 == 0:
                            print(f"    ...{file_rows:,} rows | {len(team_data):,} teams", flush=True)

            except Exception as e:
                msg = f"  ERROR in {fname}: {e}"
                print(msg); log.append(msg); data_flags.append(msg)
                import traceback; traceback.print_exc()

            total_rows += file_rows
            msg = f"    Done: {file_rows:,} rows | {len(team_data):,} teams total"
            print(msg); log.append(msg)

    # Build baselines
    pos_occ_baseline = {}
    for pos, occ_data in pos_occ_raw.items():
        pos_occ_baseline[pos] = {occ: s/c for occ,(s,c) in occ_data.items() if c >= 100}

    del team_pos_occ, pos_occ_raw

    total_teams = len(team_data)
    total_adv   = sum(td["advance"] for td in team_data.values())
    msg = f"\n  Pass 1 done: {total_rows:,} rows | {total_teams:,} teams | {total_adv:,} advanced"
    print(msg); log.append(msg)
    return team_data, pos_occ_baseline, data_flags

# ---------------------------------------------------------------------------
# PASS 2 — compute position-occurrence ADP values for BBM IV/V/BBM teams
# ---------------------------------------------------------------------------

def pass2(team_data, pos_occ_baseline, log):
    team_pos_occ = defaultdict(lambda: defaultdict(int))
    total_rows = 0

    for ver, meta in PROCESS_FILES.items():
        if ver in ("BBM II","BBM III"): continue  # already computed real ADP in pass 1
        for fname in meta["files"]:
            path = os.path.join(DATA_DIR, fname)
            if not os.path.exists(path): continue

            fsize = os.path.getsize(path)/1e9
            msg = f"\n  [Pass2] {fname}  ({fsize:.3f}GB)"
            print(msg, flush=True); log.append(msg)

            file_rows = 0
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    headers = f.readline().rstrip("\n").split(",")
                    idx = get_idx(headers)
                    for line in f:
                        parts = line.rstrip("\n").split(",")
                        def g(key, default=""):
                            i = idx.get(key)
                            return parts[i].strip().strip('"') if (i is not None and i < len(parts)) else default
                        team_id = g("team_id_draft")
                        if not team_id or team_id not in team_data: continue
                        overall_pick = safe_int(g("overall_pick","0"))
                        pos = g("position","").upper().strip()
                        if pos in ("QB","RB","WR","TE") and overall_pick > 0:
                            team_pos_occ[team_id][pos] += 1
                            occ = team_pos_occ[team_id][pos]
                            baseline = pos_occ_baseline.get(pos,{}).get(occ)
                            if baseline:
                                team_data[team_id]["adp_base_sum"] += baseline - overall_pick
                                team_data[team_id]["adp_base_n"]   += 1
                        file_rows += 1
                        if file_rows % 1_000_000 == 0:
                            print(f"    ...{file_rows:,} rows", flush=True)
            except Exception as e:
                print(f"  ERROR {fname}: {e}")

            total_rows += file_rows
            msg = f"    Done: {file_rows:,} rows"
            print(msg); log.append(msg)

    msg = f"\n  Pass 2 done: {total_rows:,} rows"
    print(msg); log.append(msg)

# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------

def section(title, out):
    out.append("\n" + "="*80)
    out.append(title)
    out.append("="*80)

# ---------------------------------------------------------------------------
# ANALYSIS 1 — Dataset summary
# ---------------------------------------------------------------------------

def version_summary(team_data, out):
    section("0. DATASET VERSION SUMMARY", out)
    by_ver = defaultdict(lambda: [0,0,0.0,0.0])
    for td in team_data.values():
        v = td["version"]; w = td["weight"]; a = td["advance"]
        by_ver[v][0]+=1; by_ver[v][1]+=a; by_ver[v][2]+=w; by_ver[v][3]+=a*w
    headers=["Version","Weight","Teams","Advanced","Unwgt Rate","Wgt Rate"]
    rows=[]
    for ver in ["BBM II","BBM III","BBM IV (2023)","BBM V (2024)","Best Bowl Mania"]:
        if ver not in by_ver: continue
        n,a,wt,wa = by_ver[ver]
        rows.append([ver, str(PROCESS_FILES[ver]["weight"]),
                     f"{n:,}", f"{a:,}", pct(adv_rate(a,n)), pct(wadv_rate(wa,wt))])
    out.append(fmt_table(headers, rows, cw=20))

# ---------------------------------------------------------------------------
# ANALYSIS 2 — Roster construction
# ---------------------------------------------------------------------------

def roster_construction(team_data, out):
    section("1. ROSTER CONSTRUCTION ANALYSIS", out)
    out.append("  All 5 versions combined. Columns: Count | Unwgt Rate | n | Wgt Rate | Wgt-n")

    for pos in ("WR","RB"):
        for label, key in [("Through Round 6",f"{pos.lower()}6"),
                            ("Through Round 10",f"{pos.lower()}10"),
                            ("All 18 Rounds",f"{pos.lower()}18")]:
            b = DB()
            for td in team_data.values(): b.add(td[key], td["advance"], td["weight"])
            out.append(f"\n{pos}s {label}:")
            rows=[]
            for cnt in b.keys():
                if b.n_uw(cnt) < 10: continue
                rows.append([f"{cnt} {pos}s", pct(b.uw(cnt)), f"{b.n_uw(cnt):,}",
                              pct(b.wt(cnt)), f"{b.n_wt(cnt):,.0f}"])
            out.append(fmt_table([f"{pos}s Drafted","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=18))

    for pos, key in [("QB","qb_total"),("TE","te_total")]:
        b = DB()
        for td in team_data.values(): b.add(td[key], td["advance"], td["weight"])
        out.append(f"\n{pos}s Total Drafted:")
        rows=[]
        for cnt in b.keys():
            if b.n_uw(cnt) < 10: continue
            rows.append([f"{cnt} {pos}s", pct(b.uw(cnt)), f"{b.n_uw(cnt):,}",
                          pct(b.wt(cnt)), f"{b.n_wt(cnt):,.0f}"])
        out.append(fmt_table([f"{pos}s Drafted","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=18))

# ---------------------------------------------------------------------------
# ANALYSIS 3a — Real ADP analysis (BBM II + III only)
# ---------------------------------------------------------------------------

ADP_GROUPS = [
    ("Reached Heavily  (< -10)",     float('-inf'), -10),
    ("Reached Slightly (-10 to -3)", -10,            -3),
    ("Near ADP         (-3 to +3)",   -3,             3),
    ("Good Value       (+3 to +10)",   3,            10),
    ("Great Value      (> +10)",      10, float('inf')),
]

def adp_real_analysis(team_data, out):
    section("2a. ADP DEVIATION ANALYSIS — BBM II + III (projection_adp data)", out)
    out.append("  Value = projection_adp - overall_pick  (positive = later than ADP = value)")
    out.append("  *** This is the primary ADP signal — BBM IV/V do not have reliable ADP data ***")

    b_all = DB()   # BBM II + III combined
    b_by_ver = {v: DB() for v in ("BBM II","BBM III")}
    no_data = 0

    for td in team_data.values():
        if not td["has_real_adp"]: continue
        if td["adp_real_n"] == 0: no_data += 1; continue
        avg = td["adp_real_sum"] / td["adp_real_n"]
        for gname, lo, hi in ADP_GROUPS:
            if lo <= avg < hi:
                b_all.add(gname, td["advance"], td["weight"])
                if td["version"] in b_by_ver:
                    b_by_ver[td["version"]].add(gname, td["advance"], td["weight"])
                break

    out.append(f"\n  Teams with real ADP data: {sum(1 for td in team_data.values() if td['has_real_adp'] and td['adp_real_n']>0):,} | No data: {no_data:,}")

    out.append("\n  === BBM II + III Combined ===")
    rows=[]
    for gname,lo,hi in ADP_GROUPS:
        rows.append([gname, pct(b_all.uw(gname)), f"{b_all.n_uw(gname):,}",
                     pct(b_all.wt(gname)), f"{b_all.n_wt(gname):,.0f}"])
    out.append(fmt_table(["ADP Group","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=28))

    for ver in ("BBM II","BBM III"):
        b = b_by_ver[ver]
        out.append(f"\n  === {ver} Only ===")
        rows=[]
        for gname,lo,hi in ADP_GROUPS:
            rows.append([gname, pct(b.uw(gname)), f"{b.n_uw(gname):,}",
                         pct(b.wt(gname)), f"{b.n_wt(gname):,.0f}"])
        out.append(fmt_table(["ADP Group","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=28))

    return b_all

# ---------------------------------------------------------------------------
# ANALYSIS 3b — Baseline ADP (BBM IV/V/BBM — position-occurrence method)
# ---------------------------------------------------------------------------

def adp_baseline_analysis(team_data, out):
    section("2b. ADP ANALYSIS — BBM IV/V/Best Bowl Mania (position-occurrence baseline)", out)
    out.append("  NOTE: BBM IV/V projection_adp is unreliable; using position-occurrence mean as expected pick.")
    out.append("  Value = expected_pick_for_Nth_occurrence - actual_pick  (positive = value)")

    b = DB()
    no_data = 0
    for td in team_data.values():
        if td["has_real_adp"]: continue
        if td["adp_base_n"] == 0: no_data += 1; continue
        avg = td["adp_base_sum"] / td["adp_base_n"]
        for gname, lo, hi in ADP_GROUPS:
            if lo <= avg < hi:
                b.add(gname, td["advance"], td["weight"]); break

    out.append(f"\n  Teams: {sum(1 for td in team_data.values() if not td['has_real_adp'] and td['adp_base_n']>0):,} with data | {no_data:,} no data")
    rows=[]
    for gname,lo,hi in ADP_GROUPS:
        rows.append([gname, pct(b.uw(gname)), f"{b.n_uw(gname):,}",
                     pct(b.wt(gname)), f"{b.n_wt(gname):,.0f}"])
    out.append(fmt_table(["ADP Group","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=28))

# ---------------------------------------------------------------------------
# ANALYSIS 4 — Bye week (BBM II + III only)
# ---------------------------------------------------------------------------

def bye_week_analysis(team_data, out):
    section("3. BYE WEEK ANALYSIS — BBM II + III (bye_week column present)", out)
    out.append("  Flagged = 3+ players at same position with same bye week on same roster")

    flagged_b = DB()
    clean_b = DB()
    no_bye = 0

    for td in team_data.values():
        if not td["has_real_adp"]: continue  # only BBM II/III have bye data
        if td["pos_bye"] is None:
            no_bye += 1; continue
        is_flagged = any(cnt >= 3 for pos_byes in td["pos_bye"].values() for cnt in pos_byes.values())
        if is_flagged: flagged_b.add("flagged", td["advance"], td["weight"])
        else:          clean_b.add("clean",   td["advance"], td["weight"])

    total_with_bye = flagged_b.n_uw("flagged") + clean_b.n_uw("clean")
    out.append(f"\n  Teams with bye data: {total_with_bye:,} | No bye data: {no_bye:,}")

    rows = [
        ["Flagged (3+ same-pos same-bye)", pct(flagged_b.uw("flagged")),
         f"{flagged_b.n_uw('flagged'):,}", pct(flagged_b.wt("flagged")), f"{flagged_b.n_wt('flagged'):,.0f}"],
        ["Clean (no concentration)",       pct(clean_b.uw("clean")),
         f"{clean_b.n_uw('clean'):,}",     pct(clean_b.wt("clean")),    f"{clean_b.n_wt('clean'):,.0f}"],
    ]
    out.append(fmt_table(["Bye Week Status","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=30))

    # Also: advance rate by specific bye week position concentrations
    pos_bye_buckets = {p: DB() for p in ("QB","RB","WR","TE")}
    for td in team_data.values():
        if not td["has_real_adp"] or td["pos_bye"] is None: continue
        for pos in ("QB","RB","WR","TE"):
            max_same_bye = max(td["pos_bye"].get(pos, {0:0}).values(), default=0)
            pos_bye_buckets[pos].add(min(max_same_bye,3), td["advance"], td["weight"])

    for pos, b in pos_bye_buckets.items():
        out.append(f"\n  {pos} — Max players sharing a bye week:")
        rows=[]
        for cnt in b.keys():
            lbl = f"{cnt}+" if cnt==3 else str(cnt)
            rows.append([f"{lbl} sharing a bye", pct(b.uw(cnt)), f"{b.n_uw(cnt):,}",
                         pct(b.wt(cnt)), f"{b.n_wt(cnt):,.0f}"])
        out.append(fmt_table(["Max Same-Bye","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=20))

    return flagged_b, clean_b

# ---------------------------------------------------------------------------
# ANALYSIS 5 — Positional investment + cross-tab
# ---------------------------------------------------------------------------

def positional_investment(team_data, out):
    section("4. POSITIONAL INVESTMENT ANALYSIS", out)
    out.append("  Draft capital = sum of overall_pick_number (lower = earlier = more expensive)")
    out.append("  % capital = position pick total / all-pick total for team")

    for pos, cap_key in [("QB","cap_qb"),("RB","cap_rb"),("WR","cap_wr"),("TE","cap_te")]:
        data=[(td[cap_key]/td["cap_total"]*100, td["advance"], td["weight"])
              for td in team_data.values() if td["cap_total"]>0]
        data.sort(key=lambda x: x[0])
        n=len(data); q=n//4

        out.append(f"\n{pos} Draft Capital % — by Quartile:")
        rows=[]
        for qi in range(4):
            s=qi*q; e=(qi+1)*q if qi<3 else n
            chunk=data[s:e]
            t=len(chunk); a=sum(x[1] for x in chunk)
            wt=sum(x[2] for x in chunk); wa=sum(x[1]*x[2] for x in chunk)
            lo=chunk[0][0]; hi=chunk[-1][0]; avg=sum(x[0] for x in chunk)/t
            rows.append([f"Q{qi+1} ({lo:.1f}%-{hi:.1f}%)", f"{avg:.1f}%",
                         pct(adv_rate(a,t)), f"{t:,}", pct(wadv_rate(wa,wt)), f"{wt:,.0f}"])
        out.append(fmt_table(["Quartile","Avg % Cap","Unwgt Rate","n","Wgt Rate","Wgt-n"], rows, cw=20))

    # Cross-tab: has_real_adp vs no_adp within each quartile (checking for distortion)
    out.append("\n  CROSS-TAB: Investment quartile advance rates split by version group")
    out.append("  (BBM II/III = 'Early versions' | BBM IV/V/BBM = 'Recent versions')")
    out.append("  If early vs recent advance rates diverge >5pp, result may be version-driven not construction-driven.")

    for pos, cap_key in [("WR","cap_wr"),("RB","cap_rb")]:
        data_early=[(td[cap_key]/td["cap_total"]*100, td["advance"])
                    for td in team_data.values() if td["cap_total"]>0 and td["has_real_adp"]]
        data_recent=[(td[cap_key]/td["cap_total"]*100, td["advance"])
                     for td in team_data.values() if td["cap_total"]>0 and not td["has_real_adp"]]
        for group, data in [("Early (II+III)", data_early), ("Recent (IV+V+BBM)", data_recent)]:
            data.sort(key=lambda x:x[0]); n=len(data); q=n//4
            out.append(f"\n  {pos} — {group}:")
            rows=[]
            for qi in range(4):
                s=qi*q; e=(qi+1)*q if qi<3 else n
                chunk=data[s:e]; t=len(chunk); a=sum(x[1] for x in chunk)
                lo=chunk[0][0]; hi=chunk[-1][0]
                rows.append([f"Q{qi+1} ({lo:.1f}%-{hi:.1f}%)", pct(adv_rate(a,t)), f"{t:,}"])
            out.append(fmt_table(["Quartile","Advance Rate","n"], rows, cw=22))

# ---------------------------------------------------------------------------
# ANALYSIS 6 — Changes vs BBM IV/V-only baseline
# ---------------------------------------------------------------------------

def delta_analysis(team_data, out):
    section("5. MATERIAL CHANGES VS BBM IV/V-ONLY BASELINE", out)
    out.append("  Shows how much each key metric shifted when BBM II and III were added.")
    out.append("  'IV/V only' = weighted rate using only BBM IV/V/Best Bowl Mania teams")
    out.append("  'All five' = weighted rate using all five versions")
    out.append("  Delta > 1.0pp flagged as material change.")

    configs = [
        ("WR through Rd6",  "wr6"),
        ("RB through Rd6",  "rb6"),
        ("WR through Rd10", "wr10"),
        ("RB through Rd10", "rb10"),
        ("QB total",        "qb_total"),
        ("TE total",        "te_total"),
    ]

    all_rows = []
    for label, key in configs:
        b_recent = DB(); b_all = DB()
        for td in team_data.values():
            b_all.add(td[key], td["advance"], td["weight"])
            if not td["has_real_adp"]:
                b_recent.add(td[key], td["advance"], td["weight"])

        # Focus on the key bucket values (0-5)
        for cnt in sorted(set(b_all.d.keys()) | set(b_recent.d.keys())):
            if b_all.n_uw(cnt) < 100: continue
            r_all = b_all.wt(cnt)
            r_recent = b_recent.wt(cnt)
            if r_all is None or r_recent is None: continue
            delta = r_all - r_recent
            flag = " ◄ MATERIAL" if abs(delta) >= 1.0 else ""
            all_rows.append([f"{label}: {cnt}", pct(r_recent), pct(r_all),
                             f"{delta:+.2f}pp{flag}"])

    out.append(fmt_table(["Metric: bucket","IV/V/BBM only (wgt)","All 5 versions (wgt)","Delta"], all_rows, cw=24))

# ---------------------------------------------------------------------------
# Generate scoring weights JSON
# ---------------------------------------------------------------------------

def generate_weights(team_data, adp_b_real):
    w = {
        "_description": (
            "BBM scoring weights — all 5 versions (BBM II-V + Best Bowl Mania). "
            "Weighted rates: BBM II=0.6, III=0.75, IV=0.9, V=1.0, BBM=1.1. "
            "Delta vs median bucket. Positive = bonus, negative = penalty."
        ),
        "_baseline_advance_rate": None,
        "_adp_source": "BBM II + III (real projection_adp); BBM IV/V/BBM excluded from ADP weights",
        "roster_construction": {},
        "adp_value_bbm2_bbm3": {},
        "bye_week": {},
        "positional_investment": {},
    }

    # Baseline
    wt = sum(td["weight"] for td in team_data.values())
    wa = sum(td["advance"]*td["weight"] for td in team_data.values())
    w["_baseline_advance_rate"] = round(wadv_rate(wa,wt), 2)

    # Roster construction
    for pos in ("WR","RB"):
        for lbl, key in [("rd6",f"{pos.lower()}6"),("rd10",f"{pos.lower()}10"),("rd18",f"{pos.lower()}18")]:
            b=DB()
            for td in team_data.values(): b.add(td[key],td["advance"],td["weight"])
            valid = {k:v for k,v in b.d.items() if v[0]>=100}
            if not valid: continue
            sk = sorted(valid); med = sk[len(sk)//2]
            base = b.wt(med)
            if base is None: continue
            sec = {}
            for cnt in sk:
                r = b.wt(cnt)
                if r is not None: sec[f"{cnt}_{pos}s"] = round(r-base, 2)
            if sec: w["roster_construction"][f"{pos}_through_{lbl}"] = sec

    for pos, key in [("QB","qb_total"),("TE","te_total")]:
        b=DB()
        for td in team_data.values(): b.add(td[key],td["advance"],td["weight"])
        valid={k:v for k,v in b.d.items() if v[0]>=100}
        if not valid: continue
        sk=sorted(valid); med=sk[len(sk)//2]; base=b.wt(med)
        if base is None: continue
        sec={}
        for cnt in sk:
            r=b.wt(cnt)
            if r is not None: sec[f"{cnt}_{pos}s"] = round(r-base,2)
        if sec: w["roster_construction"][f"{pos}_total"] = sec

    # ADP weights (BBM II/III only)
    near_rate = adp_b_real.wt("Near ADP         (-3 to +3)")
    if near_rate is not None:
        for gname,lo,hi in ADP_GROUPS:
            r = adp_b_real.wt(gname)
            n = adp_b_real.n_uw(gname)
            if r is not None and n >= 50:
                slug = gname.split("(")[0].strip().lower().replace(" ","_").rstrip("_")
                w["adp_value_bbm2_bbm3"][slug] = round(r-near_rate,2)

    # Positional investment
    for pos, cap_key in [("QB","cap_qb"),("RB","cap_rb"),("WR","cap_wr"),("TE","cap_te")]:
        data=sorted([(td[cap_key]/td["cap_total"]*100, td["advance"], td["weight"])
                     for td in team_data.values() if td["cap_total"]>0], key=lambda x:x[0])
        n=len(data); q=n//4
        qrates=[]
        for qi in range(4):
            s=qi*q; e=(qi+1)*q if qi<3 else n; chunk=data[s:e]
            wa=sum(x[1]*x[2] for x in chunk); wt=sum(x[2] for x in chunk)
            qrates.append(wadv_rate(wa,wt))
        base=qrates[1]
        if base is not None:
            sec={f"Q{i+1}": round((r-base) if r else 0,2) for i,r in enumerate(qrates) if r is not None}
            w["positional_investment"][f"{pos}_capital_pct"] = sec

    return w

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log=[]; data_flags=[]

    print("\n" + "="*60)
    print("BBM CALIBRATION ANALYSIS v3")
    print("Datasets: BBM II + III + IV + V + Best Bowl Mania")
    print("="*60)

    # Verify all expected files exist
    print("\nChecking files...")
    all_expected = [f for meta in PROCESS_FILES.values() for f in meta["files"]] + BBM3_QF_FILES
    for fname in all_expected:
        path = os.path.join(DATA_DIR, fname)
        exists = os.path.exists(path)
        size = os.path.getsize(path)/1e6 if exists else 0
        status = f"OK ({size:.1f}MB)" if exists else "MISSING ⚠"
        print(f"  {fname:<65} {status}")
        if not exists:
            data_flags.append(f"FILE MISSING: {fname}")

    # === PRE-PASS: BBM III advance imputation ===
    print("\n" + "="*60)
    print("PRE-PASS — Imputing BBM III advance flags from quarterfinals")
    print("="*60)
    log.append("="*80)
    log.append("PRE-PASS — BBM III advance flag imputation")
    log.append("="*80)
    bbm3_advancing = pass0_bbm3_advance(log)

    # === PASS 1 ===
    print("\n" + "="*60)
    print("PASS 1 — Building baselines + team data")
    print("="*60)
    log.append("\n" + "="*80)
    log.append("PASS 1 — Building position-occurrence baselines + team data")
    log.append("="*80)
    team_data, pos_occ_baseline, p1_flags = pass1(bbm3_advancing, log)
    data_flags.extend(p1_flags)

    # === PASS 2 ===
    print("\n" + "="*60)
    print("PASS 2 — Computing ADP values (BBM IV/V/BBM only)")
    print("="*60)
    log.append("\n" + "="*80)
    log.append("PASS 2 — ADP values via position-occurrence baseline (BBM IV/V/BBM)")
    log.append("="*80)
    pass2(team_data, pos_occ_baseline, log)

    # === Totals ===
    total_teams = len(team_data)
    total_adv   = sum(td["advance"] for td in team_data.values())
    wt_all      = sum(td["weight"] for td in team_data.values())
    wa_all      = sum(td["advance"]*td["weight"] for td in team_data.values())
    uw_rate     = adv_rate(total_adv, total_teams)
    w_rate      = wadv_rate(wa_all, wt_all)
    print(f"\n  Total teams: {total_teams:,} | Advanced: {total_adv:,} | Unwgt rate: {pct(uw_rate)} | Wgt rate: {pct(w_rate)}")

    # === Build output ===
    out = []
    out.append("BBM CALIBRATION ANALYSIS v3")
    out.append("="*80)
    out.append(f"Datasets: BBM II (wt=0.6) + BBM III (wt=0.75) + BBM IV (wt=0.9) + BBM V (wt=1.0) + Best Bowl Mania (wt=1.1)")
    out.append(f"Total teams: {total_teams:,} | Advanced: {total_adv:,}")
    out.append(f"Unweighted advance rate: {pct(uw_rate)} | Weighted advance rate: {pct(w_rate)}")

    if data_flags:
        out.append("\n" + "="*80)
        out.append("⚠ DATA QUALITY FLAGS")
        out.append("="*80)
        for f in data_flags: out.append(f"  {f}")

    out += log

    print("\nRunning analyses...")
    version_summary(team_data, out)
    roster_construction(team_data, out)
    print("  Roster construction done.")

    adp_b_real = adp_real_analysis(team_data, out)
    print("  ADP real analysis done.")
    adp_baseline_analysis(team_data, out)
    print("  ADP baseline analysis done.")
    bye_week_analysis(team_data, out)
    print("  Bye week analysis done.")
    positional_investment(team_data, out)
    print("  Positional investment done.")
    delta_analysis(team_data, out)
    print("  Delta analysis done.")

    # Write outputs
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f: f.write("\n".join(out))
    print(f"\n  Saved: {OUTPUT_TXT}")

    weights = generate_weights(team_data, adp_b_real)
    with open(OUTPUT_JSON,"w",encoding="utf-8") as f: json.dump(weights,f,indent=2)
    print(f"  Saved: {OUTPUT_JSON}")

    print("\nDone!")

if __name__ == "__main__":
    main()
