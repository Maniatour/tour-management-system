/** 검색어에서 금액 비교용 숫자 문자열 추출 ($, 콤마, 공백 제거) */
export function normalizeAmountSearchQuery(raw: string): string {
  return raw.trim().replace(/[$,\s]/g, '')
}

/** 금액 검색어인지 (숫자·소수·음수) */
export function isAmountSearchQuery(raw: string): boolean {
  const q = normalizeAmountSearchQuery(raw)
  return q.length > 0 && /^-?\d+(\.\d+)?$/.test(q)
}

/**
 * 금액 검색: 숫자·소수 포함 문자열 일치 또는 동일 금액(±0.005)
 * — 투어/예약/입금·지출 탭 검색 공통
 */
export function matchesAmountSearch(amount: number | null | undefined, searchRaw: string): boolean {
  const q = normalizeAmountSearchQuery(searchRaw)
  if (!q || !/^-?\d+(\.\d+)?$/.test(q)) return false
  if (amount == null || !Number.isFinite(amount)) return false

  const absAmt = Math.abs(amount)
  const amountStrings = new Set(
    [String(amount), String(absAmt), amount.toFixed(2), absAmt.toFixed(2)].map((s) =>
      s.replace(/,/g, '')
    )
  )
  for (const s of amountStrings) {
    if (s.includes(q)) return true
  }

  const qNum = Number(q)
  return Number.isFinite(qNum) && Math.abs(absAmt - Math.abs(qNum)) < 0.005
}

/** 입금(payment_records): USD·KRW 모두 검색 */
export function matchesPaymentRecordAmountSearch(
  amount: number | null | undefined,
  amountKrw: number | null | undefined,
  searchRaw: string
): boolean {
  return (
    matchesAmountSearch(amount, searchRaw) || matchesAmountSearch(amountKrw, searchRaw)
  )
}
