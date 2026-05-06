-- is_staff() / is_team_member(current_email) / is_admin_user(current_email) 만 두면
-- JWT email 이 비어 current_email() 이 실패할 때 관리 화면 CRUD 가 42501 로 막힐 수 있다.
-- auth.users 기반 is_*_for_session() 과 session_email_from_auth_users() 경로를 정책·헬퍼에 일괄 반영한다.
--
-- Depends: session_email_from_auth_users, is_staff_for_session, is_team_member_for_session,
--          is_admin_user_for_session, submitted_by_matches_session_auth_email (20260621160000),
--          nullif_blank_tour_id (20260621150000).
-- Skips: reservation_pricing, audit_logs_insert_team (20260621250000), reservations/customers/team/tours
--        (20260621170000–21180000), ticket_bookings 정책·ticket_booking_row_accessible (20260621160000).

begin;

-- ---------- 공통: RLS 식에서 재사용 (invoker, stable) ----------
create or replace function public.rls_is_staff_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_staff() or public.is_staff_for_session();
$$;

create or replace function public.rls_is_staff_current_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_staff(public.current_email()) or public.is_staff_for_session();
$$;

create or replace function public.rls_team_member_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_team_member(public.current_email())
    or public.is_team_member_for_session();
$$;

create or replace function public.rls_admin_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session();
$$;

create or replace function public.rls_email_eq_session_or_current(p text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    length(trim(coalesce(p, ''))) > 0
    and (
      lower(trim(coalesce(p, ''))) = public.current_email()
      or (
        length(public.session_email_from_auth_users()) > 0
        and lower(trim(coalesce(p, ''))) = public.session_email_from_auth_users()
      )
    );
$$;

create or replace function public.rls_shared_settings_admin_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.team
      where coalesce(team.is_active, true) = true
        and (team.position = 'super' or team.position = 'admin')
        and (
          lower(trim(team.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or lower(trim(team.email)) = public.session_email_from_auth_users()
        )
    )
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) in (
      'info@maniatour.com',
      'wooyong.shim09@gmail.com'
    )
    or public.session_email_from_auth_users() in (
      'info@maniatour.com',
      'wooyong.shim09@gmail.com'
    );
$$;

comment on function public.rls_is_staff_session_ok() is
  'RLS 보조: is_staff() 또는 auth.users 세션 이메일 기준 스태프.';
comment on function public.rls_is_staff_current_session_ok() is
  'RLS 보조: is_staff(current_email) 또는 세션 스태프.';
comment on function public.rls_team_member_session_ok() is
  'RLS 보조: 팀 멤버(current_email 또는 세션).';
comment on function public.rls_admin_session_ok() is
  'RLS 보조: is_admin_user(current_email) 또는 세션.';
comment on function public.rls_email_eq_session_or_current(text) is
  'RLS 보조: 문자열이 current_email 또는 session_email_from_auth_users 와 일치.';
comment on function public.rls_shared_settings_admin_ok() is
  'RLS 보조: shared_settings super/admin 또는 화이트리스트 (JWT·세션).';

-- ---------- financial: 명세 업로드 권한 ----------
create or replace function public.statement_csv_upload_privileged()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    lower(trim(coalesce(public.current_email(), ''))) = 'info@maniatour.com'
    or public.session_email_from_auth_users() = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where coalesce(t.is_active, true) = true
        and lower(coalesce(t.position::text, '')) = 'super'
        and (
          lower(t.email) = public.current_email()
          or lower(t.email) = public.session_email_from_auth_users()
        )
    );
$$;

-- ---------- 사이트 접근 매트릭스 ----------
create or replace function public.can_edit_site_access_matrix()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select exists (
        select 1
        from public.team t
        where t.is_active = true
          and (
            lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
            or lower(trim(t.email)) = public.session_email_from_auth_users()
          )
          and (
            lower(trim(coalesce(t.position, ''))) in ('super', 'office manager', '매니저')
            or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) in (
              'info@maniatour.com',
              'wooyong.shim09@gmail.com'
            )
            or public.session_email_from_auth_users() in (
              'info@maniatour.com',
              'wooyong.shim09@gmail.com'
            )
          )
      )
    ),
    false
  );
$$;

-- ---------- 호텔 부킹: 티켓과 동일하게 세션 스태프·관리자·팀 ----------
create or replace function public.tour_hotel_booking_row_accessible(p_booking_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_booking_id is not null
  and exists (
    select 1
    from public.tour_hotel_bookings hb
    where hb.id = p_booking_id
      and (
        public.is_staff()
        or public.is_staff_for_session()
        or public.is_admin_user(public.current_email())
        or public.is_admin_user_for_session()
        or public.is_team_member(public.current_email())
        or public.is_team_member_for_session()
        or (
          public.nullif_blank_tour_id(hb.tour_id) is not null
          and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(hb.tour_id))
        )
      )
  );
$$;

drop policy if exists "tour_hotel_bookings_insert_accessible" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_insert_accessible"
  on public.tour_hotel_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
  );

drop policy if exists "tour_hotel_bookings_update_accessible" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_update_accessible"
  on public.tour_hotel_bookings for update to authenticated
  using (public.tour_hotel_booking_row_accessible(id))
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
  );

