import { KOVEgAS_DIRECT_CHANNEL_ID } from '@/lib/operators/resolvePublicDirectChannel'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

export type PublicDirectChannelClient = {
  operatorId: string
  channelId: string
}

let cached: PublicDirectChannelClient | null = null
let inflight: Promise<PublicDirectChannelClient> | null = null

/**
 * Client-side: resolve Direct Web channel for the current host operator.
 * Falls back to Kovegas M00001 if the API is unavailable.
 */
export async function fetchPublicDirectChannelBrowser(): Promise<PublicDirectChannelClient> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetch('/api/public/direct-channel', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error(`direct-channel ${res.status}`)
      }
      const json = (await res.json()) as {
        operatorId?: string
        channelId?: string
      }
      const channelId = String(json.channelId || '').trim()
      const operatorId = String(json.operatorId || '').trim()
      if (!channelId || !operatorId) {
        throw new Error('direct-channel missing fields')
      }
      cached = { operatorId, channelId }
      return cached
    } catch (err) {
      console.warn('[fetchPublicDirectChannelBrowser] fallback M00001', err)
      cached = {
        operatorId: KOVEgAS_OPERATOR_ID,
        channelId: KOVEgAS_DIRECT_CHANNEL_ID,
      }
      return cached
    } finally {
      inflight = null
    }
  })()

  return inflight
}
