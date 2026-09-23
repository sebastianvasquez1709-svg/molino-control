-- Molino Control · cola segura y acotada para n8n
-- Fase de staging: no publica datos operacionales. Los trabajos terminan en
-- validado, rechazado o error y requieren una promoción explícita posterior.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists n8n_private;
revoke all on schema n8n_private from public, anon, authenticated;

create table if not exists n8n_private.webhook_secrets (
  name text primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

revoke all on table n8n_private.webhook_secrets from public, anon, authenticated;

alter table public.import_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists result_summary jsonb not null default '{}'::jsonb,
  add column if not exists last_error text,
  add column if not exists next_attempt_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.import_jobs'::regclass
      and conname = 'import_jobs_attempt_count_check'
  ) then
    alter table public.import_jobs
      add constraint import_jobs_attempt_count_check check (attempt_count >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.import_jobs'::regclass
      and conname = 'import_jobs_max_attempts_check'
  ) then
    alter table public.import_jobs
      add constraint import_jobs_max_attempts_check check (max_attempts between 1 and 10);
  end if;
end
$$;

create index if not exists import_jobs_requested_by_idx
  on public.import_jobs(requested_by);
create index if not exists import_jobs_claim_idx
  on public.import_jobs(status, lease_expires_at, created_at)
  where status in ('pendiente', 'procesando');
create unique index if not exists import_errors_dedupe_idx
  on public.import_errors (
    job_id,
    severity,
    coalesce(sheet_name, ''),
    coalesce(row_number, 0),
    coalesce(column_name, ''),
    error_code,
    message
  );

create or replace function n8n_private.assert_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  supplied_token text;
begin
  select s.secret_hash
    into expected_hash
  from n8n_private.webhook_secrets s
  where s.name = 'molino_control_n8n'
    and s.active;

  supplied_token := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb
      ->> 'x-molino-n8n-token',
    ''
  );

  if expected_hash is null
     or pg_catalog.encode(
       pg_catalog.sha256(pg_catalog.convert_to(supplied_token, 'UTF8')),
       'hex'
     ) <> expected_hash then
    raise insufficient_privilege using message = 'invalid n8n token';
  end if;
end;
$$;

revoke all on function n8n_private.assert_request() from public, anon, authenticated;

create or replace function public.n8n_authorize_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform n8n_private.assert_request();
  return true;
end;
$$;

