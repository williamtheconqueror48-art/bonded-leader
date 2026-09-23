#!/usr/bin/env python3
"""Compute mechanical anomaly flags for Bonded-Leader donations.

Applies the three exact rules defined in lib/anomaly.ts — the rule texts
are extracted from that file at runtime, so there is a single source of
truth. Triggered flags are inserted into anomaly_flags with:
  flag_type, flag_rule_text (verbatim), computed_value (actual trigger value).

Rules (mechanical, descriptive only — never allegations):
  1. incorporation_timing (AMBER): MCA21 incorporation date within the 12
     calendar months preceding the bond purchase date.
  2. turnover_ratio (AMBER): donation amount > 50% of the company's most
     recently disclosed annual turnover from a public MCA21 filing.
  3. strict_combined (RED): BOTH (a) incorporation within 6 months AND
     (b) donation > 50% of disclosed turnover.

Honest-data notes:
  - company_registry is currently EMPTY (no verified MCA21 rows ingested),
    so rule 1 has no incorporation dates to compute against.
  - donations.bond_date is NULL for the ADR donor-wise source (per-donor
    aggregates carry no per-bond dates), so date-based rules cannot trigger.
  - company_registry has no annual-turnover column in the approved schema,
    so rules 2 and 3 have no turnover figures to compute against.
  - Missing inputs NEVER trigger a flag; they record NOT AVAILABLE IN
    SOURCE DATA. Expect 0 inserted rows until registry data exists.

Idempotency: full recompute — existing anomaly_flags rows are deleted and
re-derived from current data, so re-runs never duplicate flags.

All SQL values travel as parameters (never string-interpolated). The Neon
connection URI is held in memory only and never logged.

Usage:
  compute_flags.py [--project-name bonded-leader]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)
sys.path.insert(0, "/home/hatch/workspace/skills/neon/bin")

import neon_api  # noqa: E402

NEON_EXEC = "/home/hatch/workspace/skills/neon/bin/neon-exec.js"
ANOMALY_TS = os.path.join(APP_ROOT, "lib", "anomaly.ts")
NOT_AVAILABLE = "NOT AVAILABLE IN SOURCE DATA"
AVG_MONTH_DAYS = 30.436875


# --------------------------------------------------------------------------
# Rule texts: extracted verbatim from lib/anomaly.ts (single source of truth)
# --------------------------------------------------------------------------
def extract_rule_texts(path: str) -> dict[str, str]:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    out: dict[str, str] = {}
    # export const RULE_X =\n  "..." +\n  "...";
    for m in re.finditer(
        r'export const (RULE_\w+)\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+\s*)+"(?:[^"\\]|\\.)*");',
        src,
    ):
        name, body = m.group(1), m.group(2)
        parts = re.findall(r'"((?:[^"\\]|\\.)*)"', body)
        text = "".join(p.encode("utf-8").decode("unicode_escape") for p in parts)
        out[name] = text
    return out


def extract_flag_types(path: str) -> dict[str, str]:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    return dict(
        re.findall(r'export const (FLAG_TYPE_\w+)\s*=\s*"([^"]+)";', src)
    )


RULE_TEXTS = extract_rule_texts(ANOMALY_TS)
FLAG_TYPES = extract_flag_types(ANOMALY_TS)

RULE_12M = RULE_TEXTS["RULE_INCORPORATION_TIMING_12M"]
RULE_50 = RULE_TEXTS["RULE_TURNOVER_RATIO_50"]
RULE_STRICT = RULE_TEXTS["RULE_STRICT_COMBINED_6M"]
TYPE_TIMING = FLAG_TYPES["FLAG_TYPE_INCORPORATION_TIMING"]
TYPE_RATIO = FLAG_TYPES["FLAG_TYPE_TURNOVER_RATIO"]
TYPE_STRICT = FLAG_TYPES["FLAG_TYPE_STRICT_COMBINED"]


# --------------------------------------------------------------------------
# Mechanical checks (faithful port of lib/anomaly.ts)
# --------------------------------------------------------------------------
def months_between(earlier: date, later: date) -> float:
    ms = (datetime(later.year, later.month, later.day) -
          datetime(earlier.year, earlier.month, earlier.day)).total_seconds() * 1000
    return ms / (1000 * 60 * 60 * 24 * AVG_MONTH_DAYS)


def parse_date(value) -> date | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def fmt_inr(amount) -> str:
    """Indian digit grouping, mirroring toLocaleString('en-IN', {maximumFractionDigits: 2})."""
    n = float(amount)
    s = f"{n:.2f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    int_part, dot, frac = s.partition(".")
    if len(int_part) > 3:
        tail = int_part[-3:]
        head = int_part[:-3]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        int_part = ",".join(groups) + "," + tail
    return f"INR {int_part}{dot + frac if frac else ''}"


def check_timing_12m(incorp_raw, donation_raw):
    incorp, donation = parse_date(incorp_raw), parse_date(donation_raw)
    if incorp is None or donation is None:
        return (False, RULE_12M,
                f"{NOT_AVAILABLE} (missing or unparsable incorporation/donation date)")
    gap = months_between(incorp, donation)
    value = (f"incorporation {incorp.isoformat()}; "
             f"donation {donation.isoformat()}; gap = {gap:.1f} months")
    return (0 <= gap <= 12, RULE_12M, value)


def to_number(v):
    try:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        n = float(v)
        return n if n == n else None  # reject NaN
    except (TypeError, ValueError):
        return None


def check_turnover_50(amount_raw, turnover_raw):
    amount, turnover = to_number(amount_raw), to_number(turnover_raw)
    if amount is None or turnover is None or turnover <= 0:
        return (False, RULE_50,
                f"{NOT_AVAILABLE} (missing or invalid donation amount / disclosed turnover)")
    ratio = amount / turnover
    value = (f"donation {fmt_inr(amount)}; "
             f"disclosed annual turnover {fmt_inr(turnover)}; "
             f"ratio = {ratio * 100:.1f}%")
    return (ratio > 0.5, RULE_50, value)


def check_strict_6m(incorp_raw, donation_raw, amount_raw, turnover_raw):
    incorp, donation = parse_date(incorp_raw), parse_date(donation_raw)
    amount, turnover = to_number(amount_raw), to_number(turnover_raw)
    if (incorp is None or donation is None or amount is None
            or turnover is None or turnover <= 0):
        return (False, RULE_STRICT,
                f"{NOT_AVAILABLE} (missing incorporation date, donation date, amount, or disclosed turnover)")
    gap = months_between(incorp, donation)
    ratio = amount / turnover
    value = (f"gap = {gap:.1f} months (threshold: <= 6); "
             f"donation-to-turnover ratio = {ratio * 100:.1f}% (threshold: > 50%)")
    return (0 <= gap <= 6 and ratio > 0.5, RULE_STRICT, value)


# --------------------------------------------------------------------------
# DB plumbing (same parameterized pattern as ingest.py)
# --------------------------------------------------------------------------
def run_actions(uri: str, actions: list[dict]) -> list:
    payload = json.dumps({"uri": uri, "actions": actions})
    proc = subprocess.run(
        ["node", NEON_EXEC], input=payload.encode(),
        capture_output=True, timeout=300,
    )
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"neon-exec failed: {err}")
    out = json.loads(proc.stdout.decode())
    if not out.get("ok"):
        raise RuntimeError(f"neon-exec error: {out}")
    return out["results"]


DONATIONS_SQL = """
SELECT d.id,
       d.donor_name_raw,
       d.amount_inr,
       d.bond_date,
       cr.incorporation_date
