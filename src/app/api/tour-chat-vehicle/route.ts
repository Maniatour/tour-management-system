import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

function simplifyUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

function toPublicPhotoUrl(
  photo: { photo_url?: string | null; photo_name?: string | null },
  db: typeof supabase
): { url: string; alt?: string } | null {
  const raw = photo.photo_url
  if (!raw) return null
  if (raw.startsWith('data:image') || raw.startsWith('http')) {
    return { url: simplifyUrl(raw), alt: photo.photo_name || undefined }
  }
  try {
    const { data } = db.storage.from('images').getPublicUrl(raw)
    return { url: simplifyUrl(data.publicUrl), alt: photo.photo_name || undefined }
  } catch {
    return { url: raw, alt: photo.photo_name || undefined }
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
      .select('vehicle_type, capacity, color')
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

    const processedType = (typePhotosData || [])
      .map((p) => toPublicPhotoUrl(p, admin))
      .filter((x): x is { url: string; alt?: string } => x != null && !!x.url)
    const processedVehicle = (vehiclePhotosData || [])
      .map((p) => toPublicPhotoUrl(p, admin))
      .filter((x): x is { url: string; alt?: string } => x != null && !!x.url)

    const photos = processedVehicle.length > 0 ? processedVehicle : processedType

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
