import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { hotelManager } from '@/lib/hotels/hotel-manager'
import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import type { HotelSupplierCode } from '@/lib/hotels/types'

/**
 * POST /api/hotels/reservations/[id]/cancel
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as { reason?: string }

    const db = getHotelAdminClient()
    const { data: reservation, error } = await db
      .from('hotel_reservations')
      .select('*')
      .eq('reservation_id', id)
      .single()

    if (error || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    const confirmation = reservation.supplier_confirmation_number as string | null
    if (!confirmation) {
      return NextResponse.json(
        { error: 'No supplier confirmation number to cancel' },
        { status: 400 }
      )
    }

    const result = await hotelManager.cancel({
      supplier: reservation.supplier as HotelSupplierCode,
      reservationId: id,
      confirmationNumber: confirmation,
      reason: body.reason,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[api/hotels/reservations/cancel]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cancel failed' },
      { status: 500 }
    )
  }
}
