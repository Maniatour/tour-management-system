/**
 * 이메일 예약 가져오기: 픽업 호텔을 특정하지 못했을 때 extracted_data.pickup_hotel 에 넣는 표시문.
 * pickup_hotels 에 동일/유사 라벨 행이 있으면 matchPickupHotelId 로 UUID 가 붙는다.
 */
export const PICKUP_IMPORT_NOT_DECIDED_LABEL = '❗ Not Decided - '

/** 이 값이면 이미 "미정" 픽업으로 처리 중 — 재판정하지 않음 */
export function isPickupImportNotDecidedLabel(text: string | null | undefined): boolean {
  const t = (text ?? '').trim().toLowerCase()
  if (!t) return false
  return t.includes('not decided') || t.startsWith('❗')
}

/**
 * 이메일에서 나온 픽업 문자열이 비어 있거나, 플레이스홀더·너무 일반적이어서 DB 매칭하면 오탐하기 쉬운 경우.
 */
export function isPickupHotelImportTextUnusable(text: string | null | undefined): boolean {
  if (isPickupImportNotDecidedLabel(text)) return false
  const q = (text ?? '').trim()
  if (!q) return true
  if (/^(tbd|n\/a|n\/?a|none|null|unknown|pending|[-—…]+)$/i.test(q)) return true
  if (/please\s+(insert|confirm|enter|select|provide|advise)|not\s+yet\s*provided|pickup\s*tbc|to\s+be\s+confirmed|will\s+be\s+sent/i.test(q)) return true
  if (q.length < 8 && !/\d/.test(q)) return true
  const letters = q.replace(/[^a-z\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (
    /^(las vegas|las vegas nv|nevada|nv usa|downtown lv|the strip|strip hotel|airport only|near airport)$/i.test(
      letters
    )
  ) {
    return true
  }
  return false
}
