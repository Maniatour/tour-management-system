-- Google Business reviews admin list/stats RPCs (scales to thousands of rows)

begin;

create index if not exists idx_review_products_operator_primary_review
  on public.review_products (operator_id, google_review_id)
  where is_primary = true;

drop function if exists public.admin_list_google_reviews(uuid, text, uuid, boolean, int, int);
drop function if exists public.admin_list_google_reviews(uuid, text, text, boolean, int, int);

create or replace function public.admin_list_google_reviews(
  p_operator_id uuid,
  p_status text default null,
  p_product_id text default null,
  p_unclassified_only boolean default false,
  p_page int default 1,
  p_limit int default 20
)
returns table (
  id uuid,
  google_review_id text,
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
        nullif(trim(p.customer_name_en), ''),
        nullif(trim(p.customer_name_ko), ''),
        nullif(trim(p.name_en), ''),
        nullif(trim(p.name_ko), ''),
        nullif(trim(p.name), ''),
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
        or not exists (
          select 1
          from public.review_products rp3
          where rp3.google_review_id = gr.id
            and rp3.operator_id = gr.operator_id
            and rp3.is_primary = true
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

create or replace function public.admin_google_review_stats(p_operator_id uuid)
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
    ),
    'pending', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'pending'
    ),
    'approved', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'approved'
    ),
    'rejected', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'rejected'
    ),
    'hidden', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and gr.import_status = 'hidden'
    ),
    'unclassified', (
      select count(*)::int
      from public.google_reviews gr
      where gr.operator_id = p_operator_id
        and not exists (
          select 1
          from public.review_products rp
          where rp.google_review_id = gr.id
            and rp.operator_id = gr.operator_id
            and rp.is_primary = true
        )
    )
  );
$$;

grant execute on function public.admin_list_google_reviews(uuid, text, text, boolean, int, int)
  to service_role, authenticated;

grant execute on function public.admin_google_review_stats(uuid)
  to service_role, authenticated;

comment on function public.admin_list_google_reviews is
  'Paginated Google review moderation list with optional status/product/unclassified filters.';

comment on function public.admin_google_review_stats is
  'Aggregate counts for Google review moderation dashboard.';

commit;
