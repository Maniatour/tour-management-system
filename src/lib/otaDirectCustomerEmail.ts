/**
 * OTA가 제공하는 임시 이메일, 또는 고객 이메일을 알 수 없는 채널은
 * 취소 안내 메일을 직접 보내면 안 된다.
 */

function normalize(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

export function isViatorBookingChannel(
  channelId?: string | null,
  channelName?: string | null
): boolean {
  const blob = `${normalize(channelId)} ${normalize(channelName)}`
  return /viator|비아터/.test(blob)
}

/** GetYourGuide 플랫폼 중계 주소 — 실제 고객 수신함이 아님 */
export function isGetYourGuideReplyEmail(email?: string | null): boolean {
  return normalize(email).endsWith('@reply.getyourguide.com')
}

/**
 * 취소 안내 이메일 미리보기·발송을 막아야 하는 경우:
 * - 이메일이 @reply.getyourguide.com 으로 끝남
 * - Viator 채널 (고객 이메일을 알 수 없음)
 */
export function shouldSkipDirectCancellationFollowUpEmail(input: {
  email?: string | null
  channelId?: string | null
  channelName?: string | null
}): boolean {
  if (isGetYourGuideReplyEmail(input.email)) return true
  if (isViatorBookingChannel(input.channelId, input.channelName)) return true
  return false
}
