-- Security Advisor P0 fixes (2026-07-13)
-- 1) Drop legacy USING(true) policies that bypass RLS (coupons, ticket_booking_* children)
-- 2) Enable RLS on public tables missing it (backups, cache, internal)
-- 3) Convert Security Definer views → security_invoker (PG15+)
--
-- Resolves Security Advisor ERRORS:
--   - rls_disabled_in_public (11 tables)
--   - security_definer_view (18 views)
-- And critical WARN:
--   - rls_policy_always_true on coupons + ticket_booking_* child tables
--
-- Depends: rls_is_staff_session_ok, rls_team_member_session_ok,
--          ticket_booking_row_accessible (20260619220000+).

begin;

-- =============================================================================
-- 1) coupons — remove public ALL(true); active-only anon read + staff write
-- =============================================================================
alter table public.coupons enable row level security;

drop policy if exists "Allow public access" on public.coupons;
drop policy if exists "coupons_anon_select_active" on public.coupons;
drop policy if exists "coupons_select_staff" on public.coupons;
drop policy if exists "coupons_insert_staff" on public.coupons;
drop policy if exists "coupons_update_staff" on public.coupons;
drop policy if exists "coupons_delete_staff" on public.coupons;

revoke all on table public.coupons from anon;
grant select on table public.coupons to anon;

create policy "coupons_anon_select_active"
  on public.coupons for select to anon
  using (lower(trim(coalesce(status, ''))) = 'active');

create policy "coupons_select_staff"
  on public.coupons for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "coupons_insert_staff"
  on public.coupons for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "coupons_update_staff"
  on public.coupons for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "coupons_delete_staff"
  on public.coupons for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- =============================================================================
-- 2) ticket_booking_* children — drop legacy ALL(true); keep 202606192200 policies
-- =============================================================================
drop policy if exists "Enable all access for ticket_booking_status_logs"
  on public.ticket_booking_status_logs;
drop policy if exists "Enable all access for ticket_booking_changes"
  on public.ticket_booking_changes;
drop policy if exists "Enable all access for ticket_booking_payments"
  on public.ticket_booking_payments;
drop policy if exists "Enable all access for ticket_booking_refunds"
  on public.ticket_booking_refunds;

-- Ensure anon cannot reach payment/audit child rows via PostgREST
revoke all on table public.ticket_booking_status_logs from anon;
revoke all on table public.ticket_booking_changes from anon;
revoke all on table public.ticket_booking_payments from anon;
revoke all on table public.ticket_booking_refunds from anon;

-- =============================================================================
-- 3) Backup / internal tables — RLS on, no anon/authenticated access
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'dynamic_pricing_backup',
    'products_backup_20260626_pickup_sending_merge',
    'products_choices_backup',
    'reservations_backup_before_product_migration',
    'reservations_choices_backup',
    'product_id_mapping_suggestions'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end$$;

-- =============================================================================
-- 4) Operational tables — staff-only (no app anon usage)
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'global_options'
  ) then
    alter table public.global_options enable row level security;
    revoke all on table public.global_options from anon;
    grant select, insert, update, delete on table public.global_options to authenticated;

    drop policy if exists "global_options_staff_all" on public.global_options;
    create policy "global_options_staff_all"
      on public.global_options for all to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_maps'
  ) then
    alter table public.tour_course_maps enable row level security;
    revoke all on table public.tour_course_maps from anon;
    grant select, insert, update, delete on table public.tour_course_maps to authenticated;

    drop policy if exists "tour_course_maps_staff_all" on public.tour_course_maps;
    create policy "tour_course_maps_staff_all"
      on public.tour_course_maps for all to authenticated
      using (public.rls_team_member_session_ok())
      with check (public.rls_team_member_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_products'
  ) then
    alter table public.tour_course_products enable row level security;
    revoke all on table public.tour_course_products from anon;
    grant select, insert, update, delete on table public.tour_course_products to authenticated;

    drop policy if exists "tour_course_products_staff_all" on public.tour_course_products;
    create policy "tour_course_products_staff_all"
      on public.tour_course_products for all to authenticated
      using (public.rls_team_member_session_ok())
      with check (public.rls_team_member_session_ok());
  end if;
end$$;

-- =============================================================================
-- 5) Weather cache — public read (tour pages), writes via service_role/cron
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'weather_data'
  ) then
    alter table public.weather_data enable row level security;
    revoke all on table public.weather_data from anon;
    grant select on table public.weather_data to anon;

    drop policy if exists "weather_data_anon_select" on public.weather_data;
    create policy "weather_data_anon_select"
      on public.weather_data for select to anon
      using (true);

    drop policy if exists "weather_data_staff_all" on public.weather_data;
    create policy "weather_data_staff_all"
      on public.weather_data for all to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sunrise_sunset_data'
  ) then
    alter table public.sunrise_sunset_data enable row level security;
    revoke all on table public.sunrise_sunset_data from anon;
    grant select on table public.sunrise_sunset_data to anon;

    drop policy if exists "sunrise_sunset_data_anon_select" on public.sunrise_sunset_data;
    create policy "sunrise_sunset_data_anon_select"
      on public.sunrise_sunset_data for select to anon
      using (true);

    drop policy if exists "sunrise_sunset_data_staff_all" on public.sunrise_sunset_data;
    create policy "sunrise_sunset_data_staff_all"
      on public.sunrise_sunset_data for all to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());
  end if;
end$$;

-- =============================================================================
-- 6) Security Definer views → security_invoker (querying user RLS applies)
-- =============================================================================
do $$
declare
  v text;
begin
  foreach v in array array[
    'audit_logs_view',
    'cash_balance',
    'channels_with_sub_channels',
    'choice_templates',
    'current_guide_costs',
    'current_reservation_status',
    'dynamic_pricing_choices_view',
    'invalid_product_id_report',
    'migration_results',
    'option_migration_results',
    'options_with_images',
    'product_id_analysis',
    'product_options_check',
    'reservation_choices_view',
    'reservation_choices_with_names',
    'reservations_with_invalid_products',
    'tags_with_translations',
    'translations_with_values'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v
        and c.relkind = 'v'
    ) then
      execute format(
        'alter view public.%I set (security_invoker = true)',
        v
      );
    end if;
  end loop;
end$$;

commit;
