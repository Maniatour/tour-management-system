export type RentalVehicleTypeOption = {
  name: string
  passenger_capacity?: number | null
  brand?: string | null
  model?: string | null
}

function normalizeTypeKey(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/인승/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHightopName(raw: string): boolean {
  return /high\s*top|hightop/.test(raw)
}

function looksLikeTransit15(raw: string): boolean {
  return (
    /15\s*passenger/.test(raw) ||
    /ford\s*transit/.test(raw) ||
    /transit\s*wagon/.test(raw) ||
    /15인승/.test(raw)
  )
}

/** Enterprise 기본 렌탈 차종: Ford Transit 15 passenger (Hightop 제외) */
export function preferredRentalTransitType(
  types: RentalVehicleTypeOption[],
): RentalVehicleTypeOption | null {
  if (!Array.isArray(types) || types.length === 0) return null
  const transit15 = types.filter((type) => {
    const name = normalizeTypeKey(type.name)
    return /transit/.test(name) && /15/.test(name) && !isHightopName(name)
  })
  return (
    transit15.find((type) => /passenger/.test(normalizeTypeKey(type.name))) ||
    transit15[0] ||
    null
  )
}

/** 확인서 차종(15 Passenger Van, Ford Transit Wagon) → 등록 차종 Ford Transit 15 passenger */
export function matchRentalVehicleType(
  extracted: string | null | undefined,
  types: RentalVehicleTypeOption[],
): RentalVehicleTypeOption | null {
  if (!Array.isArray(types) || types.length === 0) return null
  const raw = normalizeTypeKey(String(extracted || ''))
  const extractedHightop = isHightopName(raw)
  const transit15 = looksLikeTransit15(raw) || looksLikeTransit15(String(extracted || '').toLowerCase())

  const scored = types
    .map((type) => {
      const name = normalizeTypeKey(type.name)
      const brandModel = normalizeTypeKey(`${type.brand || ''} ${type.model || ''}`)
      let score = 0
      if (raw && (name === raw || name.includes(raw) || raw.includes(name))) score += 60
      if (raw && brandModel && (brandModel.includes(raw) || raw.includes(brandModel))) score += 30
      if (transit15 && /transit/.test(name) && /15/.test(name)) score += 120
      if (transit15 && /transit/.test(name)) score += 40
      if (transit15 && Number(type.passenger_capacity) === 12) score += 15
      if (/passenger/.test(name) && !isHightopName(name) && (/passenger|wagon/.test(raw) || transit15)) {
        score += 50
      }
      if (/^ford transit 15 passenger/.test(name) && !isHightopName(name)) score += 40
      if (isHightopName(name) && !extractedHightop) score -= 100
      if (extractedHightop && isHightopName(name)) score += 80
      return { type, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aHigh = isHightopName(a.type.name) ? 1 : 0
      const bHigh = isHightopName(b.type.name) ? 1 : 0
      return aHigh - bHigh
    })

  return scored[0]?.type ?? preferredRentalTransitType(types)
}
