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
    tagQuery: 'las_vegas',
    imageUrl: '/images/destinations/las-vegas.jpg',
  },
  {
    id: 'grand-canyon',
    labelKey: 'destGrandCanyon',
    tagQuery: 'grand_canyon',
    imageUrl: MANIATOUR_CTA_IMAGE,
  },
  {
    id: 'antelope-canyon',
    labelKey: 'destAntelopeCanyon',
    tagQuery: 'antelope_canyon',
    imageUrl: '/images/destinations/antelope-canyon.jpg',
  },
  {
    id: 'zion-canyon',
    labelKey: 'destZion',
    tagQuery: 'zion',
    imageUrl: '/images/destinations/zion-canyon.jpg',
  },
  {
    id: 'bryce-canyon',
    labelKey: 'destBryceCanyon',
    tagQuery: 'bryce_canyon',
    imageUrl: '/images/destinations/bryce-canyon.jpg',
  },
  {
    id: 'horseshoe-bend',
    labelKey: 'destHorseshoeBend',
    tagQuery: 'horseshoe_bend',
    imageUrl: '/images/destinations/horseshoe-bend.jpg',
  },
  {
    id: 'death-valley',
    labelKey: 'destDeathValley',
    tagQuery: 'death_valley',
    imageUrl: '/images/destinations/death-valley.jpg',
  },
  {
    id: 'valley-of-fire',
    labelKey: 'destValleyOfFire',
    tagQuery: 'valley_of_fire',
    imageUrl: '/images/destinations/valley-of-fire.jpg',
  },
  {
    id: 'monument-valley',
    labelKey: 'destMonumentValley',
    tagQuery: 'monument_valley',
    imageUrl: '/images/destinations/monument-valley.jpg',
  },
  {
    id: 'sedona',
    labelKey: 'destSedona',
    tagQuery: 'sedona',
    imageUrl: '/images/destinations/sedona.jpg',
  },
]
