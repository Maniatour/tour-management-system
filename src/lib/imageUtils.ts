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

/** Thrown as `Error.message` from `ensureImageFitsMaxBytes` when decode/compress fails. */
export const RECEIPT_COMPRESS_FAILED = 'RECEIPT_COMPRESS_FAILED'

/**
 * If an image exceeds `maxBytes`, re-encode as JPEG with downscaling until it fits (for receipt uploads).
 * GIF animation / transparency are flattened to a single JPEG frame.
 */
export async function ensureImageFitsMaxBytes(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= maxBytes) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(RECEIPT_COMPRESS_FAILED)
  }

  try {
    let w = bitmap.width
    let h = bitmap.height
    const maxEdge0 = Math.max(w, h)
    const cap = 2600
    if (maxEdge0 > cap) {
      const s = cap / maxEdge0
      w = Math.round(w * s)
      h = Math.round(h * s)
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error(RECEIPT_COMPRESS_FAILED)
    }

    for (let shrink = 0; shrink < 14; shrink++) {
      canvas.width = w
      canvas.height = h
      ctx.drawImage(bitmap, 0, 0, w, h)
      let q = 0.92
      while (q >= 0.26) {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', q)
        })
        if (blob && blob.size <= maxBytes) {
          return new File([blob], 'receipt.jpg', { type: 'image/jpeg', lastModified: Date.now() })
        }
        q -= 0.055
      }
      const nw = Math.max(320, Math.floor(w * 0.84))
      const nh = Math.max(320, Math.floor(h * 0.84))
      if (nw >= w && nh >= h) break
      w = nw
      h = nh
    }

    throw new Error(RECEIPT_COMPRESS_FAILED)
  } finally {
    bitmap.close()
  }
}

