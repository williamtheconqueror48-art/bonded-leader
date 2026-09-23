/**
 * GET /api/benefits — benefit-side datasets for the top corporate donors.
 *
 * Three pilot reports are produced by background research jobs, each under
 * the same zero-fabrication rule as the rest of the project: every figure
 * carries a source URL, anything not found is marked NOT AVAILABLE IN
 * SOURCE DATA, and no causal claim is made between donations and any
 * financial result, tender award, or approval. Donations and benefit-side
 * facts are presented as separate dated records.
 *
 * Until a report file exists, its status is "in_progress" and the UI shows
 * an honest empty state instead of invented content.
 */
import { readBenefitReports } from "@/lib/derived";

export const dynamic = "force-dynamic";

export async function GET() {
  const reports = readBenefitReports();
  return Response.json({
    reports,
    note: "Benefit-side facts are independent public records shown alongside donation records. Proximity in this view does not assert that any donation caused any financial result, award, or approval, or vice versa.",
  });
}
