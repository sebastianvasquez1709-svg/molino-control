-- Molino Control · integración n8n (fase segura de preparación)
-- Este script crea únicamente infraestructura aislada. No modifica documentos,
-- despachos, clientes, productos ni las importaciones actuales del Maestro.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.n8n_connection_tests (
  id uuid primary key default extensions.gen_random_uuid(),
  source text not null default 'n8n',
  status text not null check (status in ('ok', 'error')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  idempotency_key text not null unique,
  file_name text not null,
  storage_path text not null,
  checksum_sha256 text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente','procesando','validado','rechazado','publicado','error')),
  requested_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  rows_total integer not null default 0 check (rows_total >= 0),
  rows_valid integer not null default 0 check (rows_valid >= 0),
  rows_error integer not null default 0 check (rows_error >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_errors (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  severity text not null default 'error'
    check (severity in ('warning','error','fatal')),
  sheet_name text,
  row_number integer check (row_number is null or row_number > 0),
  column_name text,
  error_code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_rows_staging (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  sheet_name text not null,
  row_number integer not null check (row_number > 0),
  source_data jsonb not null,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pendiente'
    check (validation_status in ('pendiente','valido','advertencia','error')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, sheet_name, row_number)
);

create index if not exists import_jobs_status_created_idx
  on public.import_jobs(status, created_at desc);
create index if not exists import_errors_job_severity_idx
  on public.import_errors(job_id, severity);
create index if not exists import_rows_staging_job_sheet_idx
  on public.import_rows_staging(job_id, sheet_name, row_number);

alter table public.n8n_connection_tests enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_errors enable row level security;
alter table public.import_rows_staging enable row level security;

revoke all on table public.n8n_connection_tests from public, anon, authenticated;
revoke all on table public.import_jobs from public, anon, authenticated;
revoke all on table public.import_errors from public, anon, authenticated;
revoke all on table public.import_rows_staging from public, anon, authenticated;

-- Las claves secretas de Supabase actúan con service_role. Se declaran grants
-- explícitos porque las tablas nuevas ya no deben depender de grants implícitos.
grant select, insert on table public.n8n_connection_tests to service_role;
grant select, insert, update, delete on table public.import_jobs to service_role;
grant select, insert, update, delete on table public.import_errors to service_role;
grant select, insert, update, delete on table public.import_rows_staging to service_role;
grant usage, select on sequence public.import_errors_id_seq to service_role;
grant usage, select on sequence public.import_rows_staging_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'excel-imports',
  'excel-imports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ]
)
on conflict (id) do nothing;

comment on table public.n8n_connection_tests is
  'Pruebas aisladas de conectividad de n8n. No contiene datos operacionales.';
comment on table public.import_jobs is
  'Control auditable de importaciones de Excel iniciadas por Molino Control.';
comment on table public.import_rows_staging is
  'Filas temporales normalizadas antes de publicar datos operacionales.';
comment on table public.import_errors is
  'Errores y advertencias correlacionados con trabajo, hoja, fila y columna.';
