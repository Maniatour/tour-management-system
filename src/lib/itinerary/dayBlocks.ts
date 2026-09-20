import type { CityCode, InterestTag, ItineraryDayBlock } from './types'

type DayBlockInput = {
  title: string
  tags: InterestTag[]
  stops: string[]
  note?: string
}

function block(city: CityCode, key: string, input: DayBlockInput): ItineraryDayBlock {
  return { id: `${city}.${key}`, city, ...input }
}

export const ITINERARY_DAY_BLOCKS: ItineraryDayBlock[] = [
  // ── 하노이 ──────────────────────────────────────────────
  block('hanoi', 'core', {
    title: '호안끼엠 + 올드쿼터',
    tags: ['mustsee', 'culture', 'food', 'local', 'photo', 'night'],
    stops: ['호안끼엠 호수·응옥썬 사원', '점심 · 올드쿼터 로컬 식사', '올드쿼터 골목·카페', '수상인형극 또는 야간 산책'],
    note: '하노이 첫 방문에 좋은 도보 중심 일정',
  }),
  block('hanoi', 'heritage', {
    title: '호찌민 묘역 + 한기둥사원 + 문묘',
    tags: ['mustsee', 'culture', 'photo'],
    stops: ['호찌민 묘역 권역·한기둥사원', '점심 · 시내 식사', '문묘·국자감', '호안끼엠 주변 자유시간'],
    note: '역사 명소 비중이 높은 구성',
  }),
  block('hanoi', 'westlake', {
    title: '서호 + 쩐꾸옥사',
    tags: ['food', 'photo', 'wellness', 'local'],
    stops: ['쩐꾸옥 사원·서호 산책', '점심 · 서호 권역 식사', '카페·호수 주변 느린 이동', '올드쿼터 복귀 후 자유시간'],
    note: '부모님·커플·여유 일정에 적합',
  }),
  block('hanoi', 'food', {
    title: '먹거리 + 카페 + 야시장',
    tags: ['food', 'local', 'night'],
    stops: ['현지식 아침·올드쿼터 산책', '점심 · 분짜 등 로컬 메뉴', '에그커피·시장 골목 탐방', '야시장 또는 길거리 음식'],
    note: '관광지보다 먹거리와 골목 체류 비중이 큼',
  }),
  block('hanoi', 'ninhbinh', {
    title: '닌빈 당일치기',
    tags: ['nature', 'mustsee', 'photo'],
    stops: ['하노이 출발·닌빈 이동', '점심 · 현지 식사', '짱안 또는 땀꼭 수로 체험·전망 포인트', '하노이 귀환'],
    note: '외곽 자연경관에 하루를 통째로 쓰는 구성',
  }),
  block('hanoi', 'halong', {
    title: '하롱베이 당일치기',
    tags: ['nature', 'mustsee', 'photo'],
    stops: ['이른 오전 하노이 출발', '하롱베이 크루즈 중심 일정', '선상·섬 경관 체험', '하노이 귀환'],
    note: '장거리 이동이 포함된 전일 일정',
  }),
  block('hanoi', 'pottery', {
    title: '밧짱 도자기마을',
    tags: ['culture', 'local', 'family', 'photo'],
    stops: ['밧짱 도자기 마을 이동', '점심 · 현지 식사', '도자기·공예 체험·마을 산책', '올드쿼터 복귀'],
    note: '아이 동반과 체험 선호 고객용',
  }),
  block('hanoi', 'museum', {
    title: '박물관·실내 일정',
    tags: ['culture', 'local', 'wellness'],
    stops: ['베트남 민족학박물관', '점심 · 시내 식사', '미술관 또는 실내 문화공간', '카페·가벼운 산책'],
    note: '더위·비 또는 차분한 일정에 활용',
  }),

  // ── 호치민 ─────────────────────────────────────────────
  block('hcmc', 'core', {
    title: '1군 대표 명소',
    tags: ['mustsee', 'culture', 'photo', 'food'],
    stops: ['통일궁', '점심 · 1군 로컬 식사', '중앙우체국·동커이·오페라하우스 권역', '응우옌후에 산책'],
    note: '호치민 첫 방문 대표 동선',
  }),
  block('hcmc', 'history', {
    title: '전쟁박물관 + 통일궁',
    tags: ['culture', 'mustsee'],
    stops: ['전쟁박물관', '점심 · 시내 식사', '통일궁·중앙우체국 권역', '벤탄시장 주변'],
    note: '역사·근현대사 관심 고객용',
  }),
  block('hcmc', 'local', {
    title: '차이나타운 + 시장',
    tags: ['local', 'food', 'culture', 'photo'],
    stops: ['떤딘시장 또는 로컬 시장', '점심 · 현지식', '쩌런·티엔허우 사원 권역', '4군 또는 시내 로컬 먹거리'],
    note: '현지 생활감과 먹거리 중심',
  }),
  block('hcmc', 'cuchi', {
    title: '꾸찌터널 당일치기',
    tags: ['culture', 'mustsee', 'nature'],
    stops: ['호치민 출발·꾸찌 이동', '꾸찌터널 관람', '시내 복귀', '1군 자유시간'],
    note: '반일~전일 외곽 역사 체험',
  }),
  block('hcmc', 'mekong', {
    title: '메콩델타 당일치기',
    tags: ['nature', 'local', 'photo'],
    stops: ['이른 오전 호치민 출발', '메콩델타 보트·마을 체험', '현지 풍경·귀환 이동', '호치민 도착 후 휴식'],
    note: '도시 밖 자연·지역문화 경험',
  }),
  block('hcmc', 'thuduc', {
    title: '타오디엔 감성 코스',
    tags: ['food', 'photo', 'local', 'wellness'],
    stops: ['타오디엔 카페·브런치', '점심 · 강변 또는 신도심 식사', '쇼핑·카페·느린 산책', '시내 복귀 후 야경'],
    note: '전통 관광지보다 감성·휴식 중심',
  }),
  block('hcmc', 'night', {
    title: '야경 + 강변 저녁',
    tags: ['food', 'night', 'photo', 'wellness'],
    stops: ['늦은 오전 브런치·카페', '응우옌후에·쇼핑 산책', '사이공강 야경 또는 공연 선택', '마사지 또는 루프탑 권역'],
    note: '늦게 시작하는 커플·친구 일정',
  }),
  block('hcmc', 'family', {
    title: '아이 동반 도심형',
    tags: ['family', 'mustsee', 'food', 'wellness'],
    stops: ['도심 공원·동물원 권역', '점심 · 이동이 편한 식사', '북스트리트·중앙우체국 권역', '강변 산책 후 이른 복귀'],
    note: '이동량과 역사 비중을 낮춘 가족형',
  }),

  // ── 다낭 ──────────────────────────────────────────────
  block('danang', 'core', {
    title: '미케비치 + 선짜반도 + 한강',
    tags: ['mustsee', 'beach', 'photo', 'night'],
    stops: ['미케비치', '점심 · 시내 식사', '선짜반도·린응사 권역', '한강·용다리 야경'],
    note: '다낭 첫날 또는 짧은 일정용',
  }),
  block('danang', 'hoian', {
    title: '오행산 + 호이안',
    tags: ['mustsee', 'culture', 'photo', 'night', 'local'],
    stops: ['여유롭게 시작 또는 미케비치', '점심 · 다낭/호이안 이동 중 식사', '오행산·호이안 올드타운', '야경·등불거리 후 다낭 복귀'],
    note: '다낭과 호이안을 하루에 묶는 대표형',
  }),
  block('danang', 'bana', {
    title: '바나힐',
    tags: ['mustsee', 'family', 'photo'],
    stops: ['바나힐 이동·케이블카 권역', '점심 · 바나힐 내 자유식', '골든브릿지·테마 구역', '다낭 복귀·휴식'],
    note: '아이·가족과 대표 관광지 선호형',
  }),
  block('danang', 'hue', {
    title: '후에 당일치기',
    tags: ['culture', 'mustsee', 'photo'],
    stops: ['이른 오전 다낭 출발', '후에 황성·사원/왕릉 권역', '늦은 오후 다낭 귀환', '휴식'],
    note: '역사 비중이 높은 장거리 하루',
  }),
  block('danang', 'local', {
    title: '한시장 + 참박물관',
    tags: ['local', 'culture', 'food'],
    stops: ['한시장 또는 재래시장', '점심 · 로컬 식사', '참조각박물관·시내 카페', '한강 주변 산책'],
    note: '쇼핑과 현지 분위기를 가볍게 섞은 구성',
  }),
  block('danang', 'beach', {
    title: '해변 + 카페 + 마사지',
    tags: ['beach', 'food', 'wellness', 'photo'],
    stops: ['늦은 오전 브런치', '미케비치·카페', '마사지·스파', '해산물 또는 한강 산책'],
    note: '일정을 비우고 휴양 비중을 높인 구성',
  }),
  block('danang', 'haivan', {
    title: '하이반패스 + 랑코',
    tags: ['nature', 'photo', 'beach'],
    stops: ['하이반패스 방향 이동', '점심 · 랑코 권역', '해안 드라이브·전망 포인트', '다낭 복귀'],
    note: '자연·드라이브·사진 선호 고객용',
  }),
  block('danang', 'family', {
    title: '아이와 가벼운 다낭 일정',
    tags: ['family', 'beach', 'mustsee', 'wellness'],
    stops: ['해변 산책', '점심 · 이동이 편한 식사', '선짜반도 또는 실내·체험 선택', '한강 야경 후 이른 복귀'],
    note: '아이 컨디션에 따라 쉽게 줄일 수 있는 일정',
  }),

  // ── 나트랑 ─────────────────────────────────────────────
  block('nhatrang', 'core', {
    title: '포나가르 + 시내 + 해변',
    tags: ['mustsee', 'culture', 'beach', 'photo'],
    stops: ['포나가르 사원', '점심 · 시내 식사', '혼총 또는 시내 해변', '야시장·해변 산책'],
    note: '나트랑 첫 방문 핵심형',
  }),
  block('nhatrang', 'island', {
    title: '섬투어·호핑',
    tags: ['nature', 'beach', 'photo'],
    stops: ['선착장 이동·섬투어 출발', '스노클링·섬 체류', '귀항·호텔 휴식', '해변 식사'],
    note: '바다 활동이 하루의 중심',
  }),
  block('nhatrang', 'vin', {
    title: '빈원더스',
    tags: ['family', 'mustsee', 'photo'],
    stops: ['빈원더스 이동', '테마파크·시설 자유 이용', '계속 이용 또는 휴식', '시내 복귀'],
    note: '아이 동반 가족이 하루를 통째로 쓰는 구성',
  }),
  block('nhatrang', 'mud', {
    title: '머드배스 + 온천',
    tags: ['wellness', 'culture', 'mustsee'],
    stops: ['포나가르 사원 또는 시내 관광', '점심 · 시내 식사', '머드배스·온천 체험', '해변 산책'],
    note: '관광과 휴양을 반반 섞은 대표형',
  }),
  block('nhatrang', 'beach', {
    title: '해변 + 카페 + 휴식',
    tags: ['beach', 'food', 'wellness', 'photo'],
    stops: ['늦은 오전 브런치', '해변·카페', '마사지·스파', '야시장 또는 해변 식사'],
    note: '리조트 휴양 중 하루만 외출하는 고객용',
  }),
  block('nhatrang', 'local', {
    title: '담시장 + 롱선사',
    tags: ['local', 'food', 'culture'],
    stops: ['담시장 등 로컬 시장', '점심 · 현지식', '롱선사·카페', '야시장·로컬 먹거리'],
    note: '현지 분위기와 먹거리 선호형',
  }),
  block('nhatrang', 'baidai', {
    title: '바이다이 해안',
    tags: ['beach', 'nature', 'food', 'wellness'],
    stops: ['바이다이 방향 이동', '점심 · 해변권 식사', '해변 휴식·카페', '나트랑 시내 복귀'],
    note: '도심보다 해변 체류 비중이 높음',
  }),
  block('nhatrang', 'culture', {
    title: '문화 중심 일정',
    tags: ['culture', 'photo', 'mustsee'],
    stops: ['롱선사', '점심 · 시내 식사', '포나가르·시내 건축 명소 권역', '해변 자유시간'],
    note: '바다 액티비티 없이 문화관광 중심',
  }),

  // ── 푸꾸옥 ─────────────────────────────────────────────
  block('phuquoc', 'south', {
    title: '남부 + 선셋타운',
    tags: ['mustsee', 'beach', 'photo', 'family'],
    stops: ['남부 방향 이동·해안 명소', '혼똔 케이블카·남부 체험 선택', '선셋타운 권역', '남부 야경 후 복귀'],
    note: '푸꾸옥 남부 대표 관광형',
  }),
  block('phuquoc', 'islands', {
    title: '안터이 섬투어',
    tags: ['nature', 'beach', 'photo'],
    stops: ['안터이 출발·섬투어', '스노클링·바다 체험', '귀항·휴식', '즈엉동 자유시간'],
    note: '바다 액티비티가 핵심인 하루',
  }),
  block('phuquoc', 'north', {
    title: '북부 사파리·테마파크',
    tags: ['family', 'mustsee', 'nature'],
    stops: ['북부 이동·사파리·동물 체험', '점심 · 북부 권역 식사', '테마파크 또는 그랜드월드 권역', '북부 야경 후 복귀'],
    note: '아이 동반 가족형',
  }),
  block('phuquoc', 'local', {
    title: '야시장 + 로컬',
    tags: ['local', 'food', 'culture'],
    stops: ['후추농장 등 로컬 생산지', '점심 · 현지 식사', '함닌·지역 마을 권역', '즈엉동 야시장'],
    note: '섬의 생활·먹거리 중심',
  }),
  block('phuquoc', 'beach', {
    title: '해변 + 리조트 + 선셋',
    tags: ['beach', 'wellness', 'photo', 'food'],
    stops: ['늦은 오전 리조트 휴식', '해변·카페', '해질 무렵 선셋 포인트', '해변·야시장 식사'],
    note: '관광을 최소화한 휴양형',
  }),
  block('phuquoc', 'nature', {
    title: '국립공원·북서부',
    tags: ['nature', 'beach', 'photo'],
    stops: ['북부 자연 권역 이동', '국립공원·숲 체험', '간저우 등 북서부 해변 권역', '리조트 복귀'],
    note: '테마파크보다 자연 선호형',
  }),
  block('phuquoc', 'family', {
    title: '아이와 남북 핵심 혼합',
    tags: ['family', 'beach', 'mustsee', 'wellness'],
    stops: ['가족형 대표 관광지 1곳', '점심 · 이동이 편한 식사', '해변 또는 리조트 휴식', '야시장·야경'],
    note: '하루 한 개 큰 일정만 넣는 가족형',
  }),
  block('phuquoc', 'wellness', {
    title: '스파 + 카페 + 휴양',
    tags: ['wellness', 'beach', 'food', 'photo'],
    stops: ['늦은 오전 브런치·카페', '해변·리조트 휴식', '마사지·스파', '선셋·가벼운 식사'],
    note: '커플·부모님과 무리 없이 쉬는 일정',
  }),
]

const dayBlockIndex = new Map(ITINERARY_DAY_BLOCKS.map((item) => [item.id, item]))

export function getItineraryDayBlock(id: string): ItineraryDayBlock | undefined {
  return dayBlockIndex.get(id)
}

export function getCityDayBlocks(city: CityCode): ItineraryDayBlock[] {
  return ITINERARY_DAY_BLOCKS.filter((item) => item.city === city)
}
