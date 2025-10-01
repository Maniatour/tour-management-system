-- Create storage bucket for product media (thumbnails, images, etc.)
-- Migration: 20250101000107_create_product_media_storage

-- Create storage bucket for product media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true, -- Public bucket for easier access
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to product media" ON storage.objects;

-- Create storage policies for product media
CREATE POLICY "Allow authenticated users to upload product media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-media');

CREATE POLICY "Allow authenticated users to view product media" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-media');

CREATE POLICY "Allow authenticated users to update product media" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-media');

CREATE POLICY "Allow authenticated users to delete product media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-media');

-- Allow public access to product media (for displaying images)
CREATE POLICY "Allow public access to product media" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'product-media');

-- Storage bucket created for product media
