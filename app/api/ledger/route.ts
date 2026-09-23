/**
 * GET /api/ledger — every ingestion batch ever sealed, newest last.
 * Each row is the public provenance record: exact source URL, retrieval
 * date, SHA-256 of the raw file, and parsed row count.
 */
import { getSql, dbErrorResponse } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let sql;
  try {
    sql = getSql();
  } catch {
    return dbErrorResponse("DATABASE_URL is not configured");
  }

  try {
    const rows = await sql.query(`
      SELECT id, source_name, source_url, retrieved_at, sha256, row_count
      FROM ingestion_ledger
      ORDER BY id ASC
    `);
    return Response.json({ batches: rows });
  } catch (err) {
    console.error("GET /api/ledger failed:", (err as Error).message);
    return dbErrorResponse("database query failed");
  }
}
