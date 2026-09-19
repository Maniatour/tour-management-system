import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractInterestTags,
  extractPlaceMentions,
  inferPartyFromText,
} from '@/lib/itinerary/keywords'
import { matchItineraries } from '@/lib/itinerary/matcher'
import { ITINERARY_TEMPLATES } from '@/lib/itinerary/templates'
import type { ItineraryQuery } from '@/lib/itinerary/types'

function query(partial: Partial<ItineraryQuery> = {}): ItineraryQuery {
  return {
    city: 'danang',
    days: 3,
    party: 'any',
    pace: 'balanced',
    interests: [],
    freeText: '',
    ...partial,
  }
}

test('다른 도시의 일정은 결과에서 제외된다', () => {
  const matches = matchItineraries(query({ city: 'hanoi', days: 3 }), 10)
  assert.ok(matches.length > 0)
  assert.ok(matches.every((match) => match.city === 'hanoi'))
})

test('여행 일수가 일치하는 일정이 더 높은 점수를 받는다', () => {
  const matches = matchItineraries(query({ city: 'danang', days: 3 }), 10)
  const threeDay = matches.find((match) => match.id === 'dn-first-3d')
  const twoDay = matches.find((match) => match.id === 'dn-classic-2d')
  assert.ok(threeDay && twoDay)
  assert.ok(threeDay.score > twoDay.score)
})

test('동행 유형이 일치하는 일정이 상위에 온다', () => {
  const matches = matchItineraries(
    query({ city: 'phuquoc', days: 3, party: 'parents', pace: 'relaxed' }),
    10
  )
  assert.equal(matches[0]?.id, 'pq-parents-3d')
})

test('관심사 일치가 점수에 반영된다', () => {
  const beachy = matchItineraries(
    query({ city: 'nhatrang', days: 3, interests: ['beach', 'nature'] }),
    10
  )
  const top = beachy[0]
  assert.ok(top)
  assert.ok(['nt-sea-3d', 'nt-photo-3d', 'nt-wellness-3d'].includes(top.id))
})

test('자유문장에서 관심사·동행 키워드를 추출한다', () => {
  const tags = extractInterestTags('9살 아이와 여행합니다. 바다와 야시장을 좋아하고 카페도 가고 싶어요.')
  assert.ok(tags.includes('family'))
  assert.ok(tags.includes('beach'))
  assert.ok(tags.includes('night'))
  assert.ok(tags.includes('food'))
  assert.equal(inferPartyFromText('부모님과 함께 갑니다'), 'parents')
  assert.equal(inferPartyFromText('혼자 가는 여행'), 'solo')
})

test('선택한 동행 유형이 자유문장 추론보다 우선한다', () => {
  const matches = matchItineraries(
    query({
      city: 'phuquoc',
      days: 3,
      party: 'parents',
      pace: 'relaxed',
      freeText: '친구와 가요', // 문장은 friends를 추론하지만 selector가 우선
    }),
    10
  )
  assert.equal(matches[0]?.id, 'pq-parents-3d')
})

test('요청 일수가 템플릿보다 길면 같은 도시의 미사용 블록으로 확장한다', () => {
  const matches = matchItineraries(
    query({ city: 'danang', days: 5, interests: ['beach', 'wellness'] }),
    10
  )
  const expanded = matches.find((match) => match.dayCount === 5)
  assert.ok(expanded)
  const ids = expanded.days.map((day) => day.blockId)
  assert.equal(new Set(ids).size, ids.length, '같은 day block이 중복되면 안 된다')
  assert.ok(ids.every((id) => id.startsWith('danang.')))
})

test('요청 일수가 짧으면 블록을 잘라낸다', () => {
  const matches = matchItineraries(query({ city: 'hanoi', days: 2 }), 10)
  assert.ok(matches.every((match) => match.dayCount === 2))
})

