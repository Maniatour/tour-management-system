import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  listHotels,
  enrichHotelMetadata,
  upsertHotel,
  deleteHotel,
} from '@/lib/hotels/services/hotel-catalog-service'
import type { HotelSupplierCode } from '@/lib/hotels/types'
import { HOTEL_SUPPLIERS } from '@/lib/hotels/types'

/**
 * GET /api/hotels — list catalog
 * POST /api/hotels — enrich (StayAPI) | upsert hotel row
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const hotels = await listHotels({
      city: searchParams.get('city') || undefined,
      supplier: (searchParams.get('supplier') as HotelSupplierCode) || undefined,
      activeOnly: searchParams.get('activeOnly') !== '0',
    })
    return NextResponse.json({ success: true, hotels })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list hotels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      action?: string
      hotelId?: string
      hard?: boolean
      supplier?: HotelSupplierCode
      supplierHotelId?: string
      name?: string
      city?: string
      state?: string
      address?: string
      country?: string
    }

    if (body.action === 'enrich' && body.hotelId) {
      const result = await enrichHotelMetadata(body.hotelId)
      return NextResponse.json({ success: true, ...result })
    }

    if (body.action === 'delete' && body.hotelId) {
      const result = await deleteHotel(body.hotelId, { hard: body.hard === true })
      return NextResponse.json({ success: true, ...result })
    }

    if (body.action === 'upsert') {
      if (!body.supplier || !HOTEL_SUPPLIERS.includes(body.supplier)) {
        return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
      }
      if (!body.name || !body.supplierHotelId) {
        return NextResponse.json(
          { error: 'name and supplierHotelId required' },
          { status: 400 }
        )
      }
      const hotel = await upsertHotel({
        supplier: body.supplier,
        supplierHotelId: body.supplierHotelId,
        name: body.name,
        city: body.city,
        state: body.state,
        address: body.address,
        country: body.country || 'US',
      })
      return NextResponse.json({ success: true, hotel })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    )
  }
}
