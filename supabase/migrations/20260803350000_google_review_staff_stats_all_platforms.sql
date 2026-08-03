-- 가이드·어시스턴트 리뷰 통계: 모든 플랫폼(Google+OTA) + 투어 배정 fallback, 별점별 리뷰 목록 RPC

drop function if exists public.admin_google_review_staff_stats(uuid);
drop function if exists public.admin_google_review_staff_stats_monthly(uuid, int);
drop function if exists public.admin_google_review_staff_stat_reviews(uuid, text, int, int, int);

create or replace function public.admin_google_review_staff_stats(p_operator_id uuid)
returns table (
  staff_email text,
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
  with staff_review_links as (
    select distinct
      lower(gs.staff_email) as staff_email,
      gr.id as review_id,
      gr.rating
    from public.google_review_staff gs
    inner join public.google_reviews gr
      on gr.id = gs.google_review_id
     and gr.operator_id = gs.operator_id
    where gs.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)

    union

    select distinct
      lower(tr.tour_guide_id) as staff_email,
      gr.id as review_id,
      gr.rating
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)

    union

    select distinct
      lower(tr.assistant_id) as staff_email,
      gr.id as review_id,
      gr.rating
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
  )
  select
    srl.staff_email,
    coalesce(
      nullif(trim(t.nick_name), ''),
      nullif(trim(t.name_ko), ''),
      nullif(trim(t.name_en), ''),
      srl.staff_email
    ) as staff_name,
    count(distinct srl.review_id)::bigint as review_count,
    round(avg(srl.rating)::numeric, 2) as avg_rating,
    count(distinct srl.review_id) filter (where srl.rating = 5)::bigint as five_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 4)::bigint as four_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 3)::bigint as three_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 2)::bigint as two_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 1)::bigint as one_star_count
  from staff_review_links srl
  left join public.team t on lower(t.email) = lower(srl.staff_email)
  group by srl.staff_email, t.nick_name, t.name_ko, t.name_en
  order by review_count desc, avg_rating desc nulls last;
$$;

