-- 리스팅별 포함/불포함 항목 (그랜드캐년, 앤텔롭, 홀스슈, 팁, 식사)
begin;

alter table public.market_competitor_listings
  add column if not exists inclusion_items jsonb not null default '{}'::jsonb;

comment on column public.market_competitor_listings.inclusion_items is
  'Per-listing included/excluded flags for compare items, e.g. {"grand_canyon":"included","guide_tip":"excluded"}.';

commit;
