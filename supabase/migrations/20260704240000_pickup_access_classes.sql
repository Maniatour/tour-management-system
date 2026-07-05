-- Vehicle pickup access tiers: regular | high_top | bus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickup_access_class') THEN
    CREATE TYPE pickup_access_class AS ENUM ('regular', 'high_top', 'bus');
  END IF;
END $$;

ALTER TABLE vehicle_types
  ADD COLUMN IF NOT EXISTS pickup_access_class pickup_access_class NOT NULL DEFAULT 'regular';

COMMENT ON COLUMN vehicle_types.pickup_access_class IS 'Hotel pickup access tier: regular, high_top, or bus';

-- Best-effort classification for existing vehicle types
UPDATE vehicle_types
SET pickup_access_class = 'bus'
WHERE pickup_access_class = 'regular'
  AND name ~* '(mini\s*bus|minibus|\m23\M|\m28\M|\mbus\M)';

UPDATE vehicle_types
SET pickup_access_class = 'high_top'
WHERE pickup_access_class = 'regular'
  AND name ~* '(sprinter|hightop|high\s*top|captain\s*seat|transit\s*hightop)';

ALTER TABLE pickup_hotels
  ADD COLUMN IF NOT EXISTS allowed_pickup_access_classes pickup_access_class[];

ALTER TABLE pickup_hotels
  DROP COLUMN IF EXISTS allowed_vehicle_type_ids;

COMMENT ON COLUMN pickup_hotels.allowed_pickup_access_classes IS 'Allowed pickup access tiers at this hotel; NULL = all tiers allowed';
