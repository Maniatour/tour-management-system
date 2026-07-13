-- Security Advisor P1: function_search_path_mutable
-- Sets search_path on public app functions missing it (search-path hijacking mitigation).
-- Skips extension-owned functions (e.g. pg_trgm set_limit) and objects we do not own.
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

begin;

do $$
declare
  r record;
  altered int := 0;
  skipped int := 0;
begin
  for r in
    select p.oid::regprocedure as func_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and p.proowner = (select oid from pg_roles where rolname = current_user)
      -- extension-provided functions (pg_trgm set_limit/show_limit, etc.)
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) as cfg
          where cfg like 'search_path=%'
        )
      )
    order by 1
  loop
    begin
      execute format('alter function %s set search_path = public', r.func_signature);
      altered := altered + 1;
    exception
      when insufficient_privilege then
        skipped := skipped + 1;
        raise notice 'skipped (not owner): %', r.func_signature;
    end;
  end loop;

  raise notice 'function search_path hardened: % altered, % skipped', altered, skipped;
end$$;

commit;
