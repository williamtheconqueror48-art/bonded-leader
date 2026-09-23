import Link from "next/link";

/**
 * BONDED-LEADER home.
 * Placeholders only — no demo data, no synthetic donors, no fabricated
 * amounts. Empty states are explicit: "NO DATA INGESTED YET".
 */

const NO_DATA = "NO DATA INGESTED YET — awaiting real ADR/ECI source file";

export default function Home() {
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
          <Link href="/">TABLE</Link>
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

        <div className="bl-grid-2" style={{ marginTop: 24 }}>
          <section className="bl-panel" aria-label="Graph view">
            <div className="bl-panel-head">
              <span>GRAPH VIEW</span>
              <span className="bl-dim">NODES: 0 / EDGES: 0</span>
            </div>
            <div className="bl-panel-body">
              <div className="bl-empty">{NO_DATA}</div>
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
              <span className="bl-dim">SEARCH: OFFLINE UNTIL INGEST</span>
            </div>
            <div className="bl-panel-body">
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
                  <tr>
                    <td colSpan={5} className="bl-dim" style={{ textAlign: "center" }}>
                      {NO_DATA}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="bl-small bl-dim" style={{ marginTop: 12 }}>
                Journalist queries (&ldquo;every donation to Party X&rdquo;,
                &ldquo;every donation from Company Y&rdquo;) activate after the
                first real ingestion batch is sealed in the ledger.
              </p>
            </div>
          </section>
        </div>

        <section className="bl-panel" style={{ marginTop: 16 }} aria-label="Provenance">
          <div className="bl-panel-head">
            <span>DATA PROVENANCE</span>
            <span className="bl-dim">LEDGER: EMPTY</span>
          </div>
          <div className="bl-panel-body" style={{ minHeight: 0 }}>
            <p className="bl-p bl-small bl-dim">
              No ingestion batches recorded. Each batch will log its exact
              source file/URL, retrieval date, SHA-256 hash, and row count in
              the public ingestion ledger before any record is displayed.
            </p>
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
