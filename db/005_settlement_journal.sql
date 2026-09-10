-- S11 settlement journal. One signed XRPL transaction per (company, loan, run, leg). The blob is
-- persisted BEFORE submission so a timeout or process restart resubmits / looks up the same hash
-- instead of re-signing a duplicate payment. Tenant and loan ids are opaque text in this repo.
set search_path = htm_mortgages, public;

create table if not exists settlement_jobs (
  company_id    text        not null,
  loan_id       text        not null,
  run_id        text        not null,
  leg           text        not null,
  fingerprint   char(64)    not null,                       -- sha256 of the unsigned tx JSON
  status        text        not null check (status in ('prepared', 'validated', 'failed')),
  signed_blob   text        not null,                       -- exact signed blob; never re-signed
  tx_hash       char(64)    not null,
  engine_result text,                                       -- tesSUCCESS / tec* once validated
  created_at    timestamptz not null default now(),
  primary key (company_id, loan_id, run_id, leg)
);

create index if not exists idx_settlement_jobs_hash on settlement_jobs (tx_hash);

-- Grants only where the platform roles exist (embedded/test databases apply this file standalone).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cf_pg_api_login') then
    grant select, insert, update on settlement_jobs to cf_pg_api_login;
  end if;
  if exists (select 1 from pg_roles where rolname = 'cf_appsmith_read') then
    grant select on settlement_jobs to cf_appsmith_read;
  end if;
  if exists (select 1 from pg_roles where rolname = 'cf_nocodb_read') then
    grant select on settlement_jobs to cf_nocodb_read;
  end if;
end $$;
