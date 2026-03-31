-- reservation_customers: 비 거주자 (패스 구매) 상태 추가
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'reservation_customers'::regclass
    AND contype = 'c'
    AND conname LIKE '%resident_status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE reservation_customers DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
  END IF;

  ALTER TABLE reservation_customers
    ADD CONSTRAINT chk_reservation_customers_resident_status
    CHECK (
      resident_status IN (
        'us_resident',
        'non_resident',
        'non_resident_with_pass',
        'non_resident_under_16',
        'non_resident_purchase_pass'
      )
    );

  COMMENT ON COLUMN reservation_customers.resident_status IS
    '예약 시점의 거주 상태: us_resident, non_resident, non_resident_with_pass, non_resident_under_16, non_resident_purchase_pass(비거주 패스 구매)';
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'customers'::regclass
    AND contype = 'c'
    AND conname LIKE '%resident_status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
  END IF;

  ALTER TABLE customers
    ADD CONSTRAINT chk_customers_resident_status
    CHECK (
      resident_status IS NULL OR
      resident_status IN (
        'us_resident',
        'non_resident',
        'non_resident_with_pass',
        'non_resident_under_16',
        'non_resident_purchase_pass'
      )
    );
END $$;
