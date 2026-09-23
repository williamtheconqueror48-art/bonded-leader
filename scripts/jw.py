#!/usr/bin/env python3
"""Jaro-Winkler canonicalization — faithful Python port of lib/canonicalize.ts.

Merge rule (identical to the TypeScript): two donor-name variants merge into
one canonical node ONLY when jaro_winkler(normalized_a, normalized_b) >= 0.90.
Every decision carries its exact similarity score; nothing merges silently.
"""
from __future__ import annotations

import re

MERGE_THRESHOLD = 0.90


def jaro(s1: str, s2: str) -> float:
    if s1 == s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0
    match_distance = max(len1, len2) // 2 - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0
    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(len2 - 1, i + match_distance)
        for j in range(start, end + 1):
            if not s2_matches[j] and s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break
    if matches == 0:
        return 0.0
    transpositions = 0
    k = 0
    for i in range(len1):
        if s1_matches[i]:
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
    transpositions /= 2
    return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3


def jaro_winkler(s1: str, s2: str, prefix_scale: float = 0.1) -> float:
    j = jaro(s1, s2)
    if j == 0.0 or j == 1.0:
        return j
    prefix = 0
    for i in range(min(4, len(s1), len(s2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break
    return j + prefix * prefix_scale * (1 - j)


_SUFFIX_RES = [
    (re.compile(r"\bPRIVATE\s+LIMITED\b"), "PLTD"),
    (re.compile(r"\bPVT\.?\s+LTD\.?\b"), "PLTD"),
    (re.compile(r"\bLIMITED\b"), "LTD"),
    (re.compile(r"\bLTD\.?\b"), "LTD"),
    (re.compile(r"\bLLP\b"), "LLP"),
    (re.compile(r"\bINC\.?\b"), "INC"),
    (re.compile(r"\bCORP(ORATION)?\.?\b"), "CORP"),
]


def normalize_company_name(raw: str) -> str:
    n = raw.upper()
    n = re.sub(r"[.,;:'\"()\-_/\\&]", " ", n)
    for rx, token in _SUFFIX_RES:
        n = rx.sub(token, n)
    return re.sub(r"\s+", " ", n).strip()


def decide_merge(a: str, b: str, threshold: float = MERGE_THRESHOLD) -> dict:
    na, nb = normalize_company_name(a), normalize_company_name(b)
    sim = jaro_winkler(na, nb)
    return {
        "inputA": a, "inputB": b,
        "normalizedA": na, "normalizedB": nb,
        "similarity": round(sim, 6),
        "threshold": threshold,
        "merged": sim >= threshold,
    }


def canonicalize(names: list[str], threshold: float = MERGE_THRESHOLD) -> list[dict]:
    groups: list[dict] = []
    for name in names:
        placed = False
        for group in groups:
            decision = decide_merge(group["canonical"], name, threshold)
            group["decisions"].append(decision)
            if decision["merged"]:
                group["members"].append(name)
                if len(name) > len(group["canonical"]):
                    group["canonical"] = name
                placed = True
                break
        if not placed:
            groups.append({"canonical": name, "members": [name], "decisions": []})
    return groups


if __name__ == "__main__":
    # Reference vectors (must match lib/canonicalize.ts smoke test)
    assert abs(jaro_winkler("MARTHA", "MARHTA") - 0.9611) < 1e-4, jaro_winkler("MARTHA", "MARHTA")
    assert abs(jaro_winkler("DWAYNE", "DUANE") - 0.8400) < 1e-4, jaro_winkler("DWAYNE", "DUANE")
    print("jw.py reference vectors OK")
