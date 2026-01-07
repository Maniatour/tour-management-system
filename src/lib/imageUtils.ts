/**
 * 이미지 썸네일 생성 유틸리티
 */

/**
 * 이미지 파일을 썸네일로 리사이즈
 * @param file 원본 이미지 파일
 * @param maxWidth 최대 너비 (기본값: 400px)
 * @param maxHeight 최대 높이 (기본값: 400px)
 * @param quality JPEG 품질 (0-1, 기본값: 0.8)
 * @returns 썸네일 Blob
 */
export async function createThumbnail(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = () => {
      // 원본 비율 유지하면서 리사이즈
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height)

      // Blob으로 변환
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create thumbnail blob'))
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // File을 Data URL로 변환하여 이미지 로드
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * 썸네일 파일명 생성
 * @param originalFileName 원본 파일명
 * @returns 썸네일 파일명 (예: "photo.jpg" -> "photo_thumb.jpg")
 */
export function getThumbnailFileName(originalFileName: string): string {
  const lastDotIndex = originalFileName.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return `${originalFileName}_thumb`
  }
  const nameWithoutExt = originalFileName.substring(0, lastDotIndex)
  const ext = originalFileName.substring(lastDotIndex)
  return `${nameWithoutExt}_thumb${ext}`
}

