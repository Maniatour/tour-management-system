-- 시장조사 자사 채널 비교 설정. 예약·동적가격은 바꾸지 않는다.
begin;

alter table public.market_research_our_offers
  add column if not exists channel_settings jsonb not null default '{}'::jsonb;

comment on column public.market_research_our_offers.channel_settings is
  'Per OTA comparison overrides for Kovegas (discount and sale). Does not change booking or dynamic pricing.';

commit;
