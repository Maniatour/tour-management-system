import { otaPlatformLabel } from './compare'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import { channelIsOtaForPricingSection } from '@/utils/channelSettlement'
import { MARKET_OTA_PLATFORMS, type MarketCatalogChannel } from './types'

type KnownOta = Exclude<(typeof MARKET_OTA_PLATFORMS)[number], 'other'>

export const OTA_CHANNEL_ALIASES: Record<KnownOta, string[]> = {
  getyourguide: ['getyourguide', 'gyg', 'get your guide'],
  viator: ['viator'],
  klook: ['klook'],
  kkday: ['kkday', 'kk day'],
  tripadvisor: ['tripadvisor', 'trip advisor'],
  tripcom: ['trip.com', 'tripcom', 'ctrip'],
  myrealtrip: ['myrealtrip', 'my real trip', '마이리얼트립'],
  expedia: ['expedia'],
}

export type OtaChoice = {
  id: string
  label: string
  channelId: string | null
}

export type OtaSelectOption = {
  value: string
  label: string
  platform: string
}

function compactToken(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, '')
}

export function isCompanyOtaChannel(channel: {
  id?: string | null
  name?: string | null
  type?: string | null
  category?: string | null
  status?: string | null
}): boolean {
  const status = String(channel.status || '').trim().toLowerCase()
  if (status === 'inactive' || status === 'disabled' || status === 'archived') return false
  const type = String(channel.type || '').trim().toLowerCase()
  const category = String(channel.category || '').trim().toLowerCase()
  if (type === 'ota' || category === 'ota') return true
  if (
    category === 'own' ||
    category === 'partner' ||
    type === 'self' ||
    type === 'direct' ||
    type === 'partner' ||
    type === 'website' ||
    type === 'phone'
  ) {
    return false
  }
  return channelIsOtaForPricingSection(channel)
}

export function companyOtaChannels(channels: readonly MarketCatalogChannel[]): MarketCatalogChannel[] {
  return channels
    .filter((channel) => isCompanyOtaChannel(channel))
    .slice()
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'ko'))
}

/** 기존 시세 행과 맞추기 위해 알려진 OTA는 슬러그를, 그 외는 채널 id를 저장한다. */
export function storedPlatformForChannel(channel: { id: string; name: string | null }): string {
  const idToken = compactToken(channel.id)
  const nameToken = compactToken(channel.name || '')
  for (const platform of MARKET_OTA_PLATFORMS) {
    if (platform === 'other') continue
    const mapped = getChannelIdForPlatform(platform)
    if (mapped && mapped === channel.id) return platform
    const aliases = OTA_CHANNEL_ALIASES[platform].map(compactToken)
    if (aliases.includes(idToken)) return platform
    if (
      nameToken &&
      aliases.some((alias) => alias.length >= 3 && (nameToken === alias || nameToken.includes(alias)))
    ) {
      return platform
    }
  }
  return channel.id
}

export function channelForStoredPlatform(
  platform: string,
  channels: readonly MarketCatalogChannel[]
): MarketCatalogChannel | null {
  const pool = companyOtaChannels(channels)
  const list = pool.length > 0 ? pool : channels
  const exact = list.find((row) => row.id === platform)
  if (exact) return exact
  const matches = list.filter((row) => storedPlatformForChannel(row) === platform)
  const mappedId = getChannelIdForPlatform(platform)
  return matches.find((row) => row.id === mappedId) || matches[0] || null
}

export function labelForOta(
  platform: string,
  channels: readonly MarketCatalogChannel[],
  isKo: boolean
): string {
  const channel = channelForStoredPlatform(platform, channels)
  const name = channel?.name?.trim()
  if (name) return name
  return otaPlatformLabel(platform, isKo)
}

export function orderOtaKeys(platforms: readonly string[]): string[] {
  const unique = [...new Set(platforms.map((platform) => platform.trim()).filter(Boolean))]
  const known = MARKET_OTA_PLATFORMS.filter((platform) => unique.includes(platform))
  const rest = unique
    .filter((platform) => !(MARKET_OTA_PLATFORMS as readonly string[]).includes(platform))
    .sort((a, b) => a.localeCompare(b, 'en'))
  return [...known, ...rest]
}

export function otaPlatformRank(platform: string): number {
  const index = (MARKET_OTA_PLATFORMS as readonly string[]).indexOf(platform)
  return index < 0 ? MARKET_OTA_PLATFORMS.length : index
}

export function otaChoicesFromChannels(
  channels: readonly MarketCatalogChannel[],
  isKo: boolean
): OtaChoice[] {
  const registered = companyOtaChannels(channels)
  if (registered.length === 0) return []
  const seen = new Set<string>()
  const choices: OtaChoice[] = []
  for (const channel of registered) {
    const id = storedPlatformForChannel(channel)
    if (seen.has(id)) continue
    seen.add(id)
    choices.push({
      id,
      label: channel.name?.trim() || labelForOta(id, channels, isKo),
      channelId: channel.id,
    })
  }
  return choices
}

export function otaChoicesForBoard(
  channels: readonly MarketCatalogChannel[],
  listings: readonly { ota_platform: string }[],
  isKo: boolean
): OtaChoice[] {
  const choices = otaChoicesFromChannels(channels, isKo)
  const seen = new Set(choices.map((choice) => choice.id))
  for (const listing of listings) {
    if (!listing.ota_platform || seen.has(listing.ota_platform)) continue
    seen.add(listing.ota_platform)
    choices.push({
      id: listing.ota_platform,
      label: labelForOta(listing.ota_platform, channels, isKo),
      channelId: null,
    })
  }
  return choices
}

export function otaSelectOptions(
  channels: readonly MarketCatalogChannel[],
  currentPlatform: string,
  isKo: boolean
): OtaSelectOption[] {
  const registered = companyOtaChannels(channels)
  if (registered.length === 0) {
    if (!currentPlatform) return []
    return [
      {
        value: `__legacy:${currentPlatform}`,
        label: otaPlatformLabel(currentPlatform, isKo),
        platform: currentPlatform,
      },
    ]
  }
  const options = registered.map((channel) => ({
    value: channel.id,
    label: channel.name?.trim() || channel.id,
    platform: storedPlatformForChannel(channel),
  }))
  if (
    currentPlatform &&
    !options.some((option) => option.platform === currentPlatform || option.value === currentPlatform)
  ) {
    options.unshift({
      value: `__legacy:${currentPlatform}`,
      label: otaPlatformLabel(currentPlatform, isKo),
      platform: currentPlatform,
    })
  }
  return options
}

export function initialOtaPlatform(
  listingPlatform: string | null | undefined,
  preferred: string | null | undefined,
  channels: readonly MarketCatalogChannel[]
): string {
  if (listingPlatform) return listingPlatform
  if (preferred) return preferred
  const registered = companyOtaChannels(channels)
  if (registered[0]) return storedPlatformForChannel(registered[0])
  return 'viator'
}
