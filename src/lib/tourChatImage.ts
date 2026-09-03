import {
  ensureImageFitsMaxBytes,
  isHeicLikeReceiptFile,
  isLikelyReceiptImageFile,
  snapshotInputFiles,
} from '@/lib/imageUtils'

export const TOUR_CHAT_IMAGE_ACCEPT =
  'image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif'

/** 원본 선택 한도 (스크린샷·고해상도 사진) */
export const TOUR_CHAT_IMAGE_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024

/** 업로드 전 압축 목표 */
export const TOUR_CHAT_IMAGE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export function isLikelyChatImageFile(file: File): boolean {
  return isLikelyReceiptImageFile(file)
}

export function chatImageDisplayName(fileName?: string | null): string | null {
  const name = (fileName || '').trim()
  if (!name) return null
  if (/^(image|screenshot|paste|clipboard|photo)[-_\s]?\d*\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name)) {
    return null
  }
  return name
}

const CHAT_IMAGE_URL_RE = /\/storage\/v1\/object\/public\/images\/chat-messages\//i

export function isChatImageMessage(message: {
  message_type?: string | null
  file_url?: string | null
}): boolean {
  const url = (message.file_url || '').trim()
  if (!url) return false
  if (message.message_type === 'image') return true
  return CHAT_IMAGE_URL_RE.test(url)
}

export function chatMessagePreviewText(
  message: {
    message_type?: string | null
    message?: string | null
    file_url?: string | null
  },
  locale: 'ko' | 'en' = 'ko'
): string {
  const caption = (message.message || '').trim()
  if (isChatImageMessage(message) || message.message_type === 'image') {
    const label = locale === 'ko' ? '[이미지]' : '[Image]'
    return caption ? `${label} ${caption}` : label
  }
  return caption
}

function safeChatImageFileName(file: File, mime: string): string {
  const raw = (file.name || 'screenshot').trim() || 'screenshot'
  const base = raw.replace(/\.[^.]+$/, '').replace(/[^\w가-힣.-]+/g, '_').slice(0, 48) || 'screenshot'
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/gif'
          ? 'gif'
          : 'jpg'
  return `${base}.${ext}`
}

export async function prepareTourChatImageForUpload(file: File): Promise<File> {
  if (file.size <= 0) {
    throw new Error('EMPTY_FILE')
  }
  if (file.size > TOUR_CHAT_IMAGE_MAX_ORIGINAL_BYTES) {
    throw new Error('TOO_LARGE')
  }
  if (!isLikelyChatImageFile(file)) {
    throw new Error('NOT_IMAGE')
  }

  const mime = (file.type || '').trim().toLowerCase()
  const forceJpeg =
    isHeicLikeReceiptFile(file) ||
    !mime.startsWith('image/') ||
    mime === 'image/bmp' ||
    mime === 'image/tiff' ||
    mime === 'image/tif' ||
    mime === 'image/avif' ||
    mime === 'image/heic' ||
    mime === 'image/heif'

  const prepared = await ensureImageFitsMaxBytes(file, TOUR_CHAT_IMAGE_MAX_UPLOAD_BYTES, {
    forceJpeg,
  })
  const type = prepared.type || 'image/jpeg'
  return new File([prepared], safeChatImageFileName(file, type), {
    type,
    lastModified: Date.now(),
  })
}

export async function snapshotChatImageFiles(
  files: FileList | File[] | null | undefined
): Promise<File[]> {
  const snapped = await snapshotInputFiles(files)
  return snapped.filter(isLikelyChatImageFile)
}

export function filesFromClipboardOrDrop(data: DataTransfer | null): File[] {
  if (!data) return []
  const out: File[] = []
  const items = Array.from(data.items || [])
  for (const item of items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file && isLikelyChatImageFile(file)) {
      const named =
        file.name && file.name !== 'image.png' && file.name !== 'blob'
          ? file
          : new File([file], `screenshot-${Date.now()}.png`, {
              type: file.type || 'image/png',
              lastModified: Date.now(),
            })
      out.push(named)
    }
  }
  if (out.length > 0) return out
  return Array.from(data.files || []).filter(isLikelyChatImageFile)
}
