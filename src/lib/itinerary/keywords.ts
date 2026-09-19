import type { InterestTag, PaceType, PartyType } from './types'

const INTEREST_KEYWORDS: Record<InterestTag, string[]> = {
  mustsee: ['대표', '핵심', '유명', '필수', '처음', '랜드마크', '관광', '명소'],
  food: ['맛집', '음식', '먹방', '카페', '커피', '브런치', '해산물', '먹거리', '로컬푸드'],
  culture: ['역사', '문화', '박물관', '사원', '유적', '전쟁', '왕릉', '성당'],
  nature: ['자연', '숲', '산', '국립공원', '드라이브', '닌빈', '하롱', '메콩', '하이반'],
  beach: ['바다', '해변', '비치', '스노클링', '스노클', '호핑', '섬', '수영'],
  family: ['아이', '어린이', '아동', '자녀', '가족', '테마파크', '놀이공원', '사파리', '워터파크'],
  photo: ['사진', '인생샷', '감성', '뷰', '포토', '예쁜'],
  night: ['야경', '야시장', '밤', '저녁', '공연', '루프탑', '선셋'],
  local: ['시장', '로컬', '현지', '골목', '마을', '재래시장'],
  wellness: ['휴양', '마사지', '스파', '힐링', '쉬고', '여유롭', '머드', '온천'],
}

const PARTY_PATTERNS: Array<[Exclude<PartyType, 'any'>, RegExp]> = [
  ['family', /아이|아동|어린이|자녀|가족|딸|아들/],
  ['parents', /부모님|어르신|엄마|아빠|부모/],
  ['couple', /커플|연인|신혼|남자친구|여자친구|남편|아내/],
  ['friends', /친구|우정/],
  ['solo', /혼자|혼행|솔로/],
]

const RELAXED_PATTERNS = /여유|느긋|빡빡하지|빡빡하지\s*않|천천히|쉬면서|쉬고|무리하지|많이 걷|안 빡빡/
const FULL_PATTERNS = /꽉|빡빡하게|다 보고|알차게|최대한 많이/

const PLACE_BLOCK_KEYWORDS: Array<[blockId: string, keywords: string[]]> = [
  ['hanoi.ninhbinh', ['닌빈', '짱안', '땀꼭']],
  ['hanoi.halong', ['하롱', '하롱베이']],
  ['hanoi.pottery', ['밧짱', '도자기']],
  ['hanoi.westlake', ['서호', '쩐꾸옥']],
  ['hanoi.core', ['호안끼엠', '올드쿼터']],
  ['hanoi.heritage', ['호찌민 묘역', '문묘', '한기둥']],
  ['hcmc.cuchi', ['꾸찌']],
  ['hcmc.mekong', ['메콩']],
  ['hcmc.thuduc', ['타오디엔']],
  ['hcmc.local', ['차이나타운', '쩌런', '벤탄']],
  ['danang.bana', ['바나힐', '골든브릿지', '골든 브릿지']],
  ['danang.hoian', ['호이안']],
  ['danang.hue', ['후에']],
  ['danang.haivan', ['하이반', '랑코']],
  ['danang.local', ['한시장', '참박물관', '참 조각']],
  ['danang.core', ['미케비치', '선짜', '린응사', '용다리']],
  ['nhatrang.vin', ['빈원더스', '빈펄']],
  ['nhatrang.island', ['호핑', '섬투어', '섬 투어']],
  ['nhatrang.mud', ['머드']],
  ['nhatrang.baidai', ['바이다이']],
  ['nhatrang.local', ['담시장', '롱선사']],
  ['phuquoc.south', ['선셋타운', '혼똔', '남부']],
  ['phuquoc.islands', ['안터이']],
  ['phuquoc.north', ['사파리', '그랜드월드', '북부']],
]

export function extractInterestTags(text: string): InterestTag[] {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return []
  return (Object.keys(INTEREST_KEYWORDS) as InterestTag[]).filter((tag) =>
    INTEREST_KEYWORDS[tag].some((keyword) => normalized.includes(keyword.toLowerCase()))
  )
}

export function inferPartyFromText(text: string): Exclude<PartyType, 'any'> | null {
  for (const [party, pattern] of PARTY_PATTERNS) {
    if (pattern.test(text)) return party
  }
  return null
}

export function inferPaceFromText(text: string): PaceType | null {
  if (RELAXED_PATTERNS.test(text)) return 'relaxed'
  if (FULL_PATTERNS.test(text)) return 'full'
  return null
}

export type PlaceMention = {
  blockId: string
  keyword: string
}

export function extractPlaceMentions(text: string): PlaceMention[] {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return []
  const mentions: PlaceMention[] = []
  for (const [blockId, keywords] of PLACE_BLOCK_KEYWORDS) {
    const hit = keywords.find((keyword) => normalized.includes(keyword.toLowerCase()))
    if (hit) mentions.push({ blockId, keyword: hit })
  }
  return mentions
}
