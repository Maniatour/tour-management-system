/**
 * 영수증 OCR 원문 정리·2-pass 병합 (품질 낮은 줄·중복 블록 제거)
 */

const RECEIPT_KEYWORD =
  /\b(total|fuel|regular|pump|invoice|auth|credit|price|gal|amount|express|visa|mastercard|amex|approved|sequence|customer)\b/i

const JUNK_CHAR = /[©®¢§{}|\\<>«»""''`~]/

/** 금액·주유 등 핵심 필드가 1차 OCR에 잡혔는지 */
export function receiptOcrHasCoreFields(text: string): boolean {
  const t = text.toLowerCase()
  return (
    (/(fuel\s+total|total\s*=)/.test(t) || /credit/.test(t)) &&
    /\$\s*\d+\.\d{2}/.test(text) &&
    (/pump\s*#/.test(t) || /regular/.test(t) || /price\s*\/?\s*gal/.test(t))
  )
}

function fixOcrDateInLine(s: string): string {
  return s.replace(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g, (match, a, b, y) => {
    let month = Number.parseInt(a, 10)
    let day = Number.parseInt(b, 10)
    const year = Number.parseInt(y, 10)
    if (month > 12 && day <= 12) {
      ;[month, day] = [day, month]
    }
    if (month > 12) {
      const ms = String(month).padStart(2, '0')
      month = Number.parseInt(ms.replace(/^8/, '0').replace(/^9/, '0'), 10)
    }
    if (day > 31) {
      const ds = String(day).padStart(2, '0')
      day = Number.parseInt(ds.replace(/^8/, '0').replace(/^9/, '0'), 10)
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
    }
    return match
  })
}

function normalizeLineForCompare(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9$./#*=+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lineSimilarity(a: string, b: string): number {
  const na = normalizeLineForCompare(a)
  const nb = normalizeLineForCompare(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  const tokensA = na.split(' ').filter(Boolean)
  const tokensB = new Set(nb.split(' ').filter(Boolean))
  if (tokensA.length === 0 || tokensB.size === 0) return 0
  let match = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) match += 1
  }
  return match / Math.max(tokensA.length, tokensB.size)
}

/** 줄 품질 점수 — 높을수록 영수증 본문에 가깝다 */
export function scoreReceiptOcrLine(line: string): number {
  const clean = line.trim()
  if (!clean) return -999
  if (clean.length < 2) return -999

  let score = 0
  const alnum = (clean.match(/[a-zA-Z0-9$]/g) || []).length
  const ratio = alnum / clean.length
  if (ratio < 0.3) return -100
  score += ratio * 40

  const words = clean.split(/\s+/).filter(Boolean)
  const singleCharWords = words.filter((w) => w.length === 1).length
  if (words.length >= 3 && singleCharWords / words.length > 0.45) score -= 30

  if (JUNK_CHAR.test(clean)) score -= 25
  if (/^[^\w$]{3,}$/.test(clean)) score -= 40
  if (/\$?\s*\d+\.\d{2}\b/.test(clean)) score += 22
  if (RECEIPT_KEYWORD.test(clean)) score += 18
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(clean)) score += 16
  if (/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/i.test(clean)) score += 12
  if (/\bpump\s*#\s*\d+/i.test(clean)) score += 14
  if (/\b\d{5}\b/.test(clean) && /page|az|zip/i.test(clean)) score += 8
  if (/^[A-Z0-9*X]{6,}\d{4}$/i.test(clean.replace(/\s/g, ''))) score += 10
  if (clean.length > 72 && !RECEIPT_KEYWORD.test(clean) && !/\$/.test(clean)) score -= 15

  return score
}

/** 흔한 OCR 오타·공백 깨짐 보정 */
export function cleanupReceiptOcrLine(line: string): string {
  let s = line.trim()
  if (!s) return s

  s = s.replace(/§(\d)/g, '0$1')
  s = s.replace(/[©®¢]/g, '')
  s = s.replace(/\$(\s+)(\d)/g, '$$$2')
  s = s.replace(/(\d)\s+\.\s+(\d{2})\b/g, '$1.$2')
  s = s.replace(/PRICE\s+\/\s*GAL/gi, 'PRICE/GAL')
  s = s.replace(/\s+,/g, ',')
  s = s.replace(/,\s+/g, ', ')
  s = s.replace(/\s{2,}/g, ' ')

  s = fixOcrDateInLine(s)

  // 마스킹된 카드번호: K/H/N/O 등 → X
  s = s.replace(/\b([A-Z*KXHNUOIl|]{4,})[*X]*(\d{4})\b/gi, (_m, mask: string, last4: string) => {
    const xCount = Math.max(4, mask.replace(/[^A-Z*KX]/gi, '').length)
    return `${'X'.repeat(Math.min(xCount, 12))}${last4}`
  })

  // LAKE POWELL TRAVEL p → P
  s = s.replace(/\bTRAVEL\s+p\b/i, 'TRAVEL P')

  return s.trim()
}

function dedupeSimilarLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const cl = cleanupReceiptOcrLine(line)
    const sc = scoreReceiptOcrLine(cl)
    if (sc < 5) continue

    let merged = false
    for (let i = 0; i < out.length; i++) {
      if (lineSimilarity(out[i], cl) < 0.55) continue
      const existingScore = scoreReceiptOcrLine(out[i])
      if (sc > existingScore) out[i] = cl
      merged = true
      break
    }
    if (!merged) out.push(cl)
  }
  return out
}

/** 2-pass OCR: primary(정규화) 순서 유지, 유사 줄은 더 높은 점수만 채택 */
export function mergeReceiptOcrTextsSmart(primary: string, secondary: string): string {
  const primaryLines = primary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const secondaryLines = secondary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const picked: string[] = []
  const usedSecondary = new Set<number>()

  for (const pl of primaryLines) {
    let best = cleanupReceiptOcrLine(pl)
    let bestScore = scoreReceiptOcrLine(best)

    for (let i = 0; i < secondaryLines.length; i++) {
      if (lineSimilarity(pl, secondaryLines[i]) < 0.5) continue
      usedSecondary.add(i)
      const cand = cleanupReceiptOcrLine(secondaryLines[i])
      const sc = scoreReceiptOcrLine(cand)
      if (sc > bestScore) {
        best = cand
        bestScore = sc
      }
    }

    if (bestScore >= 8) picked.push(best)
  }

  for (let i = 0; i < secondaryLines.length; i++) {
    if (usedSecondary.has(i)) continue
    const cl = cleanupReceiptOcrLine(secondaryLines[i])
    if (scoreReceiptOcrLine(cl) < 18) continue
    if (picked.some((p) => lineSimilarity(p, cl) >= 0.5)) continue
    picked.push(cl)
  }

  return `${dedupeSimilarLines(picked).join('\n')}\n`
}

export function finalizeReceiptOcrText(text: string): string {
  let lines = text
    .split(/\r?\n/)
    .map(cleanupReceiptOcrLine)
    .filter((l) => scoreReceiptOcrLine(l) >= 8)
  lines = dedupeSimilarLines(lines)

  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const sc = scoreReceiptOcrLine(line)
    if (
      sc >= 24 ||
      /\b[A-Z]{2,}\s+[A-Z]{2,}/.test(line) ||
      /\b(travel|plaza|invoice|pump|fuel|express)\b/i.test(line)
    ) {
      start = Math.max(0, i - 1)
      break
    }
  }
  if (start > 0) lines = lines.slice(start)

  return `${lines.join('\n')}\n`
}
