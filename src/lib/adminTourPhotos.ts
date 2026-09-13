import { supabase } from '@/lib/supabase'
import { getTicketBookingProductName } from '@/lib/ticket-booking-tour-display'
import { calculateAssignedPeople, normalizeReservationIds } from '@/utils/tourUtils'

const TOUR_IN_CHUNK = 80
const TOUR_LIMIT = 250

export type AdminGalleryPhoto = {
  id: string
  tourId: string
  tourDate: string
  productName: string
  fileName: string
  filePath: string
  thumbnailPath: string | null
  mimeType: string | null
  createdAt: string | null
  uploadedBy: string
  uploadedByName: string | null
  hiddenByAdmin: boolean
  guideName: string | null
  assistantName: string | null
  assignedPeople: number
}

export type AdminGalleryTourGroup = {
  tourId: string
  tourDate: string
  productName: string
  guideName: string | null
  assistantName: string | null
  assignedPeople: number
  photos: AdminGalleryPhoto[]
}

type ProductNameFields = {
  name?: string
  name_ko?: string
  name_en?: string
}

type PhotoRow = {
  id: string
  tour_id: string
  file_name: string
  file_path: string
  thumbnail_path: string | null
  mime_type: string | null
  created_at: string | null
  uploaded_by: string
  hidden_by_admin: boolean | null
}

type TourSource = {
  id: string
  tour_date: string | null
  product_id: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  reservation_ids: unknown
  products: unknown
}

type ReservationPeopleRow = {
  id: string
  status: string | null
  total_people: number | null
  adults: number | null
  child: number | null
  infant: number | null
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function unwrapProduct(value: unknown): ProductNameFields | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || typeof raw !== 'object') return undefined
  const product = raw as Record<string, unknown>
  const out: ProductNameFields = {}
  if (typeof product.name === 'string') out.name = product.name
  if (typeof product.name_ko === 'string') out.name_ko = product.name_ko
  if (typeof product.name_en === 'string') out.name_en = product.name_en
  return out
}

function teamDisplayName(row: {
  email: string
  display_name?: string | null
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): string {
  const nick = row.nick_name?.trim()
  const display = row.display_name?.trim()
  const ko = row.name_ko?.trim()
  const en = row.name_en?.trim()
  return nick || display || ko || en || row.email
}

function lookupTeamName(teamMap: Map<string, string>, raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  return teamMap.get(value) || teamMap.get(value.toLowerCase()) || value
}

async function resolveTeamNames(emails: string[]): Promise<Map<string, string>> {
  const teamMap = new Map<string, string>()
  const unique = Array.from(new Set(emails.flatMap((email) => {
    const trimmed = email.trim()
    return trimmed ? [trimmed, trimmed.toLowerCase()] : []
  })))
  if (unique.length === 0) return teamMap

  const { data: teamRows } = await supabase
    .from('team')
    .select('email, display_name, nick_name, name_ko, name_en')
    .in('email', unique)

  for (const row of teamRows ?? []) {
    const name = teamDisplayName(row)
    teamMap.set(row.email, name)
    teamMap.set(row.email.trim().toLowerCase(), name)
  }
  return teamMap
}

async function fetchPhotosForTourIds(tourIds: string[]): Promise<PhotoRow[]> {
  const photos: PhotoRow[] = []
  for (const ids of chunkArray(tourIds, TOUR_IN_CHUNK)) {
    const { data, error } = await supabase
      .from('tour_photos')
      .select(
        'id, tour_id, file_name, file_path, thumbnail_path, mime_type, created_at, uploaded_by, hidden_by_admin',
      )
      .in('tour_id', ids)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    photos.push(...((data ?? []) as PhotoRow[]))
  }
  return photos
}

async function fetchReservationsByIds(reservationIds: string[]): Promise<ReservationPeopleRow[]> {
  const rows: ReservationPeopleRow[] = []
  for (const ids of chunkArray(reservationIds, TOUR_IN_CHUNK)) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, status, total_people, adults, child, infant')
      .in('id', ids)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ReservationPeopleRow[]))
  }
  return rows
}

