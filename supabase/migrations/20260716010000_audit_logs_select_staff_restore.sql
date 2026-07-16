-- Follow up / 예약 수정 이력: audit_logs_view 가 security_invoker=true 로 바뀐 뒤
-- audit_logs 에 SELECT 정책이 없으면 스태프도 이력이 0건으로 보인다.
-- op / office manager / super 포함 활성 스태프가 조회할 수 있도록 SELECT 정책을 복구한다.
--
-- Depends: rls_is_staff_session_ok() (20260621260000)

begin;

grant select on table public.audit_logs to authenticated;

drop policy if exists "audit_logs_select_staff_only" on public.audit_logs;
drop policy if exists "audit_logs_select_staff" on public.audit_logs;

create policy "audit_logs_select_staff_only"
  on public.audit_logs
  for select
  to authenticated
  using (public.rls_is_staff_session_ok());

comment on policy "audit_logs_select_staff_only" on public.audit_logs is
  '활성 스태프(op/office manager/super 등) audit_logs · audit_logs_view SELECT.';

commit;
