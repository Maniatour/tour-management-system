import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { hotelManager } from '@/lib/hotels/hotel-manager'
import { listRates, listRecentPriceAlerts } from '@/lib/hotels/services/rate-service'
import type { HotelSupplierCode } from '@/lib/hotels/types'
import { HOTEL_SUPPLIERS } from '@/lib/hotels/types'

/**
 * GET /api/hotels/rates?hotelId=&fromDate=&toDate=
 * POST /api/hotels/rates — compare & persist rates via supplier
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('alerts') === '1') {
      const alerts = await listRecentPriceAlerts(50)
      return NextResponse.json({ success: true, alerts })
    }

    const rates = await listRates({
      hotelId: searchParams.get('hotelId') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      supplier: (searchParams.get('supplier') as HotelSupplierCode) || undefined,
    })
    return NextResponse.json({ success: true, rates })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list rates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      supplier?: HotelSupplierCode
      hotelId?: string
      supplierHotelId?: string
      checkIn?: string
      checkOut?: string
      rooms?: number
      guests?: number
      destination?: string
      /** Manual trigger from admin UI — run live Wyndham path for this call */
      forceLive?: boolean
    }

    if (!body.supplier || !HOTEL_SUPPLIERS.includes(body.supplier)) {
      return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
    }
    if (!body.hotelId || !body.supplierHotelId || !body.checkIn || !body.checkOut) {
      return NextResponse.json(
        { error: 'hotelId, supplierHotelId, checkIn, checkOut required' },
        { status: 400 }
      )
    }

    const result = await hotelManager.compareRates({
      supplier: body.supplier,
      hotelId: body.hotelId,
      supplierHotelId: body.supplierHotelId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      rooms: body.rooms,
      guests: body.guests,
      destination: body.destination,
      forceLive: body.forceLive === true || body.supplier === 'wyndham',
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[api/hotels/rates]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rate check failed' },
      { status: 500 }
    )
  }
}
