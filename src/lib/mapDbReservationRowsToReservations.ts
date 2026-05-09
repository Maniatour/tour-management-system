import type { Reservation } from '@/types/reservation'
import { parseEmbeddedChannelNameFromReservationRow } from '@/utils/reservationUtils'

const toNumber = (val: number | null | undefined): number => {
  if (val === null || val === undefined) return 0
  if (typeof val === 'string') return parseFloat(val) || 0
  return val || 0
}

/** useReservationData.mapRawToReservation 와 동일 규칙 (삭제·모달 등 보조 로드용) */
export function mapDbReservationRowsToReservations(
  raw: Record<string, unknown>[],
  productMap: Map<string, string>,
  tourMap: Map<string, boolean>
): Reservation[] {
  return raw.map((item: Record<string, unknown>) => {
    const subCategory = productMap.get((item.product_id as string) || '')
    const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
    const hasExistingTour = isManiaTour ? tourMap.has(`${item.product_id}-${item.tour_date}`) : false
    return {
      id: item.id as string,
      customerId: (item.customer_id as string) || '',
      productId: (item.product_id as string) || '',
      tourDate: (item.tour_date as string) || '',
      tourTime: (item.tour_time as string) || '',
      eventNote: (item.event_note as string) || '',
      pickUpHotel: (item.pickup_hotel as string) || '',
      pickUpTime: (item.pickup_time as string) || '',
      adults: toNumber(item.adults as number | undefined),
      child: toNumber(item.child as number | undefined),
      infant: toNumber(item.infant as number | undefined),
      totalPeople: toNumber(item.total_people as number | undefined),
      channelId: (item.channel_id as string) || '',
      channelNameSnapshot: parseEmbeddedChannelNameFromReservationRow(item) ?? null,
      variantKey: (item.variant_key as string) || 'default',
      channelRN: (item.channel_rn as string) || '',
      addedBy: (item.added_by as string) || '',
      addedTime: (item.created_at as string) || '',
      tourId: (item.tour_id as string) || '',
      status: ((item.status as string) || 'pending') as Reservation['status'],
      updated_at: (item.updated_at as string | null) ?? null,
      amount_audited: !!item.amount_audited,
      amount_audited_at: (item.amount_audited_at as string | null) ?? null,
      amount_audited_by: (item.amount_audited_by as string | null) ?? null,
      selectedOptions:
        typeof item.selected_options === 'string'
          ? (() => {
              try {
                return JSON.parse(item.selected_options as string) as { [k: string]: string[] }
              } catch {
                return {}
              }
            })()
          : (item.selected_options as { [k: string]: string[] }) || {},
      selectedOptionPrices:
        typeof item.selected_option_prices === 'string'
          ? (() => {
              try {
                return JSON.parse(item.selected_option_prices as string) as { [k: string]: number }
              } catch {
                return {}
              }
            })()
          : (item.selected_option_prices as { [k: string]: number }) || {},
      choices: (item.choices as Reservation['choices']) || null,
      hasExistingTour,
    }
  })
}
