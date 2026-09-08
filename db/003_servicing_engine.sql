-- Servicing engine (Phase C). Bank custodial balances are legally authoritative; these tables are the
-- servicer's subledger, decision records and reconciliation proof. Every row carries company_id + loan_id.
set search_path = htm_mortgages, public;

alter table loans
  add column if not exists legal_owner_id        text,              -- funding bank that owns the note (R31: the only owner field)
  add column if not exists servicer_of_record_id text,              -- bank-owned licensed subservicer
  add column if not exists property_state        char(2),
  add column if not exists credit_purpose        text not null default 'consumer' check (credit_purpose = 'consumer');

-- Operative-document chain (S2): the NFToken URI points at one of these rows by hash.
create table if not exists loan_document_versions (
  version_id     uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  version        int not null,
  bundle_sha256  char(64) not null,
  pointer        text not null,                 -- content-addressed off-ledger location
  effective_from date not null,
  effective_to   date,
  nftoken_id     text,
  unique (loan_id, version)
);

-- Integer-cent subledger. Purposes are servicing purposes only (R01); 'closing_escrow' is not a value.
create table if not exists subledger_entries (
  entry_id       uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  account        text not null check (account in ('collection','suspense','note_holder','tax','hazard','mip','fees','advance','refund','loss_draft')),
  cents          bigint not null,
  leg            text not null,
  period_no      int,
  effective_date date not null,                 -- R16: date of receipt for borrower payments
  bank_ref       text,
  ledger_hash    text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_subledger_loan on subledger_entries(loan_id, effective_date);

alter table impound_accounts drop constraint if exists impound_accounts_kind_check;
alter table impound_accounts add constraint impound_accounts_kind_check check (kind in ('tax','hazard','mip','loss_draft'));

-- Verified bills (never forecasts) that may create a ledger escrow (S7).
create table if not exists escrow_bills (
  bill_id        uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  purpose        text not null check (purpose in ('tax','hazard')),
  payee_id       text not null,
  cents          bigint not null check (cents > 0),
  due_date       date not null,
  verified       boolean not null default false,
  source_ref     text,
  decision       text check (decision in ('escrow','advance_then_escrow','advance_optional','forecast_only','refuse')),
  escrow_object_id text,
  escrow_create_hash text,
  escrow_finish_hash text,
  escrow_cancel_hash text,
  finish_after   timestamptz,
  cancel_after   timestamptz,
  payee_receipt_confirmed_at timestamptz,        -- EscrowFinish is not proof of receipt
  unique (loan_id, purpose, due_date)
);

create table if not exists servicer_advances (
  advance_id     uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  bill_id        uuid references escrow_bills(bill_id),
  cents          bigint not null,
  advanced_on    date not null,
  recovery_option text check (recovery_option in ('do_nothing','repay_30_days','equal_monthly_payments')),
  recovery_months int,
  recovered_cents bigint not null default 0
);

-- 12 CFR 1024.17 decision record, immutable per computation year (R02-R09, R23).
create table if not exists escrow_analyses (
  analysis_id    uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  computation_year_start date not null,
  computation_year_end   date not null,
  analysis       jsonb not null,               -- full EscrowAnalysis
  classification text not null check (classification in ('balanced','surplus','shortage','deficiency')),
  chosen_shortage_months int,
  chosen_deficiency_months int,
  new_monthly_escrow_cents bigint not null,
  california_interest_cents bigint not null default 0,
  approved_by    text,
  approved_at    timestamptz,
  unique (loan_id, computation_year_start)
);

create table if not exists statements (
  statement_id   uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  kind           text not null check (kind in ('initial_escrow_statement','annual_escrow_statement','periodic_statement')),
  period_no      int,
  due_by         date,
  delivered_on   date,
  content        jsonb not null,
  pdf_key        text
);

create table if not exists tax_forms (
  form_id        uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  tax_year       int not null,
  form           text not null check (form in ('1098','1099-INT','1099-A','1099-C')),
  required       boolean not null,
  content        jsonb not null,
  furnished_on   date,
  filed_on       date,
  irs_status     text,
  unique (loan_id, tax_year, form)
);

create table if not exists servicing_cases (
  case_id        uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  kind           text not null check (kind in ('notice_of_error','information_request','force_placed','servicing_transfer','ownership_transfer','delinquency','loss_mitigation')),
  opened_on      date not null,
  clocks         jsonb not null,
  state          text not null,
  closed_on      date
);

create table if not exists reconciliation_events (
  event_id       uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(company_id),
  loan_id        uuid not null references loans(loan_id) on delete cascade,
  at             timestamptz not null,
  result         jsonb not null,
  prev_hash      char(64) not null,
  hash           char(64) not null unique
);

grant select, insert, update, delete on loan_document_versions, subledger_entries, escrow_bills, servicer_advances, escrow_analyses, statements, tax_forms, servicing_cases, reconciliation_events to cf_pg_api_login;
grant select on loan_document_versions, subledger_entries, escrow_bills, servicer_advances, escrow_analyses, statements, tax_forms, servicing_cases, reconciliation_events to cf_appsmith_read, cf_nocodb_read;
