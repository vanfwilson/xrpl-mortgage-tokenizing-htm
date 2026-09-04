-- htm_mortgages: closing package + servicing + XRPL ledger references.
-- Sits beside htm_mortgages.loan_applications (the website URLA intake form).
-- Tenant scoping: company_id uuid = public.companies.company_id (High Tech Mortgage = 85020860-28c1-4b05-ac38-8ede57a7e797).
-- Source of truth: this schema is the system of record for DOCUMENTS and servicing ledger;
-- the XRPL ledger is authoritative for TOKEN / VAULT / LOAN state. xrpl_* tables are mirrors for reconciliation.

create schema if not exists htm_mortgages;
set search_path = htm_mortgages, public;

create table if not exists loans (
  loan_id            uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(company_id),
  application_id     uuid references htm_mortgages.loan_applications(id),
  loan_number        text not null,                       -- lender loan identifier (MORT-2026-88492X)
  loan_type          text not null check (loan_type in ('FHA','Conventional','VA','USDA')),
  agency_case_number text,                                -- FHA case no. 3-7-3 digits
  product            text not null,                       -- 30-Year Fixed Rate
  purpose            text not null default 'Purchase',
  note_form          text,                                -- Fannie Mae/Freddie Mac Form 3200
  base_loan_amount   numeric(14,2) not null,
  financed_ufmip     numeric(14,2) not null default 0,
  note_amount        numeric(14,2) not null,              -- base + financed UFMIP
  interest_rate      numeric(7,5) not null,               -- 0.06250
  term_months        int not null,
  amortization_type  text not null default 'Fixed',
  monthly_pi         numeric(12,2) not null,
  first_payment_date date not null,
  maturity_date      date not null,
  closing_date       date,
  disbursement_date  date,
  status             text not null default 'closed' check (status in ('application','approved','closed','servicing','paid_off','defaulted')),
  synthetic          boolean not null default true,       -- dummy/test data flag; never false without real-data controls
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, loan_number),
  check (note_amount = base_loan_amount + financed_ufmip)
);
create index if not exists idx_loans_company on loans(company_id, created_at desc);

create table if not exists parties (
  party_id    uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(company_id),
  loan_id     uuid not null references loans(loan_id) on delete cascade,
  role        text not null check (role in ('borrower','coborrower','seller','lender','servicer','settlement_agent','trustee','loan_originator','kyc_issuer','investor')),
  name        text not null,
  nmls_id     text,
  license_id  text,
  email       text,
  phone       text,
  mailing_address text,
  xrpl_address text,                                       -- Devnet classic address if the party has a ledger identity
  details     jsonb not null default '{}'::jsonb
);
create index if not exists idx_parties_loan on parties(loan_id, role);

create table if not exists properties (
  property_id       uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(company_id),
  loan_id           uuid not null references loans(loan_id) on delete cascade,
  street            text not null, city text not null, state char(2) not null, zip text not null, county text,
  apn               text,
  legal_description text,
  units             int not null default 1,
  occupancy         text not null default 'PrimaryResidence',
  contract_sales_price numeric(14,2),
  appraised_value   numeric(14,2),
  ltv               numeric(7,4)
);

-- One row per closing document. `sections` holds the document as structured JSON
-- (URLA sections 1-9, CD pages 1-5, ALTA line items, deed recording block...).
-- `content_sha256` is the hash of the canonical document JSON; the bundle hash of all docs
-- for a loan is what goes into the MPT XLS-89 metadata (see xrpl_objects.docs_sha256).
create table if not exists loan_documents (
  document_id     uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(company_id),
  loan_id         uuid not null references loans(loan_id) on delete cascade,
  doc_type        text not null check (doc_type in ('URLA_1003','CLOSING_DISCLOSURE','ALTA_SETTLEMENT','FHA_AMENDATORY_CLAUSE','DEED_OF_TRUST','WARRANTY_DEED','PROMISSORY_NOTE','SERVICING_STATEMENT','OTHER')),
  form_reference  text,                                  -- "Fannie Mae 1003 / Freddie Mac 65 (09/2020)", "CFPB H-25", "ALTA Borrower/Buyer"
  sort_order      int not null default 0,
  sections        jsonb not null,
  content_sha256  char(64) not null,
  filled_pdf_key  text,                                  -- storage key of the filled printable PDF
  scanned_pdf_key text,                                  -- storage key of the scanned-back PDF
  ocr_text        text,                                  -- raw OCR of the scan
  ocr_extracted   jsonb,                                 -- fields extracted from OCR
  ocr_match       jsonb,                                 -- per-field compare vs sections (true/false/delta)
  recorded_document_number text,                         -- county recording no. (deeds)
  recorded_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (loan_id, doc_type)
);
create index if not exists idx_docs_loan on loan_documents(loan_id, sort_order);

