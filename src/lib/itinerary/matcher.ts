import { getCityDayBlocks, getItineraryDayBlock } from './dayBlocks'
import {
  extractInterestTags,
  extractPlaceMentions,
  inferPaceFromText,
  inferPartyFromText,
} from './keywords'
import { ITINERARY_INTEREST_LABELS, ITINERARY_TEMPLATES } from './templates'
import type {
  InterestTag,
  ItineraryMatch,
  ItineraryMatchDay,
  ItineraryQuery,
  ItineraryTemplate,
  PaceType,
  PartyType,
} from './types'

const BASE_SCORE = 40
const DAYS_SCORE = 20
const PARTY_SCORE = 15
const PACE_SCORE = 10
const INTEREST_SCORE_MAX = 25
const FREETEXT_SCORE_MAX = 10

const PARTY_REASON_LABELS: Record<Exclude<PartyType, 'any'>, string> = {
  couple: '커플 여행 조건 일치',
  family: '아이 동반 조건 일치',
  parents: '부모님/어르신 동행 조건 일치',
  friends: '친구 여행 조건 일치',
  solo: '혼자 여행 조건 일치',
}

const PACE_REASON_LABELS: Record<PaceType, string> = {
  relaxed: '여유로운 템포 반영',
  balanced: '적당한 템포 반영',
  full: '꽉 채우는 템포 반영',
}

function daysScore(templateDays: number, queryDays: number): number {
  const diff = Math.abs(templateDays - queryDays)
  if (diff === 0) return DAYS_SCORE
  if (diff === 1) return 10
  return 0
}

function paceScore(templatePace: PaceType, queryPace: PaceType): number {
  if (templatePace === queryPace) return PACE_SCORE
  if (queryPace === 'balanced') return 4
  return 0
}

function interestOverlap(pool: InterestTag[], template: ItineraryTemplate): InterestTag[] {
  return pool.filter((tag) => template.interests.includes(tag))
}

/**
 * 템플릿의 기본 동선을 요청 일수에 맞춘다.
 * - 요청 일수가 짧으면: 요청 장소·관심사와 맞는 블록을 우선 남기고 원래 순서 유지
 * - 요청 일수가 길면: 같은 도시의 미사용 블록을 관심사 일치 > 새 태그 추가 > 동행 적합도 순으로 추가
 */
function resolveRouteBlocks(
  template: ItineraryTemplate,
  query: ItineraryQuery,
  pool: InterestTag[],
  effectiveParty: Exclude<PartyType, 'any'> | null,
  mentionedBlockIds: Set<string>
): string[] {
  const base = template.dayBlocks.filter((id) => getItineraryDayBlock(id)?.city === query.city)

  if (query.days <= base.length) {
    const ranked = base
      .map((id, index) => {
        const blockData = getItineraryDayBlock(id)
        const tags = blockData?.tags ?? []
        const overlap = tags.filter((tag) => pool.includes(tag)).length
        const placeHit = mentionedBlockIds.has(id) ? 1 : 0
        return { id, index, rank: placeHit * 100 + overlap }
      })
      .sort((a, b) => b.rank - a.rank || a.index - b.index)
      .slice(0, query.days)
      .sort((a, b) => a.index - b.index)
    return ranked.map((entry) => entry.id)
  }

  const selected = new Set(base)
  const selectedTags = new Set<InterestTag>(
    base.flatMap((id) => getItineraryDayBlock(id)?.tags ?? [])
  )
  const extras = [...base]
  const candidates = getCityDayBlocks(query.city).filter((item) => !selected.has(item.id))

  const ranked = candidates
    .map((item) => {
      const overlap = item.tags.filter((tag) => pool.includes(tag)).length
      const novelty = item.tags.filter((tag) => !selectedTags.has(tag)).length
      let partyScore = 0
      if (item.tags.includes('family')) partyScore = effectiveParty === 'family' ? 2 : -3
      else if (
        (effectiveParty === 'parents' && item.tags.includes('wellness')) ||
        ((effectiveParty === 'couple' || effectiveParty === 'friends') &&
          (item.tags.includes('night') || item.tags.includes('food')))
      ) {
        partyScore = 1
      }
      const placeHit = mentionedBlockIds.has(item.id) ? 6 : 0
      return { item, rank: placeHit + overlap * 3 + novelty + partyScore }
    })
    .sort((a, b) => b.rank - a.rank || a.item.id.localeCompare(b.item.id))

  for (const { item } of ranked) {
    if (extras.length >= query.days) break
    extras.push(item.id)
  }
  return extras.slice(0, query.days)
}

