import type {
  AdapterResult,
  ChannelConnectionStatus,
  OtaPlatform,
  PushRatesPayload,
  SyncEventType,
} from '@/lib/commerce/ota/types'

export type OtaAdapterContext = {
  connectionId: string
  operatorId: string
  platform: OtaPlatform
  status: ChannelConnectionStatus
  config: Record<string, unknown>
  /** Vault pointer only (e.g. env:OTA_VIATOR_API_KEY) — never raw secrets */
  credentialsRef: string | null
  /** Active mappings for this connection (sku ↔ internal) */
  mappings: Array<{
    internalType: string
    internalId: string
    externalSku: string
    externalProductId: string | null
    externalPackageId: string | null
  }>
}

export interface OtaAdapter {
  platform: OtaPlatform
  pushRates(ctx: OtaAdapterContext, payload: PushRatesPayload): Promise<AdapterResult>
  pushAvailability?(
    ctx: OtaAdapterContext,
    payload: Record<string, unknown>
  ): Promise<AdapterResult>
  supports(eventType: SyncEventType): boolean
}
