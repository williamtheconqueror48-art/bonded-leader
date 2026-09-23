/**
 * BONDED-LEADER — public data sources and ingestion provenance.
 *
 * Every ingestion batch records its exact source file/URL and retrieval
 * date in ingestion_ledger. The URLs below are the real, published sources:
 * the ECI's SBI-supplied disclosure (per Supreme Court orders of 15.02.2024
 * and 11.03.2024 in WPC No. 880 of 2017) and ADR's compiled public datasets.
 * Retrieval dates are stamped at ingestion time — never backfilled.
 */

import { createHash } from "crypto";
import { createReadStream } from "fs";

export interface DataSource {
  id: string;
  name: string;
  url: string;
  description: string;
}

export const ECI_PRESS_NOTE: DataSource = {
  id: "eci_press_note_pn21_2024",
  name: "ECI Press Note No. ECI/PN/21/2024 (14.03.2024)",
  url: "https://images.assettype.com/barandbench/2024-03/aaf75dc0-0ed9-4803-b4b0-2c29d9382c63/Press_Release___ECI.pdf",
  description:
    "ECI press note confirming the State Bank of India supplied electoral bond data to the Election Commission of India on 12.03.2024, in compliance with Supreme Court directions dated 15.02.2024 and 11.03.2024, and that ECI published it on an 'as is where is' basis.",
};

export const ECI_DATA_PORTAL: DataSource = {
  id: "eci_bonds_portal",
  name: "ECI candidate / political party disclosure portal",
  url: "https://www.eci.gov.in/candidatepoliticalparty",
  description:
    "Election Commission of India portal hosting the SBI-supplied electoral bond donor and party redemption data.",
};

export const ADR_REPORTS_HUB: DataSource = {
  id: "adr_electoral_bonds_hub",
  name: "ADR — Electoral Bonds reports hub",
  url: "https://adrindia.org/content/electoralbonds",
  description:
    "Association for Democratic Reforms' index of reports compiled from SBI RTI responses on electoral bond sales and redemptions.",
};

export const ADR_UPDATED_DATA_PART1: DataSource = {
  id: "adr_updated_data_part1",
  name: "ADR — Updated Data on Electoral Bonds (Part 1)",
  url: "https://d2dqzm0c5v10mw.cloudfront.net/sites/default/files/Updated_Data_on_Electoral_Bonds_Part_1.pdf",
  description:
    "ADR-compiled tables of electoral bonds sold, denomination-wise and branch-wise, sourced from SBI RTI responses.",
};

export const ADR_UPDATED_DATA_PART2: DataSource = {
  id: "adr_updated_data_part2",
  name: "ADR — Updated Data on Electoral Bonds (Part 2)",
  url: "https://adrindia.org/sites/default/files/EBs_Updated_Data_Part_2.pdf",
  description:
    "ADR-compiled tables on electoral bond redemptions by political parties, sourced from SBI RTI responses.",
};

export const ALL_SOURCES: DataSource[] = [
  ECI_PRESS_NOTE,
  ECI_DATA_PORTAL,
  ADR_REPORTS_HUB,
  ADR_UPDATED_DATA_PART1,
  ADR_UPDATED_DATA_PART2,
];

/**
 * Ledger-ready ingestion record (mirrors ingestion_ledger columns).
 * retrieved_at is stamped at call time; sha256 is the real hash of the
 * downloaded source file; row_count must be the actual parsed row count.
 */
export interface IngestionRecord {
  source_name: string;
  source_url: string;
  retrieved_at: string;
  sha256: string;
  row_count: number;
}

/** Compute the SHA-256 hex digest of a file on disk (streamed). */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Build an ingestion_ledger record for a downloaded source file.
 * Call with the real row count parsed from the file — never estimate.
 */
export async function makeIngestionRecord(
  source: DataSource,
  filePath: string,
  rowCount: number
): Promise<IngestionRecord> {
  return {
    source_name: source.id,
    source_url: source.url,
    retrieved_at: new Date().toISOString(),
    sha256: await sha256File(filePath),
    row_count: rowCount,
  };
}
