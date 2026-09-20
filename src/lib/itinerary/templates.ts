import type { CityCode, InterestTag, ItineraryTemplate, PaceType, PartyType } from './types'

export const ITINERARY_CITY_LABELS: Record<CityCode, string> = {
  hanoi: '하노이',
  hcmc: '호치민',
  danang: '다낭',
  nhatrang: '나트랑',
  phuquoc: '푸꾸옥',
}

export const ITINERARY_PARTY_LABELS: Record<PartyType, string> = {
  any: '상관없음',
  couple: '커플',
  family: '아이 동반 가족',
  parents: '부모님/어르신',
  friends: '친구',
  solo: '혼자',
}

export const ITINERARY_PACE_LABELS: Record<PaceType, string> = {
  relaxed: '여유롭게',
  balanced: '적당히',
  full: '꽉 채우기',
}

export const ITINERARY_INTEREST_LABELS: Record<InterestTag, string> = {
  mustsee: '대표 명소',
  food: '맛집·카페',
  culture: '문화·역사',
  nature: '자연',
  beach: '해변·바다',
  family: '아이·테마파크',
  photo: '사진·감성',
  night: '야경·저녁',
  local: '시장·로컬',
  wellness: '휴양·마사지',
}

type TemplateTuple = [
  id: string,
  city: CityCode,
  name: string,
  days: number,
  parties: Exclude<PartyType, 'any'>[],
  pace: PaceType,
  interests: InterestTag[],
  dayBlocks: string[],
]

