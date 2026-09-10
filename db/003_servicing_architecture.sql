-- Phase C servicing-only schema. R01-R31 data structures.
set search_path = htm_mortgages, public;

alter table loans add column if not exists legal_owner_id text;
alter table loans add column if not exists servicer_of_record_id text;
alter table loans add column if not exists credit_purpose text not null default 'consumer' check (credit_purpose = 'consumer');
create unique index if not exists uq_loans_company_loan on loans(company_id, loan_id);

create table if not exists loan_document_versions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  version int not null, bundle_sha256 char(64) not null, content_pointer text not null,
  effective_at timestamptz not null, superseded_at timestamptz,
  foreign key (company_id, loan_id) references loans(company_id, loan_id), unique(company_id, loan_id, version)
);

create table if not exists servicing_accounts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  purpose text not null check (purpose in ('collection','note_holder','tax','hazard','mip','advance','refund','loss_draft')),
  bank_account_ref text, xrpl_address text, balance_cents bigint not null default 0,
  foreign key (company_id, loan_id) references loans(company_id, loan_id), unique(company_id, loan_id, purpose), unique(company_id, loan_id, id)
);

create table if not exists servicing_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  account_id uuid not null, event_id uuid not null,
  effective_at timestamptz not null, cents bigint not null, entry_type text not null,
  reversal_of uuid, bank_reference text, xrpl_tx_hash text,
  created_at timestamptz not null default now(),
  foreign key (company_id, loan_id) references loans(company_id, loan_id),
  unique(company_id, loan_id, id),
  foreign key (company_id, loan_id, account_id) references servicing_accounts(company_id, loan_id, id),
  foreign key (company_id, loan_id, reversal_of) references servicing_entries(company_id, loan_id, id)
);
create index if not exists idx_servicing_entries_scope on servicing_entries(company_id, loan_id, effective_at);

create table if not exists settlement_jobs (
  company_id uuid not null, loan_id uuid not null, run_id text not null, leg text not null,
  fingerprint char(64) not null, signed_blob text not null, tx_hash char(64) not null,
  status text not null check (status in ('prepared','validated','failed')),
  engine_result text, created_at timestamptz not null default now(),
  primary key (company_id, loan_id, run_id, leg),
  foreign key (company_id, loan_id) references loans(company_id, loan_id)
);

alter table servicing_payments add column if not exists hazard_part numeric(12,2);
alter table servicing_payments add column if not exists mip_part numeric(12,2);
alter table servicing_payments add column if not exists suspense_part numeric(12,2) not null default 0;
alter table servicing_payments add column if not exists adjustment_part numeric(12,2) not null default 0;
alter table servicing_payments add column if not exists idempotency_key uuid;

create table if not exists escrow_analyses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  computation_year_start date not null, starting_balance_cents bigint not null,
  current_monthly_cents bigint not null, new_monthly_cents bigint not null, cushion_cents bigint not null,
  classification text not null check (classification in ('balanced','surplus','shortage','deficiency')),
  amount_cents bigint not null, permitted_options jsonb not null, trial_balances jsonb not null,
  approved_by text, approved_at timestamptz, created_at timestamptz not null default now(),
  foreign key (company_id, loan_id) references loans(company_id, loan_id), unique(company_id, loan_id, computation_year_start)
);

create table if not exists verified_bills (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  purpose text not null check (purpose in ('tax','hazard')), due_date date not null, amount_cents bigint not null,
  payee_id text not null, verified_at timestamptz not null, corrected_from uuid,
  foreign key (company_id, loan_id) references loans(company_id, loan_id),
  unique(company_id, loan_id, id),
  foreign key (company_id, loan_id, corrected_from) references verified_bills(company_id, loan_id, id)
);

create table if not exists servicer_advances (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  bill_id uuid not null, amount_cents bigint not null, advanced_at timestamptz not null,
  recovery_status text not null default 'open', foreign key (company_id, loan_id) references loans(company_id, loan_id),
  foreign key (company_id, loan_id, bill_id) references verified_bills(company_id, loan_id, id)
);

create table if not exists servicing_cases (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  kind text not null check (kind in ('notice_of_error','information_request','force_placed','early_intervention','loss_mitigation')),
  opened_at timestamptz not null, acknowledged_at timestamptz, resolved_at timestamptz,
  status text not null, evidence jsonb not null default '[]', foreign key (company_id, loan_id) references loans(company_id, loan_id)
);

create table if not exists transfer_cases (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  kind text not null check (kind in ('servicing','ownership')), effective_date date not null,
  transferor_notice date, transferee_notice date, grace_ends date, nft_offer_id text,
  foreign key (company_id, loan_id) references loans(company_id, loan_id)
);

create table if not exists reconciliation_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  cutoff_at timestamptz not null, bank_cents bigint not null, servicing_cents bigint not null, ledger_cents bigint not null,
  difference_cents bigint not null, bank_reference text, ledger_tx_hash text, status text not null,
  previous_hash char(64), event_hash char(64) not null,
  foreign key (company_id, loan_id) references loans(company_id, loan_id)
);

create table if not exists tax_form_records (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, loan_id uuid not null,
  tax_year int not null, form_type text not null check (form_type in ('1098','1099-INT','1099-A-REVIEW','1099-C-REVIEW')),
  rules_version text not null, payload jsonb not null, furnished_at timestamptz, accepted_at timestamptz,
  foreign key (company_id, loan_id) references loans(company_id, loan_id), unique(company_id, loan_id, tax_year, form_type)
);

create or replace function deny_servicing_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'servicing event rows are append-only'; end $$;
drop trigger if exists servicing_entries_append_only on servicing_entries;
create trigger servicing_entries_append_only before update or delete on servicing_entries for each row execute function deny_servicing_event_mutation();
drop trigger if exists reconciliation_events_append_only on reconciliation_events;
create trigger reconciliation_events_append_only before update or delete on reconciliation_events for each row execute function deny_servicing_event_mutation();

grant select, insert, update, delete on loan_document_versions, servicing_accounts, escrow_analyses, verified_bills, servicer_advances, servicing_cases, transfer_cases, tax_form_records to cf_pg_api_login;
grant select, insert on servicing_entries, reconciliation_events to cf_pg_api_login;
grant select, insert, update on settlement_jobs to cf_pg_api_login;
grant select on loan_document_versions, servicing_accounts, servicing_entries, escrow_analyses, verified_bills, servicer_advances, servicing_cases, transfer_cases, reconciliation_events, tax_form_records to cf_appsmith_read, cf_nocodb_read;
