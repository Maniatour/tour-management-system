/**
 * 플랫폼 키(이메일 추출) → channels.id 매핑.
 * 관리자 설정으로 확장 가능; 여기서는 기본 매핑만 제공.
 */
export const PLATFORM_CHANNEL_MAP: Record<string, string> = {
  viator: 'viator',
  getyourguide: 'getyourguide',
  tripadvisor: 'tripadvisor',
  klook: 'klook',
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
