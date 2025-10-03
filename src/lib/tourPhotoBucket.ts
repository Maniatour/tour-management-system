import { supabase } from './supabase'

/**
 * tour-photos 스토리지 버켓을 생성하는 함수
 */
export async function createTourPhotosBucket(): Promise<boolean> {
  try {
    // 기존 버켓 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }
    
    const tourPhotosBucket = buckets?.find(bucket => bucket.name === 'tour-photos')
    if (tourPhotosBucket) {
      console.log('tour-photos bucket already exists')
      return true
    }
    
    // 버켓 생성 시도
    const { data, error } = await supabase.storage.createBucket('tour-photos', {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    })
    
    if (error) {
      console.error('Error creating tour-photos bucket:', error)
      
      // RLS 오류인 경우 수동으로 버켓 생성 안내
      if (error.message.includes('row-level security policy')) {
        console.warn('RLS policy error detected. Please run the following SQL in Supabase SQL Editor:')
        console.log(`
-- Run this SQL in Supabase SQL Editor to create tour-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies
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
        `)
        return false
      }
      
      return false
    }
    
    console.log('tour-photos bucket created successfully:', data)
    return true
  } catch (error) {
    console.error('Error in createTourPhotosBucket:', error)
    return false
  }
}

/**
 * tour-photos 버켓이 존재하는지 확인하는 함수
 */
export async function checkTourPhotosBucket(): Promise<boolean> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
      console.error('Error listing buckets:', error)
      return false
    }
    
    return buckets?.some(bucket => bucket.name === 'tour-photos') || false
  } catch (error) {
    console.error('Error checking tour-photos bucket:', error)
    return false
  }
}
