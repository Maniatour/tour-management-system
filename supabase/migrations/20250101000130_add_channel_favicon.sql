-- Add favicon support for channels and storage bucket for icons

-- 1) Add favicon_url column to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- 2) Create a dedicated storage bucket for channel icons (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'channel-icons',
  'channel-icons',
  true,
  1048576, -- 1MB limit; icons are small
  ARRAY['image/x-icon','image/vnd.microsoft.icon','image/png','image/svg+xml','image/jpeg','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies to allow authenticated uploads and public reads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public read of channel icons'
  ) THEN
    CREATE POLICY "Allow public read of channel icons" ON storage.objects
      FOR SELECT USING (bucket_id = 'channel-icons');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can upload channel icons'
  ) THEN
    CREATE POLICY "Authenticated can upload channel icons" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'channel-icons' AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update their channel icons'
  ) THEN
    CREATE POLICY "Authenticated can update their channel icons" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'channel-icons' AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete their channel icons'
  ) THEN
    CREATE POLICY "Authenticated can delete their channel icons" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'channel-icons' AND auth.role() = 'authenticated'
      );
  END IF;
END $$;


