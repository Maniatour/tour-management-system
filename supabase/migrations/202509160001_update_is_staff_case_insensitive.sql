-- Make team.position comparisons case-insensitive and harden is_staff
-- Safe to run multiple times

begin;

-- 1) Ensure citext extension exists (case-insensitive text type)
create extension if not exists citext with schema public;

-- 2) Alter team.position to citext so equality checks are case-insensitive
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team'
      and column_name = 'position'
      and udt_name <> 'citext'
  ) then
    alter table public.team
      alter column position type citext using position::citext;
  end if;
end$$;

-- 3) Recreate is_staff to be case-insensitive for email and position checks
create or replace function public.is_staff(p_email text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.team
    where lower(email) = lower(p_email)
      and is_active = true
      -- position is citext now; equality is case-insensitive
      and lower(coalesce(position::text, '')) in (
        'super','office manager','manager','admin','op'
      )
  );
$$;

commit;


