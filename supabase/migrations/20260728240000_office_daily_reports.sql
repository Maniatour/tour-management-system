-- Office daily reports: end-of-day summary for SUPER admins
create table if not exists public.office_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  operator_id uuid not null references public.operators(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_email text,
  submitted_by_name text,
  submitted_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  report_data jsonb not null default '{}'::jsonb,
  editor_notes text,
  pdf_storage_path text,
  pdf_url text,
  email_sent_at timestamptz,
  email_sent_to text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, operator_id)
);

create index if not exists idx_office_daily_reports_date
  on public.office_daily_reports (report_date desc);

create index if not exists idx_office_daily_reports_operator
  on public.office_daily_reports (operator_id, report_date desc);

create index if not exists idx_office_daily_reports_status
  on public.office_daily_reports (status, report_date desc);

comment on table public.office_daily_reports is '사무실 일일 업무 보고 — SUPER 관리자 이메일·PDF 아카이브';

alter table public.office_daily_reports enable row level security;

create policy "Staff can read office daily reports"
  on public.office_daily_reports for select
  to authenticated
  using (public.is_staff(current_setting('request.jwt.claim.email', true)));

create policy "Staff can insert office daily reports"
  on public.office_daily_reports for insert
  to authenticated
  with check (public.is_staff(current_setting('request.jwt.claim.email', true)));

create policy "Staff can update office daily reports"
  on public.office_daily_reports for update
  to authenticated
  using (public.is_staff(current_setting('request.jwt.claim.email', true)));

-- Storage bucket for PDF archives
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'office-daily-reports',
  'office-daily-reports',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "Staff can upload office daily report PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'office-daily-reports'
    and public.is_staff(current_setting('request.jwt.claim.email', true))
  );

create policy "Staff can read office daily report PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'office-daily-reports'
    and public.is_staff(current_setting('request.jwt.claim.email', true))
  );

create or replace function public.update_office_daily_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_update_office_daily_reports_updated_at
  before update on public.office_daily_reports
  for each row
  execute function public.update_office_daily_reports_updated_at();
