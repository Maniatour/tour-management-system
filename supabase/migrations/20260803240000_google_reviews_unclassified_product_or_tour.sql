-- 미분류: primary 상품 또는 투어 연결 중 하나라도 없으면 포함

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
          or not exists (
            select 1
            from public.google_review_tours gt
            where gt.google_review_id = gr.id
              and gt.operator_id = gr.operator_id
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
          or not exists (
            select 1
            from public.google_review_tours gt
            where gt.google_review_id = gr.id
              and gt.operator_id = gr.operator_id
          )
        )
    )
  );
$$;

comment on function public.admin_list_google_reviews is
  'Admin paginated reviews. unclassified_only = missing primary product OR missing tour link.';

comment on function public.admin_google_review_stats is
  'Review moderation stats. unclassified = missing primary product OR missing tour link.';
