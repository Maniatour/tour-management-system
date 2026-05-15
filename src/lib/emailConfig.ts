/** 예약·픽업·거주 안내 등 고객 발송 메일 운영 CC */
export const OPERATIONS_CC_EMAIL = 'vegasmaniatour@gmail.com'

/** 수신자가 CC 주소와 같으면 중복 CC를 넣지 않음 */
export function getOperationsCc(to: string | string[]): string[] | undefined {
  const recipients = (Array.isArray(to) ? to : [to]).map((e) => e.trim().toLowerCase())
  if (recipients.includes(OPERATIONS_CC_EMAIL.toLowerCase())) {
    return undefined
  }
  return [OPERATIONS_CC_EMAIL]
}
