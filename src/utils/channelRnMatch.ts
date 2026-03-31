/**
 * 채널 RN 표기 차이로 동일 예약을 찾기 위한 변형 목록.
 * - Viator: `BR-1376645191` vs `1376645191`
 * - 대소문자만 다른 코드(DB/파서·이메일 불일치)
 */
export function expandChannelRnMatchVariants(rn: string): string[] {
  const t = rn.trim()
  if (!t) return []
  const out = new Set<string>([t])
  const br = /^BR-(\d+)$/i.exec(t)
  if (br) out.add(br[1])
  if (/^\d+$/.test(t) && t.length >= 5) out.add(`BR-${t}`)
  if (/^[A-Za-z0-9_-]+$/.test(t)) {
    out.add(t.toUpperCase())
    out.add(t.toLowerCase())
  }
  return [...out]
}
