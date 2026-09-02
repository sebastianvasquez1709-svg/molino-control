-- Molinos San Miguel · Remediación integral de auditoría 2026-09-02
-- Fórmulas exactas, fechas, paginación y endurecimiento de sesión local.

create table if not exists private.molino_local_credentials (
  profile_id uuid primary key references public.perfiles(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  must_change_pin boolean not null default true,
  updated_at timestamptz not null default now()
);

revoke all on table private.molino_local_credentials from public, anon, authenticated;

insert into private.molino_local_credentials(profile_id,pin_hash,must_change_pin)
select p.id,extensions.crypt('1234',extensions.gen_salt('bf',12)),true
from public.perfiles p
on conflict (profile_id) do nothing;

create or replace function private.molino_parse_maestro_date(p_value text)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v text := btrim(p_value);
  y integer; m integer; d integer; serial integer;
begin
  if v = '' then return null; end if;
  if v ~ '^\d+(\.\d+)?$' then
    serial := floor(v::numeric)::integer;
    if serial between 1 and 100000 then return date '1899-12-30' + serial; end if;
    return null;
  elsif v ~ '^\d{4}-\d{1,2}-\d{1,2}$' then
    y := split_part(v,'-',1)::integer;m := split_part(v,'-',2)::integer;d := split_part(v,'-',3)::integer;
  elsif v ~ '^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$' then
    d := split_part(translate(v,'/.','--'),'-',1)::integer;
    m := split_part(translate(v,'/.','--'),'-',2)::integer;
    y := split_part(translate(v,'/.','--'),'-',3)::integer;
  else
    return null;
  end if;
  return make_date(y,m,d);
exception when others then
  return null;
end;
$$;

create or replace function private.molino_norm_doc(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(translate(coalesce(p_value,''),'ÁÉÍÓÚÜÑáéíóúüñ[]()','AEIOUUNaeiouun    '),'\s+',' ','g'));
$$;

create or replace function private.molino_is_credit_note(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select btrim(private.molino_norm_doc(p_value)) ~ '^(NA|NT|NX|NY)(\s|$)'
      or btrim(private.molino_norm_doc(p_value)) ~ 'NOTA\s+(DE\s+)?CREDITO';
$$;

revoke all on function private.molino_parse_maestro_date(text) from public, anon, authenticated;
revoke all on function private.molino_norm_doc(text) from public, anon, authenticated;
revoke all on function private.molino_is_credit_note(text) from public, anon, authenticated;

create or replace function public.molino_local_auth(p_rut text,p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;v_rut text;v_email text;v_rol text;v_nombre text;
  v_hash text;v_failed integer;v_locked timestamptz;v_must_change boolean;
begin
  select p.id,p.rut,p.email,p.rol,coalesce(p.nombre,p.email),c.pin_hash,c.failed_attempts,c.locked_until,c.must_change_pin
    into v_id,v_rut,v_email,v_rol,v_nombre,v_hash,v_failed,v_locked,v_must_change
  from public.perfiles p
  join private.molino_local_credentials c on c.profile_id=p.id
  where regexp_replace(coalesce(p.rut,''),'[^0-9Kk]','','g')=upper(regexp_replace(coalesce(p_rut,''),'[^0-9Kk]','','g'))
    and p.activo=true
  limit 1;

  if v_id is null or (v_locked is not null and v_locked>now()) then
    return jsonb_build_object('ok',false,'message','Credenciales inválidas');
  end if;

  if coalesce(extensions.crypt(coalesce(p_pin,''),v_hash)=v_hash,false) is false then
    update private.molino_local_credentials
       set failed_attempts=failed_attempts+1,
           locked_until=case when failed_attempts+1>=8 then now()+interval '2 minutes' else locked_until end,
           updated_at=now()
     where profile_id=v_id;
    return jsonb_build_object('ok',false,'message','Credenciales inválidas');
  end if;

  update private.molino_local_credentials set failed_attempts=0,locked_until=null,updated_at=now() where profile_id=v_id;
  return jsonb_build_object('ok',true,'id',v_id,'rut',v_rut,'email',v_email,'rol',lower(v_rol),'nombre',v_nombre,'must_change_pin',v_must_change);
end;
$$;

create or replace function public.molino_change_pin_local(p_rut text,p_current_pin text,p_new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;v_id uuid;
begin
  if coalesce(p_new_pin,'') !~ '^\d{6,12}$' then
    return jsonb_build_object('ok',false,'message','La nueva clave debe tener entre 6 y 12 dígitos.');
  end if;
  v_auth:=public.molino_local_auth(p_rut,p_current_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) then return jsonb_build_object('ok',false,'message','Credenciales inválidas'); end if;
  v_id:=(v_auth->>'id')::uuid;
  update private.molino_local_credentials
     set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),failed_attempts=0,locked_until=null,must_change_pin=false,updated_at=now()
   where profile_id=v_id;
  return jsonb_build_object('ok',true,'message','Clave actualizada.');
end;
$$;

revoke all on function public.molino_local_auth(text,text) from public,anon,authenticated;
grant execute on function public.molino_local_auth(text,text) to anon,authenticated;
revoke all on function public.molino_change_pin_local(text,text,text) from public,anon,authenticated;
grant execute on function public.molino_change_pin_local(text,text,text) to anon,authenticated;

-- Corrige el parser de las futuras reconstrucciones operacionales sin reescribir su lógica de negocio.
do $patch$
declare v_def text;v_before text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='rebuild_maestro_operational_v2' and p.prokind='f';
  if v_def is null then raise exception 'rebuild_maestro_operational_v2 no existe'; end if;
  v_before:=v_def;
  v_def:=replace(v_def,
    $$case when jsonb_typeof(datos_originales->'L')='number' then date '1899-12-30'+floor((datos_originales->>'L')::numeric)::int end$$,
    $$private.molino_parse_maestro_date(datos_originales->>'L')$$);
  v_def:=replace(v_def,
    $$case when jsonb_typeof(datos_originales->'C')='number' then date '1899-12-30'+floor((datos_originales->>'C')::numeric)::int end$$,
    $$private.molino_parse_maestro_date(datos_originales->>'C')$$);
  v_def:=replace(v_def,
    $$case when jsonb_typeof(mf.datos_originales->'L')='number' then date '1899-12-30'+floor((mf.datos_originales->>'L')::numeric)::int else current_date end$$,
    $$coalesce(private.molino_parse_maestro_date(mf.datos_originales->>'L'),current_date)$$);
  if v_def=v_before or position('jsonb_typeof(datos_originales->''L'')' in v_def)>0 then
    raise exception 'No se pudo actualizar de forma segura el parser de rebuild_maestro_operational_v2';
  end if;
  execute v_def;
end;
$patch$;

-- Backfill determinista. Cada documento debe tener una sola fecha de origen.
do $$
declare v_import uuid;v_ambiguous integer;v_remaining integer;
begin
  select id into v_import from public.maestro_importaciones where estado in ('validado','publicado') order by created_at desc limit 1;
  if v_import is null then raise exception 'No existe un Maestro validado o publicado'; end if;

  select count(*) into v_ambiguous from (
    select btrim(datos_originales->>'N') tipo,btrim(datos_originales->>'O') folio
    from public.maestro_fuente_filas
    where importacion_id=v_import and hoja='BASE DE DATOS' and fila_excel>1
    group by 1,2 having count(distinct private.molino_parse_maestro_date(datos_originales->>'L')) filter(where private.molino_parse_maestro_date(datos_originales->>'L') is not null)>1
  ) q;
  if v_ambiguous>0 then raise exception 'Backfill detenido: % documentos BASE tienen fechas ambiguas',v_ambiguous; end if;

  with src as (
    select btrim(datos_originales->>'N') tipo,btrim(datos_originales->>'O') folio,min(private.molino_parse_maestro_date(datos_originales->>'L')) fecha
    from public.maestro_fuente_filas
    where importacion_id=v_import and hoja='BASE DE DATOS' and fila_excel>1
    group by 1,2
  )
  update public.documentos d set fecha=s.fecha,updated_at=now()
  from src s where d.fecha is null and d.tipo=s.tipo and btrim(coalesce(d.folio,''))=s.folio and s.fecha is not null;

  with src as (
    select btrim(datos_originales->>'P') tipo,btrim(datos_originales->>'B') folio,min(private.molino_parse_maestro_date(datos_originales->>'C')) fecha
    from public.maestro_fuente_filas
    where importacion_id=v_import and hoja='LIBRO' and fila_excel>1 and btrim(coalesce(datos_originales->>'P','')) in ('NOTA DE CREDITO','NOTA DE DEBITO')
    group by 1,2
  )
  update public.documentos d set fecha=s.fecha,updated_at=now()
  from src s where d.fecha is null and d.tipo=s.tipo and btrim(coalesce(d.folio,''))=s.folio and s.fecha is not null;

  select count(*) into v_remaining from public.documentos where fecha is null;
  if v_remaining<>0 then raise exception 'Backfill incompleto: quedan % documentos sin fecha',v_remaining; end if;
end;
$$;

create index if not exists documentos_fecha_created_idx on public.documentos(fecha desc,created_at desc);
create index if not exists despachos_fecha_created_idx on public.despachos(fecha desc,created_at desc);
create index if not exists despachos_creado_por_idx on public.despachos(creado_por);

create or replace function public.molino_app_bootstrap_local(p_rut text,p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;
begin
  v_auth:=public.molino_local_auth(p_rut,p_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'clientes',coalesce((select jsonb_agg(to_jsonb(c) order by c.razon_social,c.nombre_fantasia) from public.clientes c where c.activo),'[]'::jsonb),
    'productos',coalesce((select jsonb_agg(to_jsonb(p) order by p.nombre) from public.productos p where p.activo),'[]'::jsonb),
    'maestro',public.maestro_public_health(),
    'counts',jsonb_build_object('documentos',(select count(*) from public.documentos),'despachos',(select count(*) from public.despachos))
  );
end;
$$;

create or replace function public.molino_documents_page_local(p_rut text,p_pin text,p_offset integer default 0,p_limit integer default 750)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;v_offset integer:=greatest(coalesce(p_offset,0),0);v_limit integer:=least(greatest(coalesce(p_limit,750),1),1000);
begin
  v_auth:=public.molino_local_auth(p_rut,p_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.fecha desc nulls last,q.created_at desc) from (
      select * from public.documentos order by fecha desc nulls last,created_at desc offset v_offset limit v_limit
    ) q),'[]'::jsonb),
    'offset',v_offset,'limit',v_limit,'total',(select count(*) from public.documentos)
  );
end;
$$;

create or replace function public.molino_dispatches_page_local(p_rut text,p_pin text,p_offset integer default 0,p_limit integer default 750)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;v_offset integer:=greatest(coalesce(p_offset,0),0);v_limit integer:=least(greatest(coalesce(p_limit,750),1),1000);
begin
  v_auth:=public.molino_local_auth(p_rut,p_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.fecha desc,q.created_at desc) from (
      select * from public.despachos order by fecha desc,created_at desc offset v_offset limit v_limit
    ) q),'[]'::jsonb),
    'offset',v_offset,'limit',v_limit,'total',(select count(*) from public.despachos)
  );
