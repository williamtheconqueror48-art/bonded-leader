/**
 * GET /api/donor-party — which party encashed which donor's bonds.
 *
 * Each row is one (purchaser, party) pair mechanically aggregated from
 * data/joined_bonds.csv, the inner join of the SBI purchase and redemption
 * lists on (prefix, bond_number) — 18,741 matched bonds. Restricted here to
 * the 618 corporate purchasers of the 99% set so it stays aligned with the
 * /corporate view. The full 18,741-row bond-level join remains available
 * as data/joined_bonds.csv in the repository.
 *
 * Query params: search (matches donor or party), page, pageSize.
 */
import { NextRequest } from "next/server";
import { readDonorParty } from "@/lib/derived";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { rows, provenance } = readDonorParty();
  if (rows.length === 0) {
    return Response.json(
      { error: "donor-party dataset not yet generated" },
      { status: 503 }
    );
  }

  const params = new URL(req.url).searchParams;
  const search = (params.get("search") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    1000,
    Math.max(1, parseInt(params.get("pageSize") || "25", 10) || 25)
  );

  const filtered = search
    ? rows.filter(
        (r) =>
          r.purchaser_name_raw.toLowerCase().includes(search) ||
          r.party_name.toLowerCase().includes(search)
      )
    : rows;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  return Response.json({
    rows: slice,
    page,
    pageSize,
    total,
    totalPages,
    search: params.get("search") || "",
    dataset: {
      name: "corporate_99pct_donor_party",
      pairCount: rows.length,
      donorCount: new Set(rows.map((r) => r.purchaser_name_raw)).size,
      partyCount: new Set(rows.map((r) => r.party_name)).size,
      method:
        "Inner join of SBI purchase + redemption lists on (prefix, bond_number); 18,741 of 18,871 purchase bonds matched. Aggregated to (donor, party) totals.",
    },
    provenance,
  });
}
