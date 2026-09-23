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
          <Link href="/corporate">CORPORATE</Link>
          <Link href="/donor-party">DONOR→PARTY</Link>
          <Link href="/benefits">BENEFITS</Link>
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

        <h2>8. BOND-LEVEL BATCHES (2–4) — JOIN METHODOLOGY</h2>
        <p className="bl-p">
          Batch #2: <strong>SBI purchase list (bond buyer)</strong> — 18,871
          rows, one per bond: purchaser name, prefix, bond number,
          denomination, purchase/expiry dates, issue branch. Batch #3:{" "}
          <strong>SBI redemption list (bond user)</strong> — 20,421 rows, one
          per encashment: political party, prefix, bond number, denomination,
          encashment date, pay branch. Both are community mirrors of the
          ECI-published SBI 21 March 2024 dump (eci.gov.in blocks this
          project&apos;s network; the official files could not be fetched
          directly — see the provenance sidecars in data/raw/). Batch #4 is
          the derived join: <strong>18,741 donation rows</strong> with real
          donor→party→amount→date linkage.
        </p>
        <p className="bl-p">
          <strong>Join rule (mechanical).</strong> Inner join on the composite
          key (prefix, bond number). The prefix encodes the denomination
          series — OC = ₹1,00,00,000; TL = ₹10,00,000; TT = ₹10,000; OL =
          ₹1,00,000; OT = ₹1,000 — so a bare bond number is not unique across
          prefixes and is never joined alone. Result:{" "}
          <strong>18,741 matched</strong>; 130 purchase-only rows (every one
          carries Status = Expired, i.e. purchased but never encashed);
          1,680 redemption-only rows (no purchase record for that
          prefix+bond number in the purchase file, concentrated in the April
          2019 first tranche — including all 38 redemptions crediting ALL
          INDIA ANNA DRAVIDA MUNNETRA KAZHAGAM). 815 redemption-only rows
          share a bond number with a purchase row under a <em>different</em>{" "}
          prefix, but in zero of those cases does the denomination also
          match — they are mechanically distinct bonds and are correctly left
          unmatched. Denomination mismatches inside the join: 0.
        </p>
        <p className="bl-p">
          <strong>Totals cross-check.</strong> Purchase file: ₹12,155.5132
          crore. Redemption file: ₹12,769.0893 crore, matching the
          independently corroborated encashment total of ₹12,769.09 crore.
          Joined rows: ₹12,145.8783 crore (the difference to the purchase
          total is the 130 expired bonds).
        </p>
        <p className="bl-p">
          <strong>No double counting.</strong> Batch #1 (50 donor-aggregate
          rows) and batch #4 (18,741 bond-level rows) overlap in coverage —
          the same donor&apos;s bonds appear in both. Never sum amounts
          across batches. Batch #1 rows are per-donor aggregates with no
          party linkage; batch #4 rows are individual bonds with party
          linkage. They are stored under separate ledger ids and the
          interface keeps them distinguishable.
        </p>
        <p className="bl-p">
          <strong>Entity-resolution review.</strong> The Jaro-Winkler merge
          (≥ 0.90, blocking on the first 4 alphanumeric characters, 822
          within-block comparisons over 1,297 distinct purchaser names)
          produced 103 merged components covering 6,434 rows. On manual
          review, 26 of those components were flagged as potentially
          conflating distinct entities — different companies sharing a name
          stem (e.g. BHARTI AIRTEL LIMITED vs BHARTI INFRATEL LIMITED;
          WELSPUN INDIA LIMITED vs WELSPUN LIVING LIMITED; MANKIND PHARMA
          LIMITED vs MANKIND TRACOM PRIVATE LIMITED), different individuals
          sharing a first name, and individual-vs-HUF pairs. On 2026-09-23
          those 26 components (58 names, 724 rows, ₹314.08 crore) were
          unmerged: their donor_name_canonical was reset to NULL so the
          interface shows the verbatim raw names and attributes nothing
          across distinct legal entities. The remaining 77 components stay
          merged. Every pairwise decision with its exact score, the review
          flags, and the correction record are published in
          data/merge_decisions_sbi.json.
        </p>

        <h2>9. CORPORATE 99% SET — DERIVATION</h2>
        <p className="bl-p">
          The <Link href="/corporate">CORPORATE</Link> view answers a
          prioritisation question: which purchasers account for 99% of
          corporate bond value, so that company-registry work can start where
          the money is? The derivation is mechanical and published as
          data/corporate_99pct.csv with a .provenance.json sidecar:
        </p>
        <p className="bl-p">
          <strong>Step 1 — group.</strong> All 18,871 SBI purchase rows are
          grouped by verbatim purchaser_name (no Jaro-Winkler merging, so
          spelling variants of one company are listed separately and nothing
          is attributed across names).
        </p>
        <p className="bl-p">
          <strong>Step 2 — corporate flag (disclosed heuristic).</strong> A
          purchaser counts as corporate if its uppercased name, with
          non-letters stripped, contains any of LTD, LIMITED, PVT, PRIVATE,
          LLP, LLC — or contains as a whole word any of COMPANY,
          CORPORATION, ENTERPRISES, TRUST, HOSPITAL, LABORATORIES,
          INFRASTRUCTURE(S), INFRATECH, ENERGY, POWER, STEEL, CEMENT,
          CONSTRUCTION, TRADING, SERVICES, SOLUTIONS, INDUSTRIES, MINING,
          PHARMA, HOTEL, GAMING, ENGINEERING, FOODS, FOODPARK, DEVELOPERS,
          TECHNOLOGY, CHEMICALS, TEXTILES — or ends in a truncated
          &ldquo; PR&rdquo; (e.g. FUTURE GAMING AND HOTEL SERVICES PR). Result:
          851 corporate purchasers, Rs 11,456.42 cr (94.2% of the Rs
          12,155.51 cr purchased).
        </p>
        <p className="bl-p">
          <strong>Step 3 — cumulative cut.</strong> Corporate purchasers are
          sorted by total amount descending; the cumulative sum is cut the
          moment it reaches 99% of the corporate total. Result:{" "}
          <strong>618 purchasers</strong> covering Rs 11,341.89 cr. For
          reference: the top 50 cover 62.7%, top 100 cover 74.2%, top 200
          cover 85.7%.
        </p>
        <p className="bl-p">
          <strong>Limitations.</strong> The corporate flag is a heuristic;
          borderline names may be misclassified in either direction, and the
          rule hit is shown per row so it can be audited. The 130 expired
          (never-encashed) purchase bonds are included in these purchase-side
          totals; the linked donation totals in /donor-party exclude them.
        </p>

        <h2>10. DONOR→PARTY MAPPING</h2>
        <p className="bl-p">
          The <Link href="/donor-party">DONOR→PARTY</Link> view aggregates the
          batch-4 join (section 8) to one row per (purchaser, party) pair:
          total rupees and bond count the party encashed from that purchaser.
          Restricted to the 618 corporate purchasers of the 99% set (887
          pairs; 616 of the 618 donors have at least one linked encashment
          row — 2 donors&apos; purchases were all expired). The full
          18,741-row bond-level join remains in data/joined_bonds.csv. This
          mapping records encashment as published; it asserts no motive.
        </p>

        <h2>11. BENEFIT-SIDE DATA — WHAT IT IS AND IS NOT</h2>
        <p className="bl-p">
          The <Link href="/benefits">BENEFITS</Link> view places three kinds
          of independent public records next to the donation data for the top
          corporate donors: (a) published company financials
          (revenue/profit by financial year), (b) government tender and
          contract awards, (c) regulatory approvals and licenses. Every
          figure carries its source URL; anything not found in a searched
          public source is marked NOT AVAILABLE IN SOURCE DATA.
        </p>
        <p className="bl-p">
          <strong>What this does not mean.</strong> A donation dated 2022 and
          a contract dated 2023 are two facts with two sources. This tool
          draws no arrow between them — not donation→benefit, not
          benefit→donation. Co-occurrence on one page is juxtaposition for
          the reader&apos;s own research, not a finding.
        </p>
      </main>

      <footer className="bl-footer">
        BONDED-LEADER · <Link href="/">BACK TO HOME</Link>
      </footer>
    </>
  );
}
