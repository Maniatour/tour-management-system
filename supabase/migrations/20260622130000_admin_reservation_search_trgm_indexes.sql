-- 예약 관리 목록 검색 (`src/lib/adminReservationListFetch.ts` → `buildSearchOrClause`)
-- 에서 쓰는 ILIKE '%…%' 조건에 대해 pg_trgm GIN 인덱스로 시퀀셜 스캔 완화.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm;
  END IF;
END $$;

-- reservations: 직접 ilike 되는 컬럼
CREATE INDEX IF NOT EXISTS idx_reservations_trgm_channel_rn
  ON public.reservations USING gin (channel_rn gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_trgm_pickup_hotel
  ON public.reservations USING gin (pickup_hotel gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_trgm_added_by
  ON public.reservations USING gin (added_by gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_trgm_event_note
  ON public.reservations USING gin (event_note gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_trgm_sub_channel
  ON public.reservations USING gin (sub_channel gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reservations_trgm_variant_key
  ON public.reservations USING gin (variant_key gin_trgm_ops);

-- customers: 보조 id 조회용 ilike
CREATE INDEX IF NOT EXISTS idx_customers_trgm_name
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_trgm_special_requests
  ON public.customers USING gin (special_requests gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_trgm_email
  ON public.customers USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_trgm_phone
  ON public.customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_trgm_emergency_contact
  ON public.customers USING gin (emergency_contact gin_trgm_ops);

-- products: 보조 id 조회용 ilike
CREATE INDEX IF NOT EXISTS idx_products_trgm_name
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_name_ko
  ON public.products USING gin (name_ko gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_name_en
  ON public.products USING gin (name_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_product_code
  ON public.products USING gin (product_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_customer_name_ko
  ON public.products USING gin (customer_name_ko gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_trgm_customer_name_en
  ON public.products USING gin (customer_name_en gin_trgm_ops);

-- channels: 보조 id 조회용 ilike
CREATE INDEX IF NOT EXISTS idx_channels_trgm_name
  ON public.channels USING gin (name gin_trgm_ops);
