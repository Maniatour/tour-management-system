/**
 * Home 「인기 목적지」 / 「나에게 맞는 여행 스타일」 ↔ product tags link catalog.
 * tag key is stored on products.tags and used as /products?tag={key}.
 */

export type HomeLinkTagDef = {
  /** Stable UI/group id */
  id: string
  /** products.tags + home tagQuery */
  key: string
  labelKo: string
  labelEn: string
  /** Older Korean tagQuery values that should map to this key */
  legacyQueries?: string[]
}

export const HOME_DESTINATION_LINK_TAGS: HomeLinkTagDef[] = [
  {
    id: 'las-vegas',
    key: 'las_vegas',
    labelKo: '라스베이거스',
    labelEn: 'Las Vegas',
    legacyQueries: ['시티', '라스베이거스', '라스베가스', 'las vegas'],
  },
  {
    id: 'grand-canyon',
    key: 'grand_canyon',
    labelKo: '그랜드캐년',
    labelEn: 'Grand Canyon',
    legacyQueries: ['그랜드캐년', '그랜드 캐니언', 'grand canyon'],
  },
  {
    id: 'antelope-canyon',
    key: 'antelope_canyon',
    labelKo: '앤텔롭캐년',
    labelEn: 'Antelope Canyon',
    legacyQueries: ['앤텔롭', '앤텔롭캐년', 'antelope'],
  },
  {
    id: 'zion-canyon',
    key: 'zion',
    labelKo: '자이언',
    labelEn: 'Zion',
    legacyQueries: ['자이언', '자이언캐년'],
  },
  {
    id: 'bryce-canyon',
    key: 'bryce_canyon',
    labelKo: '브라이스캐년',
    labelEn: 'Bryce Canyon',
    legacyQueries: ['브라이스', '브라이스캐년'],
  },
  {
    id: 'horseshoe-bend',
    key: 'horseshoe_bend',
    labelKo: '홀슈밴드',
    labelEn: 'Horseshoe Bend',
    legacyQueries: ['홀슈', '홀슈밴드'],
  },
  {
    id: 'death-valley',
    key: 'death_valley',
    labelKo: '데스밸리',
    labelEn: 'Death Valley',
    legacyQueries: ['데스밸리'],
  },
  {
    id: 'valley-of-fire',
    key: 'valley_of_fire',
    labelKo: '불의계곡',
    labelEn: 'Valley of Fire',
    legacyQueries: ['불의', '불의계곡'],
  },
  {
    id: 'monument-valley',
    key: 'monument_valley',
    labelKo: '모뉴먼트밸리',
    labelEn: 'Monument Valley',
    legacyQueries: ['모뉴먼트', '모뉴먼트밸리'],
  },
  {
    id: 'sedona',
    key: 'sedona',
    labelKo: '세도나',
    labelEn: 'Sedona',
    legacyQueries: ['세도나'],
  },
]

export const HOME_TRAVEL_STYLE_LINK_TAGS: HomeLinkTagDef[] = [
  {
    id: 'antelopeCanyon',
    key: 'antelope_canyon',
    labelKo: '앤텔롭캐년',
    labelEn: 'Antelope Canyon',
    legacyQueries: ['앤텔롭', '앤텔롭캐년'],
  },
  {
    id: 'grandCanyon',
    key: 'grand_canyon',
    labelKo: '그랜드캐년',
    labelEn: 'Grand Canyon',
    legacyQueries: ['그랜드캐년', '그랜드 캐니언'],
  },
  {
    id: 'suburbanTour',
    key: 'suburban_tour',
    labelKo: '근교투어',
    labelEn: 'Nearby Tour',
    legacyQueries: ['근교', '근교투어'],
  },
  {
    id: 'dayTour',
    key: 'day_tour',
    labelKo: '당일투어',
    labelEn: 'Day Tour',
    legacyQueries: ['당일', '당일투어'],
  },
  {
    id: 'accommodationTour',
    key: 'overnight_tour',
    labelKo: '숙박투어',
    labelEn: 'Overnight Tour',
    legacyQueries: ['숙박', '숙박투어'],
  },
  {
    id: 'cityTour',
    key: 'city_tour',
    labelKo: '시티투어',
    labelEn: 'City Tour',
    legacyQueries: ['시티', '시티투어'],
  },
  {
    id: 'helicopterTour',
    key: 'helicopter',
    labelKo: '헬리콥터',
    labelEn: 'Helicopter',
    legacyQueries: ['헬기', '헬리콥터'],
  },
  {
    id: 'lightAircraftTour',
    key: 'light_aircraft',
    labelKo: '경비행기',
    labelEn: 'Light Aircraft',
    legacyQueries: ['경비행기'],
  },
  {
    id: 'busTour',
    key: 'bus_tour',
    labelKo: '버스투어',
    labelEn: 'Bus Tour',
    legacyQueries: ['버스', '버스투어'],
  },
  {
    id: 'premiumTour',
    key: 'premium_tour',
    labelKo: '프리미엄',
    labelEn: 'Premium',
    legacyQueries: ['프리미엄'],
  },
  {
    id: 'performanceTicket',
    key: 'show_ticket',
    labelKo: '쇼티켓',
    labelEn: 'Show Ticket',
    legacyQueries: ['공연', '쇼', '쇼티켓'],
  },
  {
    id: 'attraction',
    key: 'attraction',
    labelKo: '어트랙션',
    labelEn: 'Attraction',
    legacyQueries: ['어트랙션'],
  },
  {
    id: 'categoryEvent',
    key: 'event',
    labelKo: '이벤트',
    labelEn: 'Event',
    legacyQueries: ['이벤트'],
  },
  {
    id: 'categoryCoupon',
    key: 'coupon',
    labelKo: '쿠폰',
    labelEn: 'Coupon',
    legacyQueries: ['쿠폰'],
  },
  {
    id: 'categoryTravelInsurance',
    key: 'travel_insurance',
    labelKo: '여행자보험',
    labelEn: 'Travel Insurance',
    legacyQueries: ['여행자보험'],
  },
  {
    id: 'categoryConventionSupport',
    key: 'convention',
    labelKo: '컨벤션',
    labelEn: 'Convention',
    legacyQueries: ['컨벤션'],
  },
]

