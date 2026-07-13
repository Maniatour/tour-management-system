-- Security Advisor P1 fix: anon RPC warnings persist because functions still have
-- GRANT EXECUTE TO PUBLIC (default in PostgreSQL). Revoking from anon alone is not enough.
--
-- Strategy:
--   1) REVOKE EXECUTE FROM PUBLIC on all public SECURITY DEFINER functions
--   2) GRANT EXECUTE TO authenticated + service_role (app + RLS + cron)
--   3) GRANT EXECUTE TO anon only on public customer-chat RPCs (4 functions)
--   4) service_role-only for debug introspection RPCs

begin;

do $$
declare
  r record;
  anon_public text[] := array[
    'get_public_chat_room_bundle_by_code(text)',
    'get_chat_messages_by_room_code(text,integer)',
    'get_chat_message_count_by_room_code(text)',
    'get_chat_participants_by_room_code(text)'
  ];
  service_only text[] := array[
    'get_all_tables()',
    'generate_monthly_stats(text,date)'
  ];
  processed int := 0;
begin
  for r in
    select p.oid::regprocedure::text as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prokind in ('f', 'p')
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    begin
      execute format('revoke execute on function %s from public', r.func_sig);
      execute format('revoke execute on function %s from anon', r.func_sig);

      if r.func_sig = any (service_only) then
        execute format('revoke execute on function %s from authenticated', r.func_sig);
        execute format('grant execute on function %s to service_role', r.func_sig);
      elsif r.func_sig = any (anon_public) then
        execute format('grant execute on function %s to anon, authenticated, service_role', r.func_sig);
      else
        execute format('grant execute on function %s to authenticated, service_role', r.func_sig);
      end if;

      processed := processed + 1;
    exception
      when others then
        raise notice 'skip rpc harden %: %', r.func_sig, sqlerrm;
    end;
  end loop;

  raise notice 'rpc public execute hardened: % functions', processed;
end$$;

commit;
