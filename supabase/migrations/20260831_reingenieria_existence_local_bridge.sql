-- Molino Control · Reingeniería V1
-- Puente transitorio para que la sesión local existente pueda sincronizar
-- el historial de Registros de Existencia con Supabase sin exponer tablas.
-- Se elimina cuando la aplicación migre completamente a Supabase Auth.

create or replace function public.molino_existence_state_local(
  p_rut text,
  p_pin text,
  p_action text default 'list',
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth jsonb;
  v_owner uuid;
  v_action text := lower(coalesce(p_action,'list'));
  v_key text;
  v_periodo text;
  v_row jsonb;
begin
  v_auth := public.molino_local_auth(p_rut, p_pin);
  if not coalesce((v_auth->>'ok')::boolean, false)
     or upper(coalesce(v_auth->>'rol','')) <> 'ADMIN' then
    raise exception 'not_authorized';
  end if;

  v_owner := (v_auth->>'id')::uuid;

  if v_action = 'list' then
    return jsonb_build_object(
      'ok', true,
      'rows', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'key', r.key,
            'periodo', r.periodo,
            'payload', r.payload,
            'updated_at', r.updated_at
          ) order by r.key
        )
        from public.app_existence_records r
        where r.owner = v_owner
      ), '[]'::jsonb)
    );

  elsif v_action = 'upsert' then
    v_key := nullif(trim(coalesce(p_payload->>'key','')), '');
    v_periodo := coalesce(nullif(trim(coalesce(p_payload->>'periodo','')), ''), v_key);
    if v_key is null then raise exception 'invalid_key'; end if;

    insert into public.app_existence_records(key, periodo, payload, owner)
    values (v_key, v_periodo, coalesce(p_payload->'payload','{}'::jsonb), v_owner)
    on conflict (key) do update
      set periodo = excluded.periodo,
          payload = excluded.payload,
          updated_at = now()
      where public.app_existence_records.owner = v_owner
    returning jsonb_build_object(
      'key', key,
      'periodo', periodo,
      'payload', payload,
      'updated_at', updated_at
    ) into v_row;

    if v_row is null then raise exception 'key_owned_by_other_user'; end if;
    return jsonb_build_object('ok', true, 'row', v_row);

  elsif v_action = 'delete' then
    v_key := nullif(trim(coalesce(p_payload->>'key','')), '');
    if v_key is null then raise exception 'invalid_key'; end if;
    delete from public.app_existence_records
      where key = v_key and owner = v_owner;
    return jsonb_build_object('ok', true, 'deleted', found, 'key', v_key);

  else
    raise exception 'invalid_action';
  end if;
end;
$$;

revoke all on function public.molino_existence_state_local(text,text,text,jsonb) from public;
grant execute on function public.molino_existence_state_local(text,text,text,jsonb) to anon, authenticated;

comment on function public.molino_existence_state_local(text,text,text,jsonb)
is 'Puente transitorio de Molino Control para historial de Existencia usando la sesión local heredada; retirar al migrar completamente a Supabase Auth.';
