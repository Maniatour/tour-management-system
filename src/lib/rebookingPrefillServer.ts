import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  mapReservationChoicesToBookingPrefill,
  REBOOKING_OUTREACH_COUPON_CODE,
  type CustomerRebookingPrefill,
  type ReservationChoiceRowForRebooking,
} from '@/lib/customerRebookingUrl'
import { resolveReservationChoices } from '@/lib/resolveReservationChoices'

type AdminClient = SupabaseClient<Database>

function parseChoicesJsonRows(raw: unknown): ReservationChoiceRowForRebooking[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as { required?: unknown[]; optional?: unknown[] }
  const out: ReservationChoiceRowForRebooking[] = []
  for (const list of [obj.required, obj.optional]) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const row = item as { choice_id?: string; option_id?: string; quantity?: number | null }
      const choiceId = String(row.choice_id ?? '').trim()
      const optionId = String(row.option_id ?? '').trim()
      if (!choiceId || !optionId || optionId === '__undecided__' || optionId === 'undecided') continue
      out.push({
        choice_id: choiceId,
        option_id: optionId,
        quantity: Math.max(1, Number(row.quantity) || 1),
      })
    }
  }
  return out
}

function mergeChoiceRows(...groups: ReservationChoiceRowForRebooking[][]): ReservationChoiceRowForRebooking[] {
  const byKey = new Map<string, ReservationChoiceRowForRebooking>()
  for (const group of groups) {
    for (const row of group) {
      const choiceId = String(row.choice_id ?? '').trim()
      const optionId = String(row.option_id ?? '').trim()
      if (!choiceId || !optionId) continue
      const key = `${choiceId}:${optionId}`
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity = Math.max(existing.quantity ?? 1, row.quantity ?? 1)
      } else {
        byKey.set(key, { ...row })
      }
    }
  }
  return [...byKey.values()]
}

export type RebookingPrefillPayload = CustomerRebookingPrefill & {
  productId: string
  reservationId: string
}

export async function fetchRebookingPrefillForReservation(
  admin: AdminClient,
  reservationId: string
): Promise<RebookingPrefillPayload | null> {
  const id = reservationId.trim()
  if (!id) return null

  const { data: reservation, error } = await admin
    .from('reservations')
    .select('id, product_id, tour_date, adults, child, infant, choices')
    .eq('id', id)
    .maybeSingle()

  if (error || !reservation?.product_id) return null

  const { data: pricingRow } = await admin
    .from('reservation_pricing')
    .select('choices')
    .eq('reservation_id', id)
    .maybeSingle()

  const resolved = await resolveReservationChoices(admin, id)
  const resolvedRows: ReservationChoiceRowForRebooking[] = resolved.map((row) => ({
    choice_id: row.choice_id,
    option_id: row.option_id,
    quantity: row.quantity,
  }))

  const choiceRows = mergeChoiceRows(
    parseChoicesJsonRows(pricingRow?.choices),
    parseChoicesJsonRows(reservation.choices),
    resolvedRows
  )

  const { selectedOptions, selectedChoiceQuantities } =
    mapReservationChoicesToBookingPrefill(choiceRows)

  const adults = Math.max(0, Number(reservation.adults) || 0)
  const children = Math.max(0, Number(reservation.child) || 0)
  const infants = Math.max(0, Number(reservation.infant) || 0)
  const partyTotal = adults + children + infants

  return {
    reservationId: id,
    productId: reservation.product_id,
    tourDate: reservation.tour_date ? String(reservation.tour_date).slice(0, 10) : null,
    adults: partyTotal > 0 ? adults : 1,
    children,
    infants,
    couponCode: REBOOKING_OUTREACH_COUPON_CODE,
    selectedOptions,
    selectedChoiceQuantities,
    openBooking: true,
  }
}
