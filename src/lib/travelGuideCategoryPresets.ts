export type TravelGuideCategoryPreset = {
  en: string
  ko: string
}

export const TRAVEL_GUIDE_CATEGORY_PRESETS: TravelGuideCategoryPreset[] = [
  { en: 'Travel Tips', ko: '여행 팁' },
  { en: 'Destination Guides', ko: '목적지 가이드' },
  { en: 'Packing & Planning', ko: '준비 & 짐싸기' },
  { en: 'Las Vegas', ko: '라스베가스' },
  { en: 'Grand Canyon', ko: '그랜드캐년' },
  { en: 'Antelope Canyon', ko: '앤텔로프 캐년' },
  { en: 'Zion & Bryce', ko: 'Zion & Bryce' },
  { en: 'Southwest Road Trips', ko: 'Southwest 로드트립' },
]

export function buildTravelGuideCategoryOptions(
  presets: TravelGuideCategoryPreset[],
  articles: Array<{ category_en?: string; category_ko?: string }>
): { en: string[]; ko: string[] } {
  const enSet = new Set<string>()
  const koSet = new Set<string>()

  for (const preset of presets) {
    if (preset.en.trim()) enSet.add(preset.en.trim())
    if (preset.ko.trim()) koSet.add(preset.ko.trim())
  }

  for (const article of articles) {
    const en = article.category_en?.trim()
    const ko = article.category_ko?.trim()
    if (en) enSet.add(en)
    if (ko) koSet.add(ko)
  }

  return {
    en: Array.from(enSet).sort((a, b) => a.localeCompare(b, 'en')),
    ko: Array.from(koSet).sort((a, b) => a.localeCompare(b, 'ko')),
  }
}

export function findTravelGuideCategoryPreset(
  categoryEn: string,
  categoryKo: string
): TravelGuideCategoryPreset | undefined {
  const en = categoryEn.trim()
  const ko = categoryKo.trim()
  return TRAVEL_GUIDE_CATEGORY_PRESETS.find((preset) => preset.en === en && preset.ko === ko)
}
