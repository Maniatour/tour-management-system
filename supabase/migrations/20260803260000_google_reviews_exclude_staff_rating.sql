-- 가이드·어시스턴트 평점에서 제외 (상품만 연결하고 투어 미지정)

alter table public.google_reviews
  add column if not exists exclude_staff_rating boolean not null default false;

comment on column public.google_reviews.exclude_staff_rating is
  'When true, review is not linked to staff ratings; tour link is optional for classification.';

drop function if exists public.admin_list_google_reviews(uuid, text, text, boolean, int, int, text);

create or replace function public.admin_list_google_reviews(
  p_operator_id uuid,
  p_status text default null,
  p_product_id text default null,
  p_unclassified_only boolean default false,
  p_page int default 1,
  p_limit int default 20,
  p_review_source text default null
)
returns table (
  id uuid,
  google_review_id text,
  review_source text,
  author_name text,
  author_photo_url text,
  rating smallint,
  comment text,
  review_reply text,
  review_created_at timestamptz,
  import_status text,
  classification_method text,
  classification_confidence numeric,
  imported_at timestamptz,
  product_id text,
  product_name text,
  exclude_staff_rating boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with params as (
    select
      greatest(coalesce(p_page, 1), 1) as page_num,
      greatest(1, least(coalesce(p_limit, 20), 100)) as page_size
  ),
  filtered as (
    select
      gr.id,
      gr.google_review_id,
      gr.review_source,
      gr.author_name,
      gr.author_photo_url,
      gr.rating,
      gr.comment,
      gr.review_reply,
      gr.review_created_at,
      gr.import_status,
      gr.classification_method,
      gr.classification_confidence,
      gr.imported_at,
      gr.exclude_staff_rating,
      rp.product_id as mapped_product_id,
      coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.name_ko), ''),
        nullif(trim(p.name_en), ''),
        p.id::text
      ) as mapped_product_name
    from public.google_reviews gr
    left join public.review_products rp
      on rp.google_review_id = gr.id
     and rp.operator_id = gr.operator_id
     and rp.is_primary = true
    left join public.products p on p.id = rp.product_id
    where gr.operator_id = p_operator_id
      and (p_status is null or gr.import_status = p_status)
      and (p_review_source is null or gr.review_source = p_review_source)
      and (
        p_product_id is null
        or exists (
          select 1
          from public.review_products rp2
          where rp2.google_review_id = gr.id
            and rp2.operator_id = gr.operator_id
            and rp2.is_primary = true
            and rp2.product_id = p_product_id
        )
      )
      and (
        not coalesce(p_unclassified_only, false)
        or (
          not exists (
            select 1
            from public.review_products rp3
            where rp3.google_review_id = gr.id
              and rp3.operator_id = gr.operator_id
              and rp3.is_primary = true
          )
          or (
            not exists (
              select 1
              from public.google_review_tours gt
              where gt.google_review_id = gr.id
                and gt.operator_id = gr.operator_id
            )
            and not coalesce(gr.exclude_staff_rating, false)
          )
        )
      )
  ),
  counted as (
    select count(*)::bigint as total from filtered
  ),
  paged as (
    select f.*
    from filtered f
    order by f.review_created_at desc nulls last, f.imported_at desc
    limit (select page_size from params)
    offset (select (page_num - 1) * page_size from params)
  )
  select
    pg.id,
    pg.google_review_id,
    pg.review_source,
    pg.author_name,
    pg.author_photo_url,
    pg.rating,
    pg.comment,
    pg.review_reply,
    pg.review_created_at,
    pg.import_status,
    pg.classification_method,
    pg.classification_confidence,
    pg.imported_at,
    pg.mapped_product_id as product_id,
    pg.mapped_product_name as product_name,
    pg.exclude_staff_rating,
    c.total as total_count
  from paged pg
  cross join counted c;
$$;

create or replace function public.admin_google_review_stats(
  p_operator_id uuid,
  p_review_source text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'total', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and (p_review_source is null or gr.review_source = p_review_source)
    ),
    'pending', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'pending'
        and (p_review_source is null or gr.review_source = p_review_source)
    ),
    'approved', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'approved'
        and (p_review_source is null or gr.review_source = p_review_source)
    ),
    'rejected', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'rejected'
        and (p_review_source is null or gr.review_source = p_review_source)
    ),
    'hidden', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'hidden'
        and (p_review_source is null or gr.review_source = p_review_source)
    ),
    'unclassified', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and (p_review_source is null or gr.review_source = p_review_source)
        and (
          not exists (
            select 1
            from public.review_products rp
            where rp.google_review_id = gr.id
              and rp.operator_id = gr.operator_id
              and rp.is_primary = true
          )
          or (
            not exists (
              select 1
              from public.google_review_tours gt
              where gt.google_review_id = gr.id
                and gt.operator_id = gr.operator_id
            )
            and not coalesce(gr.exclude_staff_rating, false)
          )
        )
    )
  );
$$;

drop function if exists public.admin_google_review_staff_stats(uuid);

create or replace function public.admin_google_review_staff_stats(p_operator_id uuid)
returns table (
  staff_email text,
  staff_role text,
  staff_name text,
  review_count bigint,
  avg_rating numeric,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint
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
    count(*) filter (where gr.rating = 3)::bigint as three_star_count,
    count(*) filter (where gr.rating = 2)::bigint as two_star_count,
    count(*) filter (where gr.rating = 1)::bigint as one_star_count
  from public.google_review_staff gs
  inner join public.google_reviews gr
    on gr.id = gs.google_review_id
   and gr.operator_id = gs.operator_id
  left join public.team t on lower(t.email) = lower(gs.staff_email)
  where gs.operator_id = p_operator_id
    and gr.import_status = 'approved'
    and gr.rating is not null
    and not coalesce(gr.exclude_staff_rating, false)
  group by gs.staff_email, gs.staff_role, t.nick_name, t.name_ko, t.name_en
  order by review_count desc, avg_rating desc nulls last;
$$;

grant execute on function public.admin_list_google_reviews(uuid, text, text, boolean, int, int, text)
  to service_role, authenticated;

grant execute on function public.admin_google_review_stats(uuid, text)
  to service_role, authenticated;

grant execute on function public.admin_google_review_staff_stats(uuid)
  to service_role, authenticated;

comment on function public.admin_list_google_reviews is
  'Admin paginated reviews. exclude_staff_rating skips tour requirement for classification.';

comment on function public.admin_google_review_stats is
  'Review stats. unclassified ignores tour when exclude_staff_rating is true.';

comment on function public.admin_google_review_staff_stats is
  'Per-staff stats excluding reviews marked exclude_staff_rating.';
