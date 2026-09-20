alter table public.market_competitor_price_snapshots
  add column if not exists discount_enabled boolean not null default false;

alter table public.market_competitor_price_snapshots
  add column if not exists discount_percent numeric(6,2) not null default 0;

alter table public.market_competitor_price_snapshots
  add column if not exists adult_discounted_price numeric;

comment on column public.market_competitor_price_snapshots.adult_sale_price is
  'OTA 표시가(정가).';
comment on column public.market_competitor_price_snapshots.discount_percent is
  '표시가 대비 할인율(%). 0이면 할인 없음.';
comment on column public.market_competitor_price_snapshots.adult_discounted_price is
  '할인 적용 판매가. 할인 없으면 null.';
