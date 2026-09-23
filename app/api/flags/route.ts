/**
 * GET /api/flags — every triggered mechanical anomaly flag, joined to its
 * donation row. Each flag carries the EXACT rule text that fired and the
 * computed value that triggered it. Non-triggered checks are never stored
 * and never appear here.
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
      SELECT f.id,
             f.donation_id,
             f.flag_type,
             f.flag_rule_text,
             f.computed_value,
             d.donor_name_raw,
             d.party_name,
             d.amount_inr
      FROM anomaly_flags f
      JOIN donations d ON d.id = f.donation_id
      ORDER BY f.id ASC
    `);
    return Response.json({ flags: rows });
  } catch (err) {
    console.error("GET /api/flags failed:", (err as Error).message);
    return dbErrorResponse("database query failed");
  }
}