-- ---------- booking_history ----------
alter policy "booking_history_select_accessible" on public.booking_history
  using (
    public.rls_is_staff_session_ok()
    or public.rls_admin_session_ok()
    or public.rls_team_member_session_ok()
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

alter policy "booking_history_insert_accessible" on public.booking_history
  with check (
    public.rls_is_staff_session_ok()
    or public.rls_admin_session_ok()
    or public.rls_team_member_session_ok()
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

alter policy "booking_history_update_staff" on public.booking_history
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

alter policy "booking_history_delete_staff" on public.booking_history
  using (public.rls_is_staff_session_ok());

-- ---------- payment_methods / product_options (19230000) ----------
alter policy "payment_methods_select_team" on public.payment_methods
  using (public.rls_team_member_session_ok());

alter policy "payment_methods_insert_staff" on public.payment_methods
  with check (public.rls_is_staff_session_ok());

alter policy "payment_methods_update_staff" on public.payment_methods
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

alter policy "payment_methods_delete_staff" on public.payment_methods
  using (public.rls_is_staff_session_ok());

alter policy "product_options_select_team" on public.product_options
  using (public.rls_team_member_session_ok());

alter policy "product_options_insert_staff" on public.product_options
  with check (public.rls_is_staff_session_ok());

alter policy "product_options_update_staff" on public.product_options
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

alter policy "product_options_delete_staff" on public.product_options
  using (public.rls_is_staff_session_ok());

-- ---------- 19230000: staff-only blocks ----------
alter policy "cash_transactions_select_staff" on public.cash_transactions using (public.rls_is_staff_session_ok());
alter policy "cash_transactions_insert_staff" on public.cash_transactions with check (public.rls_is_staff_session_ok());
alter policy "cash_transactions_update_staff" on public.cash_transactions using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "cash_transactions_delete_staff" on public.cash_transactions using (public.rls_is_staff_session_ok());

alter policy "invoices_select_staff" on public.invoices using (public.rls_is_staff_session_ok());
alter policy "invoices_insert_staff" on public.invoices with check (public.rls_is_staff_session_ok());
alter policy "invoices_update_staff" on public.invoices using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "invoices_delete_staff" on public.invoices using (public.rls_is_staff_session_ok());

alter policy "estimates_select_staff" on public.estimates using (public.rls_is_staff_session_ok());
alter policy "estimates_insert_staff" on public.estimates with check (public.rls_is_staff_session_ok());
alter policy "estimates_update_staff" on public.estimates using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "estimates_delete_staff" on public.estimates using (public.rls_is_staff_session_ok());

alter policy "resident_inquiry_email_templates_select_staff" on public.resident_inquiry_email_templates using (public.rls_is_staff_session_ok());
alter policy "resident_inquiry_email_templates_insert_staff" on public.resident_inquiry_email_templates with check (public.rls_is_staff_session_ok());
alter policy "resident_inquiry_email_templates_update_staff" on public.resident_inquiry_email_templates using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "resident_inquiry_email_templates_delete_staff" on public.resident_inquiry_email_templates using (public.rls_is_staff_session_ok());

alter policy "expense_standard_categories_select_staff" on public.expense_standard_categories using (public.rls_is_staff_session_ok());
alter policy "expense_standard_categories_insert_staff" on public.expense_standard_categories with check (public.rls_is_staff_session_ok());
alter policy "expense_standard_categories_update_staff" on public.expense_standard_categories using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "expense_standard_categories_delete_staff" on public.expense_standard_categories using (public.rls_is_staff_session_ok());

alter policy "expense_category_mappings_select_staff" on public.expense_category_mappings using (public.rls_is_staff_session_ok());
alter policy "expense_category_mappings_insert_staff" on public.expense_category_mappings with check (public.rls_is_staff_session_ok());
alter policy "expense_category_mappings_update_staff" on public.expense_category_mappings using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "expense_category_mappings_delete_staff" on public.expense_category_mappings using (public.rls_is_staff_session_ok());

alter policy "expense_normalization_mappings_select_staff" on public.expense_normalization_mappings using (public.rls_is_staff_session_ok());
alter policy "expense_normalization_mappings_insert_staff" on public.expense_normalization_mappings with check (public.rls_is_staff_session_ok());
alter policy "expense_normalization_mappings_update_staff" on public.expense_normalization_mappings using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "expense_normalization_mappings_delete_staff" on public.expense_normalization_mappings using (public.rls_is_staff_session_ok());

-- ---------- vehicles / suppliers (19170000) ----------
alter policy "vehicles_select_staff" on public.vehicles using (public.rls_is_staff_session_ok());
alter policy "vehicles_insert_staff" on public.vehicles with check (public.rls_is_staff_session_ok());
alter policy "vehicles_update_staff" on public.vehicles using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "vehicles_delete_staff" on public.vehicles using (public.rls_is_staff_session_ok());

alter policy "suppliers_select_staff" on public.suppliers using (public.rls_is_staff_session_ok());
alter policy "suppliers_insert_staff" on public.suppliers with check (public.rls_is_staff_session_ok());
alter policy "suppliers_update_staff" on public.suppliers using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "suppliers_delete_staff" on public.suppliers using (public.rls_is_staff_session_ok());

alter policy "supplier_products_select_staff" on public.supplier_products using (public.rls_is_staff_session_ok());
alter policy "supplier_products_insert_staff" on public.supplier_products with check (public.rls_is_staff_session_ok());
alter policy "supplier_products_update_staff" on public.supplier_products using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "supplier_products_delete_staff" on public.supplier_products using (public.rls_is_staff_session_ok());

alter policy "supplier_ticket_purchases_select_staff" on public.supplier_ticket_purchases using (public.rls_is_staff_session_ok());
alter policy "supplier_ticket_purchases_insert_staff" on public.supplier_ticket_purchases with check (public.rls_is_staff_session_ok());
alter policy "supplier_ticket_purchases_update_staff" on public.supplier_ticket_purchases using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "supplier_ticket_purchases_delete_staff" on public.supplier_ticket_purchases using (public.rls_is_staff_session_ok());

-- ---------- vehicle_maintenance / dynamic_pricing / reconciliation_match_events / channel_products 레거시(191800) ----------
alter policy "vehicle_maintenance_select_staff" on public.vehicle_maintenance using (public.rls_is_staff_session_ok());
alter policy "vehicle_maintenance_insert_staff" on public.vehicle_maintenance with check (public.rls_is_staff_session_ok());
alter policy "vehicle_maintenance_update_staff" on public.vehicle_maintenance using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "vehicle_maintenance_delete_staff" on public.vehicle_maintenance using (public.rls_is_staff_session_ok());

alter policy "reconciliation_match_events_select_staff" on public.reconciliation_match_events using (public.rls_is_staff_session_ok());
alter policy "reconciliation_match_events_insert_staff" on public.reconciliation_match_events with check (public.rls_is_staff_session_ok());
alter policy "reconciliation_match_events_update_staff" on public.reconciliation_match_events using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "reconciliation_match_events_delete_staff" on public.reconciliation_match_events using (public.rls_is_staff_session_ok());

-- 19330000: select_staff 제거 후 select_team. 레거시(191800)는 select_staff + is_staff() 무인자.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dynamic_pricing'
      and policyname = 'dynamic_pricing_select_team'
  ) then
    execute $sql$
      alter policy "dynamic_pricing_select_team" on public.dynamic_pricing
        using (
          public.rls_is_staff_current_session_ok()
          or public.rls_team_member_session_ok()
        )
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_insert_staff" on public.dynamic_pricing
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_update_staff" on public.dynamic_pricing
        using (public.rls_is_staff_current_session_ok())
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_delete_staff" on public.dynamic_pricing
        using (public.rls_is_staff_current_session_ok())
    $sql$;
  elsif exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dynamic_pricing'
      and policyname = 'dynamic_pricing_select_staff'
  ) then
    execute $sql$
      alter policy "dynamic_pricing_select_staff" on public.dynamic_pricing
        using (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_insert_staff" on public.dynamic_pricing
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_update_staff" on public.dynamic_pricing
        using (public.rls_is_staff_session_ok())
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "dynamic_pricing_delete_staff" on public.dynamic_pricing
        using (public.rls_is_staff_session_ok())
    $sql$;
  end if;
end$$;

-- ---------- coupons / date_notes / sync_history / push staff ----------
-- 일부 환경: 19190000 미적용·정책명 변경 등으로 *_staff 정책이 없을 수 있음 → 조건부 ALTER
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coupons'
      and policyname = 'coupons_select_team'
  ) then
    execute $sql$
      alter policy "coupons_select_team" on public.coupons
        using (
          public.rls_is_staff_current_session_ok()
          or public.rls_team_member_session_ok()
        )
    $sql$;
    execute $sql$
      alter policy "coupons_insert_staff" on public.coupons
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "coupons_update_staff" on public.coupons
        using (public.rls_is_staff_current_session_ok())
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "coupons_delete_staff" on public.coupons
        using (public.rls_is_staff_current_session_ok())
    $sql$;
  elsif exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coupons'
      and policyname = 'coupons_select_staff'
  ) then
    execute $sql$
      alter policy "coupons_select_staff" on public.coupons
        using (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "coupons_insert_staff" on public.coupons
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "coupons_update_staff" on public.coupons
        using (public.rls_is_staff_session_ok())
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "coupons_delete_staff" on public.coupons
        using (public.rls_is_staff_session_ok())
    $sql$;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'date_notes'
      and policyname = 'date_notes_select_team'
  ) then
    execute $sql$
      alter policy "date_notes_select_team" on public.date_notes
        using (
          public.rls_is_staff_current_session_ok()
          or public.rls_team_member_session_ok()
        )
    $sql$;
    execute $sql$
      alter policy "date_notes_insert_staff" on public.date_notes
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "date_notes_update_staff" on public.date_notes
        using (public.rls_is_staff_current_session_ok())
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "date_notes_delete_staff" on public.date_notes
        using (public.rls_is_staff_current_session_ok())
    $sql$;
  elsif exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'date_notes'
      and policyname = 'date_notes_select_staff'
  ) then
    execute $sql$
      alter policy "date_notes_select_staff" on public.date_notes
        using (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "date_notes_insert_staff" on public.date_notes
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "date_notes_update_staff" on public.date_notes
        using (public.rls_is_staff_session_ok())
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "date_notes_delete_staff" on public.date_notes
        using (public.rls_is_staff_session_ok())
    $sql$;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_history'
      and policyname = 'sync_history_select_team'
  ) then
    execute $sql$
      alter policy "sync_history_select_team" on public.sync_history
        using (
          public.rls_is_staff_current_session_ok()
          or public.rls_team_member_session_ok()
        )
    $sql$;
    execute $sql$
      alter policy "sync_history_insert_staff" on public.sync_history
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "sync_history_update_staff" on public.sync_history
        using (public.rls_is_staff_current_session_ok())
        with check (public.rls_is_staff_current_session_ok())
    $sql$;
    execute $sql$
      alter policy "sync_history_delete_staff" on public.sync_history
        using (public.rls_is_staff_current_session_ok())
    $sql$;
  elsif exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_history'
      and policyname = 'sync_history_select_staff'
  ) then
    execute $sql$
      alter policy "sync_history_select_staff" on public.sync_history
        using (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "sync_history_insert_staff" on public.sync_history
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "sync_history_update_staff" on public.sync_history
        using (public.rls_is_staff_session_ok())
        with check (public.rls_is_staff_session_ok())
    $sql$;
    execute $sql$
      alter policy "sync_history_delete_staff" on public.sync_history
        using (public.rls_is_staff_session_ok())
    $sql$;
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_staff_all'
  ) then
    execute $sql$
      alter policy "push_subscriptions_staff_all" on public.push_subscriptions
        using (public.rls_is_staff_session_ok())
        with check (public.rls_is_staff_session_ok())
    $sql$;
  end if;
