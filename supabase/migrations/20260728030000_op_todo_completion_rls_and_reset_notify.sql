-- OP Todo 1순위 안정성:
-- 1) 팀 멤버가 공통(scope=common) Todo 완료 토글 가능 (security definer RPC)
-- 2) 자동/수동 리셋 시 notify_enabled 항목의 next_notify_at 재계산

begin;

-- Asia/Seoul 기준 다음 알림 시각 (앱 computeNextNotifyAtIso와 동일 규칙)
create or replace function public.op_todo_compute_next_notify_at(
  p_category text,
  p_notify_time text,
  p_notify_weekday smallint,
  p_notify_day_of_month smallint,
  p_notify_month smallint,
  p_from timestamptz default now()
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  tz constant text := 'Asia/Seoul';
  local_ts timestamp;
  parts text[];
  hour int;
  minute int;
  target timestamp;
  wd int;
  dow_now int;
  days_ahead int;
  dom_req int;
  dom int;
  dim int;
  y int;
  m int;
  mo int;
  next_m timestamp;
begin
  if p_notify_time is null or trim(p_notify_time) = '' then
    return null;
  end if;

  if p_category not in ('daily', 'weekly', 'monthly', 'yearly') then
    return null;
  end if;

  parts := string_to_array(p_notify_time, ':');
  hour := least(23, greatest(0, coalesce(nullif(trim(parts[1]), '')::int, 9)));
  minute := least(59, greatest(0, coalesce(nullif(trim(parts[2]), '')::int, 0)));

  local_ts := (p_from at time zone tz);

  if p_category = 'daily' then
    target := date_trunc('day', local_ts) + make_interval(hours => hour, mins => minute);
    if target <= local_ts then
      target := target + interval '1 day';
    end if;
    return target at time zone tz;
  end if;

  if p_category = 'weekly' then
    wd := least(6, greatest(0, coalesce(p_notify_weekday, 1)::int));
    dow_now := extract(dow from local_ts)::int;
    days_ahead := (wd - dow_now + 7) % 7;
    target := date_trunc('day', local_ts) + (days_ahead || ' days')::interval + make_interval(hours => hour, mins => minute);
    if target <= local_ts then
      target := target + interval '7 days';
    end if;
    return target at time zone tz;
  end if;

  if p_category = 'monthly' then
    dom_req := least(31, greatest(1, coalesce(p_notify_day_of_month, 1)::int));
    y := extract(year from local_ts)::int;
    m := extract(month from local_ts)::int;
    dim := extract(
      day from (date_trunc('month', local_ts::timestamptz) + interval '1 month - 1 day')::timestamp
    )::int;
    dom := least(dom_req, dim);
    target := make_timestamp(y, m, dom, hour, minute, 0);
    if target <= local_ts then
      next_m := local_ts + interval '1 month';
      y := extract(year from next_m)::int;
      m := extract(month from next_m)::int;
      dim := extract(
        day from (date_trunc('month', next_m::timestamptz) + interval '1 month - 1 day')::timestamp
      )::int;
      dom := least(dom_req, dim);
      target := make_timestamp(y, m, dom, hour, minute, 0);
    end if;
    return target at time zone tz;
  end if;

  -- yearly
  mo := least(12, greatest(1, coalesce(p_notify_month, 1)::int));
  dom_req := least(31, greatest(1, coalesce(p_notify_day_of_month, 1)::int));
  y := extract(year from local_ts)::int;
  dim := extract(day from (make_date(y, mo, 1) + interval '1 month - 1 day')::date)::int;
  dom := least(dom_req, dim);
  target := make_timestamp(y, mo, dom, hour, minute, 0);
  if target <= local_ts then
    y := y + 1;
    dim := extract(day from (make_date(y, mo, 1) + interval '1 month - 1 day')::date)::int;
    dom := least(dom_req, dim);
    target := make_timestamp(y, mo, dom, hour, minute, 0);
  end if;
  return target at time zone tz;
end;
$$;

comment on function public.op_todo_compute_next_notify_at(text, text, smallint, smallint, smallint, timestamptz) is
  'OP Todo 다음 알림 시각(Asia/Seoul). 앱 computeNextNotifyAtIso와 동일 규칙.';

-- 팀 멤버 완료 토글 (공통 Todo 포함) + 클릭 로그
create or replace function public.op_todo_toggle_completion(
  p_todo_id uuid,
  p_completed boolean,
  p_next_notify_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.op_todos%rowtype;
  computed_next timestamptz;
  actor_email text;
  can_toggle boolean;
begin
  if not public.team_board_request_is_member() then
    raise exception 'forbidden';
  end if;

  select * into t from public.op_todos where id = p_todo_id for update;
  if not found then
    raise exception 'not found';
  end if;

  can_toggle :=
    t.scope = 'common'
    or t.assigned_to is null
    or public.team_board_email_matches(t.created_by)
    or (t.assigned_to is not null and public.team_board_email_matches(t.assigned_to))
    or public.team_board_is_admin_session();

  if not can_toggle then
    raise exception 'forbidden';
  end if;

  computed_next := t.next_notify_at;

  if t.notify_enabled and t.notify_time is not null then
    if p_completed then
      computed_next := coalesce(
        p_next_notify_at,
        public.op_todo_compute_next_notify_at(
          t.category,
          t.notify_time,
          t.notify_weekday,
          t.notify_day_of_month,
          t.notify_month,
          now()
        )
      );
    elsif t.next_notify_at is null or t.next_notify_at <= now() then
      computed_next := coalesce(
        p_next_notify_at,
        public.op_todo_compute_next_notify_at(
          t.category,
          t.notify_time,
          t.notify_weekday,
          t.notify_day_of_month,
          t.notify_month,
          now()
        )
      );
    end if;
  elsif p_next_notify_at is not null then
    computed_next := p_next_notify_at;
  end if;

  update public.op_todos
  set
    completed = p_completed,
    completed_at = case when p_completed then now() else null end,
    next_notify_at = case
      when t.notify_enabled and t.notify_time is not null then computed_next
      else next_notify_at
    end,
    updated_at = now()
  where id = p_todo_id
  returning * into t;

  actor_email := coalesce(
    nullif(lower(trim(public.current_email())), ''),
    nullif(lower(trim(public.session_email_from_auth_users())), ''),
    ''
  );

  if actor_email <> '' then
    insert into public.todo_click_logs (todo_id, user_email, action, timestamp)
    values (
      p_todo_id,
      actor_email,
      case when p_completed then 'completed' else 'uncompleted' end,
      now()
    );
  end if;

  return jsonb_build_object(
    'id', t.id,
    'completed', t.completed,
    'completed_at', t.completed_at,
    'next_notify_at', t.next_notify_at
  );
end;
$$;

comment on function public.op_todo_toggle_completion(uuid, boolean, timestamptz) is
  'OP Todo 완료 토글: 공통 체크리스트는 팀 멤버 누구나, 개별 할당은 담당자/작성자/admin.';

-- 알림 모달 완료 → 동일 RPC 경로
create or replace function public.op_todo_notify_handle_complete(p_todo_id uuid, p_next_notify_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.op_todo_toggle_completion(p_todo_id, true, p_next_notify_at);
end;
$$;

-- 자동 리셋: next_notify_at 갱신
create or replace function public.reset_op_todos_category_if_due(p_category text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_start timestamptz;
  reset_count integer := 0;
begin
  if p_category not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'invalid category: %', p_category;
  end if;

  period_start := public.op_todo_period_start(p_category);

  with reset_rows as (
    update public.op_todos t
    set
      completed = false,
      completed_at = null,
      next_notify_at = case
        when t.notify_enabled and t.notify_time is not null then
          public.op_todo_compute_next_notify_at(
            t.category,
            t.notify_time,
            t.notify_weekday,
            t.notify_day_of_month,
            t.notify_month,
            now()
          )
        else t.next_notify_at
      end,
      updated_at = now()
    where t.category = p_category
      and t.completed = true
      and (t.completed_at is null or t.completed_at < period_start)
    returning t.id
  ),
  logged as (
    insert into public.todo_click_logs (todo_id, user_email, action, timestamp)
    select id, 'system@auto-reset.com', 'uncompleted', now()
    from reset_rows
    returning 1
  )
  select count(*)::integer into reset_count from reset_rows;

  return reset_count;
end;
$$;

-- 수동 리셋: next_notify_at 갱신
create or replace function public._force_reset_op_todos_category(p_category text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_count integer := 0;
begin
  with reset_rows as (
    update public.op_todos t
    set
      completed = false,
      completed_at = null,
      next_notify_at = case
        when t.notify_enabled and t.notify_time is not null then
          public.op_todo_compute_next_notify_at(
            t.category,
            t.notify_time,
            t.notify_weekday,
            t.notify_day_of_month,
            t.notify_month,
            now()
          )
        else t.next_notify_at
      end,
      updated_at = now()
    where t.category = p_category and t.completed = true
    returning t.id
  ),
  logged as (
    insert into public.todo_click_logs (todo_id, user_email, action, timestamp)
    select id, 'system@auto-reset.com', 'uncompleted', now()
    from reset_rows
    returning 1
  )
  select count(*)::integer into reset_count from reset_rows;

  return reset_count;
end;
$$;

revoke all on function public.op_todo_compute_next_notify_at(text, text, smallint, smallint, smallint, timestamptz) from public;
revoke all on function public.op_todo_toggle_completion(uuid, boolean, timestamptz) from public;

grant execute on function public.op_todo_compute_next_notify_at(text, text, smallint, smallint, smallint, timestamptz) to authenticated, service_role;
grant execute on function public.op_todo_toggle_completion(uuid, boolean, timestamptz) to authenticated;

commit;
