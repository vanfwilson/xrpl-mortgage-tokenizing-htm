-- R14 durable business-event chain. One hash-linked row per (company, loan, sequence). Rows are never
-- updated or deleted (triggers raise); the chain is verified on read by src/servicing/event-log.ts.
-- Tenant and loan ids are opaque text in this repo (no FK to loans, which keys by uuid).
create schema if not exists htm_mortgages;
set search_path = htm_mortgages, public;

create table if not exists servicing_event_log (
  company_id    text        not null,
  loan_id       text        not null,
  sequence      int         not null check (sequence > 0),
  previous_hash char(64)    not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash    char(64)    not null unique check (event_hash ~ '^[0-9a-f]{64}$'),
  payload_json  text        not null check (jsonb_typeof(payload_json::jsonb) is not null),
  created_at    timestamptz not null default now(),
  primary key (company_id, loan_id, sequence)
);

-- Continuity guard: each insert must extend the current tail (sequence tail+1, previous_hash = tail hash).
create or replace function servicing_event_log_enforce_chain() returns trigger language plpgsql as $$
declare tail_sequence int; tail_hash text;
begin
  select sequence, event_hash into tail_sequence, tail_hash from htm_mortgages.servicing_event_log
    where company_id = new.company_id and loan_id = new.loan_id order by sequence desc limit 1;
  if new.sequence <> coalesce(tail_sequence, 0) + 1 or new.previous_hash <> coalesce(tail_hash, repeat('0', 64)) then
    raise exception 'servicing_event_log: stale or broken event chain for % / % (sequence %)', new.company_id, new.loan_id, new.sequence;
  end if;
  return new;
end $$;

create or replace function servicing_event_log_deny_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'servicing_event_log is append-only: % is not permitted', tg_op;
end $$;

drop trigger if exists servicing_event_log_chain on servicing_event_log;
create trigger servicing_event_log_chain before insert on servicing_event_log
  for each row execute function servicing_event_log_enforce_chain();

drop trigger if exists servicing_event_log_append_only on servicing_event_log;
create trigger servicing_event_log_append_only before update or delete on servicing_event_log
  for each row execute function servicing_event_log_deny_mutation();

-- Grants only where the platform roles exist (embedded/test databases apply this file standalone).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cf_pg_api_login') then
    grant select, insert on servicing_event_log to cf_pg_api_login;
  end if;
  if exists (select 1 from pg_roles where rolname = 'cf_appsmith_read') then
    grant select on servicing_event_log to cf_appsmith_read;
  end if;
  if exists (select 1 from pg_roles where rolname = 'cf_nocodb_read') then
    grant select on servicing_event_log to cf_nocodb_read;
  end if;
end $$;
