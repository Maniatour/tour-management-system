-- 팀보드 Todo List / Work 모달 목록 조회 성능 인덱스

create index if not exists idx_op_todos_created_at_desc
  on public.op_todos (created_at desc);

create index if not exists idx_tasks_updated_at_desc
  on public.tasks (updated_at desc nulls last)
  where coalesce(is_deleted, false) = false;

create index if not exists idx_team_announcements_list_order
  on public.team_announcements (is_pinned desc, created_at desc)
  where coalesce(is_deleted, false) = false;

create index if not exists idx_team_announcement_acks_ann_id_ack_at
  on public.team_announcement_acknowledgments (announcement_id, ack_at desc);
