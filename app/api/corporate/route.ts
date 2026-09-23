/**
 * GET /api/corporate — the 618 corporate purchasers covering 99% of
 * corporate bond value.
 *
 * Derived mechanically from data/parsed_sbi_purchase.csv (the SBI purchase
 * mirror): verbatim purchaser names grouped, corporate flag by the disclosed
 * substring/word rule, sorted by total amount descending, cumulative cut at
 * 99%. No Jaro-Winkler merging was applied. Provenance ships in the
 * response from data/corporate_99pct.provenance.json.
 *
 * Query params: search (matches purchaser name), page, pageSize.
 */
import { NextRequest } from "next/server";
import { readCorporate99 } from "@/lib/derived";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { rows, provenance } = readCorporate99();
  if (rows.length === 0) {
    return Response.json(
      { error: "corporate 99% dataset not yet generated" },
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
    ? rows.filter((r) => r.purchaser_name_raw.toLowerCase().includes(search))
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
      name: "corporate_99pct",
      rowCount: rows.length,
      corporateTotalInr: provenance?.counts?.total_corporate_inr ?? null,
      coverageNote:
        "618 corporate purchasers covering 99% of the mechanical corporate total (Rs 11,456.42 cr of Rs 12,155.51 cr purchased).",
    },
    provenance,
  });
}