function toMatchDays(blockIds: string[]): ItineraryMatchDay[] {
  const days: ItineraryMatchDay[] = []
  for (const id of blockIds) {
    const blockData = getItineraryDayBlock(id)
    if (!blockData) continue
    const day: ItineraryMatchDay = {
      blockId: blockData.id,
      title: blockData.title,
      stops: blockData.stops,
    }
    if (blockData.note !== undefined) day.note = blockData.note
    days.push(day)
  }
  return days
}

export function matchItineraries(query: ItineraryQuery, limit = 3): ItineraryMatch[] {
  const inferredTags = extractInterestTags(query.freeText)
  const interestPool = Array.from(new Set([...query.interests, ...inferredTags]))
  const effectiveParty =
    query.party !== 'any' ? query.party : inferPartyFromText(query.freeText)
  const effectivePace = inferPaceFromText(query.freeText) ?? query.pace
  const mentions = extractPlaceMentions(query.freeText).filter((mention) =>
    mention.blockId.startsWith(`${query.city}.`)
  )
  const mentionedBlockIds = new Set(mentions.map((mention) => mention.blockId))

  const scored = ITINERARY_TEMPLATES.filter((template) => template.city === query.city).map(
    (template, index) => {
      let score = BASE_SCORE
      const reasons: string[] = []

      score += daysScore(template.days, query.days)
      if (template.days === query.days) {
        reasons.push(`여행일수 ${query.days}일 일치`)
      } else {
        reasons.push(`${query.days}일에 맞춰 동선 조정`)
      }

      if (effectiveParty) {
        if (template.parties.includes(effectiveParty)) {
          score += PARTY_SCORE
          reasons.push(PARTY_REASON_LABELS[effectiveParty])
        }
      } else {
        score += 8
      }

      const pacePoints = paceScore(template.pace, effectivePace)
      score += pacePoints
      if (pacePoints === PACE_SCORE) reasons.push(PACE_REASON_LABELS[template.pace])

      const matched = interestOverlap(interestPool, template)
      if (interestPool.length > 0) {
        score += Math.round((INTEREST_SCORE_MAX * matched.length) / interestPool.length)
      } else {
        score += 10
      }
      for (const tag of matched.slice(0, 3)) {
        reasons.push(`${ITINERARY_INTEREST_LABELS[tag]} 선호 반영`)
      }

      const routeIds = resolveRouteBlocks(
        template,
        query,
        interestPool,
        effectiveParty,
        mentionedBlockIds
      )
      const routeSet = new Set(routeIds)
      const placeHits = mentions.filter((mention) => routeSet.has(mention.blockId))
      const inferredMatched = inferredTags.filter((tag) => template.interests.includes(tag)).length
      const freeTextBonus = Math.min(
        FREETEXT_SCORE_MAX,
        placeHits.length * 5 + inferredMatched * 2
      )
      score += freeTextBonus
      for (const mention of placeHits.slice(0, 2)) {
        reasons.push(`요청하신 ${mention.keyword} 일정 포함`)
      }

      return {
        template,
        index,
        rawScore: score,
        daysDiff: Math.abs(template.days - query.days),
        reasons,
        routeIds,
      }
    }
  )

  return scored
    .sort(
      (a, b) =>
        b.rawScore - a.rawScore || a.daysDiff - b.daysDiff || a.index - b.index
    )
    .slice(0, limit)
    .map(({ template, rawScore, reasons, routeIds }) => ({
      id: template.id,
      name: template.name,
      city: template.city,
      dayCount: routeIds.length,
      parties: template.parties,
      pace: template.pace,
      score: Math.max(0, Math.min(100, Math.round(rawScore))),
      reasons: reasons.slice(0, 5),
      days: toMatchDays(routeIds),
    }))
}