const TEMPLATE_TUPLES: TemplateTuple[] = [
  // ── 하노이 ──────────────────────────────────────────────
  ['hn-first-1d', 'hanoi', '하노이 첫 방문 1일', 1, ['couple', 'friends', 'solo', 'parents'], 'balanced', ['mustsee', 'culture', 'food'], ['hanoi.core']],
  ['hn-classic-2d', 'hanoi', '하노이 2일 클래식', 2, ['couple', 'friends', 'parents'], 'balanced', ['mustsee', 'culture', 'food', 'photo'], ['hanoi.core', 'hanoi.heritage']],
  ['hn-ninhbinh-3d', 'hanoi', '하노이 3일 · 닌빈 당일치기', 3, ['couple', 'friends', 'solo', 'family'], 'balanced', ['mustsee', 'nature', 'photo', 'culture'], ['hanoi.core', 'hanoi.heritage', 'hanoi.ninhbinh']],
  ['hn-relaxed-3d', 'hanoi', '하노이 3일 여유·로컬', 3, ['couple', 'friends', 'solo', 'parents'], 'relaxed', ['local', 'food', 'wellness', 'culture'], ['hanoi.core', 'hanoi.westlake', 'hanoi.food']],
  ['hn-family-3d', 'hanoi', '아이와 하노이 3일', 3, ['family'], 'relaxed', ['family', 'culture', 'local', 'food'], ['hanoi.core', 'hanoi.pottery', 'hanoi.westlake']],
  ['hn-parents-2d', 'hanoi', '부모님과 하노이 2일', 2, ['parents'], 'relaxed', ['culture', 'wellness', 'food', 'mustsee'], ['hanoi.heritage', 'hanoi.westlake']],
  ['hn-halong-4d', 'hanoi', '하노이 4일 · 하롱베이 포함', 4, ['couple', 'friends', 'family'], 'full', ['mustsee', 'nature', 'culture', 'photo'], ['hanoi.core', 'hanoi.heritage', 'hanoi.halong', 'hanoi.food']],
  ['hn-indoor-2d', 'hanoi', '하노이 실내·먹거리 2일', 2, ['couple', 'family', 'parents', 'friends'], 'relaxed', ['culture', 'food', 'wellness'], ['hanoi.museum', 'hanoi.food']],
  ['hn-full-5d', 'hanoi', '하노이 5일 꽉 채우기', 5, ['friends', 'solo', 'couple'], 'full', ['mustsee', 'nature', 'culture', 'food', 'local'], ['hanoi.core', 'hanoi.heritage', 'hanoi.ninhbinh', 'hanoi.halong', 'hanoi.food']],

  // ── 호치민 ─────────────────────────────────────────────
  ['sg-core-1d', 'hcmc', '호치민 1일 핵심', 1, ['couple', 'friends', 'solo', 'parents'], 'balanced', ['mustsee', 'culture', 'food'], ['hcmc.core']],
  ['sg-classic-2d', 'hcmc', '호치민 2일 클래식', 2, ['couple', 'friends', 'parents'], 'balanced', ['mustsee', 'culture', 'local', 'food'], ['hcmc.core', 'hcmc.local']],
  ['sg-cuchi-3d', 'hcmc', '호치민 3일 · 꾸찌 포함', 3, ['couple', 'friends', 'solo', 'family'], 'balanced', ['culture', 'mustsee', 'local', 'nature'], ['hcmc.core', 'hcmc.cuchi', 'hcmc.local']],
  ['sg-mekong-3d', 'hcmc', '호치민 3일 · 메콩 포함', 3, ['couple', 'friends', 'parents'], 'balanced', ['nature', 'local', 'food', 'mustsee'], ['hcmc.core', 'hcmc.mekong', 'hcmc.local']],
  ['sg-full-4d', 'hcmc', '호치민 4일 꽉 채우기', 4, ['friends', 'couple', 'solo'], 'full', ['mustsee', 'culture', 'nature', 'local'], ['hcmc.core', 'hcmc.cuchi', 'hcmc.mekong', 'hcmc.local']],
  ['sg-family-2d', 'hcmc', '아이와 호치민 2일', 2, ['family'], 'relaxed', ['family', 'mustsee', 'food'], ['hcmc.family', 'hcmc.core']],
  ['sg-couple-2d', 'hcmc', '커플 감성 호치민 2일', 2, ['couple'], 'relaxed', ['food', 'photo', 'night', 'wellness'], ['hcmc.thuduc', 'hcmc.night']],
  ['sg-history-2d', 'hcmc', '역사 집중 호치민 2일', 2, ['solo', 'friends', 'parents'], 'full', ['culture', 'mustsee'], ['hcmc.history', 'hcmc.core']],
  ['sg-night-3d', 'hcmc', '호치민 3일 · 야경과 먹거리', 3, ['couple', 'friends'], 'balanced', ['food', 'night', 'local', 'photo'], ['hcmc.core', 'hcmc.local', 'hcmc.night']],

  // ── 다낭 ──────────────────────────────────────────────
  ['dn-core-1d', 'danang', '다낭 1일 핵심', 1, ['couple', 'friends', 'solo', 'parents'], 'balanced', ['mustsee', 'beach', 'photo', 'night'], ['danang.core']],
  ['dn-classic-2d', 'danang', '다낭 2일 클래식', 2, ['couple', 'friends', 'parents'], 'balanced', ['mustsee', 'culture', 'photo', 'night'], ['danang.core', 'danang.hoian']],
  ['dn-first-3d', 'danang', '다낭 3일 첫 여행', 3, ['couple', 'friends', 'family'], 'balanced', ['mustsee', 'family', 'culture', 'photo'], ['danang.core', 'danang.bana', 'danang.hoian']],
  ['dn-family-3d', 'danang', '아이와 다낭 3일', 3, ['family'], 'relaxed', ['family', 'beach', 'mustsee', 'wellness'], ['danang.family', 'danang.bana', 'danang.beach']],
  ['dn-parents-3d', 'danang', '부모님과 다낭 3일', 3, ['parents'], 'relaxed', ['wellness', 'mustsee', 'culture', 'food'], ['danang.beach', 'danang.hoian', 'danang.local']],
  ['dn-wellness-2d', 'danang', '다낭 휴양 2일', 2, ['couple', 'parents', 'friends'], 'relaxed', ['beach', 'wellness', 'food', 'photo'], ['danang.beach', 'danang.core']],
  ['dn-nature-3d', 'danang', '다낭 자연·드라이브 3일', 3, ['couple', 'friends', 'solo'], 'balanced', ['nature', 'photo', 'beach'], ['danang.core', 'danang.haivan', 'danang.hoian']],
  ['dn-full-4d', 'danang', '다낭 4일 꽉 채우기', 4, ['couple', 'friends'], 'full', ['mustsee', 'culture', 'nature', 'photo'], ['danang.core', 'danang.bana', 'danang.hoian', 'danang.hue']],
  ['dn-food-2d', 'danang', '다낭 맛집·시장 2일', 2, ['friends', 'solo', 'couple'], 'balanced', ['food', 'local', 'beach'], ['danang.local', 'danang.beach']],

  // ── 나트랑 ─────────────────────────────────────────────
  ['nt-core-1d', 'nhatrang', '나트랑 1일 핵심', 1, ['couple', 'friends', 'solo', 'parents'], 'balanced', ['mustsee', 'culture', 'beach'], ['nhatrang.core']],
  ['nt-classic-2d', 'nhatrang', '나트랑 2일 클래식', 2, ['couple', 'friends'], 'balanced', ['mustsee', 'beach', 'wellness'], ['nhatrang.core', 'nhatrang.mud']],
  ['nt-sea-3d', 'nhatrang', '나트랑 3일 바다 중심', 3, ['couple', 'friends', 'family'], 'balanced', ['beach', 'nature', 'photo'], ['nhatrang.core', 'nhatrang.island', 'nhatrang.beach']],
  ['nt-family-3d', 'nhatrang', '아이와 나트랑 3일', 3, ['family'], 'relaxed', ['family', 'beach', 'wellness'], ['nhatrang.vin', 'nhatrang.mud', 'nhatrang.beach']],
  ['nt-parents-2d', 'nhatrang', '부모님과 나트랑 2일', 2, ['parents'], 'relaxed', ['culture', 'wellness', 'food'], ['nhatrang.culture', 'nhatrang.mud']],
  ['nt-full-4d', 'nhatrang', '나트랑 4일 종합', 4, ['couple', 'friends', 'family'], 'full', ['mustsee', 'beach', 'family', 'local'], ['nhatrang.core', 'nhatrang.island', 'nhatrang.vin', 'nhatrang.local']],
  ['nt-local-2d', 'nhatrang', '나트랑 로컬·맛집 2일', 2, ['friends', 'solo', 'couple'], 'balanced', ['local', 'food', 'culture'], ['nhatrang.local', 'nhatrang.culture']],
  ['nt-wellness-3d', 'nhatrang', '나트랑 휴양 3일', 3, ['couple', 'parents'], 'relaxed', ['beach', 'wellness', 'food'], ['nhatrang.beach', 'nhatrang.mud', 'nhatrang.baidai']],
  ['nt-photo-3d', 'nhatrang', '나트랑 3일 바다·사진', 3, ['couple', 'friends', 'solo'], 'balanced', ['photo', 'beach', 'nature'], ['nhatrang.island', 'nhatrang.culture', 'nhatrang.baidai']],

  // ── 푸꾸옥 ─────────────────────────────────────────────
  ['pq-south-1d', 'phuquoc', '푸꾸옥 1일 남부 핵심', 1, ['couple', 'friends', 'family'], 'balanced', ['mustsee', 'beach', 'photo'], ['phuquoc.south']],
  ['pq-classic-2d', 'phuquoc', '푸꾸옥 2일 클래식', 2, ['couple', 'friends'], 'balanced', ['mustsee', 'beach', 'local'], ['phuquoc.south', 'phuquoc.local']],
  ['pq-sea-3d', 'phuquoc', '푸꾸옥 3일 바다 중심', 3, ['couple', 'friends'], 'balanced', ['beach', 'nature', 'photo'], ['phuquoc.south', 'phuquoc.islands', 'phuquoc.beach']],
  ['pq-family-3d', 'phuquoc', '아이와 푸꾸옥 3일', 3, ['family'], 'relaxed', ['family', 'beach', 'mustsee'], ['phuquoc.north', 'phuquoc.south', 'phuquoc.family']],
  ['pq-full-4d', 'phuquoc', '푸꾸옥 4일 남북 종합', 4, ['couple', 'friends', 'family'], 'full', ['mustsee', 'family', 'beach', 'local', 'nature'], ['phuquoc.south', 'phuquoc.islands', 'phuquoc.north', 'phuquoc.local']],
  ['pq-parents-3d', 'phuquoc', '부모님과 푸꾸옥 3일', 3, ['parents'], 'relaxed', ['wellness', 'beach', 'food', 'local'], ['phuquoc.wellness', 'phuquoc.local', 'phuquoc.beach']],
  ['pq-couple-2d', 'phuquoc', '커플 휴양 푸꾸옥 2일', 2, ['couple'], 'relaxed', ['wellness', 'beach', 'photo', 'food'], ['phuquoc.wellness', 'phuquoc.beach']],
  ['pq-nature-3d', 'phuquoc', '푸꾸옥 자연 3일', 3, ['couple', 'friends', 'solo'], 'balanced', ['nature', 'beach', 'photo'], ['phuquoc.nature', 'phuquoc.islands', 'phuquoc.beach']],
  ['pq-food-2d', 'phuquoc', '푸꾸옥 로컬·야시장 2일', 2, ['friends', 'solo', 'couple'], 'balanced', ['local', 'food', 'beach'], ['phuquoc.local', 'phuquoc.beach']],
]

export const ITINERARY_TEMPLATES: ItineraryTemplate[] = TEMPLATE_TUPLES.map(
  ([id, city, name, days, parties, pace, interests, dayBlocks]) => ({
    id,
    city,
    name,
    days,
    parties,
    pace,
    interests,
    dayBlocks,
  })
)

export const ITINERARY_TEMPLATE_COUNT = ITINERARY_TEMPLATES.length
