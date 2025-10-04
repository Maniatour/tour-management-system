import { supabase } from './supabase'

/**
 * 특정 투어의 사진 저장 경로 생성 (폴더 구조)
 */
function getTourPhotoPath(tourId: string): string {
  return `${tourId}/`
}

/**
 * 특정 투어의 사진 버켓을 확인하는 함수
 * bucket 생성은 Supabase SQL Editor에서 수동으로 수행 (RLS 정책 때문)
 */
export async function createTourPhotosBucket(): Promise<boolean> {
  try {
    const bucketName = 'tour-photos'
    
    // 기존 버켓 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }
    
    const tourPhotosBucket = buckets?.find(bucket => bucket.name === bucketName)
    if (tourPhotosBucket) {
      console.log(`✅ ${bucketName} bucket already exists`)
      return true
    }
    
    // bucket이 없는 경우 - 수동 생성이 필요함 (RLS 정책 때문)
    console.warn(`❌ ${bucketName} bucket not found. Please run the following SQL script to create it:`)
    console.log(`
-- 🔧 Run this SQL in Supabase SQL Editor to create tour-photos bucket with folder structure

-- Single bucket for all tours with folder organization
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  104857600, -- 100MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
);

-- Storage policies for folder-based access
CREATE POLICY "tour-photos-manage-files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'tour-photos')
WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "tour-photos-public-read" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

SELECT 'tour-photos bucket created with folder structure!' as status;
    `)
    return false
  } catch (error) {
    console.error('Error in createTourPhotosBucket:', error)
    return false
  }
}

/**
 * tour-photos bucket이 존재하는지 확인하는 함수
 */
export async function checkTourPhotosBucket(): Promise<boolean> {
  try {
    console.log('🔍 Checking tour-photos bucket...')
    
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    console.log('📋 Bucket list result:', { buckets, error })
    
    if (error) {
      console.error('❌ Error listing buckets:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      })
      return false
    }
    
    console.log('📁 Available buckets:', buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })))
    
    const tourPhotosExists = buckets?.some(bucket => bucket.name === 'tour-photos') || false
    console.log('🎯 tour-photos bucket found:', tourPhotosExists)
    
    return tourPhotosExists
  } catch (error) {
    console.error('💥 Unexpected error checking tour-photos bucket:', error)
    return false
  }
}

/**
 * 특정 투어의 폴더가 존재하는지 확인하는 함수 (folder.info 마커 포함)
 */
export async function checkTourFolderExists(tourId: string): Promise<boolean> {
  try {
    // 투어 폴더의 파일 목록 조회 (마커 파일 포함)
    const { data: folderFiles, error } = await supabase.storage
      .from('tour-photos')
      .list(tourId, { limit: 10 })
    
    if (error) {
      console.error('Error checking tour folder:', error)
      return false
    }
    
    // 폴더가 존재하고 (빈 배열이 아님) 또는 폴더 접근이 가능하면 true
    return folderFiles !== null && folderFiles.length >= 0
  } catch (error) {
    console.error('Error checking tour folder:', error)
    return false
  }
}

/**
 * 투어 폴더 생성 함수 (JavaScript 버전)
 */
export async function createTourFolderMarker(tourId: string): Promise<boolean> {
  try {
    // 마커 파일 생성
    const folderInfo = `Tour folder for ${tourId}\nCreated: ${new Date().toISOString()}`
    const markerFileName = `${tourId}/folder.info`
    
    const { error } = await supabase.storage
      .from('tour-photos')
      .upload(markerFileName, new Blob([folderInfo], { type: 'text/plain' }), {
        upsert: true
      })
    
    if (error) {
      console.error('Error creating tour folder marker:', error)
      return false
    }
    
    console.log(`✅ Tour folder marker created for: ${tourId}`)
    return true
  } catch (error) {
    console.error('Error creating tour folder marker:', error)
    return false
  }
}

/**
 * 투어별 사진 업로드를 위한 Storage 경로 반환 (폴더 구조)
 */
export function getTourPhotoStoragePath(tourId: string, filename: string): string {
  return `${tourId}/${filename}`
}

/**
 * 특정 투어의 사진 목록을 조회하는 함수
 */
export async function listTourPhotos(tourId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from('tour-photos')
      .list(tourId)
    
    if (error) {
      console.error('Error listing tour photos:', error)
      return []
    }
    
    return data?.map(file => file.name) || []
  } catch (error) {
    console.error('Error listing tour photos:', error)
    return []
  }
}