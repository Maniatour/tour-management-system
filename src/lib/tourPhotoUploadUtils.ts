/**
 * 투어 사진 업로드: 중복 키·동시 실행 제한·재시도 유틸
 */

/** 갤러리·카메라 파일명 기준(모바일에서 MIME이 비는 경우 대비) */
export const TOUR_PHOTO_FILENAME_EXT_REGEX =
  /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i

/**
 * iOS/안드로이드에서 `File.type`이 빈 문자열인 경우가 많아 `image/`만 보면 실패함.
 */
export function isLikelyTourPhotoFile(file: File): boolean {
  const t = (file.type || '').trim().toLowerCase()
  if (t.startsWith('image/')) return true
  if (t === '' || t === 'application/octet-stream') {
    return TOUR_PHOTO_FILENAME_EXT_REGEX.test(file.name)
  }
  return false
}

/** Storage·DB에 넣을 MIME (빈 type이면 확장자로 추정) */
export function inferTourPhotoMimeType(file: File): string {
  const t = file.type?.trim()
  if (t && t.startsWith('image/')) return t
  const m = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)
  const ext = m?.[1]?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'heic':
    case 'heif':
      return 'image/heic'
    case 'bmp':
      return 'image/bmp'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    case 'avif':
      return 'image/avif'
    default:
      return 'image/jpeg'
  }
}

/** Storage 객체 파일명용 안전한 확장자 */
export function tourPhotoStorageExtension(file: File): string {
  const mime = inferTourPhotoMimeType(file)
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic'
  if (mime === 'image/bmp') return 'bmp'
  if (mime === 'image/tiff') return 'tiff'
  if (mime === 'image/avif') return 'avif'
  return 'jpg'
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 동일 이미지(파일 내용) 식별용 — 대용량은 앞·뒤 청크만 해시 */
export async function tourPhotoContentKey(file: File): Promise<string> {
  const MAX_FULL_HASH = 12 * 1024 * 1024
  let data: ArrayBuffer
  if (file.size <= MAX_FULL_HASH) {
    data = await file.arrayBuffer()
  } else {
    const chunk = 2 * 1024 * 1024
    const head = await file.slice(0, chunk).arrayBuffer()
    const tail = await file.slice(Math.max(0, file.size - chunk)).arrayBuffer()
    const meta = new TextEncoder().encode(`${file.size}:${file.lastModified}`)
    const u8 = new Uint8Array(head.byteLength + tail.byteLength + meta.byteLength)
    u8.set(new Uint8Array(head), 0)
    u8.set(new Uint8Array(tail), head.byteLength)
    u8.set(meta, head.byteLength + tail.byteLength)
    data = u8.buffer
  }
  const hash = await crypto.subtle.digest('SHA-256', data)
  return bufferToHex(hash)
}

export function tourPhotoMetadataKey(file: File): string {
  return `${file.name}\0${file.size}`
}

/** 같은 FileList/선택 안에서 동일 내용은 한 번만 */
export async function dedupeFilesByContent(files: File[]): Promise<{
  unique: File[]
  skippedDuplicateContent: number
}> {
  const seen = new Map<string, File>()
  let skipped = 0
  for (const file of files) {
    const key = await tourPhotoContentKey(file)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.set(key, file)
  }
  return { unique: [...seen.values()], skippedDuplicateContent: skipped }
}

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  const n = Math.max(1, Math.min(limit, items.length))
  let next = 0
  const runWorker = async () => {
    while (true) {
      const i = next++
      if (i >= items.length) break
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: n }, () => runWorker()))
}

export async function withUploadRetries<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; onBeforeRetry?: () => Promise<void> }
): Promise<T> {
  const attempts = options?.attempts ?? 4
  const base = options?.baseDelayMs ?? 400
  let last: unknown
  for (let a = 1; a <= attempts; a++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (a >= attempts) break
      await options?.onBeforeRetry?.()
      await new Promise((r) => setTimeout(r, base * Math.pow(2, a - 1)))
    }
  }
  throw last
}
