export type OtaPlatform = 'viator' | 'klook' | 'gyg' | 'kkday' | 'trip' | 'other'

export type ChannelConnectionStatus = 'disabled' | 'dry_run' | 'active' | 'error'

export type SyncEventType =
  | 'push_rates'
  | 'push_availability'
  | 'push_content'
  | 'pull_bookings'
  | 'reconcile'

export type SyncEntityType = 'product' | 'offer' | 'rate_plan' | 'allotment' | 'reservation'

export type SyncEventStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'skipped'

export type MappingInternalType = 'product' | 'offer' | 'rate_plan' | 'choice_option'

/** Seeded in 20260718140000_commerce_ota_distribution_tables.sql */
export const KOVEgAS_VIATOR_DRY_RUN_CONNECTION_ID =
  'c0000000-0000-4000-8000-000000000001' as const

export type PushRatesPayload = {
  productId: string
  channelId: string
  variantKey: string
  date: string
  ratePlanId: string
  offerId?: string | null
  adult?: number
  child?: number
  infant?: number
  isSaleAvailable?: boolean
  source?: string
}

export type AdapterResult = {
  ok: boolean
  dryRun?: boolean
  skipped?: boolean
  reason?: string
  externalRequest?: Record<string, unknown>
  externalResponse?: Record<string, unknown>
}
