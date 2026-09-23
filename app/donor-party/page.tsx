"use client";

/**
 * BONDED-LEADER /donor-party — which party encashed which donor's bonds.
 *
 * Each row is one (purchaser, party) pair from the mechanical inner join of
 * the SBI purchase and redemption lists on (prefix, bond_number): 18,741
 * matched bonds. Restricted to the 618 corporate purchasers of the 99% set.
 * No causal claim is made — this is the encashment record as published.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const NA = "NOT AVAILABLE IN SOURCE DATA";
const PAGE_SIZE = 25;

interface DonorPartyRow {
  purchaser_name_raw: string;
  party_name: string;
  total_amount_inr: string;
  total_amount_cr: string;
  bond_count: number;
}

interface DonorPartyResponse {
  rows: DonorPartyRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  dataset: {
    pairCount: number;
    donorCount: number;
    partyCount: number;
    method: string;
  };
}

function fmtCr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return NA;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " cr";
}

export default function DonorPartyPage() {
  const [data, setData] = useState<DonorPartyResponse | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchRows = useCallback(async (search: string, pg: number) => {
    const res = await fetch(
      `/api/donor-party?search=${encodeURIComponent(search)}&page=${pg}&pageSize=${PAGE_SIZE}`
    );
    if (!res.ok) throw new Error(`donor-party API: ${res.status}`);
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
          <div className="bl-tagline">DONOR → PARTY ENCASHMENT MAPPING</div>
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
          Every row below is a (purchaser, party) pair from the SBI bond-number
          join: the purchaser bought the bonds, the party encashed them. This
          is the published record — it does not claim why any donation was
          made.
        </p>
        <p className="bl-p bl-dim bl-small">
          {data ? `${data.dataset.pairCount} donor–party pairs · ${data.dataset.donorCount} corporate donors · ${data.dataset.partyCount} parties. ${data.dataset.method}` : ""}
        </p>

        {apiError && (
          <div className="bl-empty" style={{ marginBottom: 16 }}>
            DATA SOURCE OFFLINE — {apiError}. Showing empty states; no data is
            invented in its place.
          </div>
        )}

        <section className="bl-panel" aria-label="Donor to party mapping">
          <div className="bl-panel-head">
            <span>ENCASHMENT PAIRS</span>
            <span className="bl-dim">{data ? `${data.total} PAIRS` : "—"}</span>
          </div>
          <div className="bl-panel-body">
            <form onSubmit={onSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="SEARCH DONOR OR PARTY…"
                aria-label="Search donor or party"
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
                        <th>PURCHASER (VERBATIM)</th>
                        <th>ENCASHED BY</th>
                        <th>TOTAL</th>
                        <th>BONDS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={`${r.purchaser_name_raw}|${r.party_name}|${i}`}>
                          <td>{r.purchaser_name_raw}</td>
                          <td>{r.party_name}</td>
                          <td>{fmtCr(r.total_amount_cr)}</td>
                          <td>{r.bond_count}</td>
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
                {activeSearch ? `NO PAIRS MATCH "${activeSearch}"` : "NO DATA — derivation not yet generated"}
              </div>
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
