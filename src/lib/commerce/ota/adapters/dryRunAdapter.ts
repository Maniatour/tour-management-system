import type { OtaAdapter, OtaAdapterContext } from '@/lib/commerce/ota/adapters/types'
import type {
  AdapterResult,
  OtaPlatform,
  PushRatesPayload,
  SyncEventType,
} from '@/lib/commerce/ota/types'

/**
 * Dry-run adapter: builds a normalized outbound payload and never calls external APIs.
 * Used for all platforms until real credentials + contracts are wired.
 */
export function createDryRunAdapter(platform: OtaPlatform): OtaAdapter {
  return {
    platform,
    supports(eventType: SyncEventType): boolean {
      return eventType === 'push_rates' || eventType === 'push_availability'
    },
    async pushRates(ctx: OtaAdapterContext, payload: PushRatesPayload): Promise<AdapterResult> {
      if (ctx.status === 'disabled') {
        return { ok: true, skipped: true, reason: 'connection_disabled' }
      }

      const mapping =
        ctx.mappings.find(
          (m) =>
            (payload.offerId &&
              m.internalType === 'offer' &&
              m.internalId === payload.offerId) ||
            (m.internalType === 'rate_plan' && m.internalId === payload.ratePlanId) ||
            (m.internalType === 'product' && m.internalId === payload.productId)
        ) || null

      if (!mapping) {
        return {
          ok: true,
          skipped: true,
          reason: 'no_external_mapping',
          externalRequest: {
            platform: ctx.platform,
            event: 'push_rates',
            payload,
          },
        }
      }

      const externalRequest = {
        platform: ctx.platform,
        mode: 'dry_run',
        connectionId: ctx.connectionId,
        externalSku: mapping.externalSku,
        externalProductId: mapping.externalProductId,
        externalPackageId: mapping.externalPackageId,
        rates: {
          date: payload.date,
          adult: payload.adult ?? null,
          child: payload.child ?? null,
          infant: payload.infant ?? null,
          isSaleAvailable: payload.isSaleAvailable !== false,
        },
        internal: {
          productId: payload.productId,
          ratePlanId: payload.ratePlanId,
          offerId: payload.offerId ?? null,
          channelId: payload.channelId,
          variantKey: payload.variantKey,
        },
      }

      return {
        ok: true,
        dryRun: true,
        externalRequest,
        externalResponse: {
          status: 'accepted_dry_run',
          message: 'Payload validated locally; no OTA API call made.',
        },
      }
    },
    async pushAvailability(
      ctx: OtaAdapterContext,
      payload: Record<string, unknown>
    ): Promise<AdapterResult> {
      if (ctx.status === 'disabled') {
        return { ok: true, skipped: true, reason: 'connection_disabled' }
      }
      return {
        ok: true,
        dryRun: true,
        externalRequest: {
          platform: ctx.platform,
          mode: 'dry_run',
          event: 'push_availability',
          payload,
        },
        externalResponse: { status: 'accepted_dry_run' },
      }
    },
  }
}
