-- Google reviews ↔ tours / guide & assistant attribution (reward system foundation)

begin;

drop table if exists public.google_review_staff;
drop table if exists public.google_review_tours;

create table if not exists public.google_review_tours (
  google_review_id uuid primary key references public.google_reviews(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  tour_id text not null references public.tours(id) on delete cascade,
  match_method text,
  match_confidence numeric(5, 4),
  matched_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_google_review_tours_operator_id
  on public.google_review_tours (operator_id);
create index if not exists idx_google_review_tours_tour_id
  on public.google_review_tours (tour_id);

comment on table public.google_review_tours is
  'Links an imported Google review to a specific tour instance.';

create table if not exists public.google_review_staff (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  google_review_id uuid not null references public.google_reviews(id) on delete cascade,
  tour_id text references public.tours(id) on delete set null,
  staff_email text not null,
  staff_role text not null check (staff_role in ('guide', 'assistant')),
  match_method text not null,
  match_confidence numeric(5, 4),
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint google_review_staff_review_email_unique unique (google_review_id, staff_email)
);

create index if not exists idx_google_review_staff_operator_id
  on public.google_review_staff (operator_id);
create index if not exists idx_google_review_staff_staff_email
  on public.google_review_staff (staff_email);
create index if not exists idx_google_review_staff_tour_id
  on public.google_review_staff (tour_id);

comment on table public.google_review_staff is
  'Attributes a Google review rating to guide/assistant staff for performance tracking.';

alter table public.google_review_tours enable row level security;
alter table public.google_review_staff enable row level security;

revoke all on table public.google_review_tours from anon;
revoke all on table public.google_review_staff from anon;

grant select, insert, update, delete on table public.google_review_tours to authenticated;
grant select, insert, update, delete on table public.google_review_staff to authenticated;

create policy "google_review_tours_select_staff"
  on public.google_review_tours for select to authenticated
  using (public.is_staff());

create policy "google_review_tours_write_admin"
  on public.google_review_tours for all to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

create policy "google_review_staff_select_staff"
  on public.google_review_staff for select to authenticated
  using (public.is_staff());

create policy "google_review_staff_write_admin"
  on public.google_review_staff for all to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

create or replace function public.admin_google_review_staff_stats(p_operator_id uuid)
returns table (
  staff_email text,
  staff_role text,
  staff_name text,
  review_count bigint,
  avg_rating numeric,
  five_star_count bigint,
  four_star_count bigint,
  three_or_below_count bigint
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    gs.staff_email,
    gs.staff_role,
    coalesce(
      nullif(trim(t.nick_name), ''),
      nullif(trim(t.name_ko), ''),
      nullif(trim(t.name_en), ''),
      gs.staff_email
    ) as staff_name,
    count(*)::bigint as review_count,
    round(avg(gr.rating)::numeric, 2) as avg_rating,
    count(*) filter (where gr.rating = 5)::bigint as five_star_count,
    count(*) filter (where gr.rating = 4)::bigint as four_star_count,
    count(*) filter (where gr.rating <= 3)::bigint as three_or_below_count
  from public.google_review_staff gs
  inner join public.google_reviews gr
    on gr.id = gs.google_review_id
   and gr.operator_id = gs.operator_id
  left join public.team t on lower(t.email) = lower(gs.staff_email)
  where gs.operator_id = p_operator_id
    and gr.import_status = 'approved'
    and gr.rating is not null
  group by gs.staff_email, gs.staff_role, t.nick_name, t.name_ko, t.name_en
  order by review_count desc, avg_rating desc nulls last;
$$;

grant execute on function public.admin_google_review_staff_stats(uuid)
  to service_role, authenticated;

comment on function public.admin_google_review_staff_stats is
  'Approved Google review ratings aggregated per guide/assistant.';

commit;
