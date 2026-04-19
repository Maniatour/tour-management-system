/**
 * 명세 라인 설명 표시용 — raw CSV 파이프/키값 나열에서 사람이 읽을 한 줄만 추출
 */
export function formatStatementLineDescription(
  raw: string | null | undefined,
  merchant: string | null | undefined
): string {
  if (merchant?.trim()) return merchant.trim()
  if (!raw?.trim()) return '—'
  const s = raw.trim()

  const tailAfterDescriptions = s.match(/descriptions?\s*:\s*(.+)$/i)
  if (tailAfterDescriptions?.[1]) return tailAfterDescriptions[1].trim()

  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim())
    for (const p of parts) {
      const m = p.match(/^descriptions?\s*:\s*(.+)$/i)
      if (m?.[1]) return m[1].trim()
    }
    const last = parts[parts.length - 1]
    if (last && !/^date\s*:/i.test(last) && !/^amount\s*:/i.test(last)) return last
  }

  return s
}
