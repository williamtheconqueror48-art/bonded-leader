"use client";

/**
 * BONDED-LEADER /corporate — the 618 corporate purchasers covering 99% of
 * corporate bond value.
 *
 * All rows come from /api/corporate, a mechanical derivation of the SBI
 * purchase mirror. Verbatim purchaser names; no entity merging. The
 * classification rule and its limitations are disclosed in the provenance
 * panel and on /methodology.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const NA = "NOT AVAILABLE IN SOURCE DATA";
const PAGE_SIZE = 25;

interface CorporateRow {
  rank: number;
  purchaser_name_raw: string;
  total_amount_inr: string;
  total_amount_cr: string;
  bond_count: number;
  pct_of_corporate_value: string;
  cumulative_pct_of_corporate: string;
  classification_rule_hit: string;
}

interface CorporateResponse {
  rows: CorporateRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  dataset: {
    rowCount: number;
    corporateTotalInr: number | null;
    coverageNote: string;
  };
  provenance: {
    source_url: string;
    source_sha256: string;
    method: string;
    created_at: string;
    limitations: string[];
  } | null;
}

function fmtCr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return NA;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " cr";
}

export default function CorporatePage() {
  const [data, setData] = useState<CorporateResponse | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchRows = useCallback(async (search: string, pg: number) => {
    const res = await fetch(
      `/api/corporate?search=${encodeURIComponent(search)}&page=${pg}&pageSize=${PAGE_SIZE}`
    );
    if (!res.ok) throw new Error(`corporate API: ${res.status}`);
    setData(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchRows("", 1);
      } catch (e) {
        setApiError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchRows]);

  const onSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setActiveSearch(searchInput);
      setPage(1);
      try {
        await fetchRows(searchInput, 1);
      } catch (err) {
        setApiError((err as Error).message);
      }
    },
    [searchInput, fetchRows]
  );

  const onPage = useCallback(
    async (pg: number) => {
      setPage(pg);
      try {
        await fetchRows(activeSearch, pg);
      } catch (err) {
        setApiError((err as Error).message);
      }
    },
    [activeSearch, fetchRows]
  );

  return (
    <>
      <header className="bl-header">
        <div>
          <div className="bl-wordmark">BONDED-LEADER</div>
          <div className="bl-tagline">TOP CORPORATE PURCHASERS — 99% OF CORPORATE VALUE</div>
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
          618 corporate purchasers account for 99% of the mechanical corporate
          total (Rs 11,456.42 cr of Rs 12,155.51 cr purchased). Names are
          verbatim from the SBI purchase list — spelling variants of the same
          company are listed separately; nothing is merged or attributed
          across names.
        </p>
        <p className="bl-p bl-dim bl-small">
          {data?.dataset.coverageNote ?? ""}
        </p>

        {apiError && (
          <div className="bl-empty" style={{ marginBottom: 16 }}>
            DATA SOURCE OFFLINE — {apiError}. Showing empty states; no data is
            invented in its place.
          </div>
        )}

        <section className="bl-panel" aria-label="Corporate purchasers">
          <div className="bl-panel-head">
            <span>CORPORATE 99% SET</span>
            <span className="bl-dim">
              {data ? `${data.total} PURCHASERS` : "—"}
            </span>
          </div>
          <div className="bl-panel-body">
            <form onSubmit={onSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="SEARCH PURCHASER…"
                aria-label="Search purchaser"
                style={{
                  flex: 1, background: "#000", color: "#fff",
                  border: "1px solid #fff", borderRadius: 0,
                  padding: "8px 10px", fontFamily: "inherit", fontSize: 12,
                }}
              />
              <button type="submit" style={{
                background: "#fff", color: "#000", border: "1px solid #fff",
                borderRadius: 0, padding: "8px 14px", fontFamily: "inherit",
                fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              }}>SEARCH</button>
            </form>

            {loading ? (
              <div className="bl-empty">LOADING…</div>
            ) : data && data.rows.length > 0 ? (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className="bl-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>PURCHASER (VERBATIM)</th>
                        <th>TOTAL</th>
                        <th>BONDS</th>
                        <th>% OF CORP.</th>
                        <th>CUMULATIVE %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.rank}>
                          <td className="bl-dim">{r.rank}</td>
                          <td title={`rule hit: ${r.classification_rule_hit}`}>{r.purchaser_name_raw}</td>
                          <td>{fmtCr(r.total_amount_cr)}</td>
                          <td>{r.bond_count}</td>
                          <td className="bl-small">{Number(r.pct_of_corporate_value).toFixed(2)}%</td>
                          <td className="bl-small bl-dim">{Number(r.cumulative_pct_of_corporate).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bl-small bl-dim" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>PAGE {data.page} OF {data.totalPages}{activeSearch && ` — FILTER: "${activeSearch}"`}</span>
                  <span>
                    <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={pagerStyle(page <= 1)}>← PREV</button>{" "}
                    <button onClick={() => onPage(page + 1)} disabled={page >= data.totalPages} style={pagerStyle(page >= data.totalPages)}>NEXT →</button>
                  </span>
                </div>
              </>
            ) : (
              <div className="bl-empty">
                {activeSearch ? `NO PURCHASERS MATCH "${activeSearch}"` : "NO DATA — derivation not yet generated"}
              </div>
            )}
          </div>
        </section>

        <section className="bl-panel" style={{ marginTop: 16 }} aria-label="Provenance">
          <div className="bl-panel-head"><span>DERIVATION PROVENANCE</span></div>
          <div className="bl-panel-body" style={{ minHeight: 0 }}>
            {data?.provenance ? (
              <>
                <p className="bl-p bl-small">{data.provenance.method}</p>
                <p className="bl-p bl-small bl-dim">
                  Source SHA-256: <span title={data.provenance.source_sha256}>{data.provenance.source_sha256.slice(0, 16)}…</span>
                  {" · "}Derived: {new Date(data.provenance.created_at).toISOString().slice(0, 10)}
                </p>
                <ul className="bl-small bl-dim">
                  {data.provenance.limitations.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </>
            ) : (
              <p className="bl-p bl-small bl-dim">Provenance sidecar not found.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="bl-footer">
        BONDED-LEADER · <Link href="/">BACK TO HOME</Link> · <Link href="/methodology">METHODOLOGY</Link>
      </footer>
    </>
  );
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "#000", color: "#fff", border: "1px solid #fff", borderRadius: 0,
    padding: "4px 10px", fontFamily: "inherit", fontSize: 11,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  };
}
