-- 지출 중복 점검(회사·투어·예약·입장권 통합): 우연 일치 그룹/쌍을 목록에서 숨기기 위한 기록.
-- 스태프만 읽기·추가·삭제(되돌리기).

begin;

create table if not exists public.expense_duplicate_suppressions (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  kind text not null check (kind in ('pair', 'group')),
  member_keys text[] not null,
  created_at timestamptz not null default now(),
  created_by text null
);

comment on table public.expense_duplicate_suppressions is
  '통합 지출 중복 점검 UI: 서로 다른 지출로 표시 제외(pair=두 건, group=전체 그룹). fingerprint는 정규화된 source_key 조합.';

create index if not exists expense_duplicate_suppressions_created_at_idx
  on public.expense_duplicate_suppressions (created_at desc);

alter table public.expense_duplicate_suppressions enable row level security;

revoke all on table public.expense_duplicate_suppressions from anon;

create policy "expense_duplicate_suppressions_select_staff"
  on public.expense_duplicate_suppressions for select to authenticated
  using (public.is_staff());

create policy "expense_duplicate_suppressions_insert_staff"
  on public.expense_duplicate_suppressions for insert to authenticated
  with check (public.is_staff());

create policy "expense_duplicate_suppressions_delete_staff"
  on public.expense_duplicate_suppressions for delete to authenticated
  using (public.is_staff());

grant select, insert, delete on table public.expense_duplicate_suppressions to authenticated;

commit;
