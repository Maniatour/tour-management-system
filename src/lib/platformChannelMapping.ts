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
  /** 자사 Wix 홈페이지 예약 — channels 테이블의 Homepage 채널 id */
  maniatour: 'M00001',
  /** 타이드스퀘어 OTA — channels.id 가 다르면 관리자에서 매핑 조정 */
  tidesquare: 'tidesquare',
  myrealtrip: 'myrealtrip',
  booking: 'booking',
  expedia: 'expedia',
  airbnb: 'airbnb',
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
