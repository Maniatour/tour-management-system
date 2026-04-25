-- 정규화 UI: 그룹별 대표 행의 표준 결제내용·카테고리·유형(피커 초기값 추론용)
begin;

create or replace function public.company_expense_paid_for_normalization_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'paid_for', q.paid_for,
        'count', q.cnt,
        'paid_for_label_id', q.paid_for_label_id,
        'sample_standard_paid_for', s.sample_standard_paid_for,
        'sample_category', s.sample_category,
        'sample_expense_type', s.sample_expense_type
      )
      order by q.cnt desc
    ),
    '[]'::jsonb
  )
  from (
    select ce.paid_for, count(*)::int as cnt, ce.paid_for_label_id
    from company_expenses ce
    where ce.paid_for is not null and btrim(ce.paid_for::text) <> ''
    group by ce.paid_for, ce.paid_for_label_id
  ) q
  left join lateral (
    select ce2.standard_paid_for as sample_standard_paid_for,
           ce2.category as sample_category,
           ce2.expense_type as sample_expense_type
    from company_expenses ce2
    where ce2.paid_for is not distinct from q.paid_for
      and ce2.paid_for_label_id is not distinct from q.paid_for_label_id
      and ce2.paid_for is not null and btrim(ce2.paid_for::text) <> ''
    order by
      case
        when ce2.standard_paid_for is not null and btrim(ce2.standard_paid_for::text) <> '' then 0
        else 1
      end,
      ce2.updated_at desc nulls last
    limit 1
  ) s on true;
$$;

comment on function public.company_expense_paid_for_normalization_stats() is
  '결제 내용별 건수·라벨·대표 표준값(정규화 UI용). sample_* 는 그룹 내 한 행 기준.';

commit;
