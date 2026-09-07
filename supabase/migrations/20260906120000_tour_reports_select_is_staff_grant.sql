-- tour_reports SELECT policy "Staff can view tour reports" calls public.is_staff().
-- If authenticated cannot EXECUTE that function, every tour_reports SELECT fails with 42501
-- because permissive policies are all evaluated (including a guide reading their own rows).

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_staff(text) to authenticated;
grant execute on function public.rls_is_staff_session_ok() to authenticated;
grant execute on function public.is_staff_for_session() to authenticated;

drop policy if exists "Staff can view tour reports" on public.tour_reports;

create policy "Staff can view tour reports"
  on public.tour_reports
  for select
  using (
    lower((user_email)::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.rls_is_staff_session_ok()
  );
