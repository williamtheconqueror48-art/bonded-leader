import Link from "next/link";
import {
  RULE_INCORPORATION_TIMING_12M,
  RULE_TURNOVER_RATIO_50,
  RULE_STRICT_COMBINED_6M,
} from "@/lib/anomaly";
import { ALL_SOURCES } from "@/lib/sources";
import LedgerBatches from "./batches";

/**
 * BONDED-LEADER /methodology — plain-language statement of what this tool
 * does, what its flags mean, and what they do NOT mean.
 */

export default function Methodology() {
  return (
    <>
      <header className="bl-header">
        <div>
          <div className="bl-wordmark">BONDED-LEADER</div>
          <div className="bl-tagline">METHODOLOGY &amp; DATA PROVENANCE</div>
        </div>
        <nav className="bl-nav">
          <Link href="/">GRAPH</Link>
          <Link href="/">TABLE</Link>
          <Link href="/methodology">METHODOLOGY</Link>
        </nav>
      </header>

      <main className="bl-main bl-method">
        <h2>1. WHAT THIS TOOL IS</h2>
        <p className="bl-p">
          BONDED-LEADER presents, in structured and explorable form,
          information about political donations made through India&apos;s
          Electoral Bonds scheme that has already been placed in the public
          domain. It adds no new claims about any company or party; it
          organizes disclosed records and performs disclosed arithmetic on
          them.
        </p>

        <h2>2. DATA SOURCES</h2>
        <p className="bl-p">
          In February 2024 the Supreme Court of India struck down the
          Electoral Bonds Scheme and ordered full disclosure of donor,
          party, and amount data. The State Bank of India submitted the data
          to the Election Commission of India (ECI), which published it. The
          Association for Democratic Reforms (ADR) and MyNeta compiled the
          released data as an open civic resource intended for public
          scrutiny. Company incorporation dates and addresses come from
          public MCA21 filings.
        </p>
        <table className="bl-table">
          <thead>
            <tr>
              <th>SOURCE</th>
              <th>URL</th>
              <th>ROLE</th>
            </tr>
          </thead>
          <tbody>
            {ALL_SOURCES.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="bl-small">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                </td>
                <td className="bl-small bl-dim">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="bl-p bl-small bl-dim" style={{ marginTop: 12 }}>
          Every ingestion batch records its exact source file/URL, retrieval
          date, SHA-256 hash, and row count in the public ingestion ledger.
          Every donation record displayed links to its ledger entry. If a
          field is missing for an entity, the interface shows{" "}
          <strong>NOT AVAILABLE IN SOURCE DATA</strong> — never a blank,
          guessed, or interpolated value.
        </p>

        <h2>3. ENTITY RESOLUTION (DONOR-NAME MERGING)</h2>
        <p className="bl-p">
          The same company may appear under variant spellings across
          datasets (e.g. &ldquo;ABC Pvt Ltd&rdquo; vs &ldquo;ABC Private
          Limited&rdquo;, or OCR-mangled variants from scanned disclosure
          PDFs). Names are merged into one canonical node only when their
          Jaro-Winkler similarity score is <strong>&ge; 0.90</strong>. Every
          merge is logged with its exact similarity score, visible on
          hover/click in the interface. No merge happens silently.
        </p>

        <h2>4. ANOMALY FLAGS — MECHANICAL RULES ONLY</h2>
        <p className="bl-p">
          Flags are triggered by fixed arithmetic thresholds defined below.
          A flag states that two disclosed values stand in a stated numerical
          relationship. The interface always shows the flag together with
          the exact rule text and the computed value that triggered it.
        </p>

        <div className="bl-rule-text">
          <span className="bl-label">AMBER FLAG</span>
          {RULE_INCORPORATION_TIMING_12M}
        </div>
        <div className="bl-rule-text">
          <span className="bl-label">AMBER FLAG</span>
          {RULE_TURNOVER_RATIO_50}
        </div>
        <div className="bl-rule-text red">
          <span className="bl-label">RED FLAG — STRICTEST COMBINATION ONLY</span>
          {RULE_STRICT_COMBINED_6M}
        </div>

        <h2>5. WHAT THE FLAGS DO NOT MEAN</h2>
        <p className="bl-p">
          A flag is <strong>not</strong> an allegation of wrongdoing,
          corruption, or improper intent against any donor company or
          political party. It does <strong>not</strong> imply that a donation
          was unlawful, that a company is a shell entity, or that any
          quid pro quo occurred. It indicates only the disclosed,
          verifiable facts stated in the rule text — for example, that a
          company&apos;s incorporation date precedes its first recorded bond
          purchase by N months, per public MCA21 and ADR/ECI records. Any
          interpretation beyond the stated facts is the reader&apos;s own and
          is not asserted by this tool.
        </p>

        <h2>6. LIMITATIONS</h2>
        <p className="bl-p">
          This tool is only as complete as its cited sources. Records missing
          from the source files are missing here. Company turnover figures
          depend on the availability of public MCA21 filings; where none is
          found, the turnover-ratio checks report NOT AVAILABLE IN SOURCE
          DATA rather than estimating. Name-merging is probabilistic and its
          scores are shown so readers can judge each merge themselves.
        </p>

        <h2>7. INGESTED BATCHES — LIVE LEDGER</h2>
        <p className="bl-p">
          Batch #1 (the first sealed ingestion): <strong>ADR Part 3 —
          Donor-wise Electoral Bonds details</strong>, corporate and
          individual donors, coverage 12 April 2019 to 15 February 2024 —
          50 rows (25 corporate, 25 individual), compiled by ADR from
          Election Commission of India data as of 14 March 2024.
        </p>
        <p className="bl-p">
          <strong>What NULL fields mean.</strong> This source publishes
          per-donor aggregate totals. It does not print per-bond dates and
          does not link donors to recipient parties, so{" "}
          <strong>party_name</strong> and <strong>bond_date</strong> are NULL
          for all 50 rows and display as NOT AVAILABLE IN SOURCE DATA. The
          graph therefore shows donor nodes with zero edges: an edge is
          drawn only where a source records real donor→party linkage. No
          MCA21 company-registry rows have been verified yet, so the
          incorporation and turnover flags have nothing to compute against
          and 0 flags are triggered — that empty result is reported
          honestly, not hidden.
        </p>
        <LedgerBatches />
      </main>

      <footer className="bl-footer">
        BONDED-LEADER · <Link href="/">BACK TO HOME</Link>
      </footer>
    </>
  );
}
