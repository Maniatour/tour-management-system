-- 가이드·어시스턴트 리뷰 통계: 역할 구분 없이 직원(이메일) 단위로 집계

drop function if exists public.admin_google_review_staff_stats(uuid);

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
  select
    gs.staff_email,
    coalesce(
      nullif(trim(t.nick_name), ''),
      nullif(trim(t.name_ko), ''),
      nullif(trim(t.name_en), ''),
      gs.staff_email
    ) as staff_name,
    count(distinct gr.id)::bigint as review_count,
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
  group by gs.staff_email, t.nick_name, t.name_ko, t.name_en
  order by review_count desc, avg_rating desc nulls last;
$$;

grant execute on function public.admin_google_review_staff_stats(uuid)
  to service_role, authenticated;

comment on function public.admin_google_review_staff_stats is
  'Per-person approved review stats (guide + assistant roles combined by staff email).';
