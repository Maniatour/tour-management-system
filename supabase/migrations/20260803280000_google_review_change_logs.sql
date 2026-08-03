-- Google / OTA 리뷰 관리 변경 이력

create table if not exists public.google_review_change_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  google_review_id uuid not null references public.google_reviews(id) on delete cascade,
  change_type text not null
    check (change_type in ('status', 'product', 'tour', 'exclude_staff_rating', 'bulk_status')),
  old_value jsonb,
  new_value jsonb,
  changed_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_review_change_logs_review_created
  on public.google_review_change_logs (google_review_id, created_at desc);

create index if not exists idx_google_review_change_logs_operator_created
  on public.google_review_change_logs (operator_id, created_at desc);

comment on table public.google_review_change_logs is
  'Admin moderation change history for google/OTA reviews (status, product, tour, staff rating exclusion).';

alter table public.google_review_change_logs enable row level security;

revoke all on table public.google_review_change_logs from anon;

grant select, insert on table public.google_review_change_logs to authenticated;

create policy "google_review_change_logs_select_staff"
  on public.google_review_change_logs for select to authenticated
  using (public.is_staff());

create policy "google_review_change_logs_insert_admin"
  on public.google_review_change_logs for insert to authenticated
  with check (public.is_admin_user(public.current_email()));