end;
$$;

revoke all on function public.molino_app_bootstrap_local(text,text) from public,anon,authenticated;
grant execute on function public.molino_app_bootstrap_local(text,text) to anon,authenticated;
revoke all on function public.molino_documents_page_local(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.molino_documents_page_local(text,text,integer,integer) to anon,authenticated;
revoke all on function public.molino_dispatches_page_local(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.molino_dispatches_page_local(text,text,integer,integer) to anon,authenticated;

create or replace function public.molino_ine_sales_periods(p_rut text,p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;v_import uuid;
begin
  v_auth:=public.molino_local_auth(p_rut,p_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) or upper(coalesce(v_auth->>'rol',''))<>'ADMIN' then raise exception 'not_authorized'; end if;
  select id into v_import from public.maestro_importaciones where estado in ('validado','publicado') order by created_at desc limit 1;
  return coalesce((
    with controls as (
      select
        max(datos_originales->>'K') filter(where fila_excel=2) invoice,
        max(datos_originales->>'K') filter(where fila_excel=3) receipt,
        max(datos_originales->>'K') filter(where fila_excel=4) dispatch
      from public.maestro_fuente_filas where importacion_id=v_import and hoja='CODIGOS'
    ), dates as (
      select private.molino_parse_maestro_date(f.datos_originales->>'L') fecha
      from public.maestro_fuente_filas f cross join controls c
      where f.importacion_id=v_import and f.hoja='BASE DE DATOS' and f.fila_excel>1
        and btrim(coalesce(f.datos_originales->>'A',''))='1'
        and btrim(coalesce(f.datos_originales->>'N','')) in (c.invoice,c.receipt,c.dispatch)
    )
    select jsonb_agg(jsonb_build_object('year',extract(year from fecha)::int,'month',extract(month from fecha)::int,'key',to_char(fecha,'YYYY-MM')) order by fecha)
    from (select distinct date_trunc('month',fecha)::date fecha from dates where fecha is not null) q
  ),'[]'::jsonb);
end;
$$;

create or replace function public.molino_ine_sales_exact(p_rut text,p_pin text,p_anio integer,p_mes integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth jsonb;v_import uuid;v_file text;
begin
  v_auth:=public.molino_local_auth(p_rut,p_pin);
  if not coalesce((v_auth->>'ok')::boolean,false) or upper(coalesce(v_auth->>'rol',''))<>'ADMIN' then raise exception 'not_authorized'; end if;
  if p_anio not between 2000 and 2100 or p_mes not between 1 and 12 then raise exception 'invalid_period'; end if;
  select id,nombre_archivo into v_import,v_file from public.maestro_importaciones where estado in ('validado','publicado') order by created_at desc limit 1;
  if v_import is null then return jsonb_build_object('ok',false,'message','No existe un Maestro validado o publicado.'); end if;

  return (
    with families(name,ord) as (values
      ('HARINA GRANEL',1),('HARINA 25KG',2),('HARINA 10 KG',3),('HARINILLA KG',4),
      ('GRITZ SEMOL KG',5),('H. F. MAIZ KG',6),('ZOOTECNICA KG',7),('GERMEN KG',8)
    ), controls as (
      select max(datos_originales->>'K') filter(where fila_excel=2) invoice,
             max(datos_originales->>'K') filter(where fila_excel=3) receipt,
             max(datos_originales->>'K') filter(where fila_excel=4) dispatch
      from public.maestro_fuente_filas where importacion_id=v_import and hoja='CODIGOS'
    ), codes as (
      select distinct on (upper(btrim(datos_originales->>'A')))
        upper(btrim(datos_originales->>'A')) code,regexp_replace(upper(btrim(coalesce(datos_originales->>'C',''))),E'\\s+',' ','g') family,btrim(coalesce(datos_originales->>'G','')) classification
      from public.maestro_fuente_filas
      where importacion_id=v_import and hoja='CODIGOS' and fila_excel>1 and btrim(coalesce(datos_originales->>'A',''))<>''
      order by upper(btrim(datos_originales->>'A')),fila_excel
    ), prices as (
      select distinct on (public.maestro_num(datos_originales->>'R'))
        public.maestro_num(datos_originales->>'R') reference,public.maestro_num(datos_originales->>'S') price
      from public.maestro_fuente_filas
      where importacion_id=v_import and hoja='CODIGOS' and fila_excel between 16 and 111 and btrim(coalesce(datos_originales->>'R',''))<>''
      order by public.maestro_num(datos_originales->>'R'),fila_excel
    ), raw as (
      select f.fila_excel,upper(btrim(coalesce(f.datos_originales->>'B',''))) code,
        btrim(coalesce(f.datos_originales->>'N','')) docto,btrim(coalesce(f.datos_originales->>'O','')) folio,
        private.molino_parse_maestro_date(f.datos_originales->>'L') fecha,
        public.maestro_num(f.datos_originales->>'S') valor_movto,public.maestro_num(f.datos_originales->>'U') kg,
        c.family catalog_family,c.classification,ctl.invoice,ctl.receipt,ctl.dispatch,
        bp.price boleta_price,
        case upper(btrim(coalesce(f.datos_originales->>'B',''))) when 'G20' then 'GERMEN KG' when 'DEBILPOLI' then 'HARINA 25KG' else regexp_replace(upper(btrim(c.family)),E'\\s+',' ','g') end family
      from public.maestro_fuente_filas f cross join controls ctl
      left join codes c on c.code=upper(btrim(coalesce(f.datos_originales->>'B','')))
      left join prices bp on bp.reference=public.maestro_num(f.datos_originales->>'S')
      where f.importacion_id=v_import and f.hoja='BASE DE DATOS' and f.fila_excel>1 and btrim(coalesce(f.datos_originales->>'A',''))='1'
    ), period_rows as (
      select *,case when docto in (invoice,dispatch) then valor_movto when docto=receipt then coalesce(boleta_price,0) else 0 end price
      from raw
      where fecha>=make_date(p_anio,p_mes,1) and fecha<(make_date(p_anio,p_mes,1)+interval '1 month')
    ), valid as (
      select * from period_rows where docto in (invoice,receipt,dispatch) and upper(coalesce(classification,''))<>'NO CONTABILIZADO'
    ), agg as (
      select family,sum(price*kg) neto,sum(kg) kg,count(*) rows from valid where family in (select name from families) group by family
    ), detail as (
      select f.name familia,coalesce(a.neto,0) neto,coalesce(a.kg,0) kg,
        case when coalesce(a.kg,0)=0 then null else a.neto/a.kg end promedio,f.ord
      from families f left join agg a on a.family=f.name
    ), totals as (select sum(neto) total_neto,sum(kg) total_kg from detail), final as (
      select d.*,case when t.total_neto=0 then 0 else d.neto/t.total_neto end vn_pct,
        case when t.total_kg=0 then 0 else d.kg/t.total_kg end kg_pct from detail d cross join totals t
    ), qa as (
      select
        count(*) filter(where docto in (invoice,receipt,dispatch) and upper(coalesce(classification,''))<>'NO CONTABILIZADO' and (family is null or family not in (select name from families))) unmapped_rows,
        count(*) filter(where docto=receipt and upper(coalesce(classification,''))<>'NO CONTABILIZADO' and boleta_price is null) unmatched_receipts,
        count(*) filter(where private.molino_is_credit_note(docto)) excluded_credit_notes,
        count(*) filter(where upper(coalesce(classification,''))='NO CONTABILIZADO') excluded_no_contabilizado,
        count(*) filter(where code in ('G20','DEBILPOLI') and catalog_family is null) manual_override_rows
      from period_rows
    )
    select jsonb_build_object(
      'ok',true,'certified',((select unmapped_rows+unmatched_receipts from qa)=0),
      'engine_version','MAESTRO_CANONICAL_V1','source_file',v_file,'importacion_id',v_import,
      'period',jsonb_build_object('year',p_anio,'month',p_mes),
      'families',coalesce((select jsonb_agg(jsonb_build_object('familia',familia,'neto',neto,'kg',kg,'promedio',promedio,'vn_pct',vn_pct,'kg_pct',kg_pct) order by ord) from final),'[]'::jsonb),
      'total_neto',(select total_neto from totals),'total_kg',(select total_kg from totals),
      'total_promedio',(select case when total_kg=0 then null else total_neto/total_kg end from totals),
      'neto_harinas',(select sum(neto) from final where ord<=3),'kg_harinas',(select sum(kg) from final where ord<=3),
      'promedio_harinas',(select case when sum(kg)=0 then null else sum(neto)/sum(kg) end from final where ord<=3),
      'audit',(select to_jsonb(qa) from qa)
    )
  );
end;
$$;

revoke all on function public.molino_ine_sales_periods(text,text) from public,anon,authenticated;
grant execute on function public.molino_ine_sales_periods(text,text) to anon,authenticated;
revoke all on function public.molino_ine_sales_exact(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.molino_ine_sales_exact(text,text,integer,integer) to anon,authenticated;

-- El reporte Sacos/Granel conserva su contrato, pero usa fecha multiformato,
-- INFO=1 estricto y exclusión universal de NC.
do $report_patch$
declare v_def text;v_before text;v_date_start integer;v_date_end integer;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='molino_sacos_granel_report_v3' and p.prokind='f';
  if v_def is null then raise exception 'molino_sacos_granel_report_v3 no existe'; end if;
  v_before:=v_def;
  v_date_start:=position($$case when nullif(trim(j->>'L'),'')$$ in v_def);
  if v_date_start=0 then raise exception 'No se encontró el parser de fecha V3'; end if;
  v_date_end:=position('end fecha' in substring(v_def from v_date_start));
  if v_date_end=0 then raise exception 'El parser de fecha V3 no tiene cierre reconocible'; end if;
  v_def:=overlay(v_def placing $$private.molino_parse_maestro_date(j->>'L') fecha$$ from v_date_start for v_date_end+length('end fecha')-1);
  v_def:=replace(v_def,
    $$where info in ('','1') and sg in ('SACOS','GRANEL')
        and docto <> 'NOTA DE CREDITO' and anio ~ '^20[0-9]{2}$'$$,
    $$where info='1' and sg in ('SACOS','GRANEL')
        and not private.molino_is_credit_note(docto) and anio ~ '^20[0-9]{2}$'$$);
  v_def:=replace(v_def,
    $$count(*) filter(where docto='NOTA DE CREDITO') nc_rows_excluded,count(*) rows_valid$$,
    $$(select count(*) from x where private.molino_is_credit_note(docto)) nc_rows_excluded,count(*) rows_valid$$);
  if v_def=v_before or position('info in ('''',''1'')' in v_def)>0 then raise exception 'No se pudo sellar el reporte V3'; end if;
  execute v_def;
end;
$report_patch$;

-- Cierra ejecución pública implícita en funciones privilegiadas internas.
revoke all on function public.molino_app_snapshot() from public,anon;
grant execute on function public.molino_app_snapshot() to authenticated;
revoke all on function public.molino_ine_exact(text,text) from public,anon;
grant execute on function public.molino_ine_exact(text,text) to authenticated;
revoke all on function public.molino_sacos_granel_report(text,text) from public,anon;
grant execute on function public.molino_sacos_granel_report(text,text) to authenticated;
revoke all on function public.molino_sacos_granel_report_v3(text,text) from public,anon;
grant execute on function public.molino_sacos_granel_report_v3(text,text) to authenticated;
revoke all on function public.molino_app_snapshot_local(text,text) from public,anon,authenticated;
grant execute on function public.molino_app_snapshot_local(text,text) to anon,authenticated;
revoke all on function public.molino_existence_state_local(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.molino_existence_state_local(text,text,text,jsonb) to anon,authenticated;
revoke all on function public.molino_macro_dashboard_local(text,text) from public,anon,authenticated;
grant execute on function public.molino_macro_dashboard_local(text,text) to anon,authenticated;
revoke all on function public.molino_sacos_granel_report_local(text,text,text,text) from public,anon,authenticated;
grant execute on function public.molino_sacos_granel_report_local(text,text,text,text) to anon,authenticated;
