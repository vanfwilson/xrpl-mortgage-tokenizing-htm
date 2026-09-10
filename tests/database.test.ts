import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { PostgresSettlementStore } from '../src/db/settlement-store.js';
import { PostgresEventStore } from '../src/db/event-store.js';
const db=new PGlite();
const company='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
let loan:string,otherLoan:string,account:string;
beforeAll(async()=>{
  await db.exec(`create role cf_pg_api_login; create role cf_appsmith_read; create role cf_nocodb_read;
    create table public.companies(company_id uuid primary key);
    create schema htm_mortgages; create table htm_mortgages.loan_applications(id uuid primary key);`);
  for(const file of ['001_closing_package.sql','002_servicing_three_buckets.sql','003_servicing_architecture.sql','004_servicing_event_log.sql']) await db.exec(fs.readFileSync(`db/${file}`,'utf8'));
  await db.query('insert into public.companies values ($1),($2)',[company,other]);
  const insertLoan=async(c:string)=> (await db.query<{loan_id:string}>(`insert into htm_mortgages.loans(company_id,loan_number,loan_type,product,base_loan_amount,financed_ufmip,note_amount,interest_rate,term_months,monthly_pi,first_payment_date,maturity_date) values($1,'fixture','FHA','fixed',442260.44,7739.56,450000,.0625,360,2770.73,'2026-11-01','2056-10-01') returning loan_id`,[c])).rows[0].loan_id;
  loan=await insertLoan(company); otherLoan=await insertLoan(other);
  account=(await db.query<{id:string}>(`insert into htm_mortgages.servicing_accounts(company_id,loan_id,purpose) values($1,$2,'tax') returning id`,[company,loan])).rows[0].id;
},30000);
afterAll(async()=>{await db.close();});
it('R31_migrations_execute_and_reapply_on_embedded_PostgreSQL',async()=>{
  await db.exec(fs.readFileSync('db/003_servicing_architecture.sql','utf8'));
  await db.exec(fs.readFileSync('db/004_servicing_event_log.sql','utf8'));
  expect((await db.query(`select column_name from information_schema.columns where table_schema='htm_mortgages' and table_name='servicing_payments' and column_name in ('hazard_part','mip_part')`)).rows).toHaveLength(2);
});

it('R14_business_event_chain_persists_with_scope_sequence_and_mutation_guards',async()=>{
  const store=new PostgresEventStore(db);
  const first=await store.append(company,loan,{kind:'request_received',on:'2026-01-01'});
  const second=await new PostgresEventStore(db).append(company,loan,{kind:'response_sent',on:'2026-01-05'});
  expect(second.previousHash).toBe(first.eventHash);
  expect(await new PostgresEventStore(db).read(company,loan)).toEqual([first,second]);
  expect(await store.read(other,otherLoan)).toEqual([]);
  await expect(db.query('update htm_mortgages.servicing_event_log set payload_json=$1 where company_id=$2 and loan_id=$3',['{}',company,loan])).rejects.toThrow(/append-only/);
  await expect(db.query('delete from htm_mortgages.servicing_event_log where company_id=$1 and loan_id=$2',[company,loan])).rejects.toThrow(/append-only/);
  await expect(db.query('insert into htm_mortgages.servicing_event_log(company_id,loan_id,sequence,previous_hash,event_hash,payload_json) values($1,$2,3,$3,$4,$5)',[company,loan,first.eventHash,'c'.repeat(64),'{}'])).rejects.toThrow(/broken/);
  await expect(store.append(other,loan,{})).rejects.toThrow(/foreign key/);
});
it('R14_servicing_entries_cannot_be_updated_or_deleted',async()=>{
  const id=(await db.query<{id:string}>(`insert into htm_mortgages.servicing_entries(company_id,loan_id,account_id,event_id,effective_at,cents,entry_type) values($1,$2,$3,gen_random_uuid(),now(),100,'receipt') returning id`,[company,loan,account])).rows[0].id;
  await expect(db.query('update htm_mortgages.servicing_entries set cents=101 where id=$1',[id])).rejects.toThrow(/append-only/);
  await expect(db.query('delete from htm_mortgages.servicing_entries where id=$1',[id])).rejects.toThrow(/append-only/);
});
it('R31_cross_tenant_and_cross_loan_account_references_are_rejected',async()=>{
  await expect(db.query(`insert into htm_mortgages.servicing_entries(company_id,loan_id,account_id,event_id,effective_at,cents,entry_type) values($1,$2,$3,gen_random_uuid(),now(),100,'receipt')`,[other,otherLoan,account])).rejects.toThrow(/foreign key/);
  await expect(db.query(`insert into htm_mortgages.servicing_accounts(company_id,loan_id,purpose) values($1,$2,'tax')`,[other,loan])).rejects.toThrow(/foreign key/);
  const bill=(await db.query<{id:string}>(`insert into htm_mortgages.verified_bills(company_id,loan_id,purpose,due_date,amount_cents,payee_id,verified_at) values($1,$2,'tax','2026-12-20',100,'county',now()) returning id`,[company,loan])).rows[0].id;
  await expect(db.query(`insert into htm_mortgages.servicer_advances(company_id,loan_id,bill_id,amount_cents,advanced_at) values($1,$2,$3,100,now())`,[other,otherLoan,bill])).rejects.toThrow(/foreign key/);
});

it('S11_postgres_journal_persists_one_blob_per_scoped_run_and_leg',async()=>{
  const store=new PostgresSettlementStore(db);
  const key=JSON.stringify([company,loan,'run1','pi']);
  const original={key,fingerprint:'a'.repeat(64),status:'prepared' as const,signedBlob:'original',hash:'b'.repeat(64)};
  await store.insertIfAbsent(original);
  expect((await store.insertIfAbsent({...original,signedBlob:'duplicate'})).signedBlob).toBe('original');
  await store.validated(key,'tesSUCCESS');
  expect((await store.get(key))?.status).toBe('validated');
  expect(await store.get(JSON.stringify([other,otherLoan,'run1','pi']))).toBeUndefined();
});
