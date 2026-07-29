-- OP todo: 클릭 시 연결할 관리 화면/모달 설정
alter table public.op_todos
  add column if not exists action_type text not null default 'none',
  add column if not exists action_config jsonb not null default '{}'::jsonb;

alter table public.op_todos drop constraint if exists op_todos_action_type_check;
alter table public.op_todos
  add constraint op_todos_action_type_check check (
    action_type in (
      'none',
      'tour_detail',
      'tours_page',
      'reservation_action',
      'reservation_follow_up',
      'reservations_page',
      'team_board',
      'custom_url'
    )
  );

comment on column public.op_todos.action_type is 'Todo 클릭 시 실행할 액션 유형';
comment on column public.op_todos.action_config is '액션별 JSON 설정 (탭, 상품 필터, 투어 id 등)';

create index if not exists idx_op_todos_action_type on public.op_todos (action_type)
  where action_type <> 'none';
