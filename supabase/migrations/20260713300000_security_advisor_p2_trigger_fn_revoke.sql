-- Security Advisor P2: authenticated_security_definer_function_executable (trigger functions)
-- Trigger functions do not check the invoker's EXECUTE privilege at fire time,
-- so revoking anon/authenticated is safe and removes them from the PostgREST RPC surface.
-- Targets: sync_partner_funds_from_*, record_reservation_status_event,
--          company_structured_doc_section_versions_set_revision, etc.

begin;

do $$
declare
  r record;
  revoked int := 0;
begin
  for r in
    select p.oid::regprocedure::text as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prorettype = 'trigger'::regtype
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    begin
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        r.func_sig
      );
      revoked := revoked + 1;
    exception
      when others then
        raise notice 'skip trigger fn revoke %: %', r.func_sig, sqlerrm;
    end;
  end loop;

  raise notice 'trigger function execute revoked: % functions', revoked;
end$$;

commit;