end$$;

-- ---------- financial_accounts / statement_* / reconciliation_matches / journal_* (19160000) ----------
alter policy "financial_accounts_select_staff" on public.financial_accounts using (public.rls_is_staff_session_ok());
alter policy "financial_accounts_insert_staff" on public.financial_accounts with check (public.rls_is_staff_session_ok());
alter policy "financial_accounts_update_staff" on public.financial_accounts using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "financial_accounts_delete_staff" on public.financial_accounts using (public.rls_is_staff_session_ok());

alter policy "statement_imports_select_staff" on public.statement_imports using (public.rls_is_staff_session_ok());

alter policy "statement_lines_select_staff" on public.statement_lines using (public.rls_is_staff_session_ok());
alter policy "statement_lines_update_staff" on public.statement_lines using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());

alter policy "reconciliation_matches_select_staff" on public.reconciliation_matches using (public.rls_is_staff_session_ok());
alter policy "reconciliation_matches_insert_staff" on public.reconciliation_matches with check (public.rls_is_staff_session_ok());
alter policy "reconciliation_matches_update_staff" on public.reconciliation_matches using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "reconciliation_matches_delete_staff" on public.reconciliation_matches using (public.rls_is_staff_session_ok());

alter policy "journal_entries_select_staff" on public.journal_entries using (public.rls_is_staff_session_ok());
alter policy "journal_entries_insert_staff" on public.journal_entries with check (public.rls_is_staff_session_ok());
alter policy "journal_entries_update_staff" on public.journal_entries using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "journal_entries_delete_staff" on public.journal_entries using (public.rls_is_staff_session_ok());

