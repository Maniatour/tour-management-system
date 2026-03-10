import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'

/** confirm 요청 body: 예약 생성에 필요한 필드 */
interface ConfirmBody {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  product_id: string
  tour_date: string
  tour_time?: string | null
  event_note?: string | null
  pickup_hotel?: string | null
  pickup_time?: string | null
  adults: number
  child?: number
  infant?: number
  total_people: number
  channel_id: string
  channel_rn?: string | null
  added_by: string
  status?: string
  variant_key?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: importId } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase

  const { data: importRow, error: fetchImportError } = await client
    .from('reservation_imports')
    .select('*')
    .eq('id', importId)
    .eq('status', 'pending')
    .single()

  if (fetchImportError || !importRow) {
    return NextResponse.json(
      { error: 'Import not found or already processed' },
      { status: 404 }
    )
  }

  const body = (await request.json().catch(() => null)) as ConfirmBody | null
  if (!body?.product_id || !body.tour_date || body.adults == null || !body.channel_id || !body.added_by) {
    return NextResponse.json(
      { error: 'Missing required fields: product_id, tour_date, adults, channel_id, added_by' },
      { status: 400 }
    )
  }

  let customerId = body.customer_id
  if (!customerId) {
    if (body.customer_email && body.customer_name) {
      const { data: existing } = await client
        .from('customers')
        .select('id')
        .eq('email', body.customer_email)
        .maybeSingle()
      if (existing) {
        customerId = existing.id
      } else {
        const { data: newCustomer, error: insertCustomerError } = await client
          .from('customers')
          .insert({
            name: body.customer_name,
            email: body.customer_email,
            phone: body.customer_phone ?? null,
          })
          .select('id')
          .single()
        if (insertCustomerError || !newCustomer) {
          return NextResponse.json(
            { error: 'Failed to create customer: ' + (insertCustomerError?.message ?? '') },
            { status: 500 }
          )
        }
        customerId = newCustomer.id
      }
    } else {
      return NextResponse.json(
        { error: 'Provide either customer_id or (customer_name + customer_email)' },
        { status: 400 }
      )
    }
  }

  const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const child = body.child ?? 0
  const infant = body.infant ?? 0
  const totalPeople = body.total_people ?? body.adults + child + infant

  const reservationData = {
    id: reservationId,
    customer_id: customerId,
    product_id: body.product_id,
    tour_date: body.tour_date,
    tour_time: body.tour_time ?? null,
    event_note: body.event_note ?? null,
    pickup_hotel: body.pickup_hotel ?? null,
    pickup_time: body.pickup_time ?? null,
    adults: body.adults,
    child,
    infant,
    total_people: totalPeople,
    channel_id: body.channel_id,
    channel_rn: body.channel_rn ?? null,
    added_by: body.added_by,
    tour_id: null,
    status: body.status ?? 'confirmed',
    selected_options: null,
    selected_option_prices: null,
    is_private_tour: false,
    choices: null,
    variant_key: body.variant_key ?? 'default',
  }

  const { error: insertReservationError } = await client
    .from('reservations')
    .insert(reservationData)

  if (insertReservationError) {
    return NextResponse.json(
      { error: 'Failed to create reservation: ' + insertReservationError.message },
      { status: 500 }
    )
  }

  const _tourResult = await autoCreateOrUpdateTour(
    body.product_id,
    body.tour_date,
    reservationId,
    false
  )

  const { error: updateImportError } = await client
    .from('reservation_imports')
    .update({
      status: 'confirmed',
      reservation_id: reservationId,
      confirmed_by: body.added_by,
      updated_at: new Date().toISOString(),
    })
    .eq('id', importId)

  if (updateImportError) {
    return NextResponse.json(
      { error: 'Reservation created but import update failed: ' + updateImportError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ reservation_id: reservationId, status: 'confirmed' })
}
