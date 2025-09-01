-- Create pickup_hotels table
CREATE TABLE IF NOT EXISTS pickup_hotels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  hotel TEXT NOT NULL,
  pick_up_location TEXT NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  address TEXT NOT NULL,
  pin TEXT, -- latlong coordinates
  link TEXT, -- google map link
  media TEXT[], -- array of media file URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_hotel ON pickup_hotels(hotel);
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_location ON pickup_hotels(pick_up_location);
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_address ON pickup_hotels(address);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_pickup_hotels_updated_at' 
        AND event_object_table = 'pickup_hotels'
    ) THEN
        CREATE TRIGGER update_pickup_hotels_updated_at
            BEFORE UPDATE ON pickup_hotels
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'updated_at 트리거가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'updated_at 트리거가 이미 존재합니다.';
    END IF;
END $$;

-- Create storage bucket for pickup hotel media
INSERT INTO storage.buckets (id, name, public)
VALUES ('pickup-hotel-media', 'pickup-hotel-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set storage policy for pickup hotel media (only if they don't exist)
DO $$
BEGIN
    -- Check if policies already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'pickup-hotel-media');
        RAISE NOTICE 'Public Access 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'Public Access 정책이 이미 존재합니다.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can upload'
    ) THEN
        CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pickup-hotel-media' AND auth.role() = 'authenticated');
        RAISE NOTICE 'Authenticated users can upload 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'Authenticated users can upload 정책이 이미 존재합니다.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can update'
    ) THEN
        CREATE POLICY "Authenticated users can update" ON storage.objects FOR UPDATE USING (bucket_id = 'pickup-hotel-media' AND auth.role() = 'authenticated');
        RAISE NOTICE 'Authenticated users can update 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'Authenticated users can update 정책이 이미 존재합니다.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can delete'
    ) THEN
        CREATE POLICY "Authenticated users can delete" ON storage.objects FOR DELETE USING (bucket_id = 'pickup-hotel-media' AND auth.role() = 'authenticated');
        RAISE NOTICE 'Authenticated users can delete 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'Authenticated users can delete 정책이 이미 존재합니다.';
    END IF;
END $$;
