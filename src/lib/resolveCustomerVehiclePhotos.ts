/**
 * 고객 노출용 차량 사진 선택.
 * 허용: vehicle_photos(차량 이미지), vehicle_type_photos(차종 관리)
 * 제외: Rental reservations / agreement / receipt 등 렌탈 문서 파일
 */

const RENTAL_DOC_STORAGE_MARKERS = [
  '/storage/v1/object/public/vehicle-rental-files/',
  '/object/public/vehicle-rental-files/',
  '/vehicle-rental-files/',
] as const

export type CustomerVehiclePhotoLike = {
  photo_url?: string | null
  photo_name?: string | null
  [key: string]: unknown
}

export type VehicleRentalDocUrls = {
  rental_reservation_url?: string | null | undefined
  rental_agreement_file_url?: string | null | undefined
  rental_receipt_url?: string | null | undefined
}

export function simplifyVehiclePhotoUrl(url: string): string {
  if (!url) return url
  try {
    const urlObj = new URL(url)
    urlObj.search = ''
    urlObj.hash = ''
    return urlObj.toString()
  } catch {
    return url
  }
}

export function isRentalDocumentPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const normalized = url.trim()
  if (!normalized) return false
  return RENTAL_DOC_STORAGE_MARKERS.some((marker) => normalized.includes(marker))
}

function collectExcludedRentalDocUrls(rentalDocs?: VehicleRentalDocUrls | null): Set<string> {
  const excluded = new Set<string>()
  if (!rentalDocs) return excluded
  for (const raw of [
    rentalDocs.rental_reservation_url,
    rentalDocs.rental_agreement_file_url,
    rentalDocs.rental_receipt_url,
  ]) {
    const url = typeof raw === 'string' ? raw.trim() : ''
    if (!url) continue
    excluded.add(url)
    excluded.add(simplifyVehiclePhotoUrl(url))
  }
  return excluded
}

export function isCustomerFacingVehiclePhotoUrl(
  url: string | null | undefined,
  rentalDocs?: VehicleRentalDocUrls | null
): boolean {
  if (!url || !String(url).trim()) return false
  if (isRentalDocumentPhotoUrl(url)) return false
  const excluded = collectExcludedRentalDocUrls(rentalDocs)
  if (excluded.has(url) || excluded.has(simplifyVehiclePhotoUrl(url))) return false
  return true
}

export function filterCustomerFacingVehiclePhotos<T extends CustomerVehiclePhotoLike>(
  photos: T[] | null | undefined,
  rentalDocs?: VehicleRentalDocUrls | null
): T[] {
  if (!photos?.length) return []
  return photos.filter((photo) => isCustomerFacingVehiclePhotoUrl(photo.photo_url, rentalDocs))
}

/**
 * 고객 메일/채팅용 차량 사진.
 * - 렌탈 문서 URL은 항상 제외
 * - 렌탈 문서가 하나라도 있고 차종 사진이 있으면 차종 사진 우선
 *   (예약 확인 스크린샷이 vehicle_photos에 잘못 들어간 경우 방지)
 * - 그 외에는 차량 이미지 → 없으면 차종 이미지
 */
export function pickCustomerFacingVehiclePhotos<T extends CustomerVehiclePhotoLike>(opts: {
  vehiclePhotos?: T[] | null
  typePhotos?: T[] | null
  rentalDocs?: VehicleRentalDocUrls | null
}): T[] {
  const vehiclePhotos = filterCustomerFacingVehiclePhotos(opts.vehiclePhotos, opts.rentalDocs)
  const typePhotos = filterCustomerFacingVehiclePhotos(opts.typePhotos, opts.rentalDocs)

  const hasRentalDocs = Boolean(
    opts.rentalDocs?.rental_reservation_url?.trim() ||
      opts.rentalDocs?.rental_agreement_file_url?.trim() ||
      opts.rentalDocs?.rental_receipt_url?.trim()
  )

  if (hasRentalDocs && typePhotos.length > 0) {
    return typePhotos
  }

  return vehiclePhotos.length > 0 ? vehiclePhotos : typePhotos
}
