"use client";

/**
 * BONDED-LEADER /benefits — benefit-side public records alongside the
 * donation data.
 *
 * Three pilot datasets: company financials, government tender/contract
 * awards, and regulatory approvals. Each is produced under the same
 * zero-fabrication rule: every figure carries a source URL, anything not
 * found is marked NOT AVAILABLE IN SOURCE DATA.
 *
 * These are independent public records shown next to donation records.
 * Proximity in this view does not assert that any donation caused any
 * financial result, award, or approval — or the reverse.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

interface BenefitReport {
  key: "mca" | "tenders" | "regulatory";
  title: string;
  status: "complete" | "in_progress";
  content: string | null;
}

interface BenefitsResponse {
  reports: BenefitReport[];
  note: string;
}

export default function BenefitsPage() {
  const [data, setData] = useState<BenefitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/benefits");
        if (!res.ok) throw new Error(`benefits API: ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setApiError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (key: string) =>
    setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <>
      <header className="bl-header">
        <div>
          <div className="bl-wordmark">BONDED-LEADER</div>
          <div className="bl-tagline">BENEFIT-SIDE PUBLIC RECORDS — PILOT</div>
        </div>
        <nav className="bl-nav">
          <Link href="/">GRAPH</Link>
          <Link href="/corporate">CORPORATE</Link>
          <Link href="/donor-party">DONOR→PARTY</Link>
          <Link href="/benefits">BENEFITS</Link>
          <Link href="/methodology">METHODOLOGY</Link>
        </nav>
      </header>

      <main className="bl-main">
        <p className="bl-p">
          Donation records show money moving from purchasers to parties. The
          datasets below show what else is publicly recorded about the same
          companies: their published financials, government contracts they
          won, and regulatory approvals they received. Each is a separate
          dated fact from its own source.
        </p>
        <p className="bl-p bl-dim bl-small">
          {data?.note ?? ""}
        </p>

        {apiError && (
          <div className="bl-empty" style={{ marginBottom: 16 }}>
            DATA SOURCE OFFLINE — {apiError}. Showing empty states; no data is
            invented in its place.
          </div>
        )}

        {loading ? (
          <div className="bl-empty">LOADING…</div>
        ) : (
          data?.reports.map((r) => (
            <section
              key={r.key}
              className="bl-panel"
              style={{ marginTop: 16 }}
              aria-label={r.title}
            >
              <div className="bl-panel-head">
                <span>{r.title}</span>
                <span className={r.status === "complete" ? "bl-green" : "bl-amber"}>
                  {r.status === "complete" ? "■ PILOT COMPLETE" : "■ COLLECTION IN PROGRESS"}
                </span>
              </div>
              <div className="bl-panel-body" style={{ minHeight: 0 }}>
                {r.status === "complete" && r.content ? (
                  <>
                    <button
                      onClick={() => toggle(r.key)}
                      style={{
                        background: "#000", color: "#fff",
                        border: "1px solid #fff", borderRadius: 0,
                        padding: "6px 12px", fontFamily: "inherit",
                        fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
                        marginBottom: 8,
                      }}
                    >
                      {open[r.key] ? "COLLAPSE REPORT" : "EXPAND REPORT"}
                    </button>
                    {open[r.key] && (
                      <pre
                        className="bl-small"
                        style={{
                          whiteSpace: "pre-wrap", wordBreak: "break-word",
                          border: "1px solid #3a3a3a", padding: 12,
                          maxHeight: 480, overflowY: "auto",
                          fontFamily: "monospace",
                        }}
                      >
                        {r.content}
                      </pre>
                    )}
                    {!open[r.key] && (
                      <p className="bl-small bl-dim">
                        Pilot report ready — {r.content.split("\n").length} lines. Expand to read.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="bl-empty">
                    COLLECTION IN PROGRESS — researchers are pulling this
                    dataset from public sources under the zero-fabrication
                    rule. Nothing is shown here until a sourced figure exists;
                    absent data will read NOT AVAILABLE IN SOURCE DATA, never
                    a guess.
                  </div>
                )}
              </div>
            </section>
          ))
        )}

        <section className="bl-panel" style={{ marginTop: 16 }} aria-label="Reading guide">
          <div className="bl-panel-head"><span>HOW TO READ THIS PAGE</span></div>
          <div className="bl-panel-body" style={{ minHeight: 0 }}>
            <p className="bl-p bl-small">
              1. Find a company on <Link href="/corporate">CORPORATE</Link> and
              see which parties encashed its bonds on{" "}
              <Link href="/donor-party">DONOR→PARTY</Link>.
            </p>
            <p className="bl-p bl-small">
              2. Check here whether the same company has published financials,
              tender awards, or approvals in the public record — each with its
              own date and source.
            </p>
            <p className="bl-p bl-small bl-dim">
              3. Draw no causal arrow. A donation in 2022 and a contract in
              2023 are two facts with two sources. This tool will not connect
              them for you.
            </p>
          </div>
        </section>
      </main>

      <footer className="bl-footer">
        BONDED-LEADER · <Link href="/">BACK TO HOME</Link> · <Link href="/methodology">METHODOLOGY</Link>
      </footer>
    </>
  );
}