async function hydrateGalleryGroups(
  tours: TourSource[],
  photos: PhotoRow[],
  locale: string,
): Promise<AdminGalleryTourGroup[]> {
  if (photos.length === 0) return []

  const reservationIds = Array.from(
    new Set(tours.flatMap((tour) => normalizeReservationIds(tour.reservation_ids))),
  )
  const reservations = reservationIds.length > 0 ? await fetchReservationsByIds(reservationIds) : []

  const teamEmails = [
    ...photos.map((photo) => photo.uploaded_by),
    ...tours.map((tour) => tour.tour_guide_id ?? ''),
    ...tours.map((tour) => tour.assistant_id ?? ''),
  ].filter((email) => email.includes('@'))
  const teamMap = await resolveTeamNames(teamEmails)

  const groupsByTour = new Map<string, AdminGalleryTourGroup>()
  for (const tour of tours) {
    const product = unwrapProduct(tour.products)
    const productName = getTicketBookingProductName(locale, product, tour.id)
    const guideName = lookupTeamName(teamMap, tour.tour_guide_id)
    const assistantName = lookupTeamName(teamMap, tour.assistant_id)
    const assignedPeople = calculateAssignedPeople(tour, reservations)
    groupsByTour.set(tour.id, {
      tourId: tour.id,
      tourDate: String(tour.tour_date ?? '').slice(0, 10),
      productName,
      guideName,
      assistantName,
      assignedPeople,
      photos: [],
    })
  }

  for (const photo of photos) {
    const group = groupsByTour.get(photo.tour_id)
    if (!group) continue
    const uploadedBy = (photo.uploaded_by ?? '').trim()
    const uploadedByName = uploadedBy.includes('@')
      ? teamMap.get(uploadedBy) || teamMap.get(uploadedBy.toLowerCase()) || uploadedBy
      : uploadedBy || null
    group.photos.push({
      id: photo.id,
      tourId: photo.tour_id,
      tourDate: group.tourDate,
      productName: group.productName,
      fileName: photo.file_name,
      filePath: photo.file_path,
      thumbnailPath: photo.thumbnail_path,
      mimeType: photo.mime_type,
      createdAt: photo.created_at,
      uploadedBy,
      uploadedByName,
      hiddenByAdmin: !!photo.hidden_by_admin,
      guideName: group.guideName,
      assistantName: group.assistantName,
      assignedPeople: group.assignedPeople,
    })
  }

  return Array.from(groupsByTour.values()).filter((group) => group.photos.length > 0)
}

const TOUR_SELECT =
  'id, tour_date, product_id, tour_guide_id, assistant_id, reservation_ids, products(name, name_ko, name_en)'

export async function fetchAdminTourPhotoGallery(opts: {
  fromDate: string
  toDate: string
  locale: string
}): Promise<{ groups: AdminGalleryTourGroup[]; totalPhotos: number }> {
  const { fromDate, toDate, locale } = opts

  const { data: tours, error: toursError } = await supabase
    .from('tours')
    .select(TOUR_SELECT)
    .gte('tour_date', fromDate)
    .lte('tour_date', toDate)
    .order('tour_date', { ascending: false })
    .limit(TOUR_LIMIT)

  if (toursError) throw new Error(toursError.message)
  if (!tours?.length) return { groups: [], totalPhotos: 0 }

  const photos = await fetchPhotosForTourIds(tours.map((tour) => tour.id))
  const groups = await hydrateGalleryGroups(tours as TourSource[], photos, locale)
  return { groups, totalPhotos: photos.length }
}

export async function fetchAdminTourPhotoGalleryByPhotoIds(opts: {
  photoIds: string[]
  locale: string
}): Promise<{ groups: AdminGalleryTourGroup[]; totalPhotos: number }> {
  const ids = Array.from(new Set(opts.photoIds.filter((id) => id.length > 0)))
  if (ids.length === 0) return { groups: [], totalPhotos: 0 }

  const photos: PhotoRow[] = []
  for (const chunk of chunkArray(ids, TOUR_IN_CHUNK)) {
    const { data, error } = await supabase
      .from('tour_photos')
      .select(
        'id, tour_id, file_name, file_path, thumbnail_path, mime_type, created_at, uploaded_by, hidden_by_admin',
      )
      .in('id', chunk)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    photos.push(...((data ?? []) as PhotoRow[]))
  }
  if (photos.length === 0) return { groups: [], totalPhotos: 0 }

  const tourIds = Array.from(new Set(photos.map((photo) => photo.tour_id)))
  const tours: TourSource[] = []
  for (const chunk of chunkArray(tourIds, TOUR_IN_CHUNK)) {
    const { data, error } = await supabase
      .from('tours')
      .select(TOUR_SELECT)
      .in('id', chunk)
    if (error) throw new Error(error.message)
    tours.push(...((data ?? []) as TourSource[]))
  }

  tours.sort((a, b) => String(b.tour_date ?? '').localeCompare(String(a.tour_date ?? '')))
  const groups = await hydrateGalleryGroups(tours, photos, opts.locale)
  return { groups, totalPhotos: photos.length }
}

export function mergeAdminTourPhotoGroups(
  primary: AdminGalleryTourGroup[],
  extra: AdminGalleryTourGroup[],
): AdminGalleryTourGroup[] {
  const byTour = new Map<string, AdminGalleryTourGroup>()
  for (const group of [...primary, ...extra]) {
    const existing = byTour.get(group.tourId)
    if (!existing) {
      byTour.set(group.tourId, { ...group, photos: [...group.photos] })
      continue
    }
    const seen = new Set(existing.photos.map((photo) => photo.id))
    existing.photos.push(...group.photos.filter((photo) => !seen.has(photo.id)))
  }
  return Array.from(byTour.values()).sort((a, b) => b.tourDate.localeCompare(a.tourDate))
}
