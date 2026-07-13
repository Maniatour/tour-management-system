-- Security Advisor P1: anon_security_definer_function_executable (~61 warnings)
-- Revokes anon EXECUTE on internal SECURITY DEFINER RPCs.
-- NOTE: Revoking from anon alone is insufficient when GRANT EXECUTE TO PUBLIC exists.
--       Apply 20260713290000_security_advisor_p1_rpc_public_revoke.sql after this file.
-- Keeps public customer-chat RPCs callable without sign-in.-- RLS helper functions remain executable by authenticated (required for policies).

begin;

-- Customer tour chat (anon + authenticated)
grant execute on function public.get_public_chat_room_bundle_by_code(text) to anon, authenticated;
grant execute on function public.get_chat_messages_by_room_code(text, integer) to anon, authenticated;
grant execute on function public.get_chat_message_count_by_room_code(text) to anon, authenticated;
grant execute on function public.get_chat_participants_by_room_code(text) to anon, authenticated;

do $$
declare
  r record;
  keep_anon text[] := array[
    'get_public_chat_room_bundle_by_code(text)',
    'get_chat_messages_by_room_code(text,integer)',
    'get_chat_message_count_by_room_code(text)',
    'get_chat_participants_by_room_code(text)'
  ];
  revoked int := 0;
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
    if r.func_sig = any (keep_anon) then
      continue;
    end if;

    begin
      execute format('revoke execute on function %s from anon', r.func_sig);
      revoked := revoked + 1;
    exception
      when others then
        raise notice 'skip anon revoke %: %', r.func_sig, sqlerrm;
    end;
  end loop;

  raise notice 'anon execute revoked on % security definer functions', revoked;
end$$;

-- Debug / schema introspection — service_role only
revoke execute on function public.get_all_tables() from anon, authenticated;
grant execute on function public.get_all_tables() to service_role;

commit;
