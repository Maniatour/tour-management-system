import { supabase } from './supabase'

export interface ThumbnailUploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * 썸네일을 Supabase Storage에 업로드합니다
 */
export const uploadThumbnail = async (
  file: File, 
  productId: string, 
  scheduleId?: string
): Promise<ThumbnailUploadResult> => {
  try {
    // 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return {
        success: false,
        error: '파일 크기가 5MB를 초과합니다.'
      }
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 지원)'
      }
    }

    // 고유한 파일명 생성
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `thumbnails/${productId}/${timestamp}-${randomId}.${fileExtension}`

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('product-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('썸네일 업로드 오류:', error)
      return {
        success: false,
        error: '파일 업로드에 실패했습니다.'
      }
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('product-media')
      .getPublicUrl(fileName)

    return {
      success: true,
      url: urlData.publicUrl
    }

  } catch (error) {
    console.error('썸네일 업로드 예외:', error)
    return {
      success: false,
      error: '업로드 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 썸네일을 Supabase Storage에서 삭제합니다
 */
export const deleteThumbnail = async (url: string): Promise<boolean> => {
  try {
    // URL에서 파일 경로 추출
    const urlParts = url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    const filePath = `thumbnails/${urlParts[urlParts.length - 2]}/${fileName}`

    const { error } = await supabase.storage
      .from('product-media')
      .remove([filePath])

    if (error) {
      console.error('썸네일 삭제 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('썸네일 삭제 예외:', error)
    return false
  }
}

/**
 * URL이 Supabase Storage URL인지 확인합니다
 */
export const isSupabaseStorageUrl = (url: string): boolean => {
  return url.includes('supabase') && url.includes('storage')
}

/**
 * 범용 미디어 업로드 함수 (썸네일, 이미지 등)
 */
export const uploadProductMedia = async (
  file: File, 
  productId: string, 
  mediaType: 'thumbnails' | 'images' | 'gallery' = 'images',
  subfolder?: string
): Promise<ThumbnailUploadResult> => {
  try {
    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return {
        success: false,
        error: '파일 크기가 10MB를 초과합니다.'
      }
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF, SVG만 지원)'
      }
    }

    // 고유한 파일명 생성
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const folderPath = subfolder ? `${mediaType}/${productId}/${subfolder}` : `${mediaType}/${productId}`
    const fileName = `${folderPath}/${timestamp}-${randomId}.${fileExtension}`

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('product-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('미디어 업로드 오류:', error)
      return {
        success: false,
        error: '파일 업로드에 실패했습니다.'
      }
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('product-media')
      .getPublicUrl(fileName)

    return {
      success: true,
      url: urlData.publicUrl
    }

  } catch (error) {
    console.error('미디어 업로드 예외:', error)
    return {
      success: false,
      error: '업로드 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 범용 미디어 삭제 함수
 */
export const deleteProductMedia = async (url: string): Promise<boolean> => {
  try {
    // URL에서 파일 경로 추출
    const urlParts = url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    const folderPath = urlParts.slice(-3, -1).join('/') // 마지막 3개 중 앞의 2개 (폴더 경로)
    const filePath = `${folderPath}/${fileName}`

    const { error } = await supabase.storage
      .from('product-media')
      .remove([filePath])

    if (error) {
      console.error('미디어 삭제 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('미디어 삭제 예외:', error)
    return false
  }
}
