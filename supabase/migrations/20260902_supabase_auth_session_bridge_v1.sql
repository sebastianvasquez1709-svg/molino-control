-- Molino Control · transición segura RUT -> Supabase Auth JWT.
-- El PIN temporal solo se sincroniza para perfiles que aún deben cambiarlo.

update auth.users u
set encrypted_password=extensions.crypt('1234',extensions.gen_salt('bf',12)),
    raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object(
      'role',lower(coalesce(p.rol,'operador')),
      'rut',p.rut,
      'nombre',coalesce(p.nombre,p.email),
      'must_change_pin',c.must_change_pin
    ),
    updated_at=now()
from public.perfiles p
join private.molino_local_credentials c on c.profile_id=p.id
where u.id=p.id and c.must_change_pin=true;

-- Un JWT existente nunca puede validar el PIN de un perfil diferente.
do $patch$
declare v_def text;v_before text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='molino_local_auth' and p.prokind='f';
  if v_def is null then raise exception 'molino_local_auth no existe'; end if;
  v_before:=v_def;
  v_def:=replace(v_def,
    $$if v_id is null or (v_locked is not null and v_locked>now()) then$$,
    $$if v_id is null or (auth.uid() is not null and auth.uid()<>v_id) or (v_locked is not null and v_locked>now()) then$$);
  if v_def=v_before then raise exception 'No se pudo vincular molino_local_auth al JWT'; end if;
  execute v_def;
end;
$patch$;

create or replace function public.molino_change_password_auth(p_current_pin text,p_new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid:=auth.uid();v_hash text;
begin
  if v_id is null then raise exception 'not_authorized'; end if;
  if coalesce(p_new_pin,'') !~ '^\d{6,12}$' then
    return jsonb_build_object('ok',false,'message','La nueva clave debe tener entre 6 y 12 dígitos.');
  end if;
  select pin_hash into v_hash from private.molino_local_credentials where profile_id=v_id for update;
  if v_hash is null or not coalesce(extensions.crypt(coalesce(p_current_pin,''),v_hash)=v_hash,false) then
    return jsonb_build_object('ok',false,'message','La clave actual no es correcta.');
  end if;
  update private.molino_local_credentials
     set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),
         failed_attempts=0,locked_until=null,must_change_pin=false,updated_at=now()
   where profile_id=v_id;
  update auth.users
     set encrypted_password=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),
         raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('must_change_pin',false),
         updated_at=now()
   where id=v_id;
  return jsonb_build_object('ok',true,'message','Clave actualizada con sesión Supabase Auth.');
end;
$$;

revoke all on function public.molino_change_password_auth(text,text) from public,anon,authenticated;
grant execute on function public.molino_change_password_auth(text,text) to authenticated;

-- Solo el puente de identificación inicial conserva acceso anónimo.
revoke all on function public.molino_local_auth(text,text) from public,anon,authenticated;
grant execute on function public.molino_local_auth(text,text) to anon;

-- Toda lectura y operación de negocio requiere un JWT válido.
revoke execute on function public.molino_app_bootstrap_local(text,text) from anon;
revoke execute on function public.molino_documents_page_local(text,text,integer,integer) from anon;
revoke execute on function public.molino_dispatches_page_local(text,text,integer,integer) from anon;
revoke execute on function public.molino_ine_sales_periods(text,text) from anon;
revoke execute on function public.molino_ine_sales_exact(text,text,integer,integer) from anon;
revoke execute on function public.molino_existence_state_local(text,text,text,jsonb) from anon;
revoke execute on function public.molino_macro_dashboard_local(text,text) from anon;
revoke execute on function public.molino_sacos_granel_report_local(text,text,text,text) from anon;
revoke execute on function public.molino_change_pin_local(text,text,text) from anon;

grant execute on function public.molino_app_bootstrap_local(text,text) to authenticated;
grant execute on function public.molino_documents_page_local(text,text,integer,integer) to authenticated;
grant execute on function public.molino_dispatches_page_local(text,text,integer,integer) to authenticated;
grant execute on function public.molino_ine_sales_periods(text,text) to authenticated;
grant execute on function public.molino_ine_sales_exact(text,text,integer,integer) to authenticated;
grant execute on function public.molino_existence_state_local(text,text,text,jsonb) to authenticated;
grant execute on function public.molino_macro_dashboard_local(text,text) to authenticated;
grant execute on function public.molino_sacos_granel_report_local(text,text,text,text) to authenticated;
