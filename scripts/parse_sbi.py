#!/usr/bin/env python3
"""Parse the two SBI Electoral Bonds PDFs (community mirrors of the ECI-published
21 March 2024 dump) into structured rows and join purchases to redemptions on
(prefix, bond_number).

ZERO FABRICATION: every row is parsed mechanically from the PDF text with
regexes below. If parsed row counts do not equal the expected 18,871 / 20,421,
the script exits non-zero and writes nothing.

Outputs:
  data/parsed_sbi_purchase.csv   (mechanical parse of the purchase PDF)
  data/parsed_sbi_redemption.csv (mechanical parse of the redemption PDF)
  data/joined_bonds.csv          (inner join on (prefix, bond_number))
  /tmp/sbi_parse_summary.json    (counts, match stats, totals cross-check)
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from datetime import date

from pypdf import PdfReader

RAW_DIR = "/home/hatch/workspace/bonded-leader/data/raw"
DATA_DIR = "/home/hatch/workspace/bonded-leader/data"

PURCHASE_PDF = f"{RAW_DIR}/sbi_purchase_bond_buyer.pdf"
REDEMPTION_PDF = f"{RAW_DIR}/sbi_redemption_bond_user.pdf"

EXPECTED_PURCHASE_ROWS = 18871
EXPECTED_REDEMPTION_ROWS = 20421

MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

DATE_RE = r"\d{2}/[A-Za-z]{3}/\d{4}"

PURCHASE_START = re.compile(rf"^\d+\s+\d+\s+{DATE_RE}\s")
REDEMPTION_START = re.compile(rf"^\d+\s+{DATE_RE}\s")
HEADER_LINE = re.compile(r"^Sr No\.")
FOOTER_LINE = re.compile(r"^Page \d+ of \d+$")

PURCHASE_ROW = re.compile(
    rf"^(\d+)\s+"            # sr_no
    rf"(\d+)\s+"            # reference_no (URN)
    rf"({DATE_RE})\s+"      # journal_date
    rf"({DATE_RE})\s+"      # purchase_date
    rf"({DATE_RE})\s+"      # expiry_date
    rf"(.*?)\s+"            # purchaser name (verbatim, non-greedy)
    rf"([A-Z]{{2}})\s+"     # prefix
    rf"(\d+)\s+"            # bond_number
    rf"([\d,]+)\s+"         # denomination
    rf"(\d+)\s+"            # issue branch code
    rf"(\d+)\s+"            # issue teller
    rf"(\S+)$"              # status
)

REDEMPTION_ROW = re.compile(
    rf"^(\d+)\s+"           # sr_no
    rf"({DATE_RE})\s+"      # encashment_date
    rf"(.*?)\s+"            # political party name (verbatim, non-greedy)
    rf"(\*+\d+)\s+"         # masked account no.
    rf"([A-Z]{{2}})\s+"     # prefix
    rf"(\d+)\s+"            # bond_number
    rf"([\d,]+)\s+"         # denomination
    rf"(\d+)\s+"            # pay branch code
    rf"(\d+)$"              # pay teller
)


def to_iso(d: str) -> str:
    dd, mon, yyyy = d.split("/")
    return date(int(yyyy), MONTHS[mon], int(dd)).isoformat()


def to_int_inr(s: str) -> int:
    return int(s.replace(",", ""))


def extract_rows(pdf_path: str, start_re: re.Pattern) -> list[str]:
    """Extract text page by page, drop the repeating 3-line header and the
    "Page N of M" footer, then rejoin rows wrapped across lines."""
    reader = PdfReader(pdf_path)
    rows: list[str] = []
    for page in reader.pages:
        lines = [l.strip() for l in page.extract_text().splitlines()]
        lines = [l for l in lines if l and not FOOTER_LINE.match(l)]
        # drop the repeating multi-line column header: skip leading lines
        # until the first data row (fail-safe: any dropped data row would
        # break the exact row-count assertion downstream)
        started = False
        current = ""
        for line in lines:
            if not started:
                if start_re.match(line):
                    started = True
                else:
                    continue
            if start_re.match(line):
                if current:
                    rows.append(current)
                current = line
            else:
                # continuation of a row wrapped across lines
                current += " " + line
        if current:
            rows.append(current)
    return rows


def parse_purchase() -> list[dict]:
    rows = extract_rows(PURCHASE_PDF, PURCHASE_START)
    parsed = []
    for i, row in enumerate(rows):
        m = PURCHASE_ROW.match(row)
        if not m:
            raise ValueError(f"purchase row {i} did not parse: {row[:160]!r}")
        (sr, urn, journal, purchase, expiry, name, prefix, bond,
         denom, branch, teller, status) = m.groups()
        parsed.append({
            "sr_no": int(sr),
            "reference_no_urn": urn,
            "journal_date": to_iso(journal),
            "purchase_date": to_iso(purchase),
            "expiry_date": to_iso(expiry),
            "purchaser_name": name,  # verbatim
            "prefix": prefix,
            "bond_number": bond,
            "denomination_inr": to_int_inr(denom),
            "issue_branch_code": branch,
            "issue_teller": teller,
            "status": status,
        })
    return parsed


def parse_redemption() -> list[dict]:
    rows = extract_rows(REDEMPTION_PDF, REDEMPTION_START)
    parsed = []
    for i, row in enumerate(rows):
        m = REDEMPTION_ROW.match(row)
        if not m:
            raise ValueError(f"redemption row {i} did not parse: {row[:160]!r}")
        (sr, encash, party, account, prefix, bond,
         denom, branch, teller) = m.groups()
        parsed.append({
            "sr_no": int(sr),
            "encashment_date": to_iso(encash),
            "party_name": party,  # verbatim
            "account_no_masked": account,
            "prefix": prefix,
            "bond_number": bond,
            "denomination_inr": to_int_inr(denom),
            "pay_branch_code": branch,
            "pay_teller": teller,
        })
    return parsed


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def write_csv(path: str, rows: list[dict], fieldnames: list[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    purchase = parse_purchase()
    redemption = parse_redemption()

    if len(purchase) != EXPECTED_PURCHASE_ROWS:
        print(f"FATAL: purchase rows {len(purchase)} != {EXPECTED_PURCHASE_ROWS}",
              file=sys.stderr)
        sys.exit(1)
    if len(redemption) != EXPECTED_REDEMPTION_ROWS:
        print(f"FATAL: redemption rows {len(redemption)} != {EXPECTED_REDEMPTION_ROWS}",
              file=sys.stderr)
        sys.exit(1)

    # duplicate composite keys within each file?
    def key(r: dict) -> tuple[str, str]:
        return (r["prefix"], r["bond_number"])

    p_keys = [key(r) for r in purchase]
    r_keys = [key(r) for r in redemption]
    dup_p = len(p_keys) - len(set(p_keys))
    dup_r = len(r_keys) - len(set(r_keys))

    p_map = {key(r): r for r in purchase}
    r_map = {key(r): r for r in redemption}
    matched_keys = set(p_map) & set(r_map)
    purchase_only = set(p_map) - set(r_map)
    redemption_only = set(r_map) - set(p_map)

    joined: list[dict] = []
    for k in sorted(matched_keys):
        p, r = p_map[k], r_map[k]
        joined.append({
            "prefix": k[0],
            "bond_number": k[1],
            "purchaser_name": p["purchaser_name"],
            "purchase_date": p["purchase_date"],
            "expiry_date": p["expiry_date"],
            "party_name": r["party_name"],
            "encashment_date": r["encashment_date"],
            "denomination_inr": p["denomination_inr"],
            "redemption_denomination_inr": r["denomination_inr"],
            "denomination_match": p["denomination_inr"] == r["denomination_inr"],
            "purchase_reference_no_urn": p["reference_no_urn"],
            "purchase_status": p["status"],
        })

    denom_mismatch = sum(1 for j in joined if not j["denomination_match"])

    total_purchase_inr = sum(r["denomination_inr"] for r in purchase)
    total_redemption_inr = sum(r["denomination_inr"] for r in redemption)
    crore = 10_000_000

    write_csv(f"{DATA_DIR}/parsed_sbi_purchase.csv", purchase, list(purchase[0].keys()))
    write_csv(f"{DATA_DIR}/parsed_sbi_redemption.csv", redemption,
              list(redemption[0].keys()))
    join_fields = ["prefix", "bond_number", "purchaser_name", "purchase_date",
                   "expiry_date", "party_name", "encashment_date",
                   "denomination_inr", "redemption_denomination_inr",
                   "denomination_match", "purchase_reference_no_urn",
                   "purchase_status"]
    write_csv(f"{DATA_DIR}/joined_bonds.csv", joined, join_fields)
    join_sha = sha256_file(f"{DATA_DIR}/joined_bonds.csv")

    statuses = sorted({r["status"] for r in purchase})
    parties = sorted({r["party_name"] for r in redemption})

    summary = {
        "purchase_rows": len(purchase),
        "redemption_rows": len(redemption),
        "purchase_dup_composite_keys": dup_p,
        "redemption_dup_composite_keys": dup_r,
        "matched": len(matched_keys),
        "purchase_only": len(purchase_only),
        "redemption_only": len(redemption_only),
        "denomination_mismatches_in_join": denom_mismatch,
        "total_purchase_inr": total_purchase_inr,
        "total_purchase_crore": round(total_purchase_inr / crore, 4),
        "total_redemption_inr": total_redemption_inr,
        "total_redemption_crore": round(total_redemption_inr / crore, 4),
        "purchase_statuses": statuses,
        "distinct_parties_in_redemption": len(parties),
        "joined_csv_sha256": join_sha,
        "joined_csv_rows": len(joined),
    }
    with open("/tmp/sbi_parse_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
