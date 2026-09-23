-- 시장조사 OTA는 고정 슬러그 외에 회사에 등록된 channels.id 도 저장한다.
alter table public.market_competitor_listings
  drop constraint if exists market_competitor_listings_ota_platform_check;
