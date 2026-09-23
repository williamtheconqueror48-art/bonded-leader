#!/usr/bin/env python3
"""Ingest ADR's donor-wise Electoral Bonds table (Part 3) into Neon.

Source (real, cited):
  Part_3_Donor-wise_EBs_details_Final.pdf
  URL: http://adrindia.org/sites/default/files/Part_3_Donor-wise_EBs_details_Final.pdf
  "Share of Corporate & Individual Donors who purchased Electoral Bonds,
   12 April 2019 to 15 February 2024"
  Source note inside the PDF: "Election Commission of India as on 14th March 2024.
  Data Compiled and Analysed by ADR."

What it does:
  1. Parses the PDF with parse_adr_part3.py (50 donor rows, checksum-validated).
  2. Runs Jaro-Winkler canonicalization (jw.py, threshold >= 0.90) over donor
     names; donor_name_canonical is set ONLY when a merge actually occurred,
     otherwise NULL. Every merge decision + exact score is logged to
     data/merge_decisions_part3.json.
  3. Records one ingestion_ledger row (source URL, retrieval date, SHA-256,
     row count) and inserts the 50 donation rows referencing it.
  4. party_name and bond_date are NOT in this source -> stored as NULL
     (the app displays NOT AVAILABLE IN SOURCE DATA). This requires
     party_name to be nullable; the migration below drops the NOT NULL
     constraint idempotently. NOTE for schema.sql: party_name should be
     TEXT (nullable) to reflect that donor-wise sources carry no party link.

  Idempotent: if a ledger row with this file's SHA-256 already exists, the
  run is skipped.

  All SQL values travel as parameters (never string-interpolated). The Neon
  connection URI is held in memory only and never logged.

Usage:
  ingest.py [--project-name bonded-leader]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, "/home/hatch/workspace/skills/neon/bin")

import parse_adr_part3  # noqa: E402
import jw  # noqa: E402
import neon_api  # noqa: E402

SOURCE_URL = "http://adrindia.org/sites/default/files/Part_3_Donor-wise_EBs_details_Final.pdf"
SOURCE_NAME = (
    "ADR Part 3: Donor-wise Electoral Bonds details "
    "(corporate & individual donors, 12 Apr 2019 - 15 Feb 2024)"
)
PDF_PATH = os.path.join(APP_ROOT, "data", "raw", "Part_3_Donor-wise_EBs_details_Final.pdf")
NEON_EXEC = "/home/hatch/workspace/skills/neon/bin/neon-exec.js"


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-name", default="bonded-leader")
    args = ap.parse_args()

    donors = parse_adr_part3.parse_pdf(PDF_PATH)
    parse_adr_part3.validate(donors)
    digest = sha256_file(PDF_PATH)
    retrieved_at = datetime.now(timezone.utc).isoformat()

    # Canonicalize donor names (Jaro-Winkler >= 0.90).
    names = [d["donor_name_raw"] for d in donors]
    groups = jw.canonicalize(names)
    canonical_by_name: dict[str, str | None] = {}
    for g in groups:
        canon = g["canonical"] if len(g["members"]) > 1 else None
        for m in g["members"]:
            canonical_by_name[m] = canon
    decisions = [d for g in groups for d in g["decisions"]]
    merges = [d for d in decisions if d["merged"]]
    print(f"canonicalization: {len(groups)} groups, {len(merges)} merges at >= 0.90")
    for m in merges:
        print(f"  MERGE {m['similarity']}: {m['inputA']!r} + {m['inputB']!r}")

    with open(os.path.join(APP_ROOT, "data", "merge_decisions_part3.json"), "w") as f:
        json.dump(decisions, f, indent=2, ensure_ascii=False)

    project = neon_api.find_or_create_project(args.project_name, quiet=True)
    uri = neon_api.connection_uri(project["id"])

    # Idempotency: skip if this exact file was already ingested.
    existing = run_actions(uri, [{
        "sql": "SELECT id FROM ingestion_ledger WHERE sha256 = $1",
        "params": [digest], "returns": "rows",
    }])[0]
    if existing:
        print(f"already ingested (ledger id {existing[0]['id']}); skipping")
        return

    # Migration: donor-wise sources carry no party link -> party_name nullable.
    nullability = run_actions(uri, [{
        "sql": ("SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'donations' AND column_name = 'party_name'"),
        "returns": "rows",
    }])[0]
    if nullability and nullability[0]["is_nullable"] == "NO":
        run_actions(uri, [{
            "sql": "ALTER TABLE donations ALTER COLUMN party_name DROP NOT NULL",
        }])
        print("migration applied: donations.party_name is now nullable")

    ledger_id = run_actions(uri, [{
        "sql": ("INSERT INTO ingestion_ledger "
                "(source_name, source_url, retrieved_at, sha256, row_count) "
                "VALUES ($1, $2, $3, $4, $5) RETURNING id"),
        "params": [SOURCE_NAME, SOURCE_URL, retrieved_at, digest, len(donors)],
        "returns": "rows",
    }])[0][0]["id"]
    print(f"ledger row: id={ledger_id}")

    actions = [{
        "sql": ("INSERT INTO donations "
                "(donor_name_raw, donor_name_canonical, party_name, amount_inr, "
                " bond_date, source_ledger_id) "
                "VALUES ($1, $2, NULL, $3, NULL, $4)"),
        "params": [d["donor_name_raw"], canonical_by_name[d["donor_name_raw"]],
                   d["amount_inr"], ledger_id],
    } for d in donors]
    run_actions(uri, actions)
    print(f"inserted {len(donors)} donation rows")

    counts = run_actions(uri, [
        {"sql": "SELECT COUNT(*) AS c FROM donations", "returns": "rows"},
        {"sql": "SELECT COUNT(*) AS c FROM ingestion_ledger", "returns": "rows"},
        {"sql": ("SELECT donor_name_raw, amount_inr FROM donations "
                 "ORDER BY amount_inr DESC LIMIT 3"), "returns": "rows"},
    ])
    print("donations count:", counts[0][0]["c"])
    print("ledger count:", counts[1][0]["c"])
    print("top 3 rows:")
    for r in counts[2]:
        print(f"  {r['donor_name_raw']} | {r['amount_inr']}")

    manifest = {
        "sources": [{
            "file": "data/raw/Part_3_Donor-wise_EBs_details_Final.pdf",
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "retrieved_at": retrieved_at,
            "sha256": digest,
            "row_count": len(donors),
            "parser": "scripts/parse_adr_part3.py",
            "donor_types": {"corporate": 25, "individual": 25},
            "fields_present": ["donor_name_raw", "amount_inr"],
            "fields_absent_null": ["party_name", "bond_date"],
            "notes": [
                "Donor names kept verbatim as printed, including the source's own "
                "typesetting breaks ('LI MITED', 'PVT L TD', 'LTDPROPRIET').",
                "Row 8 spans two printed lines; joined with a single space; trailing "
                "'*' kept as printed (source footnote: combined entries).",
                "This source aggregates each donor's total over 12 Apr 2019 - 15 Feb 2024; "
                "no per-bond dates and no donor-to-party linkage are printed, so "
                "party_name and bond_date are NULL (displayed as NOT AVAILABLE IN SOURCE DATA).",
                "Source's own inside-PDF citation: 'Election Commission of India as on "
                "14th March 2024. Data Compiled and Analysed by ADR.'",
            ],
        }],
        "also_downloaded_not_ingested": [{
            "file": "data/raw/Part_1_Party-wise_EBs_Encashed.pdf",
            "source_url": "https://adrindia.org/sites/default/files/Part_1_Party-wise_EBs_Encashed.pdf",
            "sha256": "322de91cae9e8a78e9af0442f160f1ffc2783bea7f2278465ff687d47ea7e1e9",
            "reason": "Party-wise encashment totals (26 parties); no donor linkage. "
                      "Reserved for a future party-totals view, not the donations table.",
        }],
        "schema_notes": [
            "Migration applied at ingest: donations.party_name DROP NOT NULL. "
            "schema.sql should be updated to declare party_name TEXT (nullable).",
        ],
    }
    with open(os.path.join(APP_ROOT, "data", "MANIFEST.json"), "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("manifest written: data/MANIFEST.json")


if __name__ == "__main__":
    main()
