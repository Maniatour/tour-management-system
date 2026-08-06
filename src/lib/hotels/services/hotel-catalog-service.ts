import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import { createStayApiMetadataProvider } from '@/lib/hotels/metadata/stayapi-metadata-provider'
import type {
  HotelMetadataSource,
  HotelRow,
  HotelRoomRow,
  HotelSupplierCode,
} from '@/lib/hotels/types'

export async function listHotels(opts?: {
  city?: string | undefined
  supplier?: HotelSupplierCode | undefined
  activeOnly?: boolean | undefined
}): Promise<HotelRow[]> {
  const db = getHotelAdminClient()
  let q = db.from('hotels').select('*').order('name', { ascending: true })
  if (opts?.city) q = q.eq('city', opts.city)
  if (opts?.supplier) q = q.eq('supplier', opts.supplier)
  if (opts?.activeOnly !== false) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as HotelRow[]
}

export async function upsertHotel(input: {
  supplier: HotelSupplierCode
  supplierHotelId: string
  name: string
  address?: string | undefined
  city?: string | undefined
  state?: string | undefined
  country?: string | undefined
  metadataSource?: HotelMetadataSource | null | undefined
  metadataExternalId?: string | null | undefined
  metadataJson?: Record<string, unknown> | undefined
}): Promise<HotelRow> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotels')
    .upsert(
      {
        supplier: input.supplier,
        supplier_hotel_id: input.supplierHotelId,
        name: input.name,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? 'US',
        metadata_source: input.metadataSource ?? null,
        metadata_external_id: input.metadataExternalId ?? null,
        metadata_json: input.metadataJson ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'supplier,supplier_hotel_id' }
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HotelRow
}

export async function listRooms(hotelId: string): Promise<HotelRoomRow[]> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_rooms')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('room_type')
  if (error) throw new Error(error.message)
  return (data || []) as HotelRoomRow[]
}

export async function upsertRoom(input: {
  hotelId: string
  roomType: string
  bedType?: string | undefined
  capacity?: number | undefined
  supplierRoomId?: string | undefined
}): Promise<HotelRoomRow> {
  const db = getHotelAdminClient()
  const existing = await db
    .from('hotel_rooms')
    .select('*')
    .eq('hotel_id', input.hotelId)
    .eq('room_type', input.roomType)
    .maybeSingle()

  if (existing.data) {
    const { data, error } = await db
      .from('hotel_rooms')
      .update({
        bed_type: input.bedType ?? existing.data.bed_type,
        capacity: input.capacity ?? existing.data.capacity,
        supplier_room_id: input.supplierRoomId ?? existing.data.supplier_room_id,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', existing.data.room_id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as HotelRoomRow
  }

  const { data, error } = await db
    .from('hotel_rooms')
    .insert({
      hotel_id: input.hotelId,
      room_type: input.roomType,
      bed_type: input.bedType ?? null,
      capacity: input.capacity ?? 2,
      supplier_room_id: input.supplierRoomId ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HotelRoomRow
}

/** Enrich hotel row with StayAPI metadata only (never booking data). */
export type EnrichHotelResult = {
  hotel: HotelRow
  status: 'updated' | 'unchanged' | 'not_configured' | 'not_found'
  message: string
}

export async function enrichHotelMetadata(hotelId: string): Promise<EnrichHotelResult> {
  const db = getHotelAdminClient()
  const { data: hotel, error } = await db
    .from('hotels')
    .select('*')
    .eq('hotel_id', hotelId)
    .single()
  if (error || !hotel) throw new Error(error?.message || 'Hotel not found')

  if (!process.env.STAYAPI_API_KEY?.trim()) {
    return {
      hotel: hotel as HotelRow,
      status: 'not_configured',
      message:
        'StayAPI는 선택 사항입니다. 이미지·설명용이며 요금과 무관합니다. STAYAPI_API_KEY가 없어 건너뛰었습니다. 요금은 「멤버 요금 가져오기」를 사용하세요.',
    }
  }

  const stay = createStayApiMetadataProvider()
  const meta = hotel.metadata_external_id
    ? await stay.enrichByExternalId(String(hotel.metadata_external_id))
    : (await stay.searchByName(String(hotel.name), hotel.city ? String(hotel.city) : undefined))[0]

  if (!meta || (!meta.name && !meta.description && !meta.images?.length)) {
    return {
      hotel: hotel as HotelRow,
      status: 'not_found',
      message: 'StayAPI에서 호텔 메타데이터를 찾지 못했습니다. (요금에는 영향 없음)',
    }
  }

  const { data, error: updateError } = await db
    .from('hotels')
    .update({
      metadata_source: 'stayapi',
      address: meta.address ?? hotel.address,
      city: meta.city ?? hotel.city,
      state: meta.state ?? hotel.state,
      country: meta.country ?? hotel.country,
      metadata_json: {
        ...(typeof hotel.metadata_json === 'object' && hotel.metadata_json
          ? (hotel.metadata_json as Record<string, unknown>)
          : {}),
        description: meta.description,
        images: meta.images,
        amenities: meta.amenities,
        geo:
          meta.latitude != null && meta.longitude != null
            ? { lat: meta.latitude, lng: meta.longitude }
            : undefined,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('hotel_id', hotelId)
    .select('*')
    .single()

  if (updateError) throw new Error(updateError.message)
  return {
    hotel: data as HotelRow,
    status: 'updated',
    message: 'StayAPI 메타데이터를 저장했습니다. (요금/예약과 무관)',
  }
}
