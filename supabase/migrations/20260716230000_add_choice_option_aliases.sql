-- 초이스 옵션이 재생성되며 ID가 바뀌어 예약 JSON(reservations.choices)의 option_id 가
-- 현재 choice_options 에서 사라진(orphan) 경우, 예약 카드 뱃지를 복원하기 위한 별칭 매핑.
-- old_option_id(과거 삭제된 옵션 id) → current_option_id(현재 살아있는 옵션 id)
create table if not exists public.choice_option_aliases (
  old_option_id uuid primary key,
  choice_id uuid not null,
  current_option_id uuid not null references public.choice_options(id) on delete cascade,
  confidence text not null default 'price_majority',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_choice_option_aliases_choice
  on public.choice_option_aliases(choice_id);

alter table public.choice_option_aliases enable row level security;

-- 인증 사용자 읽기 허용 (예약 카드 조회 시 참조)
drop policy if exists choice_option_aliases_select on public.choice_option_aliases;
create policy choice_option_aliases_select
  on public.choice_option_aliases
  for select
  to authenticated
  using (true);
