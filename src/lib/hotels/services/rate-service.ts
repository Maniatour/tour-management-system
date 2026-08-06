import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import {
  PRICE_ALERT_DECREASE_THRESHOLD_USD,
  type HotelRateQuote,
  type HotelRateRow,
  type HotelSupplierCode,
} from '@/lib/hotels/types'

export async function listRates(opts: {
  hotelId?: string | undefined
  fromDate?: string | undefined
  toDate?: string | undefined
  supplier?: HotelSupplierCode | undefined
}): Promise<HotelRateRow[]> {
  const db = getHotelAdminClient()
  let q = db.from('hotel_rates').select('*').order('stay_date', { ascending: true })
  if (opts.hotelId) q = q.eq('hotel_id', opts.hotelId)
  if (opts.supplier) q = q.eq('supplier', opts.supplier)
  if (opts.fromDate) q = q.gte('stay_date', opts.fromDate)
  if (opts.toDate) q = q.lte('stay_date', opts.toDate)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as HotelRateRow[]
}

/**
 * Upsert latest rates and append history; returns price-drop alerts created.
 */
export async function persistRateQuotes(input: {
  hotelId: string
  roomId?: string | null
  quotes: HotelRateQuote[]
  alertThreshold?: number
}): Promise<{
  saved: number
  alerts: Array<{ message: string; previousPrice: number; newPrice: number }>
}> {
  const db = getHotelAdminClient()
  const threshold = input.alertThreshold ?? PRICE_ALERT_DECREASE_THRESHOLD_USD
  const alerts: Array<{ message: string; previousPrice: number; newPrice: number }> = []
  let saved = 0

  const { data: hotel } = await db
    .from('hotels')
    .select('name')
    .eq('hotel_id', input.hotelId)
    .maybeSingle()
  const hotelName = (hotel?.name as string) || 'Hotel'

  for (const quote of input.quotes) {
    let existingQuery = db
      .from('hotel_rates')
      .select('*')
      .eq('supplier', quote.supplier)
      .eq('hotel_id', input.hotelId)
      .eq('stay_date', quote.stayDate)

    existingQuery = input.roomId
      ? existingQuery.eq('room_id', input.roomId)
      : existingQuery.is('room_id', null)

    const { data: existing } = await existingQuery.maybeSingle()

    const previousPrice =
      existing && typeof existing.price === 'number' ? Number(existing.price) : null

    await db.from('hotel_rate_history').insert({
      hotel_id: input.hotelId,
      room_id: input.roomId ?? null,
      supplier: quote.supplier,
      stay_date: quote.stayDate,
      price: quote.price,
      previous_price: previousPrice,
      currency: quote.currency,
    })

    const payload = {
      hotel_id: input.hotelId,
      room_id: input.roomId ?? null,
      supplier: quote.supplier,
      stay_date: quote.stayDate,
      price: quote.price,
      currency: quote.currency,
      cancellation_policy: quote.cancellationPolicy ?? null,
      checked_at: new Date().toISOString(),
    }

    if (existing?.rate_id) {
      const { error } = await db
        .from('hotel_rates')
        .update(payload)
        .eq('rate_id', existing.rate_id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await db.from('hotel_rates').insert(payload)
      if (error) throw new Error(error.message)
    }
    saved += 1

    if (
      previousPrice != null &&
      quote.price < previousPrice &&
      previousPrice - quote.price >= threshold
    ) {
      const message = `${hotelName} price decreased from $${previousPrice} to $${quote.price}.`
      await db.from('hotel_price_alerts').insert({
        hotel_id: input.hotelId,
        room_id: input.roomId ?? null,
        supplier: quote.supplier,
        stay_date: quote.stayDate,
        previous_price: previousPrice,
        new_price: quote.price,
        currency: quote.currency,
        message,
        notified_at: new Date().toISOString(),
      })
      alerts.push({ message, previousPrice, newPrice: quote.price })
    }
  }

  return { saved, alerts }
}

export async function listRecentPriceAlerts(limit = 50) {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_price_alerts')
    .select('*, hotels(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}
