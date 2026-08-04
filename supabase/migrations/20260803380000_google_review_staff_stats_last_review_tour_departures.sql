-- OVERALL 가이드·어시스턴트 리뷰 통계: 마지막 리뷰일, 확정 출발 투어 진행 횟수

create or replace function public.is_tour_confirmed_departed_status(
  p_status text,
  p_tour_date date
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when public.is_tour_cancelled_or_deleted_status(p_status) then false
    when p_tour_date is null then false
    when p_tour_date > (now() at time zone 'America/Los_Angeles')::date then false
    else (
      lower(btrim(coalesce(p_status, ''))) in ('confirm', 'confirmed')
      or lower(btrim(coalesce(p_status, ''))) in ('complete', 'completed')
      or lower(coalesce(p_status, '')) like '%complete%'
    )
  end;
$$;

comment on function public.is_tour_confirmed_departed_status(text, date) is
  '확정·완료 상태이며 투어일이 지난(실제 출발한) 투어 여부';

drop function if exists public.admin_google_review_staff_stats(uuid);

create or replace function public.admin_google_review_staff_stats(p_operator_id uuid)
returns table (
  staff_email text,
  staff_name text,
  first_review_date date,
  last_review_date date,
  review_count bigint,
  avg_rating numeric,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint,
  total_tour_guests bigint,
  reservation_group_count bigint,
  tour_departure_count bigint
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
  staff_review_dates as (
    select
      sr.staff_email,
      min(sr.anchor_date) as first_review_date,
      max(sr.anchor_date) as last_review_date
    from staff_reviews sr
    where sr.anchor_date is not null
    group by sr.staff_email
  ),
  staff_tour_assignments as (
    select
      lower(tr.tour_guide_id) as staff_email,
      tr.tour_date,
      tr.reservation_ids
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
      and tr.tour_date is not null
    union all
    select
      lower(tr.assistant_id) as staff_email,
      tr.tour_date,
      tr.reservation_ids
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and not public.is_tour_cancelled_or_deleted_status(tr.tour_status)
      and tr.tour_date is not null
  ),
  tour_career_totals as (
    select
      sta.staff_email,
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
      )::bigint as total_tour_guests,
      count(distinct res_id) filter (
        where r.id is not null
          and lower(btrim(coalesce(r.status, ''))) not in (
            'cancelled', 'canceled', 'refunded', 'inquiry', 'no_show'
          )
      )::bigint as reservation_group_count
    from staff_tour_assignments sta
    inner join staff_review_dates srd
      on srd.staff_email = sta.staff_email
     and sta.tour_date >= srd.first_review_date
    left join lateral unnest(coalesce(sta.reservation_ids, '{}'::text[])) as res_id on true
    left join public.reservations r on r.id = res_id
    group by sta.staff_email
  ),
  staff_departure_assignments as (
    select
      lower(tr.tour_guide_id) as staff_email,
      tr.id as tour_id,
      tr.tour_date
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.tour_guide_id is not null
      and btrim(tr.tour_guide_id) <> ''
      and tr.tour_date is not null
      and public.is_tour_confirmed_departed_status(tr.tour_status, tr.tour_date)
    union
    select
      lower(tr.assistant_id) as staff_email,
      tr.id as tour_id,
      tr.tour_date
    from public.tours tr
    where tr.operator_id = p_operator_id
      and tr.assistant_id is not null
      and btrim(tr.assistant_id) <> ''
      and tr.tour_date is not null
      and public.is_tour_confirmed_departed_status(tr.tour_status, tr.tour_date)
  ),
  staff_departure_counts as (
    select
      sda.staff_email,
      count(distinct sda.tour_id)::bigint as tour_departure_count
    from staff_departure_assignments sda
    inner join staff_review_dates srd
      on srd.staff_email = sda.staff_email
     and sda.tour_date >= srd.first_review_date
    group by sda.staff_email
  )
  select
    srl.staff_email,
    coalesce(
      nullif(trim(t.nick_name), ''),
      nullif(trim(t.name_ko), ''),
      nullif(trim(t.name_en), ''),
      srl.staff_email
    ) as staff_name,
    srd.first_review_date,
    srd.last_review_date,
    count(distinct srl.review_id)::bigint as review_count,
    round(avg(srl.rating)::numeric, 2) as avg_rating,
    count(distinct srl.review_id) filter (where srl.rating = 5)::bigint as five_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 4)::bigint as four_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 3)::bigint as three_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 2)::bigint as two_star_count,
    count(distinct srl.review_id) filter (where srl.rating = 1)::bigint as one_star_count,
    coalesce(tct.total_tour_guests, 0)::bigint as total_tour_guests,
    coalesce(tct.reservation_group_count, 0)::bigint as reservation_group_count,
    coalesce(sdc.tour_departure_count, 0)::bigint as tour_departure_count
  from (
    select distinct staff_email, review_id, rating
    from staff_reviews
  ) srl
  left join staff_review_dates srd on srd.staff_email = srl.staff_email
  left join tour_career_totals tct on tct.staff_email = srl.staff_email
  left join staff_departure_counts sdc on sdc.staff_email = srl.staff_email
  left join public.team t on lower(t.email) = lower(srl.staff_email)
  group by
    srl.staff_email,
    t.nick_name,
    t.name_ko,
    t.name_en,
    srd.first_review_date,
    srd.last_review_date,
    tct.total_tour_guests,
    tct.reservation_group_count,
    sdc.tour_departure_count
  order by review_count desc, avg_rating desc nulls last;
$$;

grant execute on function public.admin_google_review_staff_stats(uuid)
  to authenticated, service_role;

comment on function public.admin_google_review_staff_stats is
  'Guide/assistant review stats (all platforms). Includes first/last review dates, tour guest/reservation totals, and confirmed departed tour counts since first review.';
