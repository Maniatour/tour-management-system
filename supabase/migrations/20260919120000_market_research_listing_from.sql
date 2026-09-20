-- Allow listing-level From price snapshots (From $X per person) alongside option sale prices.
alter table public.market_competitor_price_snapshots
  drop constraint if exists market_competitor_price_snapshots_offer_type_check;

alter table public.market_competitor_price_snapshots
  add constraint market_competitor_price_snapshots_offer_type_check
  check (offer_type in ('all_inclusive', 'sale_plus_excluded', 'listing_from'));

comment on column public.market_competitor_price_snapshots.offer_type is
  'all_inclusive / sale_plus_excluded for canyon options; listing_from for the public From $X / person price.';
