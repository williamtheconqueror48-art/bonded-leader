"use client";

/**
 * BONDED-LEADER home — live data views.
 *
 * Every value rendered here arrives from /api/*, which reads the Neon
 * database. The database holds only real, cited rows sealed in the
 * ingestion ledger. If the API is unreachable, the panels fall back to
 * explicit empty states — never to invented content.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const NA = "NOT AVAILABLE IN SOURCE DATA";
const PAGE_SIZE = 25;

interface DonationRow {
  id: number;
  donor_name_raw: string;
  donor_name_canonical: string | null;
  party_name: string | null;
  amount_inr: string;
  bond_date: string | null;
  source_ledger_id: number;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  sha256: string;
}

interface DonationsResponse {
  rows: DonationRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
}

interface GraphNode {
  id: string;
  kind: "donor" | "party";
  label: string;
  title: string;
  status: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  title: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  counts: { donors: number; parties: number; edges: number };
}

interface LedgerBatch {
  id: number;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  sha256: string;
  row_count: number;
}

interface FlagRow {
  id: number;
  donation_id: number;
  flag_type: string;
  flag_rule_text: string;
  computed_value: string;
  donor_name_raw: string;
  party_name: string | null;
  amount_inr: string;
}

function fmtINR(v: string | number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return NA;
  return "INR " + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function shortHash(h: string): string {
  return h && h.length > 12 ? h.slice(0, 12) + "…" : h;
}

function csvCell(v: string | number | null): string {
  const s = v == null || v === "" ? NA : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function HomeClient() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [donations, setDonations] = useState<DonationsResponse | null>(null);
  const [ledger, setLedger] = useState<LedgerBatch[] | null>(null);
  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<unknown>(null);

  const fetchDonations = useCallback(async (search: string, pg: number) => {
    const res = await fetch(
      `/api/donations?search=${encodeURIComponent(search)}&page=${pg}&pageSize=${PAGE_SIZE}`
    );
    if (!res.ok) throw new Error(`donations API: ${res.status}`);
    setDonations(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [g, l, f] = await Promise.all([
          fetch("/api/graph").then((r) => {
            if (!r.ok) throw new Error(`graph API: ${r.status}`);
            return r.json();
          }),
          fetch("/api/ledger").then((r) => {
            if (!r.ok) throw new Error(`ledger API: ${r.status}`);
            return r.json();
          }),
          fetch("/api/flags").then((r) => {
            if (!r.ok) throw new Error(`flags API: ${r.status}`);
            return r.json();
          }),
        ]);
        setGraph(g);
        setLedger(l.batches);
        setFlags(f.flags);
        await fetchDonations("", 1);
      } catch (e) {
        setApiError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchDonations]);

  // Render the network graph once data arrives.
  useEffect(() => {
    if (!graph || !graphRef.current) return;
    let cancelled = false;
    (async () => {
      const vis = await import("vis-network/standalone");
      if (cancelled || !graphRef.current) return;
      if (networkRef.current) {
        (networkRef.current as { destroy: () => void }).destroy();
      }
      const data = {
        nodes: new vis.DataSet(
          graph.nodes.map((n) => ({
            id: n.id,
            label:
              n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label,
            title: n.title,
            shape: "box",
            color: {
              background: "#000000",
              border: n.status,
              highlight: { background: "#111111", border: n.status },
            },
            font: { color: "#ffffff", face: "monospace", size: 11 },
            borderWidth: 1,
          }))
        ),
        edges: new vis.DataSet(
          graph.edges.map((e, i) => ({
            id: i,
            from: e.from,
            to: e.to,
            label: e.label,
            title: e.title,
            color: { color: "#8a8a8a", highlight: "#ffffff" },
            font: { color: "#8a8a8a", face: "monospace", size: 10 },
            width: 1,
          }))
        ),
      };
      const options = {
        height: "420px",
        background: "#000000",
        nodes: { borderWidth: 1 },
        edges: { smooth: { enabled: true, type: "continuous", roundness: 0.5 } },
        physics: {
          stabilization: { iterations: 120 },
          barnesHut: { gravitationalConstant: -4000, springLength: 140 },
        },
        interaction: { hover: true, tooltipDelay: 120 },
      };
      networkRef.current = new vis.Network(graphRef.current, data, options);
    })();
    return () => {
      cancelled = true;
    };
  }, [graph]);

  const onSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setActiveSearch(searchInput);
      setPage(1);
      try {
        await fetchDonations(searchInput, 1);
      } catch (err) {
        setApiError((err as Error).message);
      }
    },
    [searchInput, fetchDonations]
  );

  const onPage = useCallback(
    async (pg: number) => {
      setPage(pg);
      try {
        await fetchDonations(activeSearch, pg);
      } catch (err) {
        setApiError((err as Error).message);
      }
    },
    [activeSearch, fetchDonations]
  );

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/donations?search=${encodeURIComponent(activeSearch)}&page=1&pageSize=1000`
      );
      if (!res.ok) throw new Error(`export API: ${res.status}`);
      const data: DonationsResponse = await res.json();
      const header = [
        "id",
        "donor_name_raw",
        "donor_name_canonical",
        "party_name",
        "amount_inr",
        "bond_date",
        "source_ledger_id",
        "source_name",
        "source_url",
        "retrieved_at",
        "sha256",
      ];
      const lines = [header.join(",")];
      for (const r of data.rows) {
        lines.push(
          [
            csvCell(r.id),
            csvCell(r.donor_name_raw),
            csvCell(r.donor_name_canonical),
            csvCell(r.party_name),
            csvCell(r.amount_inr),
            csvCell(r.bond_date),
            csvCell(r.source_ledger_id),
            csvCell(r.source_name),
            csvCell(r.source_url),
            csvCell(r.retrieved_at),
            csvCell(r.sha256),
          ].join(",")
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `bonded-leader-donations-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [activeSearch]);

  const donorCount = graph?.counts.donors ?? 0;
  const partyCount = graph?.counts.parties ?? 0;
  const edgeCount = graph?.counts.edges ?? 0;

  return (
    <>
      <header className="bl-header">
        <div>
          <div className="bl-wordmark">BONDED-LEADER</div>
          <div className="bl-tagline">
            ELECTORAL BONDS NETWORK INTELLIGENCE — PUBLIC DISCLOSURE DATA,
            STRUCTURED
          </div>
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
          This platform maps India&apos;s Electoral Bonds donations — donor
          companies, the political parties they funded, amounts, and dates —
          as an explorable graph, cross-referenced against public
          company-registration data. Every record traces to a cited public
          disclosure ordered into the public domain by the Supreme Court of
          India in February 2024.
        </p>
        <p className="bl-p bl-dim bl-small">
          Descriptive facts only. Flags shown here are mechanical computations
          over disclosed values — see <Link href="/methodology">METHODOLOGY</Link>{" "}
          for the exact rules and what they do and do not mean.
        </p>

        {apiError && (
          <div className="bl-empty" style={{ marginBottom: 16 }}>
            DATA SOURCE OFFLINE — {apiError}. Showing empty states; no data
            is invented in its place.
          </div>
        )}

        <div className="bl-grid-2" style={{ marginTop: 24 }}>
          <section className="bl-panel" aria-label="Graph view">
            <div className="bl-panel-head">
              <span>GRAPH VIEW</span>
              <span className="bl-dim">
                NODES: {donorCount + partyCount} / EDGES: {edgeCount}
              </span>
            </div>
            <div className="bl-panel-body">
              {loading ? (
                <div className="bl-empty">LOADING GRAPH…</div>
              ) : (
                <>
                  <div
                    ref={graphRef}
                    style={{
                      border: "1px solid #3a3a3a",
                      background: "#000",
                      minHeight: 420,
                    }}
                  />
                  {edgeCount === 0 && (
                    <p className="bl-small bl-dim" style={{ marginTop: 8 }}>
                      0 edges: the ingested sources publish per-donor
                      aggregates without donor→party linkage, so no edge can
                      be honestly drawn yet. Nodes are shown; edges appear
                      only where a source records the linkage.
                    </p>
                  )}
                </>
              )}
              <div className="bl-legend">
                <span className="bl-green">
                  <i /> NO FLAG TRIGGERED
                </span>
                <span className="bl-amber">
                  <i /> MECHANICAL FLAG (RULE SHOWN ON HOVER)
                </span>
                <span className="bl-red">
                  <i /> STRICT COMBINED FLAG (6-MO + 50% RULE)
                </span>
              </div>
            </div>
          </section>

          <section className="bl-panel" aria-label="Table view">
            <div className="bl-panel-head">
              <span>TABLE VIEW</span>
              <span className="bl-dim">
                {donations ? `${donations.total} RECORDS` : "—"}
              </span>
            </div>
            <div className="bl-panel-body">
              <form
                onSubmit={onSearch}
                style={{ display: "flex", gap: 8, marginBottom: 12 }}
              >
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="SEARCH DONOR OR PARTY…"
                  aria-label="Search donor or party"
                  style={{
                    flex: 1,
                    background: "#000",
                    color: "#fff",
                    border: "1px solid #fff",
                    borderRadius: 0,
                    padding: "8px 10px",
                    fontFamily: "inherit",
                    fontSize: 12,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "#fff",
                    color: "#000",
                    border: "1px solid #fff",
                    borderRadius: 0,
                    padding: "8px 14px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >
                  SEARCH
                </button>
                <button
                  type="button"
                  onClick={onExport}
                  disabled={exporting || !donations || donations.total === 0}
                  style={{
                    background: "#000",
                    color: "#fff",
                    border: "1px solid #fff",
                    borderRadius: 0,
                    padding: "8px 14px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    opacity: exporting ? 0.5 : 1,
                  }}
                >
                  {exporting ? "EXPORTING…" : "EXPORT CSV"}
                </button>
              </form>

              {loading ? (
                <div className="bl-empty">LOADING TABLE…</div>
              ) : donations && donations.rows.length > 0 ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table className="bl-table">
                      <thead>
                        <tr>
                          <th>DONOR (RAW)</th>
                          <th>PARTY</th>
                          <th>AMOUNT (INR)</th>
                          <th>DATE</th>
                          <th>SOURCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donations.rows.map((r) => (
                          <tr key={r.id}>
                            <td title={r.donor_name_raw}>
                              {r.donor_name_raw}
                              {r.donor_name_canonical && (
                                <div className="bl-dim bl-small">
                                  → {r.donor_name_canonical}
                                </div>
                              )}
                            </td>
                            <td className={r.party_name ? "" : "bl-dim"}>
                              {r.party_name ?? NA}
                            </td>
                            <td>{fmtINR(r.amount_inr)}</td>
                            <td className={r.bond_date ? "" : "bl-dim"}>
                              {r.bond_date ?? NA}
                            </td>
                            <td className="bl-small">
                              <a
                                href={r.source_url}
                                target="_blank"
                                rel="noreferrer"
                                title={`${r.source_name} — SHA-256 ${r.sha256}`}
                              >
                                LEDGER #{r.source_ledger_id}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    className="bl-small bl-dim"
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      PAGE {donations.page} OF {donations.totalPages}
                      {activeSearch && ` — FILTER: "${activeSearch}"`}
                    </span>
                    <span>
                      <button
                        onClick={() => onPage(page - 1)}
                        disabled={page <= 1}
                        style={pagerStyle(page <= 1)}
                      >
                        ← PREV
                      </button>{" "}
                      <button
                        onClick={() => onPage(page + 1)}
                        disabled={page >= donations.totalPages}
                        style={pagerStyle(page >= donations.totalPages)}
                      >
                        NEXT →
                      </button>
                    </span>
                  </div>
                </>
              ) : (
                <div className="bl-empty">
                  {activeSearch
                    ? `NO RECORDS MATCH "${activeSearch}"`
                    : "NO DATA INGESTED YET — awaiting real ADR/ECI source file"}
                </div>
              )}
            </div>
          </section>
        </div>

        <section
          className="bl-panel"
          style={{ marginTop: 16 }}
          aria-label="Mechanical flags"
        >
          <div className="bl-panel-head">
            <span>MECHANICAL FLAGS</span>
            <span className="bl-dim">
              {flags ? `${flags.length} TRIGGERED` : "—"}
            </span>
          </div>
          <div className="bl-panel-body" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="bl-empty">LOADING FLAGS…</div>
            ) : flags && flags.length > 0 ? (
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>DONOR</th>
                    <th>FLAG TYPE</th>
                    <th>RULE</th>
                    <th>COMPUTED VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.id}>
                      <td>{f.donor_name_raw}</td>
                      <td
                        className={
                          f.flag_type === "strict_combined"
                            ? "bl-red"
                            : "bl-amber"
                        }
                      >
                        {f.flag_type}
                      </td>
                      <td className="bl-small">{f.flag_rule_text}</td>
                      <td className="bl-small">{f.computed_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="bl-p bl-small bl-dim">
                0 flags triggered. Flags fire only on disclosed arithmetic
                relationships (see METHODOLOGY); with no company-registry
                data ingested yet, the incorporation and turnover rules have
                nothing to compute against. An empty flag list is the honest
                result, not a missing feature.
              </p>
            )}
          </div>
        </section>

        <section
          className="bl-panel"
          style={{ marginTop: 16 }}
          aria-label="Provenance"
        >
          <div className="bl-panel-head">
            <span>DATA PROVENANCE</span>
            <span className="bl-dim">
              LEDGER: {ledger ? `${ledger.length} BATCH(ES)` : "—"}
            </span>
          </div>
          <div className="bl-panel-body" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="bl-empty">LOADING LEDGER…</div>
            ) : ledger && ledger.length > 0 ? (
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>BATCH</th>
                    <th>SOURCE</th>
                    <th>RETRIEVED</th>
                    <th>SHA-256</th>
                    <th>ROWS</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((b) => (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td className="bl-small">
                        <a
                          href={b.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {b.source_name}
                        </a>
                      </td>
                      <td className="bl-small bl-dim">
                        {new Date(b.retrieved_at).toISOString().slice(0, 10)}
                      </td>
                      <td
                        className="bl-small bl-dim"
                        title={b.sha256}
                      >
                        {shortHash(b.sha256)}
                      </td>
                      <td>{b.row_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="bl-p bl-small bl-dim">
                No ingestion batches recorded. Each batch will log its exact
                source file/URL, retrieval date, SHA-256 hash, and row count
                in the public ingestion ledger before any record is displayed.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="bl-footer">
        BONDED-LEADER · built on public disclosures ordered by the Supreme
        Court of India (WPC No. 880/2017, orders dated 15.02.2024 and
        11.03.2024) · data: SBI via ECI, compiled by ADR/MyNeta · company
        data: MCA21 public filings ·{" "}
        <Link href="/methodology">METHODOLOGY</Link>
      </footer>
    </>
  );
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "#000",
    color: "#fff",
    border: "1px solid #fff",
    borderRadius: 0,
    padding: "4px 10px",
    fontFamily: "inherit",
    fontSize: 11,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  };
}
