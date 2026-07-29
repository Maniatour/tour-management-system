-- 팀보드 초기 로드: op_todos·team·공지·ack·tasks·issues를 단일 RPC로 반환

begin;

create or replace function public.get_team_board_bootstrap(
  p_op_todos_limit integer default 400,
  p_announcements_limit integer default 80,
  p_tasks_limit integer default 120,
  p_issues_limit integer default 120,
  p_include_op_todos boolean default true,
  p_include_work boolean default true,
  p_include_issues boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_team jsonb := '[]'::jsonb;
  v_op_todos jsonb := '[]'::jsonb;
  v_announcements jsonb := '[]'::jsonb;
  v_acknowledgments jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_issues jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', t.email,
        'name_ko', t.name_ko,
        'position', t.position,
        'is_active', t.is_active
      )
      order by t.name_ko
    ),
    '[]'::jsonb
  )
  into v_team
  from public.team t
  where coalesce(t.is_active, true) = true;

  if p_include_op_todos then
    select coalesce(jsonb_agg(to_jsonb(ot)), '[]'::jsonb)
    into v_op_todos
    from (
      select
        o.id,
        o.title,
        o.description,
        o.scope,
        o.category,
        o.department,
        o.assigned_to,
        o.due_date,
        o.completed,
        o.completed_at,
        o.created_by,
        o.created_at,
        o.updated_at,
        o.notify_enabled,
        o.notify_time,
        o.notify_weekday,
        o.notify_day_of_month,
        o.notify_month,
        o.next_notify_at,
        o.action_type,
        o.action_config,
        o.linked_hub_article_id
      from public.op_todos o
      order by o.created_at desc
      limit greatest(1, least(coalesce(p_op_todos_limit, 400), 1000))
    ) ot;
  end if;

  if p_include_work then
    select coalesce(jsonb_agg(to_jsonb(ann)), '[]'::jsonb)
    into v_announcements
    from (
      select
        a.id,
        a.title,
        a.content,
        a.is_pinned,
        a.recipients,
        a.target_positions,
        a.priority,
        a.tags,
        a.due_by,
        a.is_archived,
        a.is_deleted,
        a.deleted_at,
        a.deleted_by,
        a.created_by,
        a.created_at,
        a.updated_at,
        a.linked_hub_article_id
      from public.team_announcements a
      order by a.is_pinned desc, a.created_at desc
      limit greatest(1, least(coalesce(p_announcements_limit, 80), 500))
    ) ann;

    select coalesce(jsonb_agg(to_jsonb(ack)), '[]'::jsonb)
    into v_acknowledgments
    from (
      select
        ack.id,
        ack.announcement_id,
        ack.ack_by,
        ack.ack_at
      from public.team_announcement_acknowledgments ack
      where ack.announcement_id in (
        select ann.id
        from (
          select a.id
          from public.team_announcements a
          order by a.is_pinned desc, a.created_at desc
          limit greatest(1, least(coalesce(p_announcements_limit, 80), 500))
        ) ann
      )
    ) ack;

    select coalesce(jsonb_agg(to_jsonb(tk)), '[]'::jsonb)
    into v_tasks
    from (
      select
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.status,
        t.created_by,
        t.assigned_to,
        t.target_positions,
        t.target_individuals,
        t.tags,
        t.is_deleted,
        t.deleted_at,
        t.deleted_by,
        t.created_at,
        t.updated_at,
        t.linked_hub_article_id
      from public.tasks t
      order by t.updated_at desc nulls last
      limit greatest(1, least(coalesce(p_tasks_limit, 120), 500))
    ) tk;
  end if;

  if p_include_issues then
    select coalesce(jsonb_agg(to_jsonb(iss)), '[]'::jsonb)
    into v_issues
    from (
      select
        i.id,
        i.title,
        i.description,
        i.status,
        i.priority,
        i.reported_by,
        i.is_deleted,
        i.deleted_at,
        i.deleted_by,
        i.created_at,
        i.updated_at
      from public.issues i
      order by i.updated_at desc nulls last
      limit greatest(1, least(coalesce(p_issues_limit, 120), 500))
    ) iss;
  end if;

  return jsonb_build_object(
    'team_members', v_team,
    'op_todos', v_op_todos,
    'announcements', v_announcements,
    'acknowledgments', v_acknowledgments,
    'tasks', v_tasks,
    'issues', v_issues
  );
end;
$$;

comment on function public.get_team_board_bootstrap(integer, integer, integer, integer, boolean, boolean, boolean) is
  '팀보드·Work FAB 초기 로드용 스냅샷 (RLS 적용, 단일 왕복).';

grant execute on function public.get_team_board_bootstrap(integer, integer, integer, integer, boolean, boolean, boolean)
  to authenticated;

commit;
