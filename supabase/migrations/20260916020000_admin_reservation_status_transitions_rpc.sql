-- 카드뷰 상태변경 집계: audit_logs UPDATE 전량(주간 약 1만 행)을 브라우저로 가져오지 않고
-- status 전환만 RPC로 반환 (실측 ~15ms / 수십 행).
-- 트리거가 2026-05-20 이후 이벤트를 안 남긴 구간도 감사 로그에서 복구한다.

begin;

drop trigger if exists reservations_record_status_event on public.reservations;
create trigger reservations_record_status_event
  after update on public.reservations
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_reservation_status_event();

insert into public.reservation_status_events (
  reservation_id,
  from_status,
  to_status,
  occurred_at,
  user_email
)
select
  al.record_id,
  al.old_values ->> 'status',
  al.new_values ->> 'status',
  al.created_at,
  al.user_email
from public.audit_logs al
where al.table_name = 'reservations'
  and al.action = 'UPDATE'
  and al.created_at > '2026-05-20 22:25:03+00'
  and al.changed_fields @> array['status']::text[]
  and (al.old_values ->> 'status') is distinct from (al.new_values ->> 'status')
  and exists (select 1 from public.reservations r where r.id = al.record_id)
  and not exists (
    select 1
    from public.reservation_status_events e
    where e.reservation_id = al.record_id
      and e.occurred_at = al.created_at
      and e.from_status is not distinct from (al.old_values ->> 'status')
      and e.to_status is not distinct from (al.new_values ->> 'status')
  );

create or replace function public.admin_reservation_status_transitions_in_range(
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  reservation_id text,
  from_status text,
  to_status text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_allowed boolean;
begin
  select (
    public.rls_is_staff_session_ok()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  )
  into v_allowed;

  if not coalesce(v_allowed, false) then
    return;
  end if;

  if p_range_start is null or p_range_end is null then
    return;
  end if;

  return query
  select s.reservation_id, s.from_status, s.to_status, s.occurred_at
  from (
    select
      e.reservation_id,
      e.from_status,
      e.to_status,
      e.occurred_at
    from public.reservation_status_events e
    where e.occurred_at >= p_range_start
      and e.occurred_at <= p_range_end
    union
    select
      al.record_id,
      al.old_values ->> 'status',
      al.new_values ->> 'status',
      al.created_at
    from public.audit_logs al
    where al.table_name = 'reservations'
      and al.action = 'UPDATE'
      and al.created_at >= p_range_start
      and al.created_at <= p_range_end
      and al.changed_fields @> array['status']::text[]
      and (al.old_values ->> 'status') is distinct from (al.new_values ->> 'status')
  ) s;
end;
$$;

comment on function public.admin_reservation_status_transitions_in_range(timestamptz, timestamptz) is
  '스태프: 구간 내 예약 status 전환만 반환. 카드뷰 상태변경 집계용.';

revoke all on function public.admin_reservation_status_transitions_in_range(timestamptz, timestamptz) from public;
grant execute on function public.admin_reservation_status_transitions_in_range(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_reservation_status_transitions_in_range(timestamptz, timestamptz) to service_role;

analyze public.reservation_status_events;

commit;
