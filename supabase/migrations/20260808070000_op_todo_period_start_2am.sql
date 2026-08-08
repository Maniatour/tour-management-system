-- OP Todo 주기 리셋 시각: Las Vegas 03:00 → 02:00
-- (자정 직후 퇴근 시 전날 미완료 목록이 보이도록)

begin;

create or replace function public.op_todo_period_start(p_category text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  with adjusted as (
    select ((now() at time zone 'America/Los_Angeles') - interval '2 hours') as ts
  )
  select case p_category
    when 'daily' then
      (date_trunc('day', ts) + interval '2 hours') at time zone 'America/Los_Angeles'
    when 'weekly' then
      (date_trunc('day', ts) - (extract(isodow from ts)::int - 1) * interval '1 day' + interval '2 hours')
        at time zone 'America/Los_Angeles'
    when 'monthly' then
      (date_trunc('month', ts) + interval '2 hours') at time zone 'America/Los_Angeles'
    when 'yearly' then
      (date_trunc('year', ts) + interval '2 hours') at time zone 'America/Los_Angeles'
    else now()
  end
  from adjusted;
$$;

comment on function public.op_todo_period_start(text) is
  'OP Todo 주기 시작 시각(Las Vegas / America/Los_Angeles 02:00). daily/weekly/monthly/yearly';

comment on function public.apply_due_op_todo_resets() is
  'OP Todo: 주기 경과 후 미리셋된 완료 항목을 일괄 해제 (Las Vegas / America/Los_Angeles 02:00 기준)';

commit;
