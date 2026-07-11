export type HomeDestination = {
  id: string
  labelKey: string
  tagQuery: string
  imageUrl: string
}

/** GetYourGuide 스타일 목적지 카드 — Kovegas/Southwest 여행지 */
export const HOME_DESTINATIONS: HomeDestination[] = [
  {
    id: 'las-vegas',
    labelKey: 'destLasVegas',
    tagQuery: '시티',
    imageUrl:
      'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'grand-canyon',
    labelKey: 'destGrandCanyon',
    tagQuery: '그랜드캐년',
    imageUrl:
      'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'antelope-canyon',
    labelKey: 'destAntelopeCanyon',
    tagQuery: '앤텔롭',
    imageUrl:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'zion',
    labelKey: 'destZion',
    tagQuery: '근교',
    imageUrl:
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'bryce-canyon',
    labelKey: 'destBryceCanyon',
    tagQuery: '근교',
    imageUrl:
      'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'hoover-dam',
    labelKey: 'destHooverDam',
    tagQuery: '근교',
    imageUrl:
      'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?auto=format&fit=crop&w=600&q=80',
  },
]