alter policy "journal_lines_select_staff" on public.journal_lines using (public.rls_is_staff_session_ok());
alter policy "journal_lines_insert_staff" on public.journal_lines with check (public.rls_is_staff_session_ok());
alter policy "journal_lines_update_staff" on public.journal_lines using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "journal_lines_delete_staff" on public.journal_lines using (public.rls_is_staff_session_ok());

-- ---------- company_expenses (19250000) ----------
alter policy "company_expenses_select_staff" on public.company_expenses using (public.rls_is_staff_session_ok());
alter policy "company_expenses_insert_staff" on public.company_expenses with check (public.rls_is_staff_session_ok());
alter policy "company_expenses_update_staff" on public.company_expenses using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "company_expenses_delete_staff" on public.company_expenses using (public.rls_is_staff_session_ok());

-- ---------- reservation_imports / shared_settings / cash_transaction_history / gmail ----------
alter policy "reservation_imports_select_staff" on public.reservation_imports using (public.rls_is_staff_session_ok());
alter policy "reservation_imports_insert_staff" on public.reservation_imports with check (public.rls_is_staff_session_ok());
alter policy "reservation_imports_update_staff" on public.reservation_imports using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());

alter policy "shared_settings_select_staff" on public.shared_settings using (public.rls_is_staff_session_ok());

alter policy "shared_settings_insert_admin" on public.shared_settings with check (public.rls_shared_settings_admin_ok());
alter policy "shared_settings_update_admin" on public.shared_settings using (public.rls_shared_settings_admin_ok()) with check (public.rls_shared_settings_admin_ok());
alter policy "shared_settings_delete_admin" on public.shared_settings using (public.rls_shared_settings_admin_ok());

alter policy "gmail_connections_select_admin" on public.gmail_connections using (public.rls_admin_session_ok());
alter policy "gmail_connections_insert_admin" on public.gmail_connections with check (public.rls_admin_session_ok());
alter policy "gmail_connections_update_admin" on public.gmail_connections using (public.rls_admin_session_ok()) with check (public.rls_admin_session_ok());
alter policy "gmail_connections_delete_admin" on public.gmail_connections using (public.rls_admin_session_ok());

alter policy "cash_transaction_history_select_staff" on public.cash_transaction_history using (public.rls_is_staff_session_ok());
alter policy "cash_transaction_history_insert_staff" on public.cash_transaction_history with check (public.rls_is_staff_session_ok());

