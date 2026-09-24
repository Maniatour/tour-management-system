/** 새 사이트(kovegas.com) 직접 예약 채널. 가격표도 이 채널에 있다. */
export const NEW_SITE_HOMEPAGE_CHANNEL_ID = 'M00001'

/** 기존 Wix 홈페이지에서 들어온 예약 채널. */
export const WIX_HOMEPAGE_CHANNEL_ID = 'M000WIX'

export function isWixHomepageChannelName(name: string | null | undefined): boolean {
  return /wix/i.test(String(name ?? ''))
}

/** Wix 채널로 저장된 예약의 가격·초이스는 새 사이트와 같은 M00001 가격표를 본다. */
export function directWebPricingChannelId(channelId: string | null | undefined): string {
  const id = String(channelId ?? '').trim()
  if (id === WIX_HOMEPAGE_CHANNEL_ID) return NEW_SITE_HOMEPAGE_CHANNEL_ID
  return id
}

/**
 * 플랫폼 키(이메일 추출) → channels.id 매핑.
 * 관리자 설정으로 확장 가능; 여기서는 기본 매핑만 제공.
 */
export const PLATFORM_CHANNEL_MAP: Record<string, string> = {
  viator: 'viator',
  getyourguide: 'getyourguide',
  /** Trip.com (Ctrip) — channels.id */
  tripcom: 'fe2b29b3',
  tripadvisor: 'tripadvisor',
  klook: 'klook',
  kkday: 'kkday',
  /** 기존 Wix 홈페이지 예약 — channels.id Homepage (Wix). 가격표는 M00001을 그대로 본다. */
  maniatour: WIX_HOMEPAGE_CHANNEL_ID,
  /** 타이드스퀘어 OTA — channels.id 가 다르면 관리자에서 매핑 조정 */
  tidesquare: 'tidesquare',
  myrealtrip: 'myrealtrip',
  booking: 'booking',
  expedia: 'expedia',
  airbnb: 'airbnb',
  /** NOL 투어 파트너센터(트리플) — channels.name "NOL (트리플)" */
  nol: '78b08b30-3047-4866-ba93-c1124d31b065',
}

/**
 * platform_key에 해당하는 channel_id를 반환.
 * channels 테이블의 id가 플랫폼 키와 동일한 경우 사용.
 * 매칭 실패 시 null (호출자가 채널 직접 선택 필요).
 */
export function getChannelIdForPlatform(platformKey: string | null): string | null {
  if (!platformKey) return null
  return PLATFORM_CHANNEL_MAP[platformKey.toLowerCase()] ?? null
}

/** channels.name 이 "NOL (트리플)" 인지 (예약 가져오기 채널 자동 선택) */
export function isNolTripleChannelName(name: string | null | undefined): boolean {
  const n = (name || '').trim()
  if (!n) return false
  return /NOL\s*\(\s*트리플\s*\)/i.test(n) || (/NOL/i.test(n) && /트리플/.test(n))
}

/** channels.name 이 마이리얼트립인지 (My Real Trip / myrealtrip / 마이리얼트립) */
export function isMyrealtripChannelName(name: string | null | undefined): boolean {
  const n = (name || '').trim()
  if (!n) return false
  if (/마이\s*리얼\s*트립/.test(n) || /마이리얼트립/.test(n)) return true
  const compact = n.toLowerCase().replace(/[\s\-_.]+/g, '')
  return compact.includes('myrealtrip')
}
