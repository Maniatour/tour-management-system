-- 가이드·어시스턴트 리뷰 통계: 연도·월별 리뷰 수, 평균 별점, 투어 인원 대비 리뷰율

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
  total_tour_guests bigint,
  review_rate_percent numeric
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with staff_reviews as (
    select
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
      and gr.import_status = 'approved'
      and gr.rating is not null
      and not coalesce(gr.exclude_staff_rating, false)
  ),
  review_by_month as (
    select
      sr.staff_email,
      extract(month from sr.anchor_date)::int as month_num,
      count(distinct sr.review_id)::bigint as review_count,
      round(avg(sr.rating)::numeric, 2) as avg_rating
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
  combined as (
    select
      coalesce(rbm.staff_email, tgm.staff_email) as staff_email,
      coalesce(rbm.month_num, tgm.month_num) as month_num,
      coalesce(rbm.review_count, 0)::bigint as review_count,
      rbm.avg_rating,
      coalesce(tgm.total_tour_guests, 0)::bigint as total_tour_guests
    from review_by_month rbm
    full outer join tour_guests_by_month tgm
      on rbm.staff_email = tgm.staff_email
     and rbm.month_num = tgm.month_num
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
    c.total_tour_guests,
    case
      when c.total_tour_guests > 0 then
        round(c.review_count::numeric / c.total_tour_guests::numeric * 100, 1)
      else null
    end as review_rate_percent
  from combined c
  left join public.team t on lower(t.email) = lower(c.staff_email)
  where c.review_count > 0 or c.total_tour_guests > 0
  order by staff_name, c.month_num;
$$;

grant execute on function public.admin_google_review_staff_stats_monthly(uuid, int)
  to service_role, authenticated;

comment on function public.admin_google_review_staff_stats_monthly is
  'Per-staff monthly review count, average rating, tour guest count, and review rate % for a calendar year.';