FROM donations d
LEFT JOIN company_registry cr
  ON cr.company_name_raw = d.donor_name_raw
     OR (cr.company_name_canonical IS NOT NULL
         AND d.donor_name_canonical IS NOT NULL
         AND cr.company_name_canonical = d.donor_name_canonical)
ORDER BY d.id
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-name", default="bonded-leader")
    args = ap.parse_args()

    print("rule texts extracted from lib/anomaly.ts:")
    for k in ("RULE_INCORPORATION_TIMING_12M", "RULE_TURNOVER_RATIO_50",
              "RULE_STRICT_COMBINED_6M"):
        print(f"  {k}: {len(RULE_TEXTS[k])} chars, verbatim")

    project = neon_api.find_or_create_project(args.project_name, quiet=True)
    uri = neon_api.connection_uri(project["id"])

    rows = run_actions(uri, [{"sql": DONATIONS_SQL, "returns": "rows"}])[0]
    reg_count = run_actions(uri, [
        {"sql": "SELECT COUNT(*) AS c FROM company_registry", "returns": "rows"}
    ])[0][0]["c"]
    print(f"donations: {len(rows)} | company_registry rows: {reg_count} "
          f"| turnover column: absent from schema (rules 2/3 need MCA21 turnover data)")

    triggered: list[tuple[int, str, str, str]] = []
    for r in rows:
        # turnover_raw is None: the approved schema has no turnover column;
        # rules 2/3 therefore report NOT AVAILABLE until such data is ingested.
        t = check_timing_12m(r["incorporation_date"], r["bond_date"])
        if t[0]:
            triggered.append((r["id"], TYPE_TIMING, t[1], t[2]))
        u = check_turnover_50(r["amount_inr"], None)
        if u[0]:
            triggered.append((r["id"], TYPE_RATIO, u[1], u[2]))
        s = check_strict_6m(r["incorporation_date"], r["bond_date"],
                            r["amount_inr"], None)
        if s[0]:
            triggered.append((r["id"], TYPE_STRICT, s[1], s[2]))

    # Full recompute: clear stale flags, insert only currently-triggered ones.
    run_actions(uri, [{"sql": "DELETE FROM anomaly_flags"}])
    for donation_id, flag_type, rule_text, computed in triggered:
        run_actions(uri, [{
            "sql": ("INSERT INTO anomaly_flags "
                    "(donation_id, flag_type, flag_rule_text, computed_value) "
                    "VALUES ($1, $2, $3, $4)"),
            "params": [donation_id, flag_type, rule_text, computed],
        }])

    final = run_actions(uri, [
        {"sql": "SELECT COUNT(*) AS c FROM anomaly_flags", "returns": "rows"}
    ])[0][0]["c"]
    print(f"evaluated {len(rows)} donations -> {len(triggered)} triggered flags "
          f"inserted (anomaly_flags now holds {final})")
    if final == 0:
        print("0 flags is the honest result: no registry dates/turnover to "
              "compute against, and bond dates are absent from the donor-wise source.")


if __name__ == "__main__":
    main()
