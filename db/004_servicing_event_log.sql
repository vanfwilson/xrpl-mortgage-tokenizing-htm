-- R14/Phase C: durable, scoped, append-only business event chain.
set search_path = htm_mortgages, public;
create table if not exists servicing_event_log (
  company_id uuid not null, loan_id uuid not null,
  sequence integer not null check(sequence > 0),
  previous_hash char(64) not null check(previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash char(64) not null check(event_hash ~ '^[a-f0-9]{64}$'),
  payload_json text not null check(jsonb_typeof(payload_json::jsonb) is not null),
  created_at timestamptz not null default now(),
  primary key(company_id,loan_id,sequence), unique(company_id,loan_id,event_hash),
  foreign key(company_id,loan_id) references loans(company_id,loan_id)
);
create or replace function enforce_servicing_chain_append() returns trigger language plpgsql as $$
declare tail_sequence integer; tail_hash text;
begin
  -- Serialize per loan; a competing stale append must retry from the new tail.
  perform 1 from loans where company_id=new.company_id and loan_id=new.loan_id for update;
  select sequence,event_hash into tail_sequence,tail_hash from servicing_event_log
    where company_id=new.company_id and loan_id=new.loan_id order by sequence desc limit 1;
  if new.sequence <> coalesce(tail_sequence,0)+1 or new.previous_hash <> coalesce(tail_hash,repeat('0',64)) then
    raise exception 'stale or broken servicing event chain';
  end if;
  return new;
end $$;
drop trigger if exists servicing_chain_append on servicing_event_log;
create trigger servicing_chain_append before insert on servicing_event_log for each row execute function enforce_servicing_chain_append();
drop trigger if exists servicing_event_log_append_only on servicing_event_log;
create trigger servicing_event_log_append_only before update or delete on servicing_event_log for each row execute function deny_servicing_event_mutation();
grant select,insert on servicing_event_log to cf_pg_api_login;
grant select on servicing_event_log to cf_appsmith_read,cf_nocodb_read;
