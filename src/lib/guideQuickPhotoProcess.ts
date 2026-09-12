import { enhanceTourPhotoPixels } from '@/lib/guideTourPhotoEnhance'
import { GUIDE_CAMERA_JPEG_QUALITY, GUIDE_CAMERA_MAX_EDGE, clampLongEdge } from '@/lib/guideLiveCameraFocus'

function isHeicLike(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.includes('heic') || type.includes('heif')) return true
  return /\.(heic|heif)$/i.test(file.name)
}

function isRasterImage(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
}

/**
 * 모바일 업로드 전에 브라우저에서 리사이즈·JPEG 압축·자동 보정.
 * EXIF 방향은 createImageBitmap이 지원하는 브라우저에서 반영한다.
 * HEIC/영상은 원본을 그대로 둔다. 영수증은 호출하지 않는다.
 */
export async function prepareGuideQuickPhoto(file: File): Promise<File> {
  if (!isRasterImage(file) || isHeicLike(file)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    let width = bitmap.width
    let height = bitmap.height
    if (width < 1 || height < 1) return file

    const sized = clampLongEdge(width, height, GUIDE_CAMERA_MAX_EDGE)
    width = sized.width
    height = sized.height

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return file
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    try {
      const imageData = ctx.getImageData(0, 0, width, height)
      enhanceTourPhotoPixels(imageData.data)
      ctx.putImageData(imageData, 0, 0)
    } catch {
      // 보정 실패 시 리사이즈된 원본을 그대로 저장
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', GUIDE_CAMERA_JPEG_QUALITY)
    })
    if (!blob) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'tour-photo'
    return new File([blob], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}