-- ---------- attendance / monthly stats ----------
alter policy "attendance_records_select_own_or_admin" on public.attendance_records
  using (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "attendance_records_insert_own_or_admin" on public.attendance_records
  with check (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "attendance_records_update_own_or_admin" on public.attendance_records
  using (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  )
  with check (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "attendance_records_delete_admin" on public.attendance_records using (public.rls_admin_session_ok());

alter policy "monthly_attendance_stats_select_own_or_admin" on public.monthly_attendance_stats
  using (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "monthly_attendance_stats_insert_own_or_admin" on public.monthly_attendance_stats
  with check (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "monthly_attendance_stats_update_own_or_admin" on public.monthly_attendance_stats
  using (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  )
  with check (
    public.rls_admin_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "monthly_attendance_stats_delete_admin" on public.monthly_attendance_stats using (public.rls_admin_session_ok());

-- ---------- off_schedules ----------
alter policy "off_schedules_select_staff" on public.off_schedules using (public.rls_is_staff_session_ok());
alter policy "off_schedules_insert_staff" on public.off_schedules with check (public.rls_is_staff_session_ok());
alter policy "off_schedules_update_staff" on public.off_schedules using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "off_schedules_delete_staff" on public.off_schedules using (public.rls_is_staff_session_ok());

-- ---------- tour_photo_* ----------
alter policy "tour_photo_hide_requests_select" on public.tour_photo_hide_requests
  using (
    public.rls_is_staff_session_ok()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or (
      public.current_email() is not null
      and exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and lower(trim(c.email)) = public.current_email()
      )
    )
    or (
      length(public.session_email_from_auth_users()) > 0
      and exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and lower(trim(c.email)) = public.session_email_from_auth_users()
      )
    )
    or (
      auth.role() = 'anon'
      and exists (
        select 1
        from public.tour_photos tp
        where tp.tour_id = tour_photo_hide_requests.tour_id
      )
    )
  );

alter policy "tour_photo_hide_requests_insert" on public.tour_photo_hide_requests
  with check (
    public.rls_is_staff_session_ok()
    or (
      public.tour_photo_gallery_write_context_valid(tour_id, file_name, file_path, customer_id)
      and (
        auth.role() = 'anon'
        or (
          auth.role() = 'authenticated'
          and exists (
            select 1
            from public.customers c
            where c.id = customer_id
              and (
                lower(trim(c.email)) = public.current_email()
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(c.email)) = public.session_email_from_auth_users()
                )
              )
          )
        )
      )
    )
  );

alter policy "tour_photo_hide_requests_update" on public.tour_photo_hide_requests
  using (
    public.rls_is_staff_session_ok()
    or (
      public.tour_photo_gallery_write_context_valid(tour_id, file_name, file_path, customer_id)
      and (
        auth.role() = 'anon'
        or (
          auth.role() = 'authenticated'
          and exists (
            select 1
            from public.customers c
            where c.id = customer_id
              and (
                lower(trim(c.email)) = public.current_email()
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(c.email)) = public.session_email_from_auth_users()
                )
              )
          )
        )
      )
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      public.tour_photo_gallery_write_context_valid(tour_id, file_name, file_path, customer_id)
      and (
        auth.role() = 'anon'
        or (
          auth.role() = 'authenticated'
          and exists (
            select 1
            from public.customers c
            where c.id = customer_id
              and (
                lower(trim(c.email)) = public.current_email()
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(c.email)) = public.session_email_from_auth_users()
                )
              )
          )
        )
      )
    )
  );

alter policy "tour_photo_hide_requests_delete_staff" on public.tour_photo_hide_requests using (public.rls_is_staff_session_ok());

alter policy "tour_photo_download_logs_select" on public.tour_photo_download_logs
  using (
    public.rls_is_staff_session_ok()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or (
      public.current_email() is not null
      and exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and lower(trim(c.email)) = public.current_email()
      )
    )
    or (
      length(public.session_email_from_auth_users()) > 0
      and exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and lower(trim(c.email)) = public.session_email_from_auth_users()
      )
    )
  );

alter policy "tour_photo_download_logs_insert" on public.tour_photo_download_logs
  with check (
    public.rls_is_staff_session_ok()
    or (
      public.tour_photo_gallery_write_context_valid(tour_id, file_name, file_path, customer_id)
      and (
        auth.role() = 'anon'
        or (
          auth.role() = 'authenticated'
          and exists (
            select 1
            from public.customers c
            where c.id = customer_id
              and (
                lower(trim(c.email)) = public.current_email()
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(c.email)) = public.session_email_from_auth_users()
                )
              )
          )
        )
      )
    )
  );

alter policy "tour_photo_download_logs_update_staff" on public.tour_photo_download_logs
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

alter policy "tour_photo_download_logs_delete_staff" on public.tour_photo_download_logs using (public.rls_is_staff_session_ok());

-- ---------- site_access_matrix_overrides ----------
alter policy site_access_matrix_overrides_select_team on public.site_access_matrix_overrides
  using (
    public.can_edit_site_access_matrix()
    or exists (
      select 1
      from public.team t
      where t.is_active = true
        and (
          lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or lower(trim(t.email)) = public.session_email_from_auth_users()
        )
    )
  );

-- ---------- 채팅 ----------
alter policy "chat_rooms_auth_select" on public.chat_rooms
  using (
    public.rls_is_staff_session_ok()
    or (
      is_active = true
      and (
        public.tour_expense_row_accessible_as_assignee(tour_id)
        or public.rls_email_eq_session_or_current(created_by)
      )
    )
  );

alter policy "chat_rooms_auth_insert" on public.chat_rooms
  with check (
    public.rls_is_staff_session_ok()
    or (
      public.tour_expense_row_accessible_as_assignee(tour_id)
      and public.rls_email_eq_session_or_current(created_by)
    )
  );

