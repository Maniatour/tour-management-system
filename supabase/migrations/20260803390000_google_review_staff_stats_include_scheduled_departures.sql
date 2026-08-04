-- 투어 진행 횟수: scheduled 상태도 포함

create or replace function public.is_tour_confirmed_departed_status(
  p_status text,
  p_tour_date date
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when public.is_tour_cancelled_or_deleted_status(p_status) then false
    when p_tour_date is null then false
    when p_tour_date > (now() at time zone 'America/Los_Angeles')::date then false
    else (
      lower(btrim(coalesce(p_status, ''))) in ('confirm', 'confirmed', 'scheduled')
      or lower(btrim(coalesce(p_status, ''))) in ('complete', 'completed')
      or lower(coalesce(p_status, '')) like '%complete%'
      or lower(coalesce(p_status, '')) like '%scheduled%'
    )
  end;
$$;

comment on function public.is_tour_confirmed_departed_status(text, date) is
  '확정·예정(scheduled)·완료 상태이며 투어일이 지난(실제 출발한) 투어 여부';
