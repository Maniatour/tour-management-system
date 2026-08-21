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
 * 영상 첫 프레임을 JPEG 썸네일로 추출 (슬로모션 MOV 포함)
 */
export async function createVideoThumbnail(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const url = URL.createObjectURL(file)
    let settled = false
    let timeoutId = 0

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    const succeed = (blob: Blob) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(blob)
    }

    timeoutId = window.setTimeout(() => fail(new Error('Video thumbnail timeout')), 20000)

    const capture = () => {
      const srcW = video.videoWidth || 0
      const srcH = video.videoHeight || 0
      if (!srcW || !srcH) {
        fail(new Error('Video has no dimensions'))
        return
      }

      let width = srcW
      let height = srcH
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        fail(new Error('Canvas context not available'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob) succeed(blob)
          else fail(new Error('Failed to create video thumbnail blob'))
        },
        'image/jpeg',
        quality
      )
    }

    video.addEventListener('seeked', capture, { once: true })
    video.addEventListener(
      'loadeddata',
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        const seekTo = duration > 0 ? Math.min(0.25, duration * 0.05) : 0.1
        try {
          video.currentTime = seekTo
        } catch {
          capture()
        }
      },
      { once: true }
    )
    video.addEventListener('error', () => fail(new Error('Failed to load video')), { once: true })
    video.src = url
    void video.play()?.then(() => video.pause()).catch(() => {})
  })
}

/** 영상 썸네일은 항상 JPEG */
export function getJpegThumbnailFileName(originalFileName: string): string {
  const lastDotIndex = originalFileName.lastIndexOf('.')
  const nameWithoutExt = lastDotIndex === -1 ? originalFileName : originalFileName.substring(0, lastDotIndex)
  return `${nameWithoutExt}_thumb.jpg`
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
/** Camera/gallery File was empty after the input was reset (common on iOS). */
export const EMPTY_RECEIPT_FILE = 'EMPTY_RECEIPT_FILE'

const RECEIPT_IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i

export function isHeicLikeReceiptFile(file: File): boolean {
  const t = (file.type || '').trim().toLowerCase()
  const n = (file.name || '').toLowerCase()
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif')
}

/**
 * iPhone/Android often give `File.type === ''` for camera/gallery photos.
 * `image/` MIME-only checks drop those files before upload.
 */
export function isLikelyReceiptImageFile(file: File): boolean {
  const t = (file.type || '').trim().toLowerCase()
  if (t.startsWith('image/')) return true
  if (t === '' || t === 'application/octet-stream') {
    return RECEIPT_IMAGE_EXT_RE.test(file.name) || !/\.[a-z0-9]+$/i.test(file.name)
  }
  return RECEIPT_IMAGE_EXT_RE.test(file.name)
}

/**
 * Copy file bytes immediately so WebKit can reset `<input type="file">`
 * without emptying the original blob (guide camera upload).
 */
export async function snapshotInputFiles(files: FileList | File[] | null | undefined): Promise<File[]> {
  if (!files || files.length === 0) return []
  const out: File[] = []
  for (const file of Array.from(files)) {
    const buf = await file.arrayBuffer()
    const name = file.name?.trim() ? file.name : `receipt-${Date.now()}.jpg`
    out.push(
      new File([buf], name, {
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified || Date.now(),
      })
    )
  }
  return out
}

async function decodeReceiptBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error(RECEIPT_COMPRESS_FAILED))
        el.src = url
      })
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function encodeReceiptFileAsJpeg(file: File, maxBytes: number): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decodeReceiptBitmap(file)
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

/**
 * If an image exceeds `maxBytes`, re-encode as JPEG with downscaling until it fits (for receipt uploads).
 * GIF animation / transparency are flattened to a single JPEG frame.
 * Pass `forceJpeg` for HEIC/HEIF so office browsers can display the receipt.
 */
export async function ensureImageFitsMaxBytes(
  file: File,
  maxBytes: number,
  options?: { forceJpeg?: boolean }
): Promise<File> {
  const forceJpeg = Boolean(options?.forceJpeg) || isHeicLikeReceiptFile(file)
  const mime = (file.type || '').trim().toLowerCase()
  const looksLikeImage = mime.startsWith('image/') || mime === '' || mime === 'application/octet-stream'

  if (!forceJpeg && file.size <= maxBytes && mime.startsWith('image/')) return file
  if (!forceJpeg && !looksLikeImage) return file

  return encodeReceiptFileAsJpeg(file, maxBytes)
}

/** Validate, convert HEIC, and shrink before Storage upload. */
export async function prepareReceiptImageForUpload(
  file: File,
  maxStorageBytes: number,
  maxOriginalBytes: number
): Promise<File> {
  if (file.size <= 0) throw new Error(EMPTY_RECEIPT_FILE)
  if (file.size > maxOriginalBytes) throw new Error('ORIGINAL_RECEIPT_TOO_LARGE')

  const safeLimit = maxStorageBytes - 256 * 1024
  const forceJpeg =
    isHeicLikeReceiptFile(file) ||
    !(file.type || '').trim().toLowerCase().startsWith('image/')

  if (!forceJpeg && file.size <= safeLimit) return file
  return ensureImageFitsMaxBytes(file, safeLimit, { forceJpeg: true })
}

