/**
 * GET /api/graph — network graph data: donor nodes, party nodes, edges.
 *
 * Honesty contract: an edge is emitted ONLY where a donation row carries a
 * non-NULL party_name (real donor→party linkage from the source). Sources
 * that publish per-donor aggregates without party linkage (e.g. ADR donor-
 * wise Part 3) therefore produce nodes with zero edges — the response says
 * so plainly via counts.edges === 0. No edge is ever synthesized.
 *
 * Node color semantics (same as the UI legend):
 *   green — no anomaly flag on the donor's rows
 *   amber — at least one amber (mechanical) flag
 *   red   — at least one strict combined flag
 */
import { getSql, dbErrorResponse } from "@/lib/db";

export const dynamic = "force-dynamic";

const GREEN = "#33ff66";
const AMBER = "#ffb000";
const RED = "#ff2b2b";

export async function GET() {
  let sql;
  try {
    sql = getSql();
  } catch {
    return dbErrorResponse("DATABASE_URL is not configured");
  }

  try {
    const donations = (await sql.query(`
      SELECT d.id,
             d.donor_name_raw,
             d.donor_name_canonical,
             d.party_name,
             d.amount_inr,
             EXISTS(SELECT 1 FROM anomaly_flags f
                    WHERE f.donation_id = d.id AND f.flag_type = 'strict_combined') AS has_strict,
             EXISTS(SELECT 1 FROM anomaly_flags f
                    WHERE f.donation_id = d.id AND f.flag_type <> 'strict_combined') AS has_amber
      FROM donations d
    `)) as Array<{
      id: number;
      donor_name_raw: string;
      donor_name_canonical: string | null;
      party_name: string | null;
      amount_inr: string;
      has_strict: boolean;
      has_amber: boolean;
    }>;

    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<Record<string, unknown>> = [];
    const partyIds = new Set<string>();

    for (const d of donations) {
      const status = d.has_strict ? RED : d.has_amber ? AMBER : GREEN;
      const label = d.donor_name_canonical ?? d.donor_name_raw;
      nodes.push({
        id: `donor:${d.id}`,
        kind: "donor",
        label,
        title:
          `${d.donor_name_raw}\n` +
          `Amount: INR ${d.amount_inr}\n` +
          `Party: ${d.party_name ?? "NOT AVAILABLE IN SOURCE DATA"}\n` +
          `Flag status: ${
            d.has_strict
              ? "STRICT COMBINED FLAG"
              : d.has_amber
                ? "MECHANICAL FLAG"
                : "NO FLAG TRIGGERED"
          }`,
        status,
      });

      if (d.party_name) {
        const pid = `party:${d.party_name}`;
        if (!partyIds.has(pid)) {
          partyIds.add(pid);
          nodes.push({
            id: pid,
            kind: "party",
            label: d.party_name,
            title: d.party_name,
            status: "#ffffff",
          });
        }
        edges.push({
          from: `donor:${d.id}`,
          to: pid,
          label: `INR ${d.amount_inr}`,
          title: `${d.donor_name_raw} -> ${d.party_name}: INR ${d.amount_inr}`,
        });
      }
    }

    return Response.json({
      nodes,
      edges,
      counts: {
        donors: donations.length,
        parties: partyIds.size,
        edges: edges.length,
      },
    });
  } catch (err) {
    console.error("GET /api/graph failed:", (err as Error).message);
    return dbErrorResponse("database query failed");
  }
}
