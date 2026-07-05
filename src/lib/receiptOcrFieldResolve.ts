/** OCR 후보 → expense_categories / expense_vendors 정규화 이름 매칭 (클라이언트·서버 공용) */

export type ExpenseVendorMatchEntry = {
  name: string
  aliases?: string[]
}

export function vendorEntriesForOcrMatch(
  vendors: Array<{ name: string; match_aliases?: string[] | null }>
): ExpenseVendorMatchEntry[] {
  return vendors
    .map((v) => {
      const name = String(v.name ?? '').trim()
      if (!name) return null
      const aliases = (v.match_aliases ?? [])
        .map((a) => String(a ?? '').trim())
        .filter(Boolean)
      return { name, aliases: aliases.length > 0 ? aliases : undefined }
    })
    .filter(Boolean) as ExpenseVendorMatchEntry[]
}

export function normalizeReceiptMatchText(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function findExactNameMatch(raw: string, names: string[]): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (names.includes(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  const ci = names.find((name) => name.toLowerCase() === lower)
  return ci ?? null
}

function findNormalizedNameMatch(raw: string, names: string[]): string | null {
  const normRaw = normalizeReceiptMatchText(raw)
  if (normRaw.length < 2) return null
  for (const name of names) {
    if (normalizeReceiptMatchText(name) === normRaw) return name
  }
  return null
}

/** OCR 분류 후보 → expense_categories.name (정확·대소문자·정규화 일치) */
export function resolvePaidForFromOcrCandidate(raw: string, categoryNames: string[]): string | null {
  const trimmed = raw.trim()
  if (!trimmed || categoryNames.length === 0) return null
  return (
    findExactNameMatch(trimmed, categoryNames) ??
    findNormalizedNameMatch(trimmed, categoryNames)
  )
}

type VendorMatchScore = { name: string; score: number }

function scoreVendorMatch(ocrNorm: string, vendorName: string): VendorMatchScore | null {
  const vendorNorm = normalizeReceiptMatchText(vendorName)
  if (vendorNorm.length < 2 || ocrNorm.length < 2) return null

  if (ocrNorm === vendorNorm) return { name: vendorName, score: 1000 + vendorNorm.length }

  if (ocrNorm.includes(vendorNorm)) {
    return { name: vendorName, score: 800 + vendorNorm.length * 2 }
  }
  if (vendorNorm.includes(ocrNorm)) {
    return { name: vendorName, score: 600 + ocrNorm.length * 2 }
  }

  const ocrTokens = ocrNorm.split(' ').filter((t) => t.length >= 3)
  const vendorTokens = vendorNorm.split(' ').filter((t) => t.length >= 3)
  if (ocrTokens.length === 0 || vendorTokens.length === 0) return null

  let matched = 0
  for (const vt of vendorTokens) {
    if (ocrTokens.some((ot) => ot === vt || ot.startsWith(vt) || vt.startsWith(ot))) matched += 1
  }
  if (matched === 0) return null

  const ratio = matched / vendorTokens.length
  if (ratio < 0.5) return null
  return { name: vendorName, score: 400 + Math.round(ratio * 100) + matched * 10 }
}
export function resolvePaidToFromOcrCandidate(
  raw: string,
  vendors: ExpenseVendorMatchEntry[] | string[]
): string | null {
  const trimmed = raw.trim()
  if (!trimmed || vendors.length === 0) return null

  const entries: ExpenseVendorMatchEntry[] =
    typeof vendors[0] === 'string'
      ? (vendors as string[]).map((name) => ({ name }))
      : (vendors as ExpenseVendorMatchEntry[])

  const names = entries.map((v) => v.name)
  const exact = findExactNameMatch(trimmed, names)
  if (exact) return exact

  const normalized = findNormalizedNameMatch(trimmed, names)
  if (normalized) return normalized

  const ocrNorm = normalizeReceiptMatchText(trimmed)
  if (ocrNorm.length < 3) return null

  let best: VendorMatchScore | null = null
  for (const entry of entries) {
    const candidates = [entry.name, ...(entry.aliases ?? [])]
    for (const candidate of candidates) {
      const scored = scoreVendorMatch(ocrNorm, candidate)
      if (!scored) continue
      const canonical = { name: entry.name, score: scored.score }
      if (!best || canonical.score > best.score) best = canonical
    }
  }
  return best?.name ?? null
}
