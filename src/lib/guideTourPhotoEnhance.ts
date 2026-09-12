export type TourPhotoEnhanceStats = {
  meanLuma: number
  meanR: number
  meanG: number
  meanB: number
  pLow: number
  pHigh: number
  isWarm: boolean
  isDark: boolean
}

const SAMPLE_STEP = 4

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = Math.max(1, total * p)
  let acc = 0
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i]
    if (acc >= target) return i
  }
  return 255
}

export function analyzeTourPhotoPixels(data: Uint8ClampedArray): TourPhotoEnhanceStats {
  const hist = new Uint32Array(256)
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumLuma = 0
  let count = 0

  for (let i = 0; i < data.length; i += SAMPLE_STEP * 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    hist[luma] += 1
    sumR += r
    sumG += g
    sumB += b
    sumLuma += luma
    count += 1
  }

  const meanR = count ? sumR / count : 0
  const meanG = count ? sumG / count : 0
  const meanB = count ? sumB / count : 0
  const meanLuma = count ? sumLuma / count : 0
  const pLow = percentile(hist, count, 0.012)
  const pHigh = percentile(hist, count, 0.988)

  return {
    meanLuma,
    meanR,
    meanG,
    meanB,
    pLow,
    pHigh,
    isWarm: meanR > meanB * 1.18 && meanR > meanG * 1.04,
    isDark: meanLuma < 72 && pHigh < 168,
  }
}

export function whiteBalanceGains(stats: TourPhotoEnhanceStats): { r: number; g: number; b: number } {
  if (stats.isWarm) return { r: 1, g: 1, b: 1 }
  const gray = (stats.meanR + stats.meanG + stats.meanB) / 3
  if (gray < 8) return { r: 1, g: 1, b: 1 }
  const clamp = (value: number) => Math.min(1.12, Math.max(0.9, value))
  return {
    r: clamp(gray / Math.max(stats.meanR, 1)),
    g: clamp(gray / Math.max(stats.meanG, 1)),
    b: clamp(gray / Math.max(stats.meanB, 1)),
  }
}

export function buildLumaLut(stats: TourPhotoEnhanceStats): Uint8Array {
  const lut = new Uint8Array(256)
  const span = stats.pHigh - stats.pLow
  if (span < 40) {
    const gamma = stats.isDark ? 0.88 : 1
    for (let i = 0; i < 256; i += 1) {
      lut[i] = clampByte(Math.pow(i / 255, gamma) * 255)
    }
    return lut
  }

  const maxStretch = stats.isDark ? 1.12 : 1.28
  const gamma = stats.isDark ? 0.9 : stats.meanLuma > 178 ? 1.02 : 0.95
  const stretch = Math.min(maxStretch, 255 / Math.max(24, span))
  for (let i = 0; i < 256; i += 1) {
    const n = Math.min(1, Math.max(0, ((i - stats.pLow) * stretch) / 255))
    lut[i] = clampByte(Math.pow(n, gamma) * 255)
  }
  return lut
}

function applyVibrance(r: number, g: number, b: number, amount: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const sat = max < 1 ? 0 : (max - min) / max
  const amp = amount * (1 - sat)
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return [luma + (r - luma) * (1 + amp), luma + (g - luma) * (1 + amp), luma + (b - luma) * (1 + amp)]
}

/** 투어 경관 사진용 자동 보정. 과한 필터 대신 밝기·대비·색만 살짝 살린다. */
export function enhanceTourPhotoPixels(data: Uint8ClampedArray): TourPhotoEnhanceStats {
  const stats = analyzeTourPhotoPixels(data)
  const lut = buildLumaLut(stats)
  const gains = whiteBalanceGains(stats)
  const vibrance = stats.isDark ? 0.08 : 0.15

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * gains.r
    let g = data[i + 1] * gains.g
    let b = data[i + 2] * gains.b
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    const mapped = lut[Math.max(0, Math.min(255, Math.round(luma)))]
    const scale = luma > 1 ? mapped / luma : mapped / 255
    r *= scale
    g *= scale
    b *= scale
    ;[r, g, b] = applyVibrance(r, g, b, vibrance)
    data[i] = clampByte(r)
    data[i + 1] = clampByte(g)
    data[i + 2] = clampByte(b)
  }

  return stats
}
