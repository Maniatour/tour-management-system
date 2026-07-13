-- Security Advisor P1: extension_in_public (pg_trgm)
-- Moves pg_trgm from public to extensions schema (Supabase recommended layout).

begin;

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    alter extension pg_trgm set schema extensions;
    raise notice 'pg_trgm moved to extensions schema';
  else
    raise notice 'pg_trgm not installed — skipped';
  end if;
exception
  when insufficient_privilege then
    raise notice 'could not move pg_trgm (insufficient privilege) — run as superuser in SQL Editor';
  when others then
    raise notice 'pg_trgm move skipped: %', sqlerrm;
end$$;

commit;
