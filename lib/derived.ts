/**
 * BONDED-LEADER — readers for derived analytical artifacts.
 *
 * These CSVs are mechanical derivations from already-ingested source batches
 * (never new claims). Each ships with a .provenance.json sidecar recording
 * the exact source file, SHA-256, method, and limitations. The API routes
 * serve them with that provenance attached so the UI can display it.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

/** Minimal RFC-4180 CSV parser (handles quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export interface CorporateRow {
  rank: number;
  purchaser_name_raw: string;
  total_amount_inr: string;
  total_amount_cr: string;
  bond_count: number;
  pct_of_corporate_value: string;
  cumulative_pct_of_corporate: string;
  classification_rule_hit: string;
}

export interface DerivedProvenance {
  source_url: string;
  source_sha256: string;
  method: string;
  created_at: string;
  counts: Record<string, number>;
  limitations: string[];
}

function readProvenance(base: string): DerivedProvenance | null {
  const p = path.join(DATA_DIR, `${base}.provenance.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function readCorporate99(): {
  rows: CorporateRow[];
  provenance: DerivedProvenance | null;
} {
  const p = path.join(DATA_DIR, "corporate_99pct.csv");
  if (!fs.existsSync(p)) return { rows: [], provenance: null };
  const grid = parseCsv(fs.readFileSync(p, "utf-8"));
  const [, ...body] = grid; // skip header
  const rows: CorporateRow[] = body.map((c) => ({
    rank: parseInt(c[0], 10),
    purchaser_name_raw: c[1],
    total_amount_inr: c[2],
    total_amount_cr: c[3],
    bond_count: parseInt(c[4], 10),
    pct_of_corporate_value: c[5],
    cumulative_pct_of_corporate: c[6],
    classification_rule_hit: c[7],
  }));
  return { rows, provenance: readProvenance("corporate_99pct") };
}

export interface DonorPartyRow {
  purchaser_name_raw: string;
  party_name: string;
  total_amount_inr: string;
  total_amount_cr: string;
  bond_count: number;
}

export function readDonorParty(): {
  rows: DonorPartyRow[];
  provenance: DerivedProvenance | null;
} {
  const p = path.join(DATA_DIR, "corporate_99pct_donor_party.csv");
  if (!fs.existsSync(p)) return { rows: [], provenance: null };
  const grid = parseCsv(fs.readFileSync(p, "utf-8"));
  const [, ...body] = grid;
  const rows: DonorPartyRow[] = body.map((c) => ({
    purchaser_name_raw: c[0],
    party_name: c[1],
    total_amount_inr: c[2],
    total_amount_cr: c[3],
    bond_count: parseInt(c[4], 10),
  }));
  // Reuse the corporate 99% provenance (same derivation family); the
  // donor-party file documents the join it was aggregated from.
  return { rows, provenance: readProvenance("corporate_99pct") };
}

export interface BenefitReport {
  key: "mca" | "tenders" | "regulatory";
  title: string;
  status: "complete" | "in_progress";
  content: string | null;
}

const BENEFIT_FILES: Array<{
  key: BenefitReport["key"];
  title: string;
  file: string;
}> = [
  {
    key: "mca",
    title: "COMPANY FINANCIALS (MCA / ANNUAL REPORTS)",
    file: "benefit_mca_pilot.md",
  },
  {
    key: "tenders",
    title: "GOVERNMENT TENDER & CONTRACT AWARDS",
    file: "benefit_tenders_pilot.md",
  },
  {
    key: "regulatory",
    title: "REGULATORY APPROVALS & LICENSES",
    file: "benefit_regulatory_pilot.md",
  },
];

export function readBenefitReports(): BenefitReport[] {
  return BENEFIT_FILES.map(({ key, title, file }) => {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) {
      return {
        key,
        title,
        status: "complete" as const,
        content: fs.readFileSync(p, "utf-8"),
      };
    }
    return { key, title, status: "in_progress" as const, content: null };
  });
}
