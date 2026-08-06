import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { hotelManager } from '@/lib/hotels/hotel-manager'
import type { HotelSupplierCode } from '@/lib/hotels/types'
import { HOTEL_SUPPLIERS } from '@/lib/hotels/types'

/**
 * POST /api/hotels/search
 * Body: { supplier, checkIn, checkOut, city?, query?, rooms?, guests? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      supplier?: HotelSupplierCode
      checkIn?: string
      checkOut?: string
      city?: string
      query?: string
      rooms?: number
      guests?: number
    }

    if (!body.supplier || !HOTEL_SUPPLIERS.includes(body.supplier)) {
      return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
    }
    if (!body.checkIn || !body.checkOut) {
      return NextResponse.json({ error: 'checkIn and checkOut required' }, { status: 400 })
    }

    const results = await hotelManager.search({
      supplier: body.supplier,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      city: body.city,
      query: body.query,
      rooms: body.rooms,
      guests: body.guests,
    })

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('[api/hotels/search]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
