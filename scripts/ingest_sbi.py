#!/usr/bin/env python3
"""Ingest the SBI bond-level Electoral Bonds data into Neon.

Inputs (all mechanically parsed, zero fabrication):
  data/parsed_sbi_purchase.csv    (18,871 rows from the SBI purchase PDF)
  data/parsed_sbi_redemption.csv  (20,421 rows from the SBI redemption PDF)
  data/joined_bonds.csv           (18,741 rows, inner join on prefix+bond_number)
  data/merge_decisions_sbi.json   (Jaro-Winkler canonical map)

What it does:
  1. Records 3 ingestion_ledger rows: (a) purchase mirror file, (b) redemption
     mirror file, (c) the join batch. retrieved_at = the file's own mtime
     (machine-recorded download time, UTC). Provenance honesty: these are
     COMMUNITY MIRRORS, not the official ECI files (eci.gov.in 406-blocks
     this project's network); see data/raw/*.provenance.json.
  2. Inserts ONLY the matched join rows into donations:
       donor_name_raw  = purchaser name verbatim
       donor_name_canonical = JW canonical (NULL for singleton names)
       party_name      = political party verbatim
       amount_inr      = bond denomination
       bond_date       = purchase date
       source_ledger_id = join batch ledger id
     Unmatched rows (130 expired purchases, 1680 unmatched redemptions) are
     NOT ingested; their counts are reported for the methodology page.
  3. Never touches the 50 batch-1 aggregate rows (different ledger id).

  Idempotent: ledger rows are looked up by SHA-256 first; if the join batch
  already exists, the run is skipped.

  All SQL values travel as parameters (never string-interpolated). The Neon
  connection URI is held in memory only and never logged.
"""
from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)
sys.path.insert(0, "/home/hatch/workspace/skills/neon/bin")
import neon_api  # noqa: E402

NEON_EXEC = "/home/hatch/workspace/skills/neon/bin/neon-exec.js"

PURCHASE_PDF = os.path.join(APP_ROOT, "data", "raw", "sbi_purchase_bond_buyer.pdf")
REDEMPTION_PDF = os.path.join(APP_ROOT, "data", "raw", "sbi_redemption_bond_user.pdf")
JOIN_CSV = os.path.join(APP_ROOT, "data", "joined_bonds.csv")
JW_JSON = os.path.join(APP_ROOT, "data", "merge_decisions_sbi.json")

PURCHASE_URL = ("https://raw.githubusercontent.com/nlahri/electoral_bond_data_viz/"
                "main/electoral_bond_data-main/bond_buyer.pdf")
REDEMPTION_URL = ("https://raw.githubusercontent.com/nlahri/electoral_bond_data_viz/"
                  "main/electoral_bond_data-main/bond_user.pdf")
PURCHASE_SHA = "91d0f83d9c8fd872891071161af3e1497fb519489a95c48674106d98ee273520"
REDEMPTION_SHA = "ee03f4bf5453ee5f114b33984db4538aeae64484e8e3bfade6c0717552828c75"

MIRROR_NOTE = ("community mirror of the ECI-published SBI 21 Mar 2024 dump; "
               "NOT the official ECI file (eci.gov.in 406-blocks this project's "
               "network). See data/raw/*.provenance.json.")

BATCH_SIZE = 500


def run_actions(uri: str, actions: list[dict]) -> list:
    payload = json.dumps({"uri": uri, "actions": actions})
    proc = subprocess.run(["node", NEON_EXEC], input=payload.encode(),
                          capture_output=True, timeout=300)
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"neon-exec failed: {err}")
    out = json.loads(proc.stdout.decode())
    if not out.get("ok"):
        raise RuntimeError(f"neon-exec error: {out}")
    return out["results"]


def sha256_file(path: str) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def mtime_utc(path: str) -> str:
    return datetime.fromtimestamp(os.path.getmtime(path),
                                  tz=timezone.utc).isoformat()


