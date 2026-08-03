-- 투어 미연결 리뷰의 잘못된 자동 상품 분류 제거 (일회성 데이터 정리)

with reviews_without_tour as (
  select gr.id, gr.operator_id
  from public.google_reviews gr
  where not exists (
    select 1
    from public.google_review_tours grt
    where grt.google_review_id = gr.id
      and grt.operator_id = gr.operator_id
  )
)
delete from public.review_products rp
using reviews_without_tour r
where rp.google_review_id = r.id
  and rp.operator_id = r.operator_id;

with reviews_without_tour as (
  select gr.id, gr.operator_id
  from public.google_reviews gr
  where not exists (
    select 1
    from public.google_review_tours grt
    where grt.google_review_id = gr.id
      and grt.operator_id = gr.operator_id
  )
)
update public.google_reviews gr
set
  classification_method = null,
  classification_confidence = null,
  classified_at = null,
  classified_by = null,
  updated_at = now()
from reviews_without_tour r
where gr.id = r.id
  and gr.operator_id = r.operator_id;
