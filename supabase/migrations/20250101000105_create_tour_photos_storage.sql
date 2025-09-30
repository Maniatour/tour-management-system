-- Create storage bucket for tour photos
-- Migration: 20250101000105_create_tour_photos_storage

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
DROP POLICY IF EXISTS "Guides can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access for shared photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can delete their own photos" ON storage.objects;

-- Create simple storage policies for tour photos
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

-- Storage bucket created for tour photos