def main() -> None:
    join_sha = sha256_file(JOIN_CSV)
    with open(JOIN_CSV, newline="", encoding="utf-8") as f:
        joined = list(csv.DictReader(f))
    jw = json.load(open(JW_JSON, encoding="utf-8"))
    cmap = jw["canonical_map"]

    project = neon_api.find_or_create_project("bonded-leader", quiet=True)
    uri = neon_api.connection_uri(project["id"])

    # Idempotency: look up all three SHAs.
    found = run_actions(uri, [{
        "sql": "SELECT id, sha256 FROM ingestion_ledger WHERE sha256 = ANY($1)",
        "params": [[PURCHASE_SHA, REDEMPTION_SHA, join_sha]],
        "returns": "rows",
    }])[0]
    by_sha = {r["sha256"]: r["id"] for r in found}
    if join_sha in by_sha:
        print(f"join batch already ingested (ledger {by_sha[join_sha]}); skipping")
        return

    def ensure_ledger(name, url, retrieved_at, sha, row_count):
        if sha in by_sha:
            return by_sha[sha]
        res = run_actions(uri, [{
            "sql": ("INSERT INTO ingestion_ledger "
                    "(source_name, source_url, retrieved_at, sha256, row_count) "
                    "VALUES ($1,$2,$3,$4,$5) RETURNING id"),
            "params": [name, url, retrieved_at, sha, row_count],
            "returns": "rows",
        }])[0]
        lid = res[0]["id"]
        by_sha[sha] = lid
        return lid

    lid_purchase = ensure_ledger(
        "SBI purchase list (bond buyer) — " + MIRROR_NOTE,
        PURCHASE_URL, mtime_utc(PURCHASE_PDF), PURCHASE_SHA, 18871)
    lid_redemption = ensure_ledger(
        "SBI redemption list (bond user) — " + MIRROR_NOTE,
        REDEMPTION_URL, mtime_utc(REDEMPTION_PDF), REDEMPTION_SHA, 20421)
    lid_join = ensure_ledger(
        f"SBI bond-number join (ledger {lid_purchase} + ledger {lid_redemption})",
        (f"derived artifact data/joined_bonds.csv from ledgers "
         f"{lid_purchase},{lid_redemption} "
         f"(inner join on prefix + bond_number; 130 expired purchases and "
         f"1680 unmatched redemptions excluded)"),
        mtime_utc(JOIN_CSV), join_sha, len(joined))
    print(f"ledger ids: purchase={lid_purchase} redemption={lid_redemption} "
          f"join={lid_join}")

    # Batched parameterized inserts of the matched join rows only.
    cols = ("donor_name_raw, donor_name_canonical, party_name, "
            "amount_inr, bond_date, source_ledger_id")
    total = 0
    for i in range(0, len(joined), BATCH_SIZE):
        batch = joined[i:i + BATCH_SIZE]
        placeholders = []
        params: list = []
        for n, r in enumerate(batch):
            base = n * 6
            placeholders.append(
                f"(${base+1},${base+2},${base+3},${base+4},${base+5},${base+6})")
            params.extend([
                r["purchaser_name"],
                cmap.get(r["purchaser_name"]),
                r["party_name"],
                int(r["denomination_inr"]),
                r["purchase_date"],
                lid_join,
            ])
        run_actions(uri, [{
            "sql": f"INSERT INTO donations ({cols}) VALUES "
                   + ",".join(placeholders),
            "params": params,
            "returns": "none",
        }])
        total += len(batch)
        print(f"  inserted {total}/{len(joined)}")

    # Verify.
    ver = run_actions(uri, [
        {"sql": "SELECT COUNT(*) AS c FROM donations WHERE source_ledger_id = $1",
         "params": [lid_join], "returns": "rows"},
        {"sql": "SELECT COUNT(*) AS c FROM donations WHERE source_ledger_id = 1",
         "params": [], "returns": "rows"},
        {"sql": ("SELECT donor_name_raw, party_name, amount_inr, bond_date "
                 "FROM donations WHERE source_ledger_id = $1 "
                 "AND party_name = 'BHARATIYA JANATA PARTY' LIMIT 3"),
         "params": [lid_join], "returns": "rows"},
    ])
    print("donations with join ledger:", ver[0][0]["c"])
    print("batch-1 rows untouched:", ver[0][0]["c"] == len(joined),
          "| batch-1 count still 50:", ver[1][0]["c"] == 50)
    for r in ver[2]:
        print("sample:", r)


if __name__ == "__main__":
    main()
