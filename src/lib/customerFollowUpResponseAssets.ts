import { fetchImageUploadApi, fetchWithAuthSession } from '@/lib/uploadClient'

export const CUSTOMER_RESPONSE_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export const CUSTOMER_RESPONSE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export type CustomerFollowUpResponseSubmitPayload = {
  text: string
  images: File[]
  cancellationReason?: string | undefined
}

export type UploadedCustomerResponseImage = {
  imageUrl: string
  fileName: string
}

function validateImageFile(file: File, locale: string): string | null {
  if (!CUSTOMER_RESPONSE_IMAGE_TYPES.includes(file.type as (typeof CUSTOMER_RESPONSE_IMAGE_TYPES)[number])) {
    return locale === 'ko'
      ? 'JPEG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.'
      : 'Only JPEG, PNG, GIF, and WebP images are allowed.'
  }
  if (file.size > CUSTOMER_RESPONSE_IMAGE_MAX_BYTES) {
    return locale === 'ko' ? '이미지는 5MB 이하여야 합니다.' : 'Each image must be 5MB or less.'
  }
  return null
}

export async function uploadCustomerResponseImages(
  reservationId: string,
  files: File[],
  locale: string
): Promise<UploadedCustomerResponseImage[]> {
  const uploaded: UploadedCustomerResponseImage[] = []

  for (const file of files) {
    const validationError = validateImageFile(file, locale)
    if (validationError) throw new Error(validationError)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'reservation-evidence')

    const uploadRes = await fetchImageUploadApi(formData)
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      throw new Error(
        typeof err.error === 'string' ? err.error : locale === 'ko' ? '이미지 업로드에 실패했습니다.' : 'Image upload failed.'
      )
    }

    const { imageUrl, path, fileName } = (await uploadRes.json()) as {
      imageUrl?: string
      path?: string
      fileName?: string
    }
    if (!imageUrl) {
      throw new Error(locale === 'ko' ? '이미지 업로드에 실패했습니다.' : 'Image upload failed.')
    }

    const addRes = await fetchWithAuthSession(`/api/reservations/${reservationId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        filePath: path || imageUrl,
        fileName: fileName || file.name,
      }),
    })
    if (!addRes.ok) {
      throw new Error(locale === 'ko' ? '첨부 저장에 실패했습니다.' : 'Failed to save attachment.')
    }

    uploaded.push({ imageUrl, fileName: fileName || file.name })
  }

  return uploaded
}

export function buildCustomerResponseContactContent(
  text: string,
  uploadedImages: UploadedCustomerResponseImage[],
  locale: string
): string {
  const trimmed = text.trim()
  const isKo = locale === 'ko'

  if (uploadedImages.length === 0) return trimmed

  const screenshotLines = uploadedImages.map((img, index) => {
    const label = isKo ? `스크린샷 ${index + 1}` : `Screenshot ${index + 1}`
    return `${label}: ${img.fileName}\n${img.imageUrl}`
  })

  if (!trimmed) {
    const header =
      uploadedImages.length === 1
        ? isKo
          ? '고객 답변 스크린샷'
          : 'Customer reply screenshot'
        : isKo
          ? `고객 답변 스크린샷 (${uploadedImages.length}장)`
          : `Customer reply screenshots (${uploadedImages.length})`
    return [header, ...screenshotLines].join('\n\n')
  }

  return [trimmed, ...screenshotLines].join('\n\n')
}