const DESTINATION_BY_ID = new Map(HOME_DESTINATION_LINK_TAGS.map((item) => [item.id, item]))
const STYLE_BY_ID = new Map(HOME_TRAVEL_STYLE_LINK_TAGS.map((item) => [item.id, item]))

export function getHomeDestinationLinkTag(destinationId: string): HomeLinkTagDef | undefined {
  return DESTINATION_BY_ID.get(destinationId)
}

export function getHomeTravelStyleLinkTag(styleId: string): HomeLinkTagDef | undefined {
  return STYLE_BY_ID.get(styleId)
}

/** Upgrade legacy Korean (or free-text) queries to the canonical tag key for a known card. */
export function resolveHomeLinkTagQuery(
  cardId: string,
  configuredQuery: string | null | undefined,
  kind: 'destination' | 'style'
): string {
  const def =
    kind === 'destination' ? DESTINATION_BY_ID.get(cardId) : STYLE_BY_ID.get(cardId)
  if (!def) return (configuredQuery ?? '').trim()

  const configured = (configuredQuery ?? '').trim()
  if (!configured) return def.key
  if (configured === def.key) return def.key

  const legacy = def.legacyQueries ?? []
  const lower = configured.toLowerCase()
  if (legacy.some((item) => item.toLowerCase() === lower || lower.includes(item.toLowerCase()))) {
    return def.key
  }

  // Keep intentional custom queries; still prefer key when it looks like an old short Korean stub
  if (legacy.some((item) => item === configured)) return def.key

  return configured
}

export function homeLinkTagLabel(def: HomeLinkTagDef, locale: string): string {
  return locale === 'en' ? def.labelEn : def.labelKo
}

const ALL_HOME_LINK_TAGS = [...HOME_DESTINATION_LINK_TAGS, ...HOME_TRAVEL_STYLE_LINK_TAGS]

/** Match product.tags against a home card /products?tag= query (key or legacy Korean). */
export function productTagsMatchHomeQuery(
  productTags: string[] | null | undefined,
  selectedTag: string
): boolean {
  const needle = selectedTag.trim().toLowerCase()
  if (!needle || needle === 'all') return true
  const tags = productTags ?? []
  if (tags.some((tag) => {
    const value = tag.toLowerCase()
    return value === needle || value.includes(needle) || needle.includes(value)
  })) {
    return true
  }

  const byKey = ALL_HOME_LINK_TAGS.find((item) => item.key.toLowerCase() === needle)
  if (byKey?.legacyQueries?.length) {
    return tags.some((tag) => {
      const value = tag.toLowerCase()
      return byKey.legacyQueries!.some(
        (legacy) => value === legacy.toLowerCase() || value.includes(legacy.toLowerCase())
      )
    })
  }

  const byLegacy = ALL_HOME_LINK_TAGS.find((item) =>
    (item.legacyQueries ?? []).some(
      (legacy) => legacy.toLowerCase() === needle || needle.includes(legacy.toLowerCase())
    )
  )
  if (byLegacy) {
    return tags.some((tag) => tag.toLowerCase() === byLegacy.key.toLowerCase())
  }

  return false
}
