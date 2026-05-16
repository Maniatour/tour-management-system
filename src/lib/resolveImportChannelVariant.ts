/**
 * DB·폼 간 variant_key 표기 차이 정규화 (all-inclusive vs all_inclusive 등)
 */
export function canonicalVariantKey(s: string | null | undefined): string | undefined {
  const raw = String(s ?? '').trim()
  if (!raw) return undefined
  const n = raw.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
  if (n === 'allinclusive' || n === 'all_inclusive') return 'all_inclusive'
  if (n === 'withexclusions' || n === 'with_exclusions') return 'with_exclusions'
  if (n === 'default') return 'default'
  return n
}

/**
 * 예약 가져오기: extracted_data의 channel_variant_key와 channel_variant_label 불일치 보정.
 * 라벨은 All Inclusive인데 키만 with_exclusions로 저장된 경우 등.
 */
export function resolveImportChannelVariantKey(
  key: string | null | undefined,
  label: string | null | undefined
): string | undefined {
  const kCanon = canonicalVariantKey(key) ?? String(key ?? '').trim()
  const labRaw = String(label ?? '').trim()
  const lab = labRaw.toLowerCase()

  if (!labRaw) return (canonicalVariantKey(key) ?? (String(key ?? '').trim() || undefined)) || undefined

  const labelSaysAll =
    lab.includes('all inclusive') ||
    lab.includes('all-inclusive') ||
    lab.includes('allinclusive') ||
    /올\s*인클루|전부\s*포함|올인클루시브/i.test(labRaw)
  const labelSaysWith =
    lab.includes('with exclusion') ||
    lab.includes('with-exclusion') ||
    lab.includes('withexclusions') ||
    (/불포함/.test(labRaw) && /exclusion|제외|위드/i.test(labRaw))

  if (labelSaysAll && !labelSaysWith && kCanon === 'with_exclusions') return 'all_inclusive'
  if (labelSaysWith && kCanon === 'all_inclusive') return 'with_exclusions'
  return kCanon || String(key ?? '').trim() || undefined
}

/**
 * 예약 가져오기 목록·상세: Klook variant 표기
 * All Inclusive → `Klook ✅`, With Exclusions → `Klook ➕`, 그 외·라벨만 있으면 `Klook - {라벨}`
 */
export function formatKlookReservationImportPlatformLabel(
  channelVariantLabel: string | null | undefined,
  channelVariantKey?: string | null | undefined
): string {
  const label = String(channelVariantLabel ?? '').trim()
  if (label) {
    const lower = label.toLowerCase()
    if (
      lower.includes('all inclusive') ||
      lower.includes('all-inclusive') ||
      /올\s*인클루|전부\s*포함|올인클루시브/i.test(label)
    ) {
      return 'Klook ✅'
    }
    if (
      lower.includes('with exclusions') ||
      lower.includes('with-exclusions') ||
      lower.includes('with exclusion')
    ) {
      return 'Klook ➕'
    }
    return `Klook - ${label}`
  }
  const canon =
    canonicalVariantKey(channelVariantKey) ??
    (channelVariantKey != null && String(channelVariantKey).trim() !== ''
      ? String(channelVariantKey)
          .trim()
          .toLowerCase()
          .replace(/-/g, '_')
      : '')
  if (canon === 'all_inclusive') return 'Klook ✅'
  if (canon === 'with_exclusions') return 'Klook ➕'
  return 'Klook'
}

/** channel_products 목록에서 폼 키와 동일한 variant 행이 있는지 (표기만 다른 경우 포함) */
export function channelProductsIncludeVariantKey(
  keys: string[],
  wanted: string | null | undefined
): string | undefined {
  const w = canonicalVariantKey(wanted)
  if (!w) return undefined
  for (const k of keys) {
    if (canonicalVariantKey(k) === w) return k
  }
  return undefined
}

export type ChannelProductVariantRow = {
  variant_key: string
  variant_name_ko?: string | null
  variant_name_en?: string | null
}

/**
 * 파서의 시맨틱 키(all_inclusive 등) 또는 라벨 → 실제 channel_products.variant_key (예: variant_1769229183270).
 * 동적가격·폼은 DB에 저장된 키 문자열과 일치해야 함.
 */
export function mapSemanticVariantToChannelProductKey(
  rows: ChannelProductVariantRow[],
  semanticKey: string | null | undefined,
  labelHint: string | null | undefined
): string | undefined {
  if (!rows.length) return undefined

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const nameBlob = (r: ChannelProductVariantRow) =>
    `${r.variant_name_ko || ''} ${r.variant_name_en || ''}`.toLowerCase()

  const hint = labelHint?.trim()
  if (hint) {
    const nh = norm(hint)
    for (const r of rows) {
      const ko = (r.variant_name_ko || '').trim()
      const en = (r.variant_name_en || '').trim()
      if (ko && norm(ko) === nh) return r.variant_key
      if (en && norm(en) === nh) return r.variant_key
    }
    for (const r of rows) {
      const blob = nameBlob(r)
      if (blob && nh.length >= 4 && blob.includes(nh)) return r.variant_key
    }
    if (/all\s*inclusive|all-inclusive|올\s*인클루|전부\s*포함|allinclusive/i.test(hint)) {
      const hit = rows.find((r) => /all\s*inclusive|all-inclusive|올\s*인클루|전부\s*포함/i.test(nameBlob(r)))
      if (hit) return hit.variant_key
    }
    if (/with\s*exclusion|withexclusions|불포함|제외/i.test(hint)) {
      const hit = rows.find(
        (r) =>
          /with\s*exclusion|withexclusions|불포함/i.test(nameBlob(r)) &&
          !/all\s*inclusive|올\s*인클루/i.test(nameBlob(r))
      )
      if (hit) return hit.variant_key
    }
  }

  const canon = canonicalVariantKey(semanticKey)
  if (canon === 'all_inclusive') {
    const hit = rows.find((r) =>
      /all\s*inclusive|all-inclusive|올\s*인클루|전부\s*포함|allinclusive/i.test(nameBlob(r))
    )
    if (hit) return hit.variant_key
  }
  if (canon === 'with_exclusions') {
    const hit = rows.find(
      (r) =>
        /with\s*exclusion|withexclusions|불포함|exclusions/i.test(nameBlob(r)) &&
        !/all\s*inclusive|올\s*인클루|전부\s*포함/i.test(nameBlob(r))
    )
    if (hit) return hit.variant_key
  }

  const sk = String(semanticKey ?? '').trim()
  if (sk && rows.some((r) => r.variant_key === sk)) return sk

  return undefined
}
