-- Servicing model: the borrower sweep splits into exactly three buckets.
set search_path = htm_mortgages, public;

alter table servicing_payments
  add column if not exists pi_part numeric(12,2),
  add column if not exists tax_part numeric(12,2),
  add column if not exists insurance_part numeric(12,2),
  add column if not exists sweep_tx_hash text,          -- homeowner -> servicer Payment
  add column if not exists pi_tx_hash text,             -- servicer LoanPay to the lender vault loan
  add column if not exists tax_tx_hash text,            -- servicer -> tax impound Payment
  add column if not exists insurance_tx_hash text;      -- servicer -> insurance impound Payment

-- Impound sub-accounts (one tax, one insurance per loan) and their statutory disbursements.
create table if not exists impound_accounts (
  impound_id    uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(company_id),
  loan_id       uuid not null references loans(loan_id) on delete cascade,
  kind          text not null check (kind in ('tax','insurance')),
  monthly_amount numeric(12,2) not null,
  annual_total  numeric(12,2) not null,
  payee_name    text not null,                          -- Ada County Treasurer / carrier
  payee_reference text,                                 -- parcel no. / policy no.
  xrpl_address  text,                                   -- impound sub-account on ledger (Devnet)
  payee_xrpl_address text,                              -- treasurer / carrier destination node
  balance       numeric(12,2) not null default 0,
  unique (loan_id, kind)
);

create table if not exists impound_disbursements (
  disbursement_id uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(company_id),
  impound_id    uuid not null references impound_accounts(impound_id) on delete cascade,
  due_date      date not null,
  description   text not null,
  amount        numeric(12,2) not null,
  status        text not null default 'scheduled' check (status in ('scheduled','escrowed','disbursed','deficit')),
  escrow_tx_hash text,                                  -- EscrowCreate (time-locked to due_date)
  release_tx_hash text,                                 -- EscrowFinish
  unique (impound_id, due_date)
);

grant select, insert, update, delete on impound_accounts, impound_disbursements to cf_pg_api_login;
grant select on impound_accounts, impound_disbursements to cf_appsmith_read, cf_nocodb_read;
