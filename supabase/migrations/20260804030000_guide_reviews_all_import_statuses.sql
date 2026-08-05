-- Guide portal: show linked reviews regardless of import_status (approved/rejected/pending/hidden)

begin;

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
    and gr.rating is not null
    and gr.exclude_staff_rating = false
  order by coalesce(gr.review_created_at, gr.imported_at) desc nulls last;
$$;

grant execute on function public.guide_my_linked_reviews(text)
  to service_role, authenticated;

comment on function public.guide_my_linked_reviews is
  'Reviews linked to a guide/assistant (any import_status), with read state, for the guide portal.';

commit;
