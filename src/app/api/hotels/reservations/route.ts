import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { hotelManager } from '@/lib/hotels/hotel-manager'
import { listReservations } from '@/lib/hotels/services/reservation-service'
import type { HotelReservationStatus, HotelSupplierCode } from '@/lib/hotels/types'
import { HOTEL_SUPPLIERS } from '@/lib/hotels/types'

/**
 * GET /api/hotels/reservations
 * POST /api/hotels/reservations — create via supplier adapter
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const reservations = await listReservations({
      status: (searchParams.get('status') as HotelReservationStatus) || undefined,
      supplier: (searchParams.get('supplier') as HotelSupplierCode) || undefined,
      limit: Number(searchParams.get('limit') || 100),
    })
    return NextResponse.json({ success: true, reservations })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list reservations' },
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
      roomId?: string
      supplierHotelId?: string
      supplierRoomId?: string
      checkIn?: string
      checkOut?: string
      guests?: number
      rooms?: number
      guestName?: string
      tourId?: string
      assignedDate?: string
      linkTourHotelBookingId?: string
      dryRun?: boolean
    }

    if (!body.supplier || !HOTEL_SUPPLIERS.includes(body.supplier)) {
      return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
    }
    if (
      !body.hotelId ||
      !body.supplierHotelId ||
      !body.checkIn ||
      !body.checkOut ||
      !body.guestName ||
      !body.guests
    ) {
      return NextResponse.json(
        {
          error:
            'hotelId, supplierHotelId, checkIn, checkOut, guestName, guests required',
        },
        { status: 400 }
      )
    }

    const result = await hotelManager.reserve({
      supplier: body.supplier,
      hotelId: body.hotelId,
      roomId: body.roomId,
      tourId: body.tourId,
      assignedDate: body.assignedDate,
      createdBy: auth.userEmail,
      linkTourHotelBookingId: body.linkTourHotelBookingId,
      params: {
        supplierHotelId: body.supplierHotelId,
        supplierRoomId: body.supplierRoomId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guests: body.guests,
        rooms: body.rooms,
        guestName: body.guestName,
        dryRun: body.dryRun,
      },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[api/hotels/reservations]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reservation failed' },
      { status: 500 }
    )
  }
}
