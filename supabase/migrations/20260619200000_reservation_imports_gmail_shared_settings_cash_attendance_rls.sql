-- Step 9 (RLS hardening): reservation_imports, gmail_connections, shared_settings,
--   cash_transaction_history, attendance_records, monthly_attendance_stats
-- 서버 라우트는 supabaseAdmin(서비스 롤)로 대부분 접근; 클라이언트·JWT 경로는 아래 정책으로 제한.
-- gmail_connections: refresh_token — public.is_admin_user(current_email) 만 (Super / Office Manager).
-- 출퇴근: 본인 행 또는 is_admin_user (is_staff가 팀 전원인 배포에서 타인 전체 열람 방지).

begin;

-- ---------- reservation_imports ----------
alter table public.reservation_imports enable row level security;

drop policy if exists "Allow read for authenticated" on public.reservation_imports;
drop policy if exists "Allow insert for service" on public.reservation_imports;
drop policy if exists "Allow update for authenticated" on public.reservation_imports;

revoke all on table public.reservation_imports from anon;
grant select, insert, update on table public.reservation_imports to authenticated;

create policy "reservation_imports_select_staff"
  on public.reservation_imports for select to authenticated
  using (public.is_staff());

create policy "reservation_imports_insert_staff"
  on public.reservation_imports for insert to authenticated
  with check (public.is_staff());

create policy "reservation_imports_update_staff"
  on public.reservation_imports for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------- gmail_connections ----------
alter table public.gmail_connections enable row level security;

drop policy if exists "Allow all for gmail_connections" on public.gmail_connections;

revoke all on table public.gmail_connections from anon;
grant select, insert, update, delete on table public.gmail_connections to authenticated;

-- refresh_token 보호: Super / Office Manager 만 (is_admin_user)
create policy "gmail_connections_select_admin"
  on public.gmail_connections for select to authenticated
  using (public.is_admin_user(public.current_email()));

create policy "gmail_connections_insert_admin"
  on public.gmail_connections for insert to authenticated
  with check (public.is_admin_user(public.current_email()));

create policy "gmail_connections_update_admin"
  on public.gmail_connections for update to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

create policy "gmail_connections_delete_admin"
  on public.gmail_connections for delete to authenticated
  using (public.is_admin_user(public.current_email()));

-- ---------- shared_settings ----------
alter table public.shared_settings enable row level security;

drop policy if exists "Anyone can read shared settings" on public.shared_settings;
drop policy if exists "Only admins can modify shared settings" on public.shared_settings;

revoke all on table public.shared_settings from anon;
grant select, insert, update, delete on table public.shared_settings to authenticated;

create policy "shared_settings_select_staff"
  on public.shared_settings for select to authenticated
  using (public.is_staff());

create policy "shared_settings_insert_admin"
  on public.shared_settings for insert to authenticated
  with check (
    exists (
      select 1 from public.team
      where team.email = (auth.jwt() ->> 'email')
        and (team.position = 'super' or team.position = 'admin')
        and team.is_active = true
    )
    or (auth.jwt() ->> 'email') in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

create policy "shared_settings_update_admin"
  on public.shared_settings for update to authenticated
  using (
    exists (
      select 1 from public.team
      where team.email = (auth.jwt() ->> 'email')
        and (team.position = 'super' or team.position = 'admin')
        and team.is_active = true
    )
    or (auth.jwt() ->> 'email') in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  )
  with check (
    exists (
      select 1 from public.team
      where team.email = (auth.jwt() ->> 'email')
        and (team.position = 'super' or team.position = 'admin')
        and team.is_active = true
    )
    or (auth.jwt() ->> 'email') in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

create policy "shared_settings_delete_admin"
  on public.shared_settings for delete to authenticated
  using (
    exists (
      select 1 from public.team
      where team.email = (auth.jwt() ->> 'email')
        and (team.position = 'super' or team.position = 'admin')
        and team.is_active = true
    )
    or (auth.jwt() ->> 'email') in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

-- ---------- cash_transaction_history ----------
alter table public.cash_transaction_history enable row level security;

drop policy if exists "cash_transaction_history_select_all" on public.cash_transaction_history;
drop policy if exists "cash_transaction_history_insert_staff" on public.cash_transaction_history;

revoke all on table public.cash_transaction_history from anon;
grant select, insert on table public.cash_transaction_history to authenticated;

create policy "cash_transaction_history_select_staff"
  on public.cash_transaction_history for select to authenticated
  using (public.is_staff());

create policy "cash_transaction_history_insert_staff"
  on public.cash_transaction_history for insert to authenticated
  with check (public.is_staff());

-- ---------- attendance_records ----------
alter table public.attendance_records enable row level security;

drop policy if exists "Enable all access for attendance_records" on public.attendance_records;
drop policy if exists "attendance_records_select_all" on public.attendance_records;
drop policy if exists "attendance_records_select_own" on public.attendance_records;
drop policy if exists "attendance_records_modify_staff_only" on public.attendance_records;

revoke all on table public.attendance_records from anon;
grant select, insert, update, delete on table public.attendance_records to authenticated;

-- is_staff()가 팀 전원이면 타인 출퇴근 전체 열람이 되므로, 타인 조회·삭제는 is_admin_user만
create policy "attendance_records_select_own_or_admin"
  on public.attendance_records for select to authenticated
  using (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "attendance_records_insert_own_or_admin"
  on public.attendance_records for insert to authenticated
  with check (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "attendance_records_update_own_or_admin"
  on public.attendance_records for update to authenticated
  using (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  )
  with check (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "attendance_records_delete_admin"
  on public.attendance_records for delete to authenticated
  using (public.is_admin_user(public.current_email()));

-- ---------- monthly_attendance_stats ----------
alter table public.monthly_attendance_stats enable row level security;

drop policy if exists "monthly_attendance_stats_select_all" on public.monthly_attendance_stats;
drop policy if exists "monthly_attendance_stats_select_own" on public.monthly_attendance_stats;
drop policy if exists "monthly_attendance_stats_modify_staff_only" on public.monthly_attendance_stats;

revoke all on table public.monthly_attendance_stats from anon;
grant select, insert, update, delete on table public.monthly_attendance_stats to authenticated;

create policy "monthly_attendance_stats_select_own_or_admin"
  on public.monthly_attendance_stats for select to authenticated
  using (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "monthly_attendance_stats_insert_own_or_admin"
  on public.monthly_attendance_stats for insert to authenticated
  with check (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "monthly_attendance_stats_update_own_or_admin"
  on public.monthly_attendance_stats for update to authenticated
  using (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  )
  with check (
    public.is_admin_user(public.current_email())
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "monthly_attendance_stats_delete_admin"
  on public.monthly_attendance_stats for delete to authenticated
  using (public.is_admin_user(public.current_email()));

commit;