create or replace function public.admin_google_review_staff_stats_monthly(
  p_operator_id uuid,
  p_year int
)
returns table (
  staff_email text,
  staff_name text,
  month_num int,
  review_count bigint,
  avg_rating numeric,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint,
  total_tour_guests bigint,
  reservation_group_count bigint,
  guest_review_rate_percent numeric,
  group_review_rate_percent numeric
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with staff_reviews as (
    select distinct
      lower(gs.staff_email) as staff_email,
      gr.id as review_id,
      gr.rating,
      coalesce(
        t_linked.tour_date,
        (gr.review_created_at at time zone 'America/Los_Angeles')::date
      ) as anchor_date
    from public.google_review_staff gs
    inner join public.google_reviews gr
      on gr.id = gs.google_review_id
     and gr.operator_id = gs.operator_id
    left join lateral (
      select tr.tour_date
      from public.tours tr
      where tr.id = coalesce(
        gs.tour_id,
        (
          select grt.tour_id
          from public.google_review_tours grt
          where grt.google_review_id = gr.id
          limit 1
        )
      )
      limit 1
    ) t_linked on true
    where gs.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)

    union

    select distinct
      lower(tr.tour_guide_id) as staff_email,
      gr.id as review_id,
      gr.rating,
      coalesce(tr.tour_date, (gr.review_created_at at time zone 'America/Los_Angeles')::date) as anchor_date
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)

    union

    select distinct
      lower(tr.assistant_id) as staff_email,
      gr.id as review_id,
      gr.rating,
      coalesce(tr.tour_date, (gr.review_created_at at time zone 'America/Los_Angeles')::date) as anchor_date
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
  ),
  review_by_month as (
    select
      sr.staff_email,
      extract(month from sr.anchor_date)::int as month_num,
      count(distinct sr.review_id)::bigint as review_count,
      round(avg(sr.rating)::numeric, 2) as avg_rating,
      count(distinct sr.review_id) filter (where sr.rating = 5)::bigint as five_star_count,
      count(distinct sr.review_id) filter (where sr.rating = 4)::bigint as four_star_count,
      count(distinct sr.review_id) filter (where sr.rating = 3)::bigint as three_star_count,
      count(distinct sr.review_id) filter (where sr.rating = 2)::bigint as two_star_count,
      count(distinct sr.review_id) filter (where sr.rating = 1)::bigint as one_star_count
    from staff_reviews sr
    where sr.anchor_date is not null
      and extract(year from sr.anchor_date)::int = p_year
    group by sr.staff_email, extract(month from sr.anchor_date)::int
  ),
  staff_tour_assignments as (
    select
      lower(tr.tour_guide_id) as staff_email,
      tr.id as tour_id,
      tr.tour_date,
      tr.reservation_ids
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
      and tr.tour_date is not null
      and extract(year from tr.tour_date)::int = p_year
    union all
    select
      lower(tr.assistant_id) as staff_email,
      tr.id as tour_id,
      tr.tour_date,
      tr.reservation_ids
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
      and tr.tour_date is not null
      and extract(year from tr.tour_date)::int = p_year
  ),
  tour_guests_by_month as (
    select
      sta.staff_email,
      extract(month from sta.tour_date)::int as month_num,
      coalesce(
        sum(
          case
            when r.id is null then 0
            when lower(btrim(coalesce(r.status, ''))) in (
              'cancelled', 'canceled', 'refunded', 'inquiry', 'no_show'
            ) then 0
            else coalesce(r.total_people, 0)
          end
        ),
        0
      )::bigint as total_tour_guests
    from staff_tour_assignments sta
    left join lateral unnest(coalesce(sta.reservation_ids, '{}'::text[])) as res_id on true
    left join public.reservations r on r.id = res_id
    group by sta.staff_email, extract(month from sta.tour_date)::int
  ),
  reservation_groups_by_month as (
    select
      sta.staff_email,
      extract(month from sta.tour_date)::int as month_num,
      count(distinct res_id) filter (
        where r.id is not null
          and lower(btrim(coalesce(r.status, ''))) not in (
            'cancelled', 'canceled', 'refunded', 'inquiry', 'no_show'
          )
      )::bigint as reservation_group_count
    from staff_tour_assignments sta
    left join lateral unnest(coalesce(sta.reservation_ids, '{}'::text[])) as res_id on true
    left join public.reservations r on r.id = res_id
    group by sta.staff_email, extract(month from sta.tour_date)::int
  ),
  combined as (
    select
      coalesce(rbm.staff_email, tgm.staff_email, rgm.staff_email) as staff_email,
      coalesce(rbm.month_num, tgm.month_num, rgm.month_num) as month_num,
      coalesce(rbm.review_count, 0)::bigint as review_count,
      rbm.avg_rating,
      coalesce(rbm.five_star_count, 0)::bigint as five_star_count,
      coalesce(rbm.four_star_count, 0)::bigint as four_star_count,
      coalesce(rbm.three_star_count, 0)::bigint as three_star_count,
      coalesce(rbm.two_star_count, 0)::bigint as two_star_count,
      coalesce(rbm.one_star_count, 0)::bigint as one_star_count,
      coalesce(tgm.total_tour_guests, 0)::bigint as total_tour_guests,
      coalesce(rgm.reservation_group_count, 0)::bigint as reservation_group_count
    from review_by_month rbm
    full outer join tour_guests_by_month tgm
      on rbm.staff_email = tgm.staff_email
     and rbm.month_num = tgm.month_num
    full outer join reservation_groups_by_month rgm
      on coalesce(rbm.staff_email, tgm.staff_email) = rgm.staff_email
     and coalesce(rbm.month_num, tgm.month_num) = rgm.month_num
  )
  select
    c.staff_email,
    coalesce(
      nullif(trim(t.nick_name), ''),
      nullif(trim(t.name_ko), ''),
      nullif(trim(t.name_en), ''),
      c.staff_email
    ) as staff_name,
    c.month_num,
    c.review_count,
    c.avg_rating,
    c.five_star_count,
    c.four_star_count,
    c.three_star_count,
    c.two_star_count,
    c.one_star_count,
    c.total_tour_guests,
    c.reservation_group_count,
    case
      when c.total_tour_guests > 0 then
        round(c.review_count::numeric / c.total_tour_guests::numeric * 100, 1)
      else null
    end as guest_review_rate_percent,
    case
      when c.reservation_group_count > 0 then
        round(c.review_count::numeric / c.reservation_group_count::numeric * 100, 1)
      else null
    end as group_review_rate_percent
  from combined c
  left join public.team t on lower(t.email) = lower(c.staff_email)
  where c.review_count > 0
     or c.total_tour_guests > 0
     or c.reservation_group_count > 0
  order by staff_name, c.month_num;
$$;

