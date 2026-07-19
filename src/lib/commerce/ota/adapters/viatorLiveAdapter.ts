/**
 * Viator live rate-push adapter (Phase 4c).
 *
 * Requires:
 *   - channel_connections.status = active
 *   - COMMERCE_V2_OTA_LIVE=1
 *   - credentials_ref (e.g. env:OTA_VIATOR_API_KEY)
 *   - rates URL: config.ratesPushUrl OR env OTA_VIATOR_RATES_URL
 *     OR config.simulate=true for local E2E without an external endpoint
 *
 * Does not invent bookings. Unmapped SKUs → skipped.
 */
import { createDryRunAdapter } from '@/lib/commerce/ota/adapters/dryRunAdapter'
import type { OtaAdapter, OtaAdapterContext } from '@/lib/commerce/ota/adapters/types'
import { resolveOtaCredentialsFromRef } from '@/lib/commerce/ota/resolveOtaCredentials'
import type {
  AdapterResult,
  PushRatesPayload,
  SyncEventType,
} from '@/lib/commerce/ota/types'

function findMapping(ctx: OtaAdapterContext, payload: PushRatesPayload) {
  return (
    ctx.mappings.find(
      (m) =>
        (payload.offerId &&
          m.internalType === 'offer' &&
          m.internalId === payload.offerId) ||
        (m.internalType === 'rate_plan' && m.internalId === payload.ratePlanId) ||
        (m.internalType === 'product' && m.internalId === payload.productId)
    ) || null
  )
}

function resolveRatesPushUrl(ctx: OtaAdapterContext): string | null {
  const fromConfig = String(ctx.config.ratesPushUrl || '').trim()
  if (fromConfig) return fromConfig
  const fromEnv = (process.env.OTA_VIATOR_RATES_URL || '').trim()
  return fromEnv || null
}

function buildOutboundBody(
  ctx: OtaAdapterContext,
  payload: PushRatesPayload,
  mapping: NonNullable<ReturnType<typeof findMapping>>
) {
  return {
    platform: 'viator' as const,
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
      currency: String(ctx.config.currency || 'USD'),
    },
    internal: {
      productId: payload.productId,
      ratePlanId: payload.ratePlanId,
      offerId: payload.offerId ?? null,
      channelId: payload.channelId,
      variantKey: payload.variantKey,
    },
  }
}

export function createViatorLiveAdapter(): OtaAdapter {
  const dryFallback = createDryRunAdapter('viator')

  return {
    platform: 'viator',
    supports(eventType: SyncEventType): boolean {
      return eventType === 'push_rates' || eventType === 'push_availability'
    },
    async pushRates(ctx: OtaAdapterContext, payload: PushRatesPayload): Promise<AdapterResult> {
      if (ctx.status === 'disabled') {
        return { ok: true, skipped: true, reason: 'connection_disabled' }
      }

      // Safety: only active connections use live path
      if (ctx.status !== 'active') {
        return dryFallback.pushRates(ctx, payload)
      }

      const mapping = findMapping(ctx, payload)
      if (!mapping) {
        return {
          ok: true,
          skipped: true,
          reason: 'no_external_mapping',
          externalRequest: { platform: 'viator', event: 'push_rates', payload },
        }
      }

      const creds = resolveOtaCredentialsFromRef(ctx.credentialsRef)
      if (!creds) {
        return {
          ok: false,
          reason: 'missing_credentials',
          externalRequest: {
            platform: 'viator',
            credentialsRef: ctx.credentialsRef || null,
            hint: 'Set credentials_ref to env:OTA_VIATOR_API_KEY (or similar) and provide the env var.',
          },
        }
      }

      const body = buildOutboundBody(ctx, payload, mapping)
      const simulate = ctx.config.simulate === true
      const url = resolveRatesPushUrl(ctx)

      if (!url && simulate) {
        return {
          ok: true,
          externalRequest: { ...body, mode: 'simulate' },
          externalResponse: {
            status: 'accepted_simulate',
            message: 'No ratesPushUrl; config.simulate=true — local accept without HTTP.',
          },
        }
      }

      if (!url) {
        return {
          ok: false,
          reason: 'missing_rates_url',
          externalRequest: {
            ...body,
            hint: 'Set channel_connections.config.ratesPushUrl or OTA_VIATOR_RATES_URL.',
          },
        }
      }

      const authHeaderName = String(ctx.config.authHeaderName || 'exp-api-key')
      const timeoutMs = Math.min(
        Math.max(Number(ctx.config.timeoutMs) || 15000, 3000),
        60000
      )

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            [authHeaderName]: creds.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        let responseBody: unknown = null
        const text = await res.text()
        try {
          responseBody = text ? JSON.parse(text) : null
        } catch {
          responseBody = { raw: text.slice(0, 2000) }
        }

        if (!res.ok) {
          return {
            ok: false,
            reason: `http_${res.status}`,
            externalRequest: { ...body, mode: 'live', url, authHeaderName },
            externalResponse: {
              status: res.status,
              body: responseBody,
            },
          }
        }

        return {
          ok: true,
          externalRequest: { ...body, mode: 'live', url, authHeaderName },
          externalResponse: {
            status: res.status,
            body: responseBody,
          },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'fetch_failed'
        return {
          ok: false,
          reason: message.includes('abort') ? 'timeout' : message,
          externalRequest: { ...body, mode: 'live', url },
        }
      } finally {
        clearTimeout(timer)
      }
    },
    async pushAvailability(
      ctx: OtaAdapterContext,
      payload: Record<string, unknown>
    ): Promise<AdapterResult> {
      if (ctx.status !== 'active') {
        return dryFallback.pushAvailability?.(ctx, payload) || {
          ok: true,
          dryRun: true,
          externalRequest: payload,
        }
      }
      // Phase 4c focuses on push_rates; availability uses dry-run shape until endpoint exists
      return {
        ok: true,
        skipped: true,
        reason: 'push_availability_not_wired',
        externalRequest: { platform: 'viator', event: 'push_availability', payload },
      }
    },
  }
}
