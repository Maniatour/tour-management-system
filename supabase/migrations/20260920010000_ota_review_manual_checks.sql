-- OTA 채널(GYG/Viator/Klook/KKDay) 수동 리뷰 확인: 리뷰없음 · follow-up
begin;

create table if not exists public.ota_review_manual_checks (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  review_source text not null,
  status text not null check (status in ('no_review', 'follow_up')),
  checked_at timestamptz not null default now(),
  checked_by_email text,
  updated_at timestamptz not null default now(),
  unique (operator_id, review_source)
);

create index if not exists idx_ota_review_manual_checks_operator
  on public.ota_review_manual_checks (operator_id, updated_at desc);

comment on table public.ota_review_manual_checks is
  'Staff marks GetYourGuide/Viator/Klook/KKDay as no-review or follow-up after a manual check.';

alter table public.ota_review_manual_checks enable row level security;

revoke all on table public.ota_review_manual_checks from anon;
grant select, insert, update on table public.ota_review_manual_checks to authenticated;

drop policy if exists "ota_review_manual_checks_select_staff"
  on public.ota_review_manual_checks;
create policy "ota_review_manual_checks_select_staff"
  on public.ota_review_manual_checks for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists "ota_review_manual_checks_write_staff"
  on public.ota_review_manual_checks;
create policy "ota_review_manual_checks_write_staff"
  on public.ota_review_manual_checks for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists "ota_review_manual_checks_update_staff"
  on public.ota_review_manual_checks;
create policy "ota_review_manual_checks_update_staff"
  on public.ota_review_manual_checks for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

commit;