-- ALTA / HUD-1 style ledger lines (double entry per side).
create table if not exists settlement_lines (
  line_id     uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(company_id),
  loan_id     uuid not null references loans(loan_id) on delete cascade,
  side        text not null check (side in ('borrower','seller')),
  entry       text not null check (entry in ('debit','credit')),
  code        text,                                       -- 101, 202, 801 ...
  description text not null,
  amount      numeric(14,2) not null,
  informational boolean not null default false           -- e.g. UFMIP financed, shown not settled
);
create index if not exists idx_settlement_loan on settlement_lines(loan_id);

-- Monthly housing obligation as disclosed (PITI + non-impounded items).
create table if not exists recurring_obligations (
  obligation_id uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(company_id),
  loan_id       uuid not null references loans(loan_id) on delete cascade,
  kind          text not null check (kind in ('principal_interest','mortgage_insurance','property_tax','homeowners_insurance','hoa','credit_life','other')),
  monthly_amount numeric(12,2) not null,
  impounded     boolean not null default true,
  note          text
);

-- Servicing: what the homeowner owes/pays each period, and what the servicer remits on-ledger.
create table if not exists servicing_payments (
  payment_id     uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  period_no      int not null,
  due_date       date not null,
  amount_due     numeric(12,2) not null,
  principal_part numeric(12,2), interest_part numeric(12,2), escrow_part numeric(12,2), fees_part numeric(12,2) default 0,
  received_at    timestamptz,
  amount_received numeric(12,2),
  status         text not null default 'scheduled' check (status in ('scheduled','received','late','missed','remitted')),
  source_doc_id  uuid references loan_documents(document_id),   -- scanned servicing statement that evidenced it
  ledger_tx_hash text,                                           -- LoanPay hash once remitted
  unique (loan_id, period_no)
);

-- Ledger mirrors --------------------------------------------------------------
create table if not exists xrpl_objects (
  object_id     uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(company_id),
  loan_id       uuid not null references loans(loan_id) on delete cascade,
  network       text not null default 'devnet' check (network in ('devnet','testnet','mainnet')),
  kind          text not null check (kind in ('mpt_issuance','permissioned_domain','vault','vault_share_mpt','loan_broker','loan','escrow','credential')),
  ledger_id     text not null,                            -- MPTokenIssuanceID / VaultID / LoanBrokerID / LoanID / DomainID
  owner_address text,
  docs_sha256   char(64),                                 -- bundle hash bound into the object (MPT metadata / Data)
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (network, kind, ledger_id)
);
create index if not exists idx_xrpl_objects_loan on xrpl_objects(loan_id, kind);

create table if not exists xrpl_transactions (
  tx_hash       text primary key,
  company_id    uuid not null references public.companies(company_id),
  loan_id       uuid references loans(loan_id) on delete set null,
  network       text not null default 'devnet',
  step          text not null,                            -- credentials | mpt | vault | lending | escrow | servicing
  tx_type       text not null,
  account       text not null,
  result        text not null,
  ledger_index  bigint,
  explorer_url  text,
  memo          jsonb,
  submitted_at  timestamptz not null default now()
);
create index if not exists idx_xrpl_tx_loan on xrpl_transactions(loan_id, submitted_at);

-- Grants matching the sibling table (pg-api login + read replicas).
grant usage on schema htm_mortgages to cf_pg_api_login, cf_appsmith_read, cf_nocodb_read;
grant select, insert, update, delete on all tables in schema htm_mortgages to cf_pg_api_login;
grant select on all tables in schema htm_mortgages to cf_appsmith_read, cf_nocodb_read;
alter default privileges in schema htm_mortgages grant select, insert, update, delete on tables to cf_pg_api_login;
alter default privileges in schema htm_mortgages grant select on tables to cf_appsmith_read, cf_nocodb_read;
