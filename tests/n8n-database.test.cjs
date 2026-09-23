'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
let db;
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const token = 'unit-test-only-never-deploy';
const query = async (sql, params) => (await db.query(sql, params)).rows;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions; create schema auth; create schema storage;
    create function extensions.gen_random_uuid() returns uuid language sql as 'select pg_catalog.gen_random_uuid()';
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.perfiles(id uuid primary key references auth.users,activo boolean,rol text);
    create function public.es_admin() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol='admin')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    grant usage on schema auth,storage to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);
  for (const file of ['20260920_n8n_integration_staging.sql','20260921_n8n_scoped_queue.sql']) {
    const sql = fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8')
      .replace(/create extension if not exists pgcrypto with schema extensions;/g,'');
    await db.exec(sql);
  }
  await query("insert into n8n_private.webhook_secrets(name,secret_hash) values('molino_control_n8n',encode(sha256(convert_to($1,'UTF8')),'hex'))",[token]);
  await query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-molino-n8n-token':token})]);
  await query('insert into auth.users(id) values($1),($2)',[user,other]);
  await query("insert into public.perfiles values($1,true,'admin'),($2,true,'operador')",[user,other]);
});
after(async () => { if(db) await db.close(); });
test('new worker RPCs cannot be called by anon or authenticated',async()=>{
  for(const signature of ['n8n_gateway_authorize(text)','n8n_claim_import_jobs(text,integer)','n8n_stage_import_rows(uuid,text,jsonb)','n8n_finish_import_job(uuid,text,text,integer,integer,integer,jsonb,text)','n8n_fail_import_job(uuid,text,text,boolean)','n8n_import_file_context(uuid,text)']) {
    const [r]=await query("select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') u,has_function_privilege('service_role',$1,'execute') s",['public.'+signature]);
    assert.deepEqual(r,{a:false,u:false,s:true});
  }
});
test('gateway rejects wrong token and rate limits valid tokens',async()=>{
  await query("select set_config('request.headers','{}',false)");
  await assert.rejects(query("select public.n8n_gateway_authorize('health')"),/invalid n8n token/);
  await query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-molino-n8n-token':token})]);
  assert.equal((await query("select public.n8n_gateway_authorize('health') ok"))[0].ok,true);
  await query("update n8n_private.gateway_limits set calls=600,window_start=date_trunc('minute',clock_timestamp())");
  assert.equal((await query("select public.n8n_gateway_authorize('claim') ok"))[0].ok,false);
});
test('admin enqueue validates ownership and deduplicates checksum',async()=>{
  await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  const hash='a'.repeat(64), storage=`${user}/${hash}/fixture.xlsx`;
  await query("insert into storage.objects(bucket_id,name) values('excel-imports',$1)",[storage]);
  const args=['fixture.xlsx',storage,hash];
  const [first]=await query("select * from public.molino_enqueue_import($1,$2,$3)",args);
  const [again]=await query("select * from public.molino_enqueue_import($1,$2,$3)",args);
  assert.equal(first.id,again.id);
  await query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await assert.rejects(query("select * from public.molino_enqueue_import($1,$2,$3)",args),/admin access required/);
  await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await assert.rejects(query("select * from public.molino_enqueue_import('fixture.xlsx',$1,$2)",[`${other}/${hash}/fixture.xlsx`,hash]),/does not belong/);
});
test('leases, reattempt cleanup, idempotent completion, and authoritative row counts',async()=>{
  const [j]=await query("select * from public.n8n_claim_import_jobs('test-worker',1)");
  assert.ok(j?.id);
  const [again]=await query("select * from public.n8n_claim_import_jobs('test-worker',1)");
  assert.equal(j.id,again.id); assert.equal(again.attempt_count,1);
  assert.deepEqual(await query("select * from public.n8n_claim_import_jobs('other-worker',1)"),[]);
  const rows=[{sheet_name:'CODIGOS',row_number:2,source_data:{A:'X'},normalized_data:{code:'X'},validation_status:'valido',validation_errors:[]}];
  await assert.rejects(query('select public.n8n_stage_import_rows($1,$2,$3)',[j.id,'other-worker',JSON.stringify(rows)]),/lease is not active/);
  assert.equal((await query('select public.n8n_stage_import_rows($1,$2,$3) n',[j.id,'test-worker',JSON.stringify(rows)]))[0].n,1);
  await assert.rejects(query('select public.n8n_stage_import_rows($1,$2,$3)',[j.id,'test-worker',JSON.stringify([{sheet_name:'',row_number:0}])]),/invalid rows/);
  const [failure]=await query("select * from public.n8n_fail_import_job($1,'test-worker','parser_failed',true)",[j.id]);
  assert.equal(failure.status,'pendiente');
  assert.deepEqual(await query("select * from public.n8n_claim_import_jobs('worker-2',1)"),[]);
  await query("update public.import_jobs set next_attempt_at=now()-interval '1 minute' where id=$1",[j.id]);
  const [retry]=await query("select * from public.n8n_claim_import_jobs('worker-2',1)");
  assert.equal(retry.attempt_count,2);
  assert.equal((await query('select count(*)::integer n from public.import_rows_staging where job_id=$1',[j.id]))[0].n,0);
  await query('select public.n8n_stage_import_rows($1,$2,$3)',[j.id,'worker-2',JSON.stringify(rows)]);
  await assert.rejects(query("select * from public.n8n_finish_import_job($1,'worker-2','validado',99,99,0)",[j.id]),/row counts/);
  await query('select public.n8n_append_import_errors($1,$2,$3)',[j.id,'worker-2',JSON.stringify([{severity:'fatal',error_code:'MISSING',message:'missing required sheet'}])]);
  await assert.rejects(query("select * from public.n8n_finish_import_job($1,'worker-2','validado',1,1,0)",[j.id]),/blocking validation/);
  const [finished]=await query("select * from public.n8n_finish_import_job($1,'worker-2','rechazado',1,1,0)",[j.id]);
  assert.equal(finished.status,'rechazado');
  assert.deepEqual(await query("select * from public.n8n_finish_import_job($1,'worker-2','rechazado',1,1,0)",[j.id]),[finished]);
  await assert.rejects(query("select * from public.n8n_finish_import_job($1,'other-worker','rechazado',1,1,0)",[j.id]),/lease is not active/);
});
test('retry limit and expired workers cannot write or heartbeat',async()=>{
  const [j]=await query("insert into public.import_jobs(idempotency_key,file_name,storage_path,checksum_sha256,status,locked_by,attempt_count,lease_expires_at) values('test-expired','test.xlsx','test.xlsx',$1,'procesando','expired',3,now()-interval '1 minute') returning id",['b'.repeat(64)]);
  assert.equal((await query("select public.n8n_heartbeat_import_job($1,'expired') alive",[j.id]))[0].alive,false);
  await query("select * from public.n8n_claim_import_jobs('rescuer',1)");
  assert.equal((await query('select status from public.import_jobs where id=$1',[j.id]))[0].status,'error');
});
