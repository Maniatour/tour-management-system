-- Fix RLS policies for google_review_change_logs (is_staff_user does not exist)

drop policy if exists "google_review_change_logs_select_staff"
  on public.google_review_change_logs;
drop policy if exists "google_review_change_logs_insert_staff"
  on public.google_review_change_logs;
drop policy if exists "google_review_change_logs_insert_admin"
  on public.google_review_change_logs;

create policy "google_review_change_logs_select_staff"
  on public.google_review_change_logs for select to authenticated
  using (public.is_staff());

create policy "google_review_change_logs_insert_admin"
  on public.google_review_change_logs for insert to authenticated
  with check (public.is_admin_user(public.current_email()));
