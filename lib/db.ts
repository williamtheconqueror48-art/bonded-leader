/**
 * BONDED-LEADER — Neon database client for API routes.
 *
 * The connection string comes ONLY from process.env.DATABASE_URL, set as an
 * environment variable on the host (Vercel). No credential is hardcoded,
 * logged, or committed anywhere in this repository.
 */
import { neon } from "@neondatabase/serverless";

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(url);
}

/** JSON error shape returned when the database cannot be reached. */
export function dbErrorResponse(message: string, status = 503) {
  return Response.json({ error: message }, { status });
}
