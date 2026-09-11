-- MortgageOS v3 mirror schema inside the councilforge database. Postgres is authoritative; the ledger is evidence.
CREATE SCHEMA IF NOT EXISTS mortgageos;

CREATE TABLE IF NOT EXISTS mortgageos.loans (
  loan_id            text PRIMARY KEY,
  company_id         text NOT NULL,
  network            text NOT NULL DEFAULT 'testnet',
  principal_cents    bigint NOT NULL CHECK (principal_cents > 0),
  rate_bps           integer NOT NULL CHECK (rate_bps >= 0),
  term_months        integer NOT NULL CHECK (term_months > 0),
  outstanding_cents  bigint NOT NULL,
  annual_tax_cents   bigint NOT NULL DEFAULT 0,
  annual_ins_cents   bigint NOT NULL DEFAULT 0,
  issuer_account     text,
  holder_account     text,
  impound_account    text,
  borrower_account   text,
  amortization       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'boarding',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mortgageos.mpt_issuances (
  issuance_id     text PRIMARY KEY,
  loan_id         text REFERENCES mortgageos.loans(loan_id),
  purpose         text NOT NULL CHECK (purpose IN ('record_of_account','settlement')),
  issuer          text NOT NULL,
  holder          text,
  asset_scale     integer NOT NULL,
  flags           integer NOT NULL,
  max_units       bigint NOT NULL,
  metadata_hex    text,
  metadata_json   jsonb,
  manifest_sha256 text,
  cid             text,
  create_tx_hash  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mortgageos.ledger_transactions (
  tx_hash       text PRIMARY KEY,
  loan_id       text,
  tx_type       text NOT NULL,
  account       text NOT NULL,
  sequence      bigint,
  state         text NOT NULL CHECK (state IN ('Pending','Submitted','Confirmed','Failed')),
  result_code   text,
  ledger_index  bigint,
  memo          jsonb,
  envelope      jsonb NOT NULL,
  meta          jsonb,
  detail        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_transactions_loan_idx ON mortgageos.ledger_transactions (loan_id, created_at);

CREATE TABLE IF NOT EXISTS mortgageos.audit_log (
  id          bigserial PRIMARY KEY,
  loan_id     text,
  phase       text NOT NULL,
  error_code  text NOT NULL,
  error_text  text NOT NULL,
  envelope    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mortgageos.payment_schedule (
  loan_id          text NOT NULL REFERENCES mortgageos.loans(loan_id),
  period           integer NOT NULL,
  due_date         date NOT NULL,
  pi_cents         bigint NOT NULL,
  principal_cents  bigint NOT NULL,
  interest_cents   bigint NOT NULL,
  tax_cents        bigint NOT NULL,
  ins_cents        bigint NOT NULL,
  status           text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Escrowed','Settled','Late','Failed')),
  PRIMARY KEY (loan_id, period)
);

CREATE TABLE IF NOT EXISTS mortgageos.escrow_legs (
  id              bigserial PRIMARY KEY,
  loan_id         text NOT NULL REFERENCES mortgageos.loans(loan_id),
  period          integer NOT NULL,
  leg             text NOT NULL CHECK (leg IN ('pi','impound')),
  owner_account   text NOT NULL,
  dest_account    text NOT NULL,
  issuance_id     text NOT NULL,
  units           bigint NOT NULL,
  finish_after    bigint NOT NULL,
  cancel_after    bigint NOT NULL,
  create_tx_hash  text,
  offer_sequence  bigint,
  finish_tx_hash  text,
  status          text NOT NULL DEFAULT 'Created' CHECK (status IN ('Created','Settled','Cancelled','Failed')),
  memo            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
