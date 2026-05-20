-- reservation_status_events: audit_logs에만 있고 events에 없는 status 전환 재백필
-- (테이블 최초 생성·트리거 RLS 이슈 이후 구간이 UI에 비어 보이는 경우)

begin;

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

analyze public.reservation_status_events;

commit;