create or replace function public.admin_google_review_staff_stat_reviews(
  p_operator_id uuid,
  p_staff_email text,
  p_rating int,
  p_year int default null,
  p_month int default null
)
returns table (
  id uuid,
  author_name text,
  rating smallint,
  comment text,
  review_created_at timestamptz,
  imported_at timestamptz,
  review_source text,
  tour_date date,
  product_name text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with staff_review_links as (
    select distinct
      lower(gs.staff_email) as staff_email,
      gr.id as review_id,
      gr.rating,
      gr.author_name,
      gr.comment,
      gr.review_created_at,
      gr.imported_at,
      gr.review_source,
      coalesce(
        t_linked.tour_date,
        (gr.review_created_at at time zone 'America/Los_Angeles')::date
      ) as anchor_date,
      coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.name_ko), ''),
        nullif(trim(p.name_en), ''),
        rp.product_id
      ) as product_name
    from public.google_review_staff gs
    inner join public.google_reviews gr
      on gr.id = gs.google_review_id
     and gr.operator_id = gs.operator_id
    left join public.review_products rp
      on rp.google_review_id = gr.id
     and rp.operator_id = gr.operator_id
     and rp.is_primary = true
    left join public.products p on p.id = rp.product_id
    left join lateral (
      select tr.tour_date
      from public.tours tr
      where tr.id = coalesce(
        gs.tour_id,
        (
          select grt.tour_id
          from public.google_review_tours grt
          where grt.google_review_id = gr.id
          limit 1
        )
      )
      limit 1
    ) t_linked on true
    where gs.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)

    union

    select distinct
      lower(tr.tour_guide_id) as staff_email,
      gr.id as review_id,
      gr.rating,
      gr.author_name,
      gr.comment,
      gr.review_created_at,
      gr.imported_at,
      gr.review_source,
      coalesce(tr.tour_date, (gr.review_created_at at time zone 'America/Los_Angeles')::date) as anchor_date,
      coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.name_ko), ''),
        nullif(trim(p.name_en), ''),
        rp.product_id
      ) as product_name
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    left join public.review_products rp
      on rp.google_review_id = gr.id
     and rp.operator_id = gr.operator_id
     and rp.is_primary = true
    left join public.products p on p.id = rp.product_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)

    union

    select distinct
      lower(tr.assistant_id) as staff_email,
      gr.id as review_id,
      gr.rating,
      gr.author_name,
      gr.comment,
      gr.review_created_at,
      gr.imported_at,
      gr.review_source,
      coalesce(tr.tour_date, (gr.review_created_at at time zone 'America/Los_Angeles')::date) as anchor_date,
      coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.name_ko), ''),
        nullif(trim(p.name_en), ''),
        rp.product_id
      ) as product_name
    from public.google_reviews gr
    inner join public.google_review_tours grt
      on grt.google_review_id = gr.id
     and grt.operator_id = gr.operator_id
    inner join public.tours tr
      on tr.id = grt.tour_id
     and tr.operator_id = gr.operator_id
    left join public.review_products rp
      on rp.google_review_id = gr.id
     and rp.operator_id = gr.operator_id
     and rp.is_primary = true
    left join public.products p on p.id = rp.product_id
    where gr.operator_id = p_operator_id
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
  )
  select distinct on (srl.review_id)
    srl.review_id as id,
    srl.author_name,
    srl.rating,
    srl.comment,
    srl.review_created_at,
    srl.imported_at,
    srl.review_source,
    srl.anchor_date as tour_date,
    srl.product_name
  from staff_review_links srl
  where lower(srl.staff_email) = lower(btrim(p_staff_email))
    and srl.rating = p_rating
    and (
      p_year is null
      or (
        srl.anchor_date is not null
        and extract(year from srl.anchor_date)::int = p_year
        and (p_month is null or extract(month from srl.anchor_date)::int = p_month)
      )
    )
  order by srl.review_id, srl.imported_at desc nulls last;
$$;

grant execute on function public.admin_google_review_staff_stats(uuid)
  to service_role, authenticated;

grant execute on function public.admin_google_review_staff_stats_monthly(uuid, int)
  to service_role, authenticated;

grant execute on function public.admin_google_review_staff_stat_reviews(uuid, text, int, int, int)
  to service_role, authenticated;

comment on function public.admin_google_review_staff_stats is
  'Per-person review stats from all platforms and import statuses, via staff links or tour assignment.';

comment on function public.admin_google_review_staff_stats_monthly is
  'Monthly staff review stats from all platforms; all import statuses included.';

comment on function public.admin_google_review_staff_stat_reviews is
  'List reviews for a staff member at a given star rating (optional year/month filter).';
