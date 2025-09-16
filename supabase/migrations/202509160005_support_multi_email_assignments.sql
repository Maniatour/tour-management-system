-- Support assistant_id/tour_guide_id columns that may contain multiple emails (comma/JSON-like)
-- by normalizing to an array and matching ANY element

begin;

-- Helper to split and normalize potential multi-email fields
create or replace function public.normalize_email_list(p text)
returns text[]
language plpgsql
immutable
as $$
declare
  cleaned text;
  arr text[];
begin
  cleaned := lower(btrim(coalesce(p, '')));
  if cleaned = '' then
    return array[]::text[];
  end if;
  -- remove common JSON/list decorations
  cleaned := replace(cleaned, '[', '');
  cleaned := replace(cleaned, ']', '');
  cleaned := replace(cleaned, '"', '');
  -- split by commas with optional spaces
  arr := regexp_split_to_array(cleaned, '\s*,\s*');
  return arr;
end;
$$;

-- Recreate policies to use ANY(normalize_email_list(...))
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tours' and policyname='tours_select_assigned_or_staff'
  ) then
    drop policy "tours_select_assigned_or_staff" on public.tours;
  end if;

  create policy "tours_select_assigned_or_staff" on public.tours
    for select
    using (
      public.is_staff(public.current_email())
      or public.current_email() = any(public.normalize_email_list(tour_guide_id))
      or public.current_email() = any(public.normalize_email_list(assistant_id))
    );

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservations' and policyname='reservations_select_assigned_via_tour'
  ) then
    drop policy "reservations_select_assigned_via_tour" on public.reservations;
  end if;

  create policy "reservations_select_assigned_via_tour" on public.reservations
    for select
    using (
      exists (
        select 1 from public.tours t
        where t.id = reservations.tour_id
          and (
            public.is_staff(public.current_email())
            or public.current_email() = any(public.normalize_email_list(t.tour_guide_id))
            or public.current_email() = any(public.normalize_email_list(t.assistant_id))
          )
      )
    );
end$$;

commit;


