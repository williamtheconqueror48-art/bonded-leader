#!/usr/bin/env python3
"""Jaro-Winkler canonicalization of distinct SBI purchaser names (bond-level).

Method (disclosed on the methodology page):
  - Names are the verbatim purchaser strings from the parsed SBI purchase PDF.
  - normalize via jw.normalize_company_name (same as lib/canonicalize.ts).
  - BLOCKING: block key = first 4 alphanumeric chars of the normalized name;
    pairwise Jaro-Winkler comparisons are performed ONLY within a block.
  - MERGE: jaro_winkler(a, b) >= 0.90 merges the pair (union-find over all
    merged pairs => connected components).
  - Canonical name per component = longest raw member (ties broken
    alphabetically, deterministic).
  - donor_name_canonical is set ONLY for names in a multi-member component;
    singleton names keep NULL.

Outputs:
  data/merge_decisions_sbi.json — every within-block pairwise decision with
    exact similarity score, plus the resulting components.
  Prints: distinct names, blocks, comparisons, merged pairs, components.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict

sys.path.insert(0, "/home/hatch/workspace/bonded-leader/scripts")
from jw import normalize_company_name, jaro_winkler, MERGE_THRESHOLD  # noqa: E402

APP_ROOT = "/home/hatch/workspace/bonded-leader"


def block_key(raw: str) -> str:
    alnum = re.sub(r"[^A-Z0-9]", "", normalize_company_name(raw))
    return alnum[:4]


def main() -> dict:
    with open(f"{APP_ROOT}/data/joined_bonds.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    names = sorted({r["purchaser_name"] for r in rows})

    blocks: dict[str, list[str]] = defaultdict(list)
    for n in names:
        blocks[block_key(n)].append(n)

    parent = {n: n for n in names}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    decisions: list[dict] = []
    comparisons = 0
    for key in sorted(blocks):
        members = sorted(blocks[key])
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                a, b = members[i], members[j]
                sim = jaro_winkler(normalize_company_name(a),
                                   normalize_company_name(b))
                merged = sim >= MERGE_THRESHOLD
                comparisons += 1
                if merged:
                    union(a, b)
                decisions.append({
                    "inputA": a,
                    "inputB": b,
                    "blockKey": key,
                    "similarity": round(sim, 6),
                    "threshold": MERGE_THRESHOLD,
                    "merged": merged,
                })

    components: dict[str, list[str]] = defaultdict(list)
    for n in names:
        components[find(n)].append(n)

    canonical_map: dict[str, str | None] = {}
    multi = 0
    for members in components.values():
        if len(members) > 1:
            multi += 1
            canon = sorted(members, key=lambda m: (-len(m), m))[0]
            for m in members:
                canonical_map[m] = canon
        else:
            canonical_map[members[0]] = None

    out = {
        "method": ("blocking on first 4 alphanumerics of normalized name; "
                   "pairwise Jaro-Winkler within blocks; union-find on "
                   "pairs with similarity >= 0.90"),
        "threshold": MERGE_THRESHOLD,
        "distinct_names": len(names),
        "blocks": len(blocks),
        "within_block_comparisons": comparisons,
        "merged_pairs": sum(1 for d in decisions if d["merged"]),
        "multi_member_components": multi,
        "decisions": decisions,
        "components": [
            {"canonical": sorted(m, key=lambda x: (-len(x), x))[0],
             "members": sorted(m)}
            for m in components.values() if len(m) > 1
        ],
        "canonical_map": canonical_map,
    }
    with open(f"{APP_ROOT}/data/merge_decisions_sbi.json", "w",
              encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(json.dumps({k: v for k, v in out.items()
                      if k not in ("decisions", "components", "canonical_map")},
                     indent=2))
    for c in out["components"][:20]:
        print("MERGE:", c["canonical"], "<-", len(c["members"]), "members")
    return canonical_map


if __name__ == "__main__":
    main()
