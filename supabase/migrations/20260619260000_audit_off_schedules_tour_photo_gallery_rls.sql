-- Step 14 (RLS hardening): audit_logs insert, off_schedules admin policies,
--   tour_photo_hide_requests, tour_photo_download_logs (공개 갤러리 anon 포함).
-- Depends: public.is_staff(), public.is_team_member, public.current_email(),
--   public.tour_expense_row_accessible_as_assignee (20260619140000).

begin;

-- ---------- Helper: 투어 사진 숨김/다운로드 기록 — 예약 고객 + (DB 사진 또는 storage 경로) ----------
create or replace function public.tour_photo_gallery_write_context_valid(
  p_tour_id text,
  p_file_name text,
  p_file_path text,
  p_customer_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_tour_id is not null
    and length(trim(p_tour_id)) > 0
    and p_file_name is not null
    and length(trim(p_file_name)) > 0
    and p_customer_id is not null
    and length(trim(p_customer_id)) > 0
    and exists (
      select 1
      from public.reservations r
      where r.tour_id = p_tour_id
        and r.customer_id = p_customer_id
    )
    and (
      exists (
        select 1
        from public.tour_photos tp
        where tp.tour_id = p_tour_id
          and tp.file_name = p_file_name
      )
      or concat(p_tour_id, '/', p_file_name) = p_file_path
    );
$$;

comment on function public.tour_photo_gallery_write_context_valid(text, text, text, text) is
  'RLS: 숨김/다운로드 로그 INSERT·UPDATE 시 해당 투어 예약 고객이며 파일이 tour_photos에 있거나 storage 경로 규칙과 일치하는지';

-- ---------- audit_logs: INSERT를 팀(스태프+가이드 등)으로 제한 (트리거가 JWT 기록) ----------
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_insert_team" on public.audit_logs;

create policy "audit_logs_insert_team"
  on public.audit_logs for insert to authenticated
  with check (
    public.is_staff()
    or public.is_team_member(public.current_email())
  );

-- ---------- off_schedules: 관리자 정책 USING(true) 제거 ----------
drop policy if exists "Admins can view all off schedules" on public.off_schedules;
drop policy if exists "Admins can insert off schedules" on public.off_schedules;
drop policy if exists "Admins can update all off schedules" on public.off_schedules;
drop policy if exists "Admins can delete off schedules" on public.off_schedules;
drop policy if exists "off_schedules_select_staff" on public.off_schedules;
drop policy if exists "off_schedules_insert_staff" on public.off_schedules;
drop policy if exists "off_schedules_update_staff" on public.off_schedules;
drop policy if exists "off_schedules_delete_staff" on public.off_schedules;

create policy "off_schedules_select_staff"
  on public.off_schedules for select to authenticated
  using (public.is_staff());

create policy "off_schedules_insert_staff"
  on public.off_schedules for insert to authenticated
  with check (public.is_staff());

create policy "off_schedules_update_staff"
  on public.off_schedules for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "off_schedules_delete_staff"
  on public.off_schedules for delete to authenticated
  using (public.is_staff());

-- ---------- tour_photo_hide_requests ----------
alter table public.tour_photo_hide_requests enable row level security;

drop policy if exists "Anyone can view photo hide requests" on public.tour_photo_hide_requests;
drop policy if exists "Anonymous users can view photo hide requests" on public.tour_photo_hide_requests;
drop policy if exists "Authenticated users can insert photo hide requests" on public.tour_photo_hide_requests;
drop policy if exists "Anonymous users can insert photo hide requests" on public.tour_photo_hide_requests;
drop policy if exists "Admins can update photo hide requests" on public.tour_photo_hide_requests;
drop policy if exists "tour_photo_hide_requests_select" on public.tour_photo_hide_requests;
drop policy if exists "tour_photo_hide_requests_insert" on public.tour_photo_hide_requests;
drop policy if exists "tour_photo_hide_requests_update" on public.tour_photo_hide_requests;
drop policy if exists "tour_photo_hide_requests_delete_staff" on public.tour_photo_hide_requests;

revoke all on table public.tour_photo_hide_requests from anon;
grant select, insert, update, delete on table public.tour_photo_hide_requests to authenticated;
grant select, insert, update on table public.tour_photo_hide_requests to anon;

create policy "tour_photo_hide_requests_select"
  on public.tour_photo_hide_requests for select
  to authenticated, anon
  using (
    public.is_staff()
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
      auth.role() = 'anon'
      and exists (
        select 1
        from public.tour_photos tp
        where tp.tour_id = tour_photo_hide_requests.tour_id
      )
    )
  );

create policy "tour_photo_hide_requests_insert"
  on public.tour_photo_hide_requests for insert
  to authenticated, anon
  with check (
    public.is_staff()
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
              and lower(trim(c.email)) = public.current_email()
          )
        )
      )
    )
  );

create policy "tour_photo_hide_requests_update"
  on public.tour_photo_hide_requests for update
  to authenticated, anon
  using (
    public.is_staff()
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
              and lower(trim(c.email)) = public.current_email()
          )
        )
      )
    )
  )
  with check (
    public.is_staff()
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
              and lower(trim(c.email)) = public.current_email()
          )
        )
      )
    )
  );

create policy "tour_photo_hide_requests_delete_staff"
  on public.tour_photo_hide_requests for delete to authenticated
  using (public.is_staff());

-- ---------- tour_photo_download_logs ----------
alter table public.tour_photo_download_logs enable row level security;

drop policy if exists "Anyone can view download logs" on public.tour_photo_download_logs;
drop policy if exists "Authenticated users can insert download logs" on public.tour_photo_download_logs;
drop policy if exists "tour_photo_download_logs_select" on public.tour_photo_download_logs;
drop policy if exists "tour_photo_download_logs_insert" on public.tour_photo_download_logs;
drop policy if exists "tour_photo_download_logs_update_staff" on public.tour_photo_download_logs;
drop policy if exists "tour_photo_download_logs_delete_staff" on public.tour_photo_download_logs;

revoke all on table public.tour_photo_download_logs from anon;
grant select, insert, update, delete on table public.tour_photo_download_logs to authenticated;
grant insert on table public.tour_photo_download_logs to anon;

create policy "tour_photo_download_logs_select"
  on public.tour_photo_download_logs for select to authenticated
  using (
    public.is_staff()
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
  );

create policy "tour_photo_download_logs_insert"
  on public.tour_photo_download_logs for insert
  to authenticated, anon
  with check (
    public.is_staff()
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
              and lower(trim(c.email)) = public.current_email()
          )
        )
      )
    )
  );

create policy "tour_photo_download_logs_update_staff"
  on public.tour_photo_download_logs for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "tour_photo_download_logs_delete_staff"
  on public.tour_photo_download_logs for delete to authenticated
  using (public.is_staff());

commit;
