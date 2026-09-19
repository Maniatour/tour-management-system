'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, MapPin, Route, Sparkles, Users } from 'lucide-react'
import { matchItineraries } from '@/lib/itinerary/matcher'
import {
  ITINERARY_CITY_LABELS,
  ITINERARY_INTEREST_LABELS,
  ITINERARY_PARTY_LABELS,
  ITINERARY_PACE_LABELS,
  ITINERARY_TEMPLATE_COUNT,
} from '@/lib/itinerary/templates'
import type {
  CityCode,
  InterestTag,
  ItineraryQuery,
  PaceType,
  PartyType,
} from '@/lib/itinerary/types'

const STORAGE_KEY = 'tms:product-itinerary-matcher:v1'

const CITY_CODES = Object.keys(ITINERARY_CITY_LABELS) as CityCode[]
const PARTY_CODES = Object.keys(ITINERARY_PARTY_LABELS) as PartyType[]
const PACE_CODES = Object.keys(ITINERARY_PACE_LABELS) as PaceType[]
const INTEREST_TAGS = Object.keys(ITINERARY_INTEREST_LABELS) as InterestTag[]
const DAY_OPTIONS = [1, 2, 3, 4, 5]

const SELECT_CLASS =
  'mt-1 w-full rounded-xl border border-[#d1d5db] bg-white px-3 py-2.5 text-sm font-normal text-[#1a2b49] outline-none focus:border-[#0071eb] focus-visible:ring-2 focus-visible:ring-[#0071eb]/30'
const LABEL_CLASS = 'block text-sm font-semibold text-[#374151]'

type StoredState = {
  city?: CityCode
  days?: number
  party?: PartyType
  pace?: PaceType
  interests?: InterestTag[]
  freeText?: string
}

function readStoredState(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredState
  } catch {
    return null
  }
}

