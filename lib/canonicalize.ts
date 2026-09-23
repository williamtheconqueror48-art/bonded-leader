/**
 * BONDED-LEADER — donor-name canonicalization via Jaro-Winkler similarity.
 *
 * ADR/MyNeta bond records and MCA21 filings spell the same company
 * differently ("ABC Pvt Ltd" vs "ABC Private Limited", OCR-mangled variants
 * from scanned disclosure PDFs, etc.). This module merges name variants into
 * one canonical node ONLY when their Jaro-Winkler similarity is >= 0.90.
 *
 * Every merge decision is returned with its exact similarity score so the UI
 * can show the evidence on hover/click. Names are never merged silently.
 */

export const MERGE_THRESHOLD = 0.9;

/**
 * Classic Jaro similarity in [0, 1].
 */
export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(len2 - 1, i + matchDistance);
    for (let j = start; j <= end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }
  transpositions = transpositions / 2;

  return (
    (matches / len1 + matches / len2 + (matches - transpositions) / matches) /
    3
  );
}

/**
 * Jaro-Winkler similarity in [0, 1]. Boosts scores for strings sharing a
 * common prefix (up to 4 chars), standard scaling factor 0.1.
 */
export function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const j = jaro(s1, s2);
  if (j === 0 || j === 1) return j;
  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * prefixScale * (1 - j);
}

/**
 * Normalize a company name for comparison only. The raw string is always
 * preserved for display and provenance. Normalization: uppercase, strip
 * punctuation, expand common suffixes to a single token so that
 * "ABC Pvt Ltd" and "ABC Private Limited" compare closely.
 */
const SUFFIX_MAP: Array<[RegExp, string]> = [
  [/\bPRIVATE\s+LIMITED\b/g, "PLTD"],
  [/\bPVT\.?\s+LTD\.?\b/g, "PLTD"],
  [/\bLIMITED\b/g, "LTD"],
  [/\bLTD\.?\b/g, "LTD"],
  [/\bLLP\b/g, "LLP"],
  [/\bINC\.?\b/g, "INC"],
  [/\bCORP(ORATION)?\.?\b/g, "CORP"],
];

export function normalizeCompanyName(raw: string): string {
  let n = raw.toUpperCase();
  n = n.replace(/[.,;:'"()\-_/\\&]/g, " ");
  for (const [re, token] of SUFFIX_MAP) n = n.replace(re, token);
  return n.replace(/\s+/g, " ").trim();
}

export interface MergeDecision {
  inputA: string;
  inputB: string;
  normalizedA: string;
  normalizedB: string;
  similarity: number;
  threshold: number;
  merged: boolean;
}

/**
 * Decide whether two raw donor-name strings merge, returning the full
 * evidence (normalized forms + exact similarity score). Merge happens only
 * when similarity >= threshold (default 0.90).
 */
export function decideMerge(
  a: string,
  b: string,
  threshold: number = MERGE_THRESHOLD
): MergeDecision {
  const normalizedA = normalizeCompanyName(a);
  const normalizedB = normalizeCompanyName(b);
  const similarity = jaroWinkler(normalizedA, normalizedB);
  return {
    inputA: a,
    inputB: b,
    normalizedA,
    normalizedB,
    similarity,
    threshold,
    merged: similarity >= threshold,
  };
}

export interface CanonicalGroup {
  /** Display form: the longest raw variant (most complete spelling). */
  canonical: string;
  members: string[];
  /** Every pairwise decision that built this group, with scores. */
  decisions: MergeDecision[];
}

/**
 * Group raw donor names into canonical clusters. A name joins the first
 * group whose representative scores >= threshold against it. All decisions
 * (including rejections at the margin) are logged for UI display.
 */
export function canonicalize(
  names: string[],
  threshold: number = MERGE_THRESHOLD
): CanonicalGroup[] {
  const groups: CanonicalGroup[] = [];
  for (const name of names) {
    let placed = false;
    for (const group of groups) {
      const decision = decideMerge(group.canonical, name, threshold);
      group.decisions.push(decision);
      if (decision.merged) {
        group.members.push(name);
        if (name.length > group.canonical.length) group.canonical = name;
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({ canonical: name, members: [name], decisions: [] });
    }
  }
  return groups;
}
