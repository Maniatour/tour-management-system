-- Create storage bucket for tour photos
-- Migration: 20250101000105_create_tour_photos_storage

-- Create storage bucket for tour photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  false, -- Private bucket
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for tour photos
CREATE POLICY "Guides can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'tour-photos'
  );

CREATE POLICY "Guides can view their own photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'tour-photos'
  );

CREATE POLICY "Admins can view all photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Public access for shared photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tour-photos' AND
    EXISTS (
      SELECT 1 FROM tour_photos 
      WHERE file_path = name 
      AND is_public = true 
      AND share_token IS NOT NULL
    )
  );

CREATE POLICY "Guides can update their own photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'tour-photos'
  );

CREATE POLICY "Guides can delete their own photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = 'tour-photos'
  );

-- Storage bucket created for tour photos