alter policy "chat_rooms_auth_update" on public.chat_rooms
  using (
    public.rls_is_staff_session_ok()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or public.rls_email_eq_session_or_current(created_by)
  )
  with check (
    public.rls_is_staff_session_ok()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or public.rls_email_eq_session_or_current(created_by)
  );

alter policy "chat_rooms_auth_delete_staff" on public.chat_rooms using (public.rls_is_staff_session_ok());

alter policy "chat_messages_auth_select" on public.chat_messages
  using (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_messages.room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  );

alter policy "chat_messages_auth_insert" on public.chat_messages
  with check (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  );

alter policy "chat_messages_auth_update" on public.chat_messages
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

alter policy "chat_messages_auth_delete_staff" on public.chat_messages using (public.rls_is_staff_session_ok());

alter policy "chat_participants_auth_select" on public.chat_participants
  using (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_participants.room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  );

alter policy "chat_participants_auth_insert" on public.chat_participants
  with check (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  );

alter policy "chat_participants_auth_update" on public.chat_participants
  using (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or public.rls_email_eq_session_or_current(cr.created_by)
        )
    )
  );

alter policy "chat_participants_auth_delete_staff" on public.chat_participants using (public.rls_is_staff_session_ok());

-- ---------- 19290000 channels / options / product_media / product_choices / choice_options ----------
alter policy "channels_select_team" on public.channels using (public.rls_team_member_session_ok());
alter policy "channels_insert_staff" on public.channels with check (public.rls_is_staff_current_session_ok());
alter policy "channels_update_staff" on public.channels using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "channels_delete_staff" on public.channels using (public.rls_is_staff_current_session_ok());

alter policy "options_select_team" on public.options using (public.rls_team_member_session_ok());
alter policy "options_insert_staff" on public.options with check (public.rls_is_staff_current_session_ok());
alter policy "options_update_staff" on public.options using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "options_delete_staff" on public.options using (public.rls_is_staff_current_session_ok());

alter policy "product_media_select_team" on public.product_media using (public.rls_team_member_session_ok());
alter policy "product_media_insert_staff" on public.product_media with check (public.rls_is_staff_current_session_ok());
alter policy "product_media_update_staff" on public.product_media using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "product_media_delete_staff" on public.product_media using (public.rls_is_staff_current_session_ok());

alter policy "product_choices_select_team" on public.product_choices using (public.rls_team_member_session_ok());
alter policy "product_choices_insert_staff" on public.product_choices with check (public.rls_is_staff_current_session_ok());
alter policy "product_choices_update_staff" on public.product_choices using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "product_choices_delete_staff" on public.product_choices using (public.rls_is_staff_current_session_ok());

alter policy "choice_options_select_team" on public.choice_options using (public.rls_team_member_session_ok());
alter policy "choice_options_insert_staff" on public.choice_options with check (public.rls_is_staff_current_session_ok());
alter policy "choice_options_update_staff" on public.choice_options using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "choice_options_delete_staff" on public.choice_options using (public.rls_is_staff_current_session_ok());

-- ---------- 19280000 reservation_options / pickup_hotels / product_details* ----------
alter policy "reservation_options_select" on public.reservation_options
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_options_insert" on public.reservation_options
  with check (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_options_update" on public.reservation_options
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_options_delete" on public.reservation_options
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "pickup_hotels_select_team" on public.pickup_hotels using (public.rls_team_member_session_ok());
alter policy "pickup_hotels_insert_staff" on public.pickup_hotels with check (public.rls_is_staff_current_session_ok());
alter policy "pickup_hotels_update_staff" on public.pickup_hotels using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "pickup_hotels_delete_staff" on public.pickup_hotels using (public.rls_is_staff_current_session_ok());

alter policy "product_details_multilingual_select_team" on public.product_details_multilingual using (public.rls_team_member_session_ok());
alter policy "product_details_multilingual_insert_staff" on public.product_details_multilingual with check (public.rls_is_staff_current_session_ok());
alter policy "product_details_multilingual_update_staff" on public.product_details_multilingual using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "product_details_multilingual_delete_staff" on public.product_details_multilingual using (public.rls_is_staff_current_session_ok());

alter policy "product_details_common_multilingual_select_team" on public.product_details_common_multilingual using (public.rls_team_member_session_ok());
alter policy "product_details_common_multilingual_insert_staff" on public.product_details_common_multilingual with check (public.rls_is_staff_current_session_ok());
alter policy "product_details_common_multilingual_update_staff" on public.product_details_common_multilingual using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "product_details_common_multilingual_delete_staff" on public.product_details_common_multilingual using (public.rls_is_staff_current_session_ok());

-- ---------- 19320000 channel_products / reservation_choices / product_faqs ----------
alter policy "channel_products_select_team" on public.channel_products
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
  );

alter policy "channel_products_insert_staff" on public.channel_products with check (public.rls_is_staff_current_session_ok());
alter policy "channel_products_update_staff" on public.channel_products using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "channel_products_delete_staff" on public.channel_products using (public.rls_is_staff_current_session_ok());

