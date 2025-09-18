-- Ensure tours.id is TEXT and has a TEXT-friendly default
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'id'
  ) THEN
    -- Convert to TEXT if not already
    BEGIN
      ALTER TABLE tours ALTER COLUMN id TYPE TEXT USING id::text;
    EXCEPTION WHEN others THEN
      -- ignore if already text-compatible
      NULL;
    END;

    -- Set default to gen_random_uuid()::text for consistency
    BEGIN
      ALTER TABLE tours ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    EXCEPTION WHEN undefined_function THEN
      -- If gen_random_uuid is unavailable, fallback to uuid_generate_v4()::text
      ALTER TABLE tours ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text;
    WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- Ensure tours.reservation_ids is TEXT[]
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tours' AND column_name = 'reservation_ids'
  ) THEN
    BEGIN
      ALTER TABLE tours ADD COLUMN IF NOT EXISTS reservation_ids_text TEXT[];
      UPDATE tours 
      SET reservation_ids_text = CASE 
        WHEN reservation_ids IS NULL THEN NULL
        ELSE ARRAY(SELECT unnest(reservation_ids)::TEXT)
      END
      WHERE reservation_ids IS NOT NULL;
      ALTER TABLE tours DROP COLUMN IF EXISTS reservation_ids;
      ALTER TABLE tours RENAME COLUMN reservation_ids_text TO reservation_ids;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- Helper: drop FK if it exists by name
DO $$ BEGIN
  -- reservations.tour_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reservations_tour_id_fkey' AND table_name = 'reservations'
  ) THEN
    ALTER TABLE reservations DROP CONSTRAINT reservations_tour_id_fkey;
  END IF;
  -- ticket_bookings.tour_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_bookings_tour_id_fkey' AND table_name = 'ticket_bookings'
  ) THEN
    ALTER TABLE ticket_bookings DROP CONSTRAINT ticket_bookings_tour_id_fkey;
  END IF;
  -- tour_hotel_bookings.tour_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tour_hotel_bookings_tour_id_fkey' AND table_name = 'tour_hotel_bookings'
  ) THEN
    ALTER TABLE tour_hotel_bookings DROP CONSTRAINT tour_hotel_bookings_tour_id_fkey;
  END IF;
  -- tour_announcements.tour_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tour_announcements_tour_id_fkey' AND table_name = 'tour_announcements'
  ) THEN
    ALTER TABLE tour_announcements DROP CONSTRAINT tour_announcements_tour_id_fkey;
  END IF;
END $$;

-- Normalize tour_id columns to TEXT
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE reservations ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_bookings' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE ticket_bookings ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_hotel_bookings' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE tour_hotel_bookings ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_expenses' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE tour_expenses ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_photos' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE tour_photos ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE chat_rooms ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_announcements' AND column_name = 'tour_id') THEN
    BEGIN
      ALTER TABLE tour_announcements ALTER COLUMN tour_id TYPE TEXT USING tour_id::text;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- Recreate FKs against tours(id) (TEXT)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'tour_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'reservations' AND constraint_name = 'reservations_tour_id_fkey'
    ) THEN
      ALTER TABLE reservations 
      ADD CONSTRAINT reservations_tour_id_fkey 
      FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_bookings' AND column_name = 'tour_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'ticket_bookings' AND constraint_name = 'ticket_bookings_tour_id_fkey'
    ) THEN
      ALTER TABLE ticket_bookings 
      ADD CONSTRAINT ticket_bookings_tour_id_fkey 
      FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_hotel_bookings' AND column_name = 'tour_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'tour_hotel_bookings' AND constraint_name = 'tour_hotel_bookings_tour_id_fkey'
    ) THEN
      ALTER TABLE tour_hotel_bookings 
      ADD CONSTRAINT tour_hotel_bookings_tour_id_fkey 
      FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_announcements' AND column_name = 'tour_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'tour_announcements' AND constraint_name = 'tour_announcements_tour_id_fkey'
    ) THEN
      ALTER TABLE tour_announcements 
      ADD CONSTRAINT tour_announcements_tour_id_fkey 
      FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Update indices for TEXT tour_id
DO $$ BEGIN
  -- reservations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'tour_id') THEN
    BEGIN
      DROP INDEX IF EXISTS idx_reservations_tour_id;
    EXCEPTION WHEN others THEN NULL; END;
    CREATE INDEX IF NOT EXISTS idx_reservations_tour_id ON reservations(tour_id);
  END IF;

  -- ticket_bookings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_bookings' AND column_name = 'tour_id') THEN
    BEGIN
      DROP INDEX IF EXISTS idx_ticket_bookings_tour_id;
    EXCEPTION WHEN others THEN NULL; END;
    CREATE INDEX IF NOT EXISTS idx_ticket_bookings_tour_id ON ticket_bookings(tour_id);
  END IF;

  -- tour_hotel_bookings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_hotel_bookings' AND column_name = 'tour_id') THEN
    BEGIN
      DROP INDEX IF EXISTS idx_tour_hotel_bookings_tour_id;
    EXCEPTION WHEN others THEN NULL; END;
    CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_tour_id ON tour_hotel_bookings(tour_id);
  END IF;

  -- tour_expenses (존재할 때만)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_expenses' AND column_name = 'tour_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tour_expenses_tour_id ON tour_expenses(tour_id);
  END IF;

  -- tour_photos (존재할 때만)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_photos' AND column_name = 'tour_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tour_photos_tour_id ON tour_photos(tour_id);
  END IF;
END $$;

-- Fix function that still uses UUID variables for tours.id
CREATE OR REPLACE FUNCTION auto_create_or_update_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_sub_category TEXT;
    existing_tour_id TEXT;
    new_tour_id TEXT;
BEGIN
    SELECT sub_category INTO product_sub_category
    FROM products 
    WHERE id = NEW.product_id;

    IF product_sub_category IN ('Mania Tour', 'Mania Service') THEN
        SELECT id INTO existing_tour_id
        FROM tours 
        WHERE product_id = NEW.product_id 
        AND tour_date = NEW.tour_date
        LIMIT 1;
        
        IF existing_tour_id IS NOT NULL THEN
            UPDATE tours 
            SET reservation_ids = array_append(reservation_ids, NEW.id)
            WHERE id = existing_tour_id;
            
            UPDATE reservations 
            SET tour_id = existing_tour_id
            WHERE id = NEW.id;
        ELSE
            INSERT INTO tours (
                product_id,
                tour_date,
                reservation_ids,
                tour_status
            ) VALUES (
                NEW.product_id,
                NEW.tour_date,
                ARRAY[NEW.id],
                'scheduled'
            ) RETURNING id INTO new_tour_id;
            
            UPDATE reservations 
            SET tour_id = new_tour_id
            WHERE id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