export default function ProductItineraryMatcher({ locale }: { locale: string }) {
  const [city, setCity] = useState<CityCode>('danang')
  const [days, setDays] = useState(3)
  const [party, setParty] = useState<PartyType>('any')
  const [pace, setPace] = useState<PaceType>('balanced')
  const [interests, setInterests] = useState<InterestTag[]>([])
  const [freeText, setFreeText] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const stored = readStoredState()
    if (!stored) return
    if (stored.city && CITY_CODES.includes(stored.city)) setCity(stored.city)
    if (stored.days && DAY_OPTIONS.includes(stored.days)) setDays(stored.days)
    if (stored.party && PARTY_CODES.includes(stored.party)) setParty(stored.party)
    if (stored.pace && PACE_CODES.includes(stored.pace)) setPace(stored.pace)
    if (Array.isArray(stored.interests)) {
      setInterests(stored.interests.filter((tag) => INTEREST_TAGS.includes(tag)))
    }
    if (typeof stored.freeText === 'string') setFreeText(stored.freeText)
  }, [])

  useEffect(() => {
    try {
      const payload: StoredState = { city, days, party, pace, interests, freeText }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // 저장 실패는 추천 기능과 무관 — 무시
    }
  }, [city, days, party, pace, interests, freeText])

  const matches = useMemo(
    () => matchItineraries({ city, days, party, pace, interests, freeText } satisfies ItineraryQuery),
    [city, days, party, pace, interests, freeText]
  )

  // TODO(i18n): 1차는 한국어 페이지만 노출. 다른 locale은 문구/데이터 확장 후 오픈.
  if (locale !== 'ko') return null

  const toggleInterest = (tag: InterestTag) => {
    setInterests((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    )
  }

  return (
    <section
      className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
      aria-labelledby="itinerary-matcher-title"
    >
      <div className="flex flex-col gap-3 border-b border-[#eef0f3] px-4 py-4 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[#1a2b49]">
            <Sparkles className="h-4 w-4 text-[#0071eb]" aria-hidden />
            여행 일정 추천
          </div>
          <h2
            id="itinerary-matcher-title"
            className="text-xl font-bold tracking-tight text-[#1a2b49] md:text-2xl"
          >
            도시와 여행 스타일을 알려주세요
          </h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            {ITINERARY_TEMPLATE_COUNT}개의 기본 일정 중 비슷한 일정을 찾아드려요.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#eff8ff] px-3 py-1 text-xs font-semibold text-[#0071eb]">
          {CITY_CODES.length}개 도시 · 기준 일정 {ITINERARY_TEMPLATE_COUNT}개
        </span>
      </div>

      <form
        className="px-4 py-4 md:px-6 md:py-5"
        onSubmit={(event) => {
          event.preventDefault()
          setSearched(true)
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={LABEL_CLASS} htmlFor="itinerary-city">
            도시
            <select
              id="itinerary-city"
              value={city}
              onChange={(event) => setCity(event.target.value as CityCode)}
              className={SELECT_CLASS}
            >
              {CITY_CODES.map((code) => (
                <option key={code} value={code}>
                  {ITINERARY_CITY_LABELS[code]}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS} htmlFor="itinerary-days">
            여행 일수
            <select
              id="itinerary-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className={SELECT_CLASS}
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day}일
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS} htmlFor="itinerary-party">
            동행 유형
            <select
              id="itinerary-party"
              value={party}
              onChange={(event) => setParty(event.target.value as PartyType)}
              className={SELECT_CLASS}
            >
              {PARTY_CODES.map((code) => (
                <option key={code} value={code}>
                  {ITINERARY_PARTY_LABELS[code]}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS} htmlFor="itinerary-pace">
            여행 템포
            <select
              id="itinerary-pace"
              value={pace}
              onChange={(event) => setPace(event.target.value as PaceType)}
              className={SELECT_CLASS}
            >
              {PACE_CODES.map((code) => (
                <option key={code} value={code}>
                  {ITINERARY_PACE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-[#374151]">관심사</legend>
          <div className="flex flex-wrap gap-2">
            {INTEREST_TAGS.map((tag) => {
              const active = interests.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleInterest(tag)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071eb]/40 ${
                    active
                      ? 'border-[#0071eb] bg-[#eff8ff] text-[#0071eb]'
                      : 'border-[#d1d5db] bg-white text-[#4b5563] hover:border-[#9ca3af]'
                  }`}
                >
                  {ITINERARY_INTEREST_LABELS[tag]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className={`${LABEL_CLASS} mt-4`} htmlFor="itinerary-freetext">
          자유 요청
          <textarea
            id="itinerary-freetext"
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            placeholder="예: 9살 아이와 3일 여행합니다. 너무 빡빡하지 않았으면 좋겠고 바다와 야시장을 좋아합니다. 하루는 테마파크를 넣고 싶어요."
            rows={3}
            className="mt-1 w-full resize-y rounded-xl border border-[#d1d5db] bg-white px-3 py-2.5 text-sm font-normal text-[#1a2b49] outline-none placeholder:text-[#9ca3af] focus:border-[#0071eb] focus-visible:ring-2 focus-visible:ring-[#0071eb]/30"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6b7280]">
            아이·부모님·카페·야경·휴양·섬투어 등 자유 요청의 키워드도 함께 반영합니다.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0071eb] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#005fc5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071eb]/40"
          >
            <Route className="h-4 w-4" aria-hidden />
            비슷한 일정 찾기
          </button>
        </div>
      </form>

      {searched ? (
        <div
          className="border-t border-[#eef0f3] bg-[#fafafa] px-4 py-4 md:px-6 md:py-5"
          role="region"
          aria-live="polite"
          aria-label="추천 일정 결과"
        >
          <h3 className="sr-only">추천 일정</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {ITINERARY_CITY_LABELS[city]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {days}일
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">
              <Users className="h-3.5 w-3.5" aria-hidden /> {ITINERARY_PARTY_LABELS[party]}
            </span>
          </div>

          <div className="space-y-3">
            {matches.map((match, index) => (
              <article
                key={match.id}
                className={`overflow-hidden rounded-2xl border bg-white ${
                  index === 0 ? 'border-[#8fc5ff] shadow-sm' : 'border-[#e5e7eb]'
                }`}
              >
                <div className="flex items-start justify-between gap-4 px-4 py-4 md:px-5">
                  <div>
                    <p className="text-xs font-bold text-[#0071eb]">추천 {index + 1}</p>
                    <h4 className="mt-1 text-base font-bold text-[#1a2b49]">{match.name}</h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6b7280]">
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                        {ITINERARY_CITY_LABELS[match.city]}
                      </span>
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                        {match.dayCount}일
                      </span>
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                        {match.parties.map((code) => ITINERARY_PARTY_LABELS[code]).join('·')}
                      </span>
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                        {ITINERARY_PACE_LABELS[match.pace]}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-[#4b5563]">
                      {match.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-1.5">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#0071eb]" aria-hidden />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 text-right">
                    <strong className="block text-2xl font-black leading-none text-[#0071eb]">
                      {match.score}%
                    </strong>
                    <span className="text-[11px] text-[#6b7280]">요청 유사도</span>
                  </div>
                </div>

                <ol className="space-y-2 border-t border-[#eef0f3] px-4 py-4 md:px-5">
                  {match.days.map((day, dayIndex) => (
                    <li
                      key={`${match.id}-${day.blockId}`}
                      className="grid grid-cols-[58px_minmax(0,1fr)] gap-3 rounded-xl border border-[#eef0f3] p-3 md:grid-cols-[72px_minmax(0,1fr)]"
                    >
                      <strong className="text-xs font-black text-[#0071eb]">
                        DAY {dayIndex + 1}
                      </strong>
                      <div>
                        <h5 className="text-sm font-bold text-[#1a2b49]">{day.title}</h5>
                        <p className="mt-1 text-xs leading-5 text-[#4b5563]">
                          {day.stops.join(' → ')}
                        </p>
                        {day.note ? (
                          <p className="mt-1 text-[11px] text-[#9ca3af]">{day.note}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
