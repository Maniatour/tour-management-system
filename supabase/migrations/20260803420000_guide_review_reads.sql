-- Guide portal: track which linked reviews a guide has seen + helper RPCs

begin;

create table if not exists public.guide_review_reads (
  staff_email text not null,
  google_review_id uuid not null references public.google_reviews(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (staff_email, google_review_id)
);

create index if not exists idx_guide_review_reads_staff_email
  on public.guide_review_reads (lower(staff_email));

comment on table public.guide_review_reads is
  'Tracks when a guide/assistant has acknowledged a linked review notification.';

alter table public.guide_review_reads enable row level security;

revoke all on table public.guide_review_reads from anon;
grant select, insert, update, delete on table public.guide_review_reads to authenticated;

create policy "guide_review_reads_select_own"
  on public.guide_review_reads for select to authenticated
  using (
    public.is_staff()
    and lower(staff_email) = lower(public.current_email())
  );

create policy "guide_review_reads_insert_own"
  on public.guide_review_reads for insert to authenticated
  with check (
    public.is_staff()
    and lower(staff_email) = lower(public.current_email())
  );

create policy "guide_review_reads_update_own"
  on public.guide_review_reads for update to authenticated
  using (
    public.is_staff()
    and lower(staff_email) = lower(public.current_email())
  )
  with check (
    public.is_staff()
    and lower(staff_email) = lower(public.current_email())
  );

create policy "guide_review_reads_delete_own"
  on public.guide_review_reads for delete to authenticated
  using (
    public.is_staff()
    and lower(staff_email) = lower(public.current_email())
  );

create or replace function public.guide_my_linked_reviews(p_staff_email text)
returns table (
  id uuid,
  author_name text,
  rating integer,
  comment text,
  review_created_at timestamptz,
  imported_at timestamptz,
  review_source text,
  tour_date date,
  product_name_ko text,
  product_name_en text,
  staff_role text,
  is_read boolean
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    gr.id,
    gr.author_name,
    gr.rating,
    gr.comment,
    gr.review_created_at,
    gr.imported_at,
    gr.review_source,
    t.tour_date,
    p.name_ko as product_name_ko,
    p.name_en as product_name_en,
    gs.staff_role,
    exists (
      select 1
      from public.guide_review_reads rr
      where rr.google_review_id = gr.id
        and lower(rr.staff_email) = lower(p_staff_email)
    ) as is_read
  from public.google_review_staff gs
  inner join public.google_reviews gr
    on gr.id = gs.google_review_id
   and gr.operator_id = gs.operator_id
  left join public.google_review_tours grt
    on grt.google_review_id = gr.id
  left join public.tours t
    on t.id = grt.tour_id
  left join public.products p
    on p.id = t.product_id
  where lower(gs.staff_email) = lower(p_staff_email)
    and gr.import_status = 'approved'
    and gr.rating is not null
    and gr.exclude_staff_rating = false
  order by coalesce(gr.review_created_at, gr.imported_at) desc nulls last;
$$;

grant execute on function public.guide_my_linked_reviews(text)
  to service_role, authenticated;

comment on function public.guide_my_linked_reviews is
  'Approved reviews linked to a guide/assistant, with read state, for the guide portal.';

commit;