create or replace function public.n8n_register_connection_test(
  p_payload jsonb default '{}'::jsonb
)
returns table(id uuid, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform n8n_private.assert_request();
  return query
  insert into public.n8n_connection_tests(source, status, payload)
  values (
    'n8n',
    'ok',
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object('transport', 'scoped-rpc')
  )
  returning n8n_connection_tests.id,
            n8n_connection_tests.status,
            n8n_connection_tests.created_at;
end;
$$;

create or replace function public.n8n_create_import_job(
  p_idempotency_key text,
  p_file_name text,
  p_storage_path text,
  p_checksum_sha256 text,
  p_requested_by uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(id uuid, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id uuid;
  job_status text;
  job_created_at timestamptz;
begin
  perform n8n_private.assert_request();

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) not between 1 and 300 then
    raise exception using message = 'invalid idempotency key', errcode = '22023';
  end if;
  if p_file_name is null
     or length(btrim(p_file_name)) not between 1 and 255
     or p_file_name !~* '\.(xlsx|xlsm)$' then
    raise exception using message = 'invalid file name', errcode = '22023';
  end if;
  if p_storage_path is null
     or length(btrim(p_storage_path)) not between 1 and 1024
     or p_storage_path like '/%'
     or position('..' in p_storage_path) > 0 then
    raise exception using message = 'invalid storage path', errcode = '22023';
  end if;
  if lower(coalesce(p_checksum_sha256, '')) !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid checksum', errcode = '22023';
  end if;

  insert into public.import_jobs(
    idempotency_key,
    file_name,
    storage_path,
    checksum_sha256,
    status,
    requested_by,
    metadata
  )
  values (
    btrim(p_idempotency_key),
    btrim(p_file_name),
    btrim(p_storage_path),
    lower(p_checksum_sha256),
    'pendiente',
    p_requested_by,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('transport', 'scoped-rpc')
  )
  on conflict (idempotency_key) do nothing
  returning import_jobs.id, import_jobs.status, import_jobs.created_at
    into job_id, job_status, job_created_at;

  if job_id is null then
    select j.id, j.status, j.created_at
      into job_id, job_status, job_created_at
    from public.import_jobs j
    where j.idempotency_key = btrim(p_idempotency_key);
  end if;

  return query select job_id, job_status, job_created_at;
end;
$$;

create or replace function public.molino_enqueue_import(
  p_file_name text,
  p_storage_path text,
  p_checksum_sha256 text,
  p_kind text default 'maestro',
  p_metadata jsonb default '{}'::jsonb
)
returns table(id uuid, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_checksum text := lower(coalesce(p_checksum_sha256, ''));
  normalized_kind text := lower(btrim(coalesce(p_kind, '')));
  job_key text;
  job_id uuid;
  job_status text;
  job_created_at timestamptz;
begin
  if caller_id is null or not exists (
    select 1
    from public.perfiles p
    where p.id = caller_id
      and p.activo
      and p.rol = 'admin'
  ) then
    raise insufficient_privilege using message = 'admin access required';
  end if;

  if p_file_name is null
     or length(btrim(p_file_name)) not between 1 and 255
     or p_file_name !~* '\.(xlsx|xlsm)$' then
    raise exception using message = 'invalid file name', errcode = '22023';
  end if;
  if normalized_checksum !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid checksum', errcode = '22023';
  end if;
  if normalized_kind not in ('maestro', 'existencia') then
    raise exception using message = 'invalid import kind', errcode = '22023';
  end if;
  if p_storage_path is null
     or length(btrim(p_storage_path)) not between 1 and 1024
     or p_storage_path like '/%'
     or position('..' in p_storage_path) > 0
     or split_part(p_storage_path, '/', 1) <> caller_id::text
     or split_part(p_storage_path, '/', 2) <> normalized_checksum then
    raise exception using message = 'storage path does not belong to caller', errcode = '22023';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'excel-imports'
      and o.name = btrim(p_storage_path)
  ) then
    raise exception using message = 'uploaded object not found', errcode = '22023';
  end if;

  job_key := caller_id::text || ':' || normalized_kind || ':' || normalized_checksum;

  insert into public.import_jobs(
    idempotency_key,
    file_name,
    storage_path,
    checksum_sha256,
    status,
    requested_by,
    metadata
  )
  values (
    job_key,
    btrim(p_file_name),
    btrim(p_storage_path),
    normalized_checksum,
    'pendiente',
    caller_id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'molino-control-panel',
        'kind', normalized_kind,
        'transport', 'authenticated-rpc'
      )
  )
  on conflict (idempotency_key) do nothing
  returning import_jobs.id, import_jobs.status, import_jobs.created_at
    into job_id, job_status, job_created_at;

  if job_id is null then
    select j.id, j.status, j.created_at
      into job_id, job_status, job_created_at
    from public.import_jobs j
    where j.idempotency_key = job_key;
  end if;

  return query select job_id, job_status, job_created_at;
end;
$$;

create or replace function public.molino_list_import_jobs(p_limit integer default 25)
returns table(
  id uuid,
  file_name text,
  status text,
  kind text,
  rows_total integer,
  rows_valid integer,
  rows_error integer,
  attempt_count integer,
  result_summary jsonb,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if caller_id is null or not exists (
    select 1
    from public.perfiles p
    where p.id = caller_id
      and p.activo
      and p.rol = 'admin'
  ) then
    raise insufficient_privilege using message = 'admin access required';
  end if;

  return query
  select j.id,
         j.file_name,
         j.status,
         coalesce(j.metadata ->> 'kind', 'maestro') as kind,
         j.rows_total,
         j.rows_valid,
         j.rows_error,
         j.attempt_count,
         j.result_summary,
         j.last_error,
         j.created_at,
         j.updated_at,
         j.finished_at
  from public.import_jobs j
  where j.requested_by = caller_id
  order by j.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.n8n_claim_import_jobs(p_worker_id text, p_limit integer default 1)
returns table(id uuid, file_name text, storage_path text, checksum_sha256 text,
  metadata jsonb, attempt_count integer, lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare claimed_id uuid;
begin
  perform n8n_private.assert_request();
  if p_worker_id is null or length(btrim(p_worker_id)) not between 1 and 200 or p_limit is distinct from 1 then
    raise exception using message = 'one job and a worker id required', errcode = '22023';
  end if;
  -- A retry of the same HTTP request must not claim a second job.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(btrim(p_worker_id), 917));
  select j.id into claimed_id from public.import_jobs j
    where j.status = 'procesando' and j.locked_by = btrim(p_worker_id)
      and j.lease_expires_at > clock_timestamp() limit 1;
  if claimed_id is null then
    update public.import_jobs j set status = 'error', finished_at = now(), updated_at = now(),
      last_error = coalesce(j.last_error, 'retry limit reached'), lease_expires_at = null
    where j.status in ('pendiente','procesando') and j.attempt_count >= j.max_attempts
      and (j.lease_expires_at is null or j.lease_expires_at < clock_timestamp());
    select j.id into claimed_id from public.import_jobs j
    where j.attempt_count < j.max_attempts and j.next_attempt_at <= clock_timestamp()
      and (j.status = 'pendiente' or (j.status = 'procesando' and j.lease_expires_at < clock_timestamp()))
      and coalesce(j.metadata->>'synthetic','false') <> 'true'
    order by j.created_at for update skip locked limit 1;
    if claimed_id is not null then
      update public.import_jobs j set status = 'procesando', attempt_count = j.attempt_count + 1,
        locked_by = btrim(p_worker_id), lease_expires_at = clock_timestamp() + interval '10 minutes',
        started_at = coalesce(j.started_at, now()), finished_at = null, updated_at = now(),
        rows_total = 0, rows_valid = 0, rows_error = 0, result_summary = '{}'
      where j.id = claimed_id;
      -- Staging is isolated per job; clean only the newly claimed retry.
      delete from public.import_rows_staging r where r.job_id = claimed_id;
      delete from public.import_errors e where e.job_id = claimed_id;
    end if;
  end if;
  return query select j.id,j.file_name,j.storage_path,j.checksum_sha256,j.metadata,
    j.attempt_count,j.lease_expires_at from public.import_jobs j where j.id = claimed_id;
end;
$$;

create or replace function public.n8n_heartbeat_import_job(
  p_job_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched integer;
begin
  perform n8n_private.assert_request();
  update public.import_jobs j
  set lease_expires_at = clock_timestamp() + interval '10 minutes',
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'procesando'
    and j.locked_by = btrim(p_worker_id)
    and j.lease_expires_at > clock_timestamp();
  get diagnostics touched = row_count;
  return touched = 1;
end;
$$;

create or replace function public.n8n_stage_import_rows(
  p_job_id uuid,
  p_worker_id text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  perform n8n_private.assert_request();
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) not between 1 and 1000 then
    raise exception using message = 'rows must be an array of 1..1000 items', errcode = '22023';
  end if;
  perform 1 from public.import_jobs j where j.id = p_job_id
    and j.status = 'procesando' and j.locked_by = btrim(p_worker_id)
    and j.lease_expires_at > clock_timestamp() for update;
  if not found then
    raise exception using message = 'job lease is not active', errcode = '55000';
  end if;

  insert into public.import_rows_staging(
    job_id,
    sheet_name,
    row_number,
    source_data,
    normalized_data,
    validation_status,
    validation_errors
  )
  select p_job_id,
         btrim(r.sheet_name),
         r.row_number,
         coalesce(r.source_data, '{}'::jsonb),
         coalesce(r.normalized_data, '{}'::jsonb),
         coalesce(r.validation_status, 'pendiente'),
         coalesce(r.validation_errors, '[]'::jsonb)
  from jsonb_to_recordset(p_rows) as r(
    sheet_name text,
    row_number integer,
    source_data jsonb,
    normalized_data jsonb,
    validation_status text,
    validation_errors jsonb
  )
  where r.sheet_name is not null
    and length(btrim(r.sheet_name)) between 1 and 200
    and r.row_number > 0
    and coalesce(r.validation_status, 'pendiente')
      in ('pendiente', 'valido', 'advertencia', 'error')
  on conflict (job_id, sheet_name, row_number) do update
    set source_data = excluded.source_data,
        normalized_data = excluded.normalized_data,
        validation_status = excluded.validation_status,
        validation_errors = excluded.validation_errors;

  get diagnostics inserted_count = row_count;
  if inserted_count <> jsonb_array_length(p_rows) then
    raise exception using message = 'invalid rows in batch', errcode = '22023';
  end if;
  return inserted_count;
end;
$$;

create or replace function public.n8n_append_import_errors(
  p_job_id uuid,
  p_worker_id text,
  p_errors jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  perform n8n_private.assert_request();
  if p_errors is null or jsonb_typeof(p_errors) <> 'array'
     or jsonb_array_length(p_errors) not between 1 and 500 then
    raise exception using message = 'errors must be an array of 1..500 items', errcode = '22023';
  end if;
  perform 1 from public.import_jobs j where j.id = p_job_id
    and j.status = 'procesando' and j.locked_by = btrim(p_worker_id)
    and j.lease_expires_at > clock_timestamp() for update;
  if not found then
    raise exception using message = 'job lease is not active', errcode = '55000';
  end if;

  insert into public.import_errors(
    job_id,
    severity,
    sheet_name,
    row_number,
    column_name,
    error_code,
    message,
    details
  )
  select p_job_id,
         coalesce(r.severity, 'error'),
         nullif(btrim(r.sheet_name), ''),
         r.row_number,
         nullif(btrim(r.column_name), ''),
         btrim(r.error_code),
         btrim(r.message),
         coalesce(r.details, '{}'::jsonb)
  from jsonb_to_recordset(p_errors) as r(
    severity text,
    sheet_name text,
    row_number integer,
    column_name text,
    error_code text,
    message text,
    details jsonb
  )
  where coalesce(r.severity, 'error') in ('warning', 'error', 'fatal')
    and r.error_code is not null
    and length(btrim(r.error_code)) between 1 and 120
    and r.message is not null
    and length(btrim(r.message)) between 1 and 1000
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.n8n_finish_import_job(
  p_job_id uuid, p_worker_id text, p_status text,
  p_rows_total integer default 0, p_rows_valid integer default 0, p_rows_error integer default 0,
  p_result_summary jsonb default '{}'::jsonb, p_last_error text default null
)
returns table(id uuid, status text, finished_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare j public.import_jobs%rowtype; actual_total integer; actual_error integer;
begin
  perform n8n_private.assert_request();
  select * into j from public.import_jobs t where t.id = p_job_id for update;
  if not found or j.locked_by is distinct from btrim(p_worker_id) then
    raise exception using message = 'job lease is not active', errcode = '55000';
  end if;
  -- Repeat completion after a lost HTTP response is safe.
  if j.status = p_status and j.status in ('validado','rechazado','error') then
    return query select j.id,j.status,j.finished_at; return;
  end if;
  if j.status <> 'procesando' or j.lease_expires_at is null or j.lease_expires_at <= clock_timestamp() then
    raise exception using message = 'job lease is not active', errcode = '55000';
  end if;
  if p_status is null or p_status not in ('validado','rechazado','error') then
    raise exception using message = 'invalid terminal status', errcode = '22023';
  end if;
  select count(*)::integer, count(*) filter(where validation_status='error')::integer
    into actual_total,actual_error from public.import_rows_staging r where r.job_id=p_job_id;
  if p_rows_total is distinct from actual_total or p_rows_error is distinct from actual_error
    or p_rows_valid is distinct from (actual_total-actual_error) then
    raise exception using message = 'row counts do not match staged data', errcode = '22023';
  end if;
  if p_status='validado' and (actual_total=0 or actual_error>0 or exists(
    select 1 from public.import_errors e where e.job_id=p_job_id and e.severity in ('error','fatal')
  )) then raise exception using message='blocking validation findings',errcode='22023'; end if;
  return query update public.import_jobs t set status=p_status, rows_total=actual_total,
    rows_valid=actual_total-actual_error,rows_error=actual_error,
    result_summary=coalesce(p_result_summary,'{}'::jsonb) || jsonb_build_object('publication_performed',false),
    last_error=nullif(left(coalesce(p_last_error,''),2000),''),finished_at=now(),updated_at=now(),lease_expires_at=null
    where t.id=p_job_id returning t.id,t.status,t.finished_at;
end;
$$;

create or replace function public.n8n_fail_import_job(p_job_id uuid,p_worker_id text,p_error_code text,p_retryable boolean default true)
returns table(id uuid,status text,attempt_count integer,next_attempt_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare j public.import_jobs%rowtype;
begin
  perform n8n_private.assert_request();
  select * into j from public.import_jobs t where t.id=p_job_id for update;
  if not found or j.locked_by is distinct from btrim(p_worker_id) then
    raise exception using message='job lease is not active',errcode='55000'; end if;
  if j.status in ('pendiente','error') then
    return query select j.id,j.status,j.attempt_count,j.next_attempt_at; return;
  end if;
  if j.status<>'procesando' or j.lease_expires_at is null or j.lease_expires_at<=clock_timestamp() then
    raise exception using message='job lease is not active',errcode='55000'; end if;
  return query update public.import_jobs t set
    status=case when coalesce(p_retryable,false) and t.attempt_count<t.max_attempts then 'pendiente' else 'error' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,t.attempt_count)::integer)),
    finished_at=case when coalesce(p_retryable,false) and t.attempt_count<t.max_attempts then null else now() end,
    lease_expires_at=null,last_error=left(regexp_replace(coalesce(p_error_code,'worker_failed'),'[^a-zA-Z0-9_:-]','_','g'),120),updated_at=now()
    where t.id=p_job_id returning t.id,t.status,t.attempt_count,t.next_attempt_at;
end;
$$;

create or replace function public.n8n_import_file_context(p_job_id uuid,p_worker_id text)
returns table(job_id uuid,storage_path text,checksum_sha256 text,kind text)
language plpgsql security definer set search_path='' as $$
begin
  perform n8n_private.assert_request();
  return query select j.id,j.storage_path,j.checksum_sha256,coalesce(j.metadata->>'kind','maestro')
    from public.import_jobs j where j.id=p_job_id and j.locked_by=btrim(p_worker_id)
    and j.status='procesando' and j.lease_expires_at>clock_timestamp();
end;
$$;

create table if not exists n8n_private.gateway_limits (
  name text primary key, window_start timestamptz not null, calls integer not null
);
alter table n8n_private.gateway_limits enable row level security;
revoke all on table n8n_private.gateway_limits from public,anon,authenticated,service_role;
create or replace function public.n8n_gateway_authorize(p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare used integer; bucket timestamptz := date_trunc('minute',clock_timestamp());
begin
  perform n8n_private.assert_request();
  if p_action is null or p_action not in ('health','claim','file','stage','findings','heartbeat','finish','fail') then
    raise exception using message='invalid action',errcode='22023'; end if;
  insert into n8n_private.gateway_limits(name,window_start,calls) values('molino_control_n8n',bucket,1)
  on conflict(name) do update set
    calls=case when gateway_limits.window_start=excluded.window_start then gateway_limits.calls+1 else 1 end,
    window_start=excluded.window_start returning calls into used;
  return used<=600;
end;
$$;

revoke all on function public.n8n_authorize_request() from public, anon, authenticated;
revoke all on function public.n8n_register_connection_test(jsonb) from public, authenticated;
revoke all on function public.n8n_create_import_job(text, text, text, text, uuid, jsonb) from public, authenticated;
revoke all on function public.n8n_claim_import_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.n8n_heartbeat_import_job(uuid, text) from public, anon, authenticated;
revoke all on function public.n8n_stage_import_rows(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.n8n_append_import_errors(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.n8n_finish_import_job(uuid, text, text, integer, integer, integer, jsonb, text) from public, anon, authenticated;

grant execute on function public.n8n_authorize_request() to service_role;
grant execute on function public.n8n_register_connection_test(jsonb) to anon;
grant execute on function public.n8n_create_import_job(text, text, text, text, uuid, jsonb) to anon;
grant execute on function public.n8n_claim_import_jobs(text, integer) to service_role;
grant execute on function public.n8n_heartbeat_import_job(uuid, text) to service_role;
grant execute on function public.n8n_stage_import_rows(uuid, text, jsonb) to service_role;
grant execute on function public.n8n_append_import_errors(uuid, text, jsonb) to service_role;
grant execute on function public.n8n_finish_import_job(uuid, text, text, integer, integer, integer, jsonb, text) to service_role;

revoke all on function public.molino_enqueue_import(text, text, text, text, jsonb) from public, anon;
revoke all on function public.molino_list_import_jobs(integer) from public, anon;
grant execute on function public.molino_enqueue_import(text, text, text, text, jsonb) to authenticated;
grant execute on function public.molino_list_import_jobs(integer) to authenticated;

grant select, insert, update, delete on table public.import_jobs to service_role;
grant select, insert, update, delete on table public.import_errors to service_role;
grant select, insert, update, delete on table public.import_rows_staging to service_role;

drop policy if exists excel_imports_admin_select on storage.objects;
drop policy if exists excel_imports_admin_insert on storage.objects;
drop policy if exists excel_imports_admin_delete on storage.objects;

create policy excel_imports_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'excel-imports'
  and public.es_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy excel_imports_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'excel-imports'
  and public.es_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy excel_imports_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'excel-imports'
  and public.es_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on function public.molino_enqueue_import(text, text, text, text, jsonb) is
  'Encola de forma idempotente un Excel privado cargado por un administrador autenticado.';
comment on function public.n8n_claim_import_jobs(text, integer) is
  'Entrega trabajos a n8n con lease, reintentos acotados y bloqueo SKIP LOCKED.';
comment on function public.n8n_finish_import_job(uuid, text, text, integer, integer, integer, jsonb, text) is
  'Cierra validaciones de staging. Esta fase no puede publicar datos operacionales.';

revoke all on function public.n8n_fail_import_job(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.n8n_import_file_context(uuid,text) from public,anon,authenticated;
revoke all on function public.n8n_gateway_authorize(text) from public,anon,authenticated;
grant execute on function public.n8n_fail_import_job(uuid,text,text,boolean) to service_role;
grant execute on function public.n8n_import_file_context(uuid,text) to service_role;
grant execute on function public.n8n_gateway_authorize(text) to service_role;
