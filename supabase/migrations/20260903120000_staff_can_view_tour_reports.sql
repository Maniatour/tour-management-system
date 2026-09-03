-- OP/office/super can read submitted tour reports in tour detail
-- (previous policy required team.position = 'admin' exactly).
drop policy if exists "Admins can view all tour reports" on public.tour_reports;

create policy "Staff can view tour reports"
  on public.tour_reports
  for select
  using (
    (user_email)::text = (auth.jwt() ->> 'email'::text)
    or public.is_staff()
  );
