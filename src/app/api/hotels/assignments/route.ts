import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  assignReservationToTour,
  listAssignmentsForTour,
  listRecentAssignments,
} from '@/lib/hotels/services/tour-hotel-assignment-service'

/**
 * GET /api/hotels/assignments?tourId=
 * POST /api/hotels/assignments — { tourId, reservationId, assignedDate }
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const tourId = new URL(request.url).searchParams.get('tourId')
    if (tourId) {
      const assignments = await listAssignmentsForTour(tourId)
      return NextResponse.json({ success: true, assignments })
    }
    const assignments = await listRecentAssignments(50)
    return NextResponse.json({ success: true, assignments })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list assignments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      tourId?: string
      reservationId?: string
      assignedDate?: string
    }
    if (!body.tourId || !body.reservationId || !body.assignedDate) {
      return NextResponse.json(
        { error: 'tourId, reservationId, assignedDate required' },
        { status: 400 }
      )
    }
    const assignment = await assignReservationToTour({
      tourId: body.tourId,
      reservationId: body.reservationId,
      assignedDate: body.assignedDate,
    })
    return NextResponse.json({ success: true, assignment })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Assign failed' },
      { status: 500 }
    )
  }
}
