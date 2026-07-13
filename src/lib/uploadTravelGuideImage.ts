import { fetchImageUploadApi } from '@/lib/uploadClient'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

export async function uploadTravelGuideImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('JPEG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('파일 크기는 5MB 이하여야 합니다.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', 'travel-guide')

  const response = await fetchImageUploadApi(formData)
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? '이미지 업로드에 실패했습니다.')
  }

  const payload = (await response.json()) as { imageUrl?: string }
  if (!payload.imageUrl) {
    throw new Error('이미지 URL을 받지 못했습니다.')
  }

  return payload.imageUrl
}
