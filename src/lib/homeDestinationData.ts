import { MANIATOUR_CTA_IMAGE } from '@/lib/maniatourHomeData'

export type HomeDestination = {
  id: string
  labelKey: string
  tagQuery: string
  imageUrl: string
}

/** Mania Tour 홈 목적지 카드 — American Southwest (로컬 검증 이미지) */
export const HOME_DESTINATIONS: HomeDestination[] = [
  {
    id: 'las-vegas',
    labelKey: 'destLasVegas',
    tagQuery: '시티',
    imageUrl: '/images/destinations/las-vegas.jpg',
  },
  {
    id: 'grand-canyon',
    labelKey: 'destGrandCanyon',
    tagQuery: '그랜드캐년',
    imageUrl: MANIATOUR_CTA_IMAGE,
  },
  {
    id: 'antelope-canyon',
    labelKey: 'destAntelopeCanyon',
    tagQuery: '앤텔롭',
    imageUrl: '/images/destinations/antelope-canyon.jpg',
  },
  {
    id: 'zion-canyon',
    labelKey: 'destZion',
    tagQuery: '자이언',
    imageUrl: '/images/destinations/zion-canyon.jpg',
  },
  {
    id: 'bryce-canyon',
    labelKey: 'destBryceCanyon',
    tagQuery: '브라이스',
    imageUrl: '/images/destinations/bryce-canyon.jpg',
  },
  {
    id: 'horseshoe-bend',
    labelKey: 'destHorseshoeBend',
    tagQuery: '홀슈',
    imageUrl: '/images/destinations/horseshoe-bend.jpg',
  },
  {
    id: 'death-valley',
    labelKey: 'destDeathValley',
    tagQuery: '데스밸리',
    imageUrl: '/images/destinations/death-valley.jpg',
  },
  {
    id: 'valley-of-fire',
    labelKey: 'destValleyOfFire',
    tagQuery: '불의',
    imageUrl: '/images/destinations/valley-of-fire.jpg',
  },
  {
    id: 'monument-valley',
    labelKey: 'destMonumentValley',
    tagQuery: '모뉴먼트',
    imageUrl: '/images/destinations/monument-valley.jpg',
  },
  {
    id: 'sedona',
    labelKey: 'destSedona',
    tagQuery: '세도나',
    imageUrl: '/images/destinations/sedona.jpg',
  },
]