test('요청 장소가 언급되면 해당 블록을 포함한 일정이 상위에 온다', () => {
  const matches = matchItineraries(
    query({ city: 'hanoi', days: 3, interests: ['nature', 'photo'], freeText: '닌빈을 꼭 가고 싶어요' }),
    3
  )
  const top = matches[0]
  assert.ok(top)
  assert.ok(top.days.some((day) => day.blockId === 'hanoi.ninhbinh'))
})

test('spec TEST 1: 다낭 3일 아이 동반 바다·테마파크 → 아이와 다낭 3일', () => {
  const matches = matchItineraries(
    query({
      city: 'danang',
      days: 3,
      party: 'family',
      pace: 'relaxed',
      interests: ['beach', 'family'],
      freeText:
        '9살 아이와 여행합니다. 바다 좋아하고 하루는 바나힐 같은 테마파크를 가고 싶습니다. 너무 빡빡하지 않았으면 합니다.',
    })
  )
  assert.equal(matches[0]?.id, 'dn-family-3d')
  assert.ok(matches[0]?.days.some((day) => day.blockId === 'danang.bana'))
})

test('spec TEST 2: 하노이 3일 커플 자연·사진 + 닌빈 요청 → 닌빈 포함 일정', () => {
  const matches = matchItineraries(
    query({
      city: 'hanoi',
      days: 3,
      party: 'couple',
      pace: 'balanced',
      interests: ['nature', 'photo'],
      freeText: '닌빈을 꼭 가고 싶고 사진 찍는 걸 좋아합니다.',
    })
  )
  assert.equal(matches[0]?.id, 'hn-ninhbinh-3d')
})

test('spec TEST 3: 푸꾸옥 3일 부모님 휴양·해변·맛집 → 부모님 일정', () => {
  const matches = matchItineraries(
    query({
      city: 'phuquoc',
      days: 3,
      party: 'parents',
      pace: 'relaxed',
      interests: ['wellness', 'beach', 'food'],
      freeText: '부모님과 가며 많이 걷는 일정은 싫고 마사지와 바다를 즐기고 싶습니다.',
    })
  )
  assert.equal(matches[0]?.id, 'pq-parents-3d')
})

test('spec TEST 4: 나트랑 3일 아이 동반 테마파크·해변 → 빈원더스 포함 일정', () => {
  const matches = matchItineraries(
    query({
      city: 'nhatrang',
      days: 3,
      party: 'family',
      pace: 'relaxed',
      interests: ['family', 'beach'],
    })
  )
  const top = matches[0]
  assert.ok(top)
  assert.equal(top.id, 'nt-family-3d')
  assert.ok(top.days.some((day) => day.blockId === 'nhatrang.vin'))
})

test('spec TEST 5: 호치민 4일 친구 꽉 채우기 역사·자연·로컬 → 시내+꾸찌+메콩+로컬', () => {
  const matches = matchItineraries(
    query({
      city: 'hcmc',
      days: 4,
      party: 'friends',
      pace: 'full',
      interests: ['culture', 'nature', 'local'],
    })
  )
  const top = matches[0]
  assert.ok(top)
  assert.equal(top.id, 'sg-full-4d')
  const ids = top.days.map((day) => day.blockId)
  for (const required of ['hcmc.core', 'hcmc.cuchi', 'hcmc.mekong', 'hcmc.local']) {
    assert.ok(ids.includes(required), `${required} 블록이 포함되어야 한다`)
  }
})

test('도시별 템플릿이 최소 8개 이상 존재한다', () => {
  const cities = ['hanoi', 'hcmc', 'danang', 'nhatrang', 'phuquoc'] as const
  for (const city of cities) {
    const count = ITINERARY_TEMPLATES.filter((template) => template.city === city).length
    assert.ok(count >= 8, `${city} 템플릿 ${count}개`)
  }
  assert.ok(ITINERARY_TEMPLATES.length >= 40)
})

test('장소 키워드가 올바른 day block에 매핑된다', () => {
  const mentions = extractPlaceMentions('바나힐과 호이안을 가고 싶어요')
  const ids = mentions.map((mention) => mention.blockId)
  assert.ok(ids.includes('danang.bana'))
  assert.ok(ids.includes('danang.hoian'))
})
