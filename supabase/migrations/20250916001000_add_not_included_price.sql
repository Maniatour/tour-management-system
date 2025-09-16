-- Add not_included_price to dynamic_pricing for OTA price derivation
alter table public.dynamic_pricing
  add column if not exists not_included_price numeric;

comment on column public.dynamic_pricing.not_included_price is
  'Amount per adult to exclude from adult_price when deriving OTA displayed price. OTA price per adult = adult_price - not_included_price.';

