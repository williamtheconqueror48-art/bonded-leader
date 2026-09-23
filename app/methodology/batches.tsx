"use client";

/**
 * Live ingestion-ledger batches for the methodology page.
 * Reads /api/ledger at runtime; falls back to an honest empty state.
 */

import { useEffect, useState } from "react";

interface LedgerBatch {
  id: number;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  sha256: string;
  row_count: number;
}

export default function LedgerBatches() {
  const [batches, setBatches] = useState<LedgerBatch[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/ledger")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setBatches(d.batches))
      .catch(() => setError(true));
  }, []);

  if (error || (batches && batches.length === 0)) {
    return (
      <p className="bl-p bl-small bl-dim">
        Ledger unavailable or empty at this moment. Each batch below is
        sealed before its rows are displayed anywhere on this site.
      </p>
    );
  }

  if (!batches) return <div className="bl-empty">LOADING LEDGER…</div>;

  return (
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
        {batches.map((b) => (
          <tr key={b.id}>
            <td>#{b.id}</td>
            <td className="bl-small">
              <a href={b.source_url} target="_blank" rel="noreferrer">
                {b.source_name}
              </a>
            </td>
            <td className="bl-small bl-dim">
              {new Date(b.retrieved_at).toISOString().slice(0, 10)}
            </td>
            <td className="bl-small bl-dim" title={b.sha256}>
              {b.sha256.slice(0, 12)}…
            </td>
            <td>{b.row_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
