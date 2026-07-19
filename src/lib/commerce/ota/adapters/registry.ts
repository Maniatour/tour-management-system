import { createDryRunAdapter } from '@/lib/commerce/ota/adapters/dryRunAdapter'
import { createViatorLiveAdapter } from '@/lib/commerce/ota/adapters/viatorLiveAdapter'
import type { OtaAdapter } from '@/lib/commerce/ota/adapters/types'
import type { ChannelConnectionStatus, OtaPlatform } from '@/lib/commerce/ota/types'
import { isCommerceV2OtaLiveEnabled } from '@/lib/commerce/commerceV2Flags'

/**
 * Resolve adapter for a platform + connection status.
 * Live HTTP only when status=active AND COMMERCE_V2_OTA_LIVE=1.
 * Otherwise dry-run (Phase 4a default).
 */
export function getOtaAdapter(
  platform: OtaPlatform,
  opts?: {
    connectionStatus?: ChannelConnectionStatus
    liveEnabled?: boolean
  }
): OtaAdapter {
  const live =
    opts?.liveEnabled !== undefined
      ? opts.liveEnabled
      : isCommerceV2OtaLiveEnabled()
  const status = opts?.connectionStatus || 'dry_run'

  if (live && status === 'active' && platform === 'viator') {
    return createViatorLiveAdapter()
  }

  return createDryRunAdapter(platform)
}
