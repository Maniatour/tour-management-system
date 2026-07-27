import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { resolveReservationEmailLocale } from '@/lib/reservationEmailLocale'

export type SendDepartureEmailResult = {
  reservationId: string
  ok: boolean
  error?: string
}

/** 단일 예약 투어 출발 확정(voucher) 이메일 발송 */
export async function sendReservationDepartureEmail(input: {
  reservationId: string
  customerEmail: string
  customerLanguage?: string | null
  sentBy: string | null
  includePriceInfo?: boolean
}): Promise<void> {
  const locale = resolveReservationEmailLocale(input.customerLanguage ?? null, null)
  const response = await fetchApiWithAuth('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId: input.reservationId,
      email: input.customerEmail,
      type: 'voucher',
      locale,
      sentBy: input.sentBy,
      includePriceInfo: input.includePriceInfo !== false,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : '이메일 발송에 실패했습니다.')
  }
}

/** 여러 예약에 순차 발송 (실패 건은 결과 배열에 기록) */
export async function sendReservationDepartureEmailsBulk(input: {
  items: Array<{
    reservationId: string
    customerEmail: string | null | undefined
    customerLanguage?: string | null
  }>
  sentBy: string | null
  includePriceInfo?: boolean
}): Promise<SendDepartureEmailResult[]> {
  const results: SendDepartureEmailResult[] = []
  for (const item of input.items) {
    if (!item.customerEmail?.trim()) {
      results.push({
        reservationId: item.reservationId,
        ok: false,
        error: '고객 이메일 없음',
      })
      continue
    }
    try {
      await sendReservationDepartureEmail({
        reservationId: item.reservationId,
        customerEmail: item.customerEmail.trim(),
        ...(item.customerLanguage != null ? { customerLanguage: item.customerLanguage } : {}),
        sentBy: input.sentBy,
        ...(input.includePriceInfo !== undefined ? { includePriceInfo: input.includePriceInfo } : {}),
      })
      results.push({ reservationId: item.reservationId, ok: true })
    } catch (error) {
      results.push({
        reservationId: item.reservationId,
        ok: false,
        error: error instanceof Error ? error.message : '발송 실패',
      })
    }
  }
  return results
}
