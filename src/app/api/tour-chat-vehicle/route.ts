import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  pickCustomerFacingVehiclePhotos,
  simplifyVehiclePhotoUrl,
  type VehicleRentalDocUrls,
} from '@/lib/resolveCustomerVehiclePhotos'

function toPublicPhotoUrl(
  photo: { photo_url?: string | null; photo_name?: string | null },
  db: typeof supabase
): { url: string; alt?: string; photo_url: string } | null {
  const raw = photo.photo_url
  if (!raw) return null
  if (raw.startsWith('data:image') || raw.startsWith('http')) {
    const url = simplifyVehiclePhotoUrl(raw)
    return {
      url,
      photo_url: url,
      ...(photo.photo_name ? { alt: photo.photo_name } : {}),
    }
  }
  try {
    const { data } = db.storage.from('images').getPublicUrl(raw)
    const url = simplifyVehiclePhotoUrl(data.publicUrl)
    return {
      url,
      photo_url: url,
      ...(photo.photo_name ? { alt: photo.photo_name } : {}),
    }
  } catch {
    return {
      url: raw,
      photo_url: raw,
      ...(photo.photo_name ? { alt: photo.photo_name } : {}),
    }
  }
}

/**
 * POST /api/tour-chat-vehicle
 * 투어 채팅용 차량 요약. chat_rooms(room_code + tour_id) 검증 후 반환.
 */
export async function POST(request: NextRequest) {
  const admin = supabaseAdmin ?? supabase
  try {
    const body = await request.json()
    const tourId = String(body.tourId ?? '').trim()
    const roomCode = String(body.roomCode ?? '').trim()

    if (!tourId || !roomCode) {
      return NextResponse.json({ error: 'tourId and roomCode are required' }, { status: 400 })
    }

    const { data: roomRow, error: roomErr } = await admin
      .from('chat_rooms')
      .select('id')
      .eq('tour_id', tourId)
      .eq('room_code', roomCode)
      .eq('is_active', true)
      .maybeSingle()

    if (roomErr || !roomRow) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 })
    }

    const { data: tour, error: tourErr } = await admin
      .from('tours')
      .select('tour_car_id')
      .eq('id', tourId)
      .maybeSingle()

    if (tourErr || !tour?.tour_car_id) {
      return NextResponse.json({ vehicle: null })
    }

    const carId = String(tour.tour_car_id)

    const { data: vehicleData, error: vehicleError } = await admin
      .from('vehicles')
      .select(
        'vehicle_type, capacity, color, rental_reservation_url, rental_agreement_file_url, rental_receipt_url'
      )
      .eq('id', carId)
      .maybeSingle()

    if (vehicleError || !vehicleData?.vehicle_type) {
      return NextResponse.json({ vehicle: null })
    }

    const { data: vehicleTypeData } = await admin
      .from('vehicle_types')
      .select('id, name, brand, model, passenger_capacity')
      .eq('name', vehicleData.vehicle_type)
      .maybeSingle()

    const typeId = vehicleTypeData?.id || ''

    let typePhotosData: Array<{ photo_url?: string | null; photo_name?: string | null }> | null = null
    if (typeId) {
      const { data } = await admin
        .from('vehicle_type_photos')
        .select('photo_url, photo_name, display_order, is_primary')
        .eq('vehicle_type_id', typeId)
        .order('display_order', { ascending: true })
        .order('is_primary', { ascending: false })
      typePhotosData = data
    }

    const { data: vehiclePhotosData } = await admin
      .from('vehicle_photos')
      .select('photo_url, photo_name, display_order, is_primary')
      .eq('vehicle_id', carId)
      .order('display_order', { ascending: true })
      .order('is_primary', { ascending: false })

    const rentalDocs: VehicleRentalDocUrls = {
      rental_reservation_url: (vehicleData as VehicleRentalDocUrls).rental_reservation_url,
      rental_agreement_file_url: (vehicleData as VehicleRentalDocUrls).rental_agreement_file_url,
      rental_receipt_url: (vehicleData as VehicleRentalDocUrls).rental_receipt_url,
    }

    const processedType = (typePhotosData || [])
      .map((p) => toPublicPhotoUrl(p, admin))
      .filter((x): x is { url: string; alt?: string; photo_url: string } => x != null && !!x.url)
    const processedVehicle = (vehiclePhotosData || [])
      .map((p) => toPublicPhotoUrl(p, admin))
      .filter((x): x is { url: string; alt?: string; photo_url: string } => x != null && !!x.url)

    const picked = pickCustomerFacingVehiclePhotos({
      vehiclePhotos: processedVehicle,
      typePhotos: processedType,
      rentalDocs,
    })
    const photos = picked.map(({ url, alt }) => ({ url, ...(alt ? { alt } : {}) }))

    const capacity =
      (vehicleTypeData?.passenger_capacity as number | null | undefined) ??
      (vehicleData.capacity as number | null | undefined) ??
      null

    const brand = (vehicleTypeData?.brand as string | null | undefined)?.trim() || ''
    const model = (vehicleTypeData?.model as string | null | undefined)?.trim() || ''
    const typeName = (vehicleTypeData?.name as string | null | undefined)?.trim() || String(vehicleData.vehicle_type)

    const modelLine = [brand, model].filter(Boolean).join(' ').trim() || typeName
    const vehicleTypeLabel = String(vehicleData.vehicle_type).trim() || typeName

    return NextResponse.json({
      vehicle: {
        vehicleType: vehicleTypeLabel,
        model: modelLine,
        capacity,
        color: (vehicleData.color as string | null) ?? null,
        photos,
      },
    })
  } catch (e) {
    console.error('[tour-chat-vehicle]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
