-- OP Todo 보류(on_hold) 상태

begin;

alter table public.op_todos
  add column if not exists on_hold boolean not null default false;

comment on column public.op_todos.on_hold is '보류: 완료 전 일시 제외. completed와 동시에 true 불가.';

create index if not exists idx_op_todos_on_hold_pending
  on public.op_todos (department, on_hold, completed)
  where completed = false;

-- 완료 토글 시 보류 해제
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
    on_hold = false,
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
    'next_notify_at', t.next_notify_at,
    'on_hold', t.on_hold
  );
end;
$$;

-- 보류 토글 (완료 해제 + on_hold 설정)
create or replace function public.op_todo_set_on_hold(
  p_todo_id uuid,
  p_on_hold boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.op_todos%rowtype;
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

  update public.op_todos
  set
    on_hold = p_on_hold,
    completed = false,
    completed_at = null,
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
      case when p_on_hold then 'on_hold' else 'resume' end,
      now()
    );
  end if;

  return jsonb_build_object(
    'id', t.id,
    'completed', t.completed,
    'completed_at', t.completed_at,
    'next_notify_at', t.next_notify_at,
    'on_hold', t.on_hold
  );
end;
$$;

comment on function public.op_todo_set_on_hold(uuid, boolean) is
  'OP Todo 보류 설정/해제. 완료 상태는 해제됩니다.';

commit;
