#!/usr/bin/env python3
"""Parse ADR's donor-wise Electoral Bonds table (Part 3) into structured rows.

Source file (real, cited):
  Part_3_Donor-wise_EBs_details_Final.pdf
  URL: http://adrindia.org/sites/default/files/Part_3_Donor-wise_EBs_details_Final.pdf
  "Share of Corporate & Individual Donors who purchased Electoral Bonds,
   12 April 2019 to 15 February 2024"
  Source note inside the PDF: "Election Commission of India as on 14th March 2024.
  Data Compiled and Analysed by ADR."

Extracts, verbatim, for each of the 50 listed donors (25 corporate + 25 individual):
  donor_name_raw : exact donor string as printed (NOT cleaned up -- e.g. the
                   source prints "LI MITED" and "PVT L TD" where its own
                   typesetting broke "LIMITED"; we keep the source's text)
  bonds_purchased: integer number of bonds
  amount_inr     : integer rupees (Indian comma grouping stripped)
  donor_type     : "corporate" | "individual"

Integrity checks (fail loudly, never silently coerce):
  - exactly 25 corporate + 25 individual rows
  - corporate bonds sum to 6658 and amounts sum to Rs 6312.67 cr
  - individual bonds sum to 347 and amounts sum to Rs 248.7506 cr
  (totals as printed in the source PDF itself)

Usage:
  parse_adr_part3.py <pdf_path> [--json-out PATH]

Requires: pypdf
"""
from __future__ import annotations

import json
import re
import sys

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf is required: pip install pypdf")

FULL_ROW = re.compile(
    r"^\s*(\d{1,2})\s+(.+?)\s+(\d+)\s+([\d,]+)\s+([\d.]+%)\s*$"
)
# A row whose donor name wrapped onto the next line: "8 BHARTI AIRTEL ... "
SNO_ONLY = re.compile(r"^\s*(\d{1,2})\s+(\S.*\S)\s*$")
# Continuation line carrying the rest of the name plus the numbers.
CONT_ROW = re.compile(r"^\s*(\S.*?\S)\s+(\d+)\s+([\d,]+)\s+([\d.]+%)\s*$")

EXPECTED = {
    "corporate": {"rows": 25, "bonds": 6658, "amount_inr": 63126700000},
    "individual": {"rows": 25, "bonds": 347, "amount_inr": 2487506000},
}


def parse_amount(s: str) -> int:
    return int(s.replace(",", ""))


def parse_pdf(pdf_path: str) -> list[dict]:
    reader = PdfReader(pdf_path)
    donors: list[dict] = []
    pending_name: str | None = None
    pending_sno: str | None = None
    donor_type: str | None = None

    for page in reader.pages:
        text = page.extract_text() or ""
        if "Top 25 corporate donors" in text or "Details of Top 25 donors" in text:
            donor_type = "corporate"
        elif "Top 25 Individual donors" in text or "Top 25 individual donors" in text:
            donor_type = "individual"

        for line in text.split("\n"):
            if donor_type is None:
                continue
            m = FULL_ROW.match(line)
            if m:
                sno, name, bonds, amount, _pct = m.groups()
                donors.append({
                    "s_no": int(sno),
                    "donor_name_raw": name.strip(),
                    "bonds_purchased": int(bonds),
                    "amount_inr": parse_amount(amount),
                    "donor_type": donor_type,
                })
                pending_name = None
                continue
            if pending_name is None:
                m2 = SNO_ONLY.match(line)
                if m2:
                    # a wrapped name line carries no trailing numbers at all
                    if not re.search(r"[\d,]+\s+[\d.]+%\s*$", line):
                        pending_sno, pending_name = m2.group(1), m2.group(2).strip()
                        continue
            else:
                m3 = CONT_ROW.match(line)
                if m3:
                    rest, bonds, amount, _pct = m3.groups()
                    donors.append({
                        "s_no": int(pending_sno),  # type: ignore[arg-type]
                        "donor_name_raw": (pending_name + " " + rest).strip(),
                        "bonds_purchased": int(bonds),
                        "amount_inr": parse_amount(amount),
                        "donor_type": donor_type,
                    })
                    pending_name = None
                    continue
                # unexpected: drop the pending buffer rather than misattribute
                pending_name = None

    if pending_name is not None:
        raise ValueError(f"unresolved wrapped donor-name line: {pending_name!r}")
    return donors


def validate(donors: list[dict]) -> None:
    for dtype, exp in EXPECTED.items():
        rows = [d for d in donors if d["donor_type"] == dtype]
        bonds = sum(d["bonds_purchased"] for d in rows)
        amount = sum(d["amount_inr"] for d in rows)
        assert len(rows) == exp["rows"], f"{dtype}: got {len(rows)} rows, expected {exp['rows']}"
        assert bonds == exp["bonds"], f"{dtype}: bonds sum {bonds} != {exp['bonds']}"
        assert amount == exp["amount_inr"], f"{dtype}: amount sum {amount} != {exp['amount_inr']}"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: parse_adr_part3.py <pdf_path> [--json-out PATH]")
    pdf_path = sys.argv[1]
    donors = parse_pdf(pdf_path)
    validate(donors)
    out = None
    if "--json-out" in sys.argv:
        out = sys.argv[sys.argv.index("--json-out") + 1]
    payload = json.dumps(donors, indent=2, ensure_ascii=False)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(payload)
        print(f"parsed {len(donors)} donors -> {out} (checksums OK)")
    else:
        print(payload)


if __name__ == "__main__":
    main()