alter policy "reservation_choices_select_access" on public.reservation_choices
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_choices_insert_access" on public.reservation_choices
  with check (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_choices_update_access" on public.reservation_choices
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_choices_delete_access" on public.reservation_choices
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "product_faqs_select_team" on public.product_faqs
  using (
    public.rls_is_staff_current_session_ok()
    or public.rls_team_member_session_ok()
  );

alter policy "product_faqs_insert_staff" on public.product_faqs with check (public.rls_is_staff_current_session_ok());
alter policy "product_faqs_update_staff" on public.product_faqs using (public.rls_is_staff_current_session_ok()) with check (public.rls_is_staff_current_session_ok());
alter policy "product_faqs_delete_staff" on public.product_faqs using (public.rls_is_staff_current_session_ok());

-- ---------- 19220000: ticket_* delete_staff / attachments / expense_* / reviews / office_meal / company_* / messages ----------
alter policy "ticket_booking_refund_lines_delete_staff" on public.ticket_booking_refund_lines using (public.rls_is_staff_session_ok());
alter policy "ticket_booking_status_logs_delete_staff" on public.ticket_booking_status_logs using (public.rls_is_staff_session_ok());
alter policy "ticket_booking_changes_delete_staff" on public.ticket_booking_changes using (public.rls_is_staff_session_ok());
alter policy "ticket_booking_payments_delete_staff" on public.ticket_booking_payments using (public.rls_is_staff_session_ok());
alter policy "ticket_booking_refunds_delete_staff" on public.ticket_booking_refunds using (public.rls_is_staff_session_ok());

alter policy "ticket_invoice_attachments_select_staff" on public.ticket_invoice_attachments using (public.rls_is_staff_session_ok());
alter policy "ticket_invoice_attachments_insert_staff" on public.ticket_invoice_attachments with check (public.rls_is_staff_session_ok());
alter policy "ticket_invoice_attachments_update_staff" on public.ticket_invoice_attachments using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "ticket_invoice_attachments_delete_staff" on public.ticket_invoice_attachments using (public.rls_is_staff_session_ok());

alter policy "expense_categories_select_team" on public.expense_categories using (public.rls_team_member_session_ok());
alter policy "expense_categories_insert_team" on public.expense_categories with check (public.rls_team_member_session_ok());
alter policy "expense_categories_update_staff" on public.expense_categories using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "expense_categories_delete_staff" on public.expense_categories using (public.rls_is_staff_session_ok());

alter policy "expense_vendors_select_team" on public.expense_vendors using (public.rls_team_member_session_ok());
alter policy "expense_vendors_insert_team" on public.expense_vendors with check (public.rls_team_member_session_ok());
alter policy "expense_vendors_update_staff" on public.expense_vendors using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "expense_vendors_delete_staff" on public.expense_vendors using (public.rls_is_staff_session_ok());

alter policy "guide_cost_notes_select_staff" on public.guide_cost_notes using (public.rls_is_staff_session_ok());
alter policy "guide_cost_notes_insert_staff" on public.guide_cost_notes with check (public.rls_is_staff_session_ok());
alter policy "guide_cost_notes_update_staff" on public.guide_cost_notes using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "guide_cost_notes_delete_staff" on public.guide_cost_notes using (public.rls_is_staff_session_ok());

alter policy "reservation_reviews_select_staff_or_assignee" on public.reservation_reviews
  using (
    public.rls_is_staff_session_ok()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

alter policy "reservation_reviews_insert_staff_or_assignee" on public.reservation_reviews
  with check (
    public.rls_is_staff_session_ok()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

alter policy "reservation_reviews_update_staff_or_assignee" on public.reservation_reviews
  using (
    public.rls_is_staff_session_ok()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  )
  with check (
    public.rls_is_staff_session_ok()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

alter policy "reservation_reviews_delete_staff" on public.reservation_reviews using (public.rls_is_staff_session_ok());

alter policy "office_meal_log_select_own_or_staff" on public.office_meal_log
  using (
    public.rls_is_staff_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "office_meal_log_insert_own_or_staff" on public.office_meal_log
  with check (
    public.rls_is_staff_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "office_meal_log_update_own_or_staff" on public.office_meal_log
  using (
    public.rls_is_staff_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "office_meal_log_delete_own_or_staff" on public.office_meal_log
  using (
    public.rls_is_staff_session_ok()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(employee_email, ''))) = public.session_email_from_auth_users()
    )
  );

alter policy "company_expense_paid_for_labels_select_staff" on public.company_expense_paid_for_labels using (public.rls_is_staff_session_ok());
alter policy "company_expense_paid_for_labels_insert_staff" on public.company_expense_paid_for_labels with check (public.rls_is_staff_session_ok());
alter policy "company_expense_paid_for_labels_update_staff" on public.company_expense_paid_for_labels using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "company_expense_paid_for_labels_delete_staff" on public.company_expense_paid_for_labels using (public.rls_is_staff_session_ok());

alter policy "company_expense_vm_links_select_staff" on public.company_expense_vehicle_maintenance_links using (public.rls_is_staff_session_ok());
alter policy "company_expense_vm_links_insert_staff" on public.company_expense_vehicle_maintenance_links with check (public.rls_is_staff_session_ok());
alter policy "company_expense_vm_links_update_staff" on public.company_expense_vehicle_maintenance_links using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "company_expense_vm_links_delete_staff" on public.company_expense_vehicle_maintenance_links using (public.rls_is_staff_session_ok());

alter policy "message_translations_select_staff" on public.message_translations using (public.rls_is_staff_session_ok());
alter policy "message_translations_insert_staff" on public.message_translations with check (public.rls_is_staff_session_ok());
alter policy "message_translations_update_staff" on public.message_translations using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "message_translations_delete_staff" on public.message_translations using (public.rls_is_staff_session_ok());

-- ---------- 19210000 autofill / hourly / follow_ups / tour_bonuses ----------
alter policy "statement_expense_autofill_rules_select_staff" on public.statement_expense_autofill_rules using (public.rls_is_staff_session_ok());
alter policy "statement_expense_autofill_rules_insert_staff" on public.statement_expense_autofill_rules with check (public.rls_is_staff_session_ok());
alter policy "statement_expense_autofill_rules_update_staff" on public.statement_expense_autofill_rules using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "statement_expense_autofill_rules_delete_staff" on public.statement_expense_autofill_rules using (public.rls_is_staff_session_ok());

alter policy "employee_hourly_rate_periods_select_staff" on public.employee_hourly_rate_periods using (public.rls_is_staff_session_ok());
alter policy "employee_hourly_rate_periods_insert_staff" on public.employee_hourly_rate_periods with check (public.rls_is_staff_session_ok());
alter policy "employee_hourly_rate_periods_update_staff" on public.employee_hourly_rate_periods using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "employee_hourly_rate_periods_delete_staff" on public.employee_hourly_rate_periods using (public.rls_is_staff_session_ok());

alter policy "position_hourly_rate_periods_select_staff" on public.position_hourly_rate_periods using (public.rls_is_staff_session_ok());
alter policy "position_hourly_rate_periods_insert_staff" on public.position_hourly_rate_periods with check (public.rls_is_staff_session_ok());
alter policy "position_hourly_rate_periods_update_staff" on public.position_hourly_rate_periods using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok());
alter policy "position_hourly_rate_periods_delete_staff" on public.position_hourly_rate_periods using (public.rls_is_staff_session_ok());

alter policy "reservation_follow_ups_select_staff_or_assignee" on public.reservation_follow_ups
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_ups_insert_staff_or_assignee" on public.reservation_follow_ups
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_ups_update_staff_or_assignee" on public.reservation_follow_ups
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_ups_delete_staff" on public.reservation_follow_ups using (public.rls_is_staff_session_ok());

alter policy "reservation_follow_up_pipeline_manual_select_staff_or_assignee" on public.reservation_follow_up_pipeline_manual
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_up_pipeline_manual_insert_staff_or_assignee" on public.reservation_follow_up_pipeline_manual
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_up_pipeline_manual_update_staff_or_assignee" on public.reservation_follow_up_pipeline_manual
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_follow_up_pipeline_manual_delete_staff" on public.reservation_follow_up_pipeline_manual using (public.rls_is_staff_session_ok());

alter policy "tour_bonuses_select_staff_or_assignee" on public.tour_bonuses
  using (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

alter policy "tour_bonuses_insert_staff_or_assignee" on public.tour_bonuses
  with check (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

alter policy "tour_bonuses_update_staff_or_assignee" on public.tour_bonuses
  using (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

alter policy "tour_bonuses_delete_staff" on public.tour_bonuses using (public.rls_is_staff_session_ok());

-- ---------- reservation_expenses / tour_expenses (191200 / 191400) ----------
alter policy "reservation_expenses_select_staff_or_assignee" on public.reservation_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

alter policy "reservation_expenses_insert_staff_or_assignee_own" on public.reservation_expenses
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

alter policy "reservation_expenses_update_staff_or_assignee_own" on public.reservation_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

alter policy "reservation_expenses_delete_staff_or_assignee_own" on public.reservation_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

alter policy "tour_expenses_select_staff_or_assignee" on public.tour_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

alter policy "tour_expenses_insert_staff_or_assignee_own" on public.tour_expenses
  with check (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

alter policy "tour_expenses_update_staff_or_assignee_own" on public.tour_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  )
  with check (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

alter policy "tour_expenses_delete_staff_or_assignee_own" on public.tour_expenses
  using (
    public.rls_is_staff_session_ok()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and (
        lower(trim(submitted_by)) = public.current_email()
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

-- ---------- expense_duplicate_suppressions ----------
alter policy "expense_duplicate_suppressions_select_staff" on public.expense_duplicate_suppressions using (public.rls_is_staff_session_ok());
alter policy "expense_duplicate_suppressions_insert_staff" on public.expense_duplicate_suppressions with check (public.rls_is_staff_session_ok());
alter policy "expense_duplicate_suppressions_delete_staff" on public.expense_duplicate_suppressions using (public.rls_is_staff_session_ok());

-- ---------- payment_records (테이블 없으면 스킵) ----------
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payment_records'
  ) then
    return;
  end if;

  execute $p$
    alter policy "payment_records_select_staff_or_assignee" on public.payment_records
      using (
        public.rls_is_staff_session_ok()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
        or (
          reservation_id is not null
          and exists (
            select 1
            from public.reservations r
            inner join public.customers c on c.id = r.customer_id
            where r.id = reservation_id
              and (
                lower(trim(coalesce(c.email, ''))) = lower(trim(coalesce(public.current_email(), '')))
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(coalesce(c.email, ''))) = public.session_email_from_auth_users()
                )
              )
          )
        )
      )
  $p$;

  execute $p$
    alter policy "payment_records_insert_staff_or_assignee" on public.payment_records
      with check (
        public.rls_is_staff_session_ok()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
  $p$;

  execute $p$
    alter policy "payment_records_update_staff_or_assignee" on public.payment_records
      using (
        public.rls_is_staff_session_ok()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
      with check (
        public.rls_is_staff_session_ok()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
  $p$;

  execute $p$
    alter policy "payment_records_delete_staff_or_assignee" on public.payment_records
      using (
        public.rls_is_staff_session_ok()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
  $p$;
end$$;

commit;
