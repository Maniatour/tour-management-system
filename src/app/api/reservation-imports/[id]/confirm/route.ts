import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  confirmReservationImport,
  type ConfirmReservationImportBody,
} from '@/lib/confirmReservationImport'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: importId } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const body = (await request.json().catch(() => null)) as ConfirmReservationImportBody | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await confirmReservationImport(client as never, importId, body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    reservation_id: result.reservation_id,
    status: result.status_label,
    reservation_status: result.reservation_status,
    total_people_before: result.total_people_before,
    total_people_after: result.total_people_after,
    departure_threshold_crossed: result.departure_threshold_crossed,
    open_price_inventory: result.open_price_inventory,
    product_id: result.product_id,
    tour_date: result.tour_date,
    spots_left_after: result.spots_left_after,
    departure_batch: result.departure_batch,
  })
}
