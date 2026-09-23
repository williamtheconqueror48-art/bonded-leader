-- ============================================================================
-- BONDED-LEADER — Neon (serverless Postgres) schema
-- ============================================================================
-- Provenance note: this schema exists to store ONLY real, cited public data.
-- Every row in `donations` and `company_registry` must reference a row in
-- `ingestion_ledger` identifying the exact source file/URL and retrieval date.
-- No demo, placeholder, or synthetic donor/party/amount values are permitted
-- anywhere in this database, including in tests or fixtures.
-- ============================================================================

CREATE TABLE ingestion_ledger (
  id SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,          -- e.g. 'ADR_electoral_bonds_2024'
  source_url TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  sha256 TEXT NOT NULL,               -- hash of the raw ingested file
  row_count INTEGER NOT NULL
);

CREATE TABLE donations (
  id SERIAL PRIMARY KEY,
  donor_name_raw TEXT NOT NULL,       -- exact string from source
  donor_name_canonical TEXT,          -- Jaro-Winkler-resolved canonical form
  party_name TEXT NOT NULL,
  amount_inr NUMERIC NOT NULL,
  bond_date DATE,
  source_ledger_id INTEGER REFERENCES ingestion_ledger(id)
);

CREATE TABLE company_registry (
  id SERIAL PRIMARY KEY,
  company_name_raw TEXT NOT NULL,
  company_name_canonical TEXT,
  incorporation_date DATE,
  registered_address TEXT,
  source_ledger_id INTEGER REFERENCES ingestion_ledger(id)
);

CREATE TABLE anomaly_flags (
  id SERIAL PRIMARY KEY,
  donation_id INTEGER REFERENCES donations(id),
  flag_type TEXT NOT NULL,            -- e.g. 'incorporation_timing', 'turnover_ratio'
  flag_rule_text TEXT NOT NULL,       -- exact human-readable rule that fired
  computed_value TEXT NOT NULL        -- the actual number/date that triggered it
);

-- Helpful indexes for the table/graph views (no behavioural change).
CREATE INDEX IF NOT EXISTS idx_donations_party ON donations (party_name);
CREATE INDEX IF NOT EXISTS idx_donations_donor_canonical ON donations (donor_name_canonical);
CREATE INDEX IF NOT EXISTS idx_donations_ledger ON donations (source_ledger_id);
CREATE INDEX IF NOT EXISTS idx_company_registry_canonical ON company_registry (company_name_canonical);
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_donation ON anomaly_flags (donation_id);
