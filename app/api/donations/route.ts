/**
 * GET /api/donations — paginated, searchable donation records.
 *
 * Query params:
 *   search   — substring matched (case-insensitive) against donor raw name
 *              and party name. Empty = no filter.
 *   page     — 1-based page number (default 1).
 *   pageSize — rows per page, 1..1000 (default 25).
 *
 * Every row carries its ingestion_ledger provenance (ledger id, source name,
 * source URL, retrieval date, SHA-256). NULL party/date are returned as null;
 * the UI renders them as NOT AVAILABLE IN SOURCE DATA.
 */
import { NextRequest } from "next/server";
import { getSql, dbErrorResponse } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROW_SQL = `
  SELECT d.id,
         d.donor_name_raw,
         d.donor_name_canonical,
         d.party_name,
         d.amount_inr,
         d.bond_date,
         d.source_ledger_id,
         l.source_name,
         l.source_url,
         l.retrieved_at,
         l.sha256
  FROM donations d
  JOIN ingestion_ledger l ON l.id = d.source_ledger_id
`;

export async function GET(req: NextRequest) {
  let sql;
  try {
    sql = getSql();
  } catch {
    return dbErrorResponse("DATABASE_URL is not configured");
  }

  const params = new URL(req.url).searchParams;
  const search = (params.get("search") || "").trim();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    1000,
    Math.max(1, parseInt(params.get("pageSize") || "25", 10) || 25)
  );
  const offset = (page - 1) * pageSize;
  const pattern = `%${search}%`;

  try {
    const rows = search
      ? await sql.query(
          `${ROW_SQL}
           WHERE d.donor_name_raw ILIKE $1 OR d.party_name ILIKE $1
           ORDER BY d.amount_inr DESC
           LIMIT $2 OFFSET $3`,
          [pattern, pageSize, offset]
        )
      : await sql.query(
          `${ROW_SQL} ORDER BY d.amount_inr DESC LIMIT $1 OFFSET $2`,
          [pageSize, offset]
        );

    const totalRows = search
      ? await sql.query(
          `SELECT COUNT(*)::int AS total FROM donations d
           WHERE d.donor_name_raw ILIKE $1 OR d.party_name ILIKE $1`,
          [pattern]
        )
      : await sql.query(
          `SELECT COUNT(*)::int AS total FROM donations WHERE $1::int = 1`,
          [1]
        );

    const total = totalRows[0]?.total ?? 0;

    return Response.json({
      rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      search,
    });
  } catch (err) {
    console.error("GET /api/donations failed:", (err as Error).message);
    return dbErrorResponse("database query failed");
  }
}
