-- Quick fix: Create tour-photos bucket manually
-- Run this SQL in your Supabase SQL Editor

-- Create storage bucket for tour photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true, -- Public bucket for easier access
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;

-- Create simple storage policies
CREATE POLICY "Allow authenticated users to upload tour photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to view tour photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to update tour photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to delete tour photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tour-photos');

-- Allow public access to tour photos
CREATE POLICY "Allow public access to tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');