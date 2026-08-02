'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Bus, Loader2, Users, UserCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { getReservationPartySize } from '@/utils/reservationUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeTourDateForDb } from '@/lib/utils'
import {
  computePerTourCapacityRows,
  pickTourWithMostSpotsLeft,
  type PerTourCapacityRow,
} from '@/lib/scheduleTourCapacity'
import type { Product } from '@/types/reservation'

/** tours.reservation_ids 정규화 (TourConnectionSection과 동일 규칙) */
function normalizeTourReservationIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v).trim()).filter((s) => s.length > 0))]
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return []
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t) as unknown
        return Array.isArray(parsed) ? normalizeTourReservationIds(parsed) : []
      } catch {
        return []
      }
    }
    if (t.includes(',')) {
      return [...new Set(t.split(',').map((s) => s.trim()).filter((s) => s.length > 0))]
    }
    return [t]
  }
  return []
}

type TeamRow = { name_ko: string | null; name_en: string | null; nick_name?: string | null }

function displayStaffName(row: TeamRow | null, fallbackEmail: string | null | undefined): string {
  if (!fallbackEmail?.trim()) return '미정'
  if (!row) return fallbackEmail.trim()
  const ko = row.name_ko?.trim()
  const en = row.name_en?.trim()
  const nick = row.nick_name?.trim()
  if (ko && nick) return `${ko} (${nick})`
  if (ko) return ko
  if (en) return en
  return fallbackEmail.trim()
}

function secondStaffLabel(teamType: string | null | undefined): string {
  if (teamType === 'guide+driver') return '드라이버'
  if (teamType === '2guide') return '2번째 가이드'
  return '어시스턴트'
}

interface TourRow {
  id: string
  tour_date: string
  product_id: string | null
  tour_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_car_id: string | null
  team_type: string | null
  reservation_ids: unknown
  tour_start_datetime?: string | null
  max_participants?: number | null
  guide?: TeamRow | null
  assistant?: TeamRow | null
  vehicle?: { vehicle_number: string | null; nick: string | null } | null
}

export interface ImportTourDaySummaryProps {
  tourDate: string
  productId: string
  products: Product[]
  locale: string
  /** 2개 이상 투어일 때 저장 시 배정할 투어 (미선택 시 여유 좌석 많은 투어로 자동 배정) */
  selectedTourId?: string | null
  onSelectedTourIdChange?: (tourId: string | null) => void
}

export default function ImportTourDaySummary({
  tourDate,
  productId,
  products,
  locale,
  selectedTourId = null,
  onSelectedTourIdChange,
}: ImportTourDaySummaryProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tours, setTours] = useState<TourRow[]>([])
  const [reservationInfoById, setReservationInfoById] = useState<
    Map<string, { party: number; status: string }>
  >(new Map())

  const dateNorm = useMemo(() => normalizeTourDateForDb(tourDate) || tourDate?.trim() || '', [tourDate])

  const productLabel = useMemo(() => {
    if (!productId) return ''
    const p = products.find((x) => x.id === productId)
    return (p as { name_ko?: string; name?: string } | undefined)?.name_ko || (p as { name?: string } | undefined)?.name || productId
  }, [productId, products])

  useEffect(() => {
    let cancelled = false

    const fetchTeamMember = async (emailOrId: string | null) => {
      if (!emailOrId?.trim()) return null
      const value = emailOrId.trim()
      try {
        const { data: directData, error: directError } = await supabase
          .from('team')
          .select('name_ko, name_en, nick_name')
          .eq('email', value)
          .maybeSingle()
        if (!directError && directData) return directData as TeamRow
        if (directError && directError.code !== 'PGRST116') {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_team_member_info', { p_email: value })
          if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
            return rpcData[0] as TeamRow
          }
        }
      } catch {
        /* empty */
      }
      return null
    }

    const fetchVehicle = async (vehicleId: string | null) => {
      if (!vehicleId) return null
      const { data, error } = await supabase.from('vehicles').select('vehicle_number, nick').eq('id', vehicleId).maybeSingle()
      if (error && error.code !== 'PGRST116') return null
      return data
    }

    async function run() {
      if (!dateNorm || !productId) {
        setTours([])
        setReservationInfoById(new Map())
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('tours')
          .select('id, tour_date, product_id, tour_status, tour_guide_id, assistant_id, tour_car_id, team_type, reservation_ids, tour_start_datetime, max_participants')
          .eq('product_id', productId)
          .eq('tour_date', dateNorm)
          .order('created_at', { ascending: true })

        if (cancelled) return

        if (qErr) {
          if (isAbortLikeError(qErr)) {
            setTours([])
            setReservationInfoById(new Map())
            return
          }
          setError(qErr.message)
          setTours([])
          setReservationInfoById(new Map())
          return
        }

        const rawList = (data || []) as Record<string, unknown>[]
        const active = rawList.filter((t) => !isTourCancelled(t.tour_status as string | null))

        const enriched = await Promise.all(
          active.map(async (tour) => {
            const guide = await fetchTeamMember((tour.tour_guide_id as string | null) ?? null)
            const assistant = await fetchTeamMember((tour.assistant_id as string | null) ?? null)
            const vehicle = await fetchVehicle((tour.tour_car_id as string | null) ?? null)
            return {
              ...(tour as unknown as TourRow),
              guide,
              assistant,
              vehicle,
            }
          })
        )

        if (cancelled) return

        const idSet = new Set<string>()
        for (const tour of enriched) {
          normalizeTourReservationIds(tour.reservation_ids).forEach((id) => idSet.add(id))
        }

        const nextMap = new Map<string, { party: number; status: string }>()
        if (idSet.size > 0) {
          const idList = Array.from(idSet)
          const chunkSize = 200
          for (let i = 0; i < idList.length; i += chunkSize) {
            const chunk = idList.slice(i, i + chunkSize)
            const { data: rows, error: resErr } = await supabase
              .from('reservations')
              .select('id, adults, child, infant, total_people, status, tour_date, product_id')
              .in('id', chunk)
            if (resErr) {
              if (!isAbortLikeError(resErr)) {
                console.error('ImportTourDaySummary: 예약 조회 실패', resErr)
              }
              continue
            }
            for (const row of rows || []) {
              const r = row as { id: string; status?: string | null }
              const party = getReservationPartySize(row as Record<string, unknown>)
              nextMap.set(String(r.id), {
                party,
                status: String(r.status || '').toLowerCase(),
              })
            }
          }
        }

        if (cancelled) return
        setReservationInfoById(nextMap)
        setTours(enriched as TourRow[])
      } catch (e) {
        if (cancelled || isAbortLikeError(e)) return
        setError(e instanceof Error ? e.message : '투어 정보를 불러오지 못했습니다.')
        setTours([])
        setReservationInfoById(new Map())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [dateNorm, productId])

  const perTourCapacity = useMemo((): Map<string, PerTourCapacityRow> => {
    if (!dateNorm || !productId || tours.length === 0) return new Map()
    const reservationRows = Array.from(reservationInfoById.entries()).map(([id, info]) => ({
      id,
      tour_date: dateNorm,
      product_id: productId,
      total_people: info.party,
      status: info.status,
    }))
    const rows = computePerTourCapacityRows(
      tours.map((t) => ({
        id: t.id,
        tour_date: t.tour_date,
        tour_status: t.tour_status,
        max_participants: t.max_participants ?? null,
        reservation_ids: normalizeTourReservationIds(t.reservation_ids),
        product_id: t.product_id,
      })),
      reservationRows,
      dateNorm,
      productId
    )
    return new Map(rows.map((r) => [r.tourId, r]))
  }, [dateNorm, productId, tours, reservationInfoById])

  const recommendedTourId = useMemo(
    () => pickTourWithMostSpotsLeft(Array.from(perTourCapacity.values())),
    [perTourCapacity]
  )

  const showTourPicker = tours.length >= 2 && !!onSelectedTourIdChange

  const { totalConfirmedOnTours, perTourConfirmed } = useMemo(() => {
    const perTour: { id: string; confirmed: number }[] = []
    let total = 0
    for (const tour of tours) {
      const ids = normalizeTourReservationIds(tour.reservation_ids)
      let sum = 0
      for (const rid of ids) {
        const info = reservationInfoById.get(rid)
        if (info?.status === 'confirmed') sum += info.party
      }
      total += sum
      perTour.push({ id: tour.id, confirmed: sum })
    }
    return { totalConfirmedOnTours: total, perTourConfirmed: new Map(perTour.map((x) => [x.id, x.confirmed])) }
  }, [tours, reservationInfoById])

  if (!dateNorm || !productId) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-white/60 text-center text-xs text-gray-500">
        <Calendar className="w-6 h-6 mx-auto mb-2 text-gray-400" aria-hidden />
        투어 날짜와 상품을 선택하면 해당일 스케줄(투어 수·확정 인원·가이드·차량)이 표시됩니다.
      </div>
    )
  }

  if (loading && tours.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 border border-gray-200 rounded-xl bg-white/80">
        <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden />
        투어 현황 불러오는 중…
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-red-100 rounded-xl p-4 bg-red-50/80 text-sm text-red-800 flex gap-2 items-start">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
        <span>{error}</span>
      </div>
    )
  }

  const startFmt = (iso: string | null | undefined) => {
    if (!iso) return null
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return null
      return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-3 border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-2">
      <div>
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-600 shrink-0" aria-hidden />
          해당일 투어 현황
        </h3>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          <span className="font-medium text-gray-800">{dateNorm}</span>
          <span className="text-gray-400 mx-1">·</span>
          <span className="text-gray-800">{productLabel}</span>
        </p>
        <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" aria-hidden />
            투어 {tours.length}건
          </span>
          <span className="text-gray-300">|</span>
          <span>확정 예약 인원 합계 {totalConfirmedOnTours}명</span>
          <span className="text-gray-400">(예약 상태가 확정인 인원만)</span>
        </p>
        {showTourPicker && (
          <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
            투어가 2건 이상입니다. 저장 시 배정할 투어를 선택하세요.
            {!selectedTourId && recommendedTourId && (
              <span className="block mt-1 text-teal-700">
                선택하지 않으면 여유 좌석이 가장 많은 투어에 자동 배정됩니다.
              </span>
            )}
          </p>
        )}
      </div>

      {tours.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg bg-white/70">
          이 날짜·상품으로 등록된 투어가 없습니다. 예약 저장 후 투어에 배정할 수 있습니다.
        </div>
      ) : (
        <ul className="space-y-2.5 max-h-[min(420px,55vh)] overflow-y-auto pr-0.5" role={showTourPicker ? 'radiogroup' : undefined} aria-label={showTourPicker ? '배정할 투어 선택' : undefined}>
          {tours.map((tour, tourIndex) => {
            const confirmed = perTourConfirmed.get(tour.id) ?? 0
            const capacity = perTourCapacity.get(tour.id)
            const assigned = capacity?.assigned ?? confirmed
            const maxPax = capacity?.max ?? 12
            const spotsLeft = capacity?.spotsLeft ?? Math.max(0, maxPax - assigned)
            const st = (tour.tour_status || '—').toString()
            const secondLabel = secondStaffLabel(tour.team_type)
            const vehicleLine =
              tour.vehicle?.nick || tour.vehicle?.vehicle_number
                ? [tour.vehicle?.nick, tour.vehicle?.vehicle_number].filter(Boolean).join(' · ')
                : null
            const isSelected = selectedTourId === tour.id
            const isRecommended = !selectedTourId && recommendedTourId === tour.id
            const tourLabel = `투어 ${tourIndex + 1}`

            const cardInner = (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {showTourPicker && (
                        <span
                          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-gray-300 bg-white'
                          }`}
                          aria-hidden
                        >
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-gray-800">{tourLabel}</span>
                      {isRecommended && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-medium">
                          자동 배정 추천
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">{st}</span>
                    </div>
                    <p className="font-mono text-[10px] text-gray-400 truncate max-w-[220px] mt-0.5" title={tour.id}>
                      {tour.id}
                    </p>
                    {startFmt(tour.tour_start_datetime) && (
                      <p className="text-[11px] text-gray-500 mt-0.5">시작 {startFmt(tour.tour_start_datetime)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-500">배정 / 정원</p>
                    <p className="text-sm font-semibold text-teal-800">
                      {assigned} / {maxPax}명
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      여유 <span className="font-medium text-gray-800">{spotsLeft}석</span>
                    </p>
                    <Link
                      href={`/${locale}/admin/tours/${tour.id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      투어 상세
                      <ExternalLink className="w-3 h-3" aria-hidden />
                    </Link>
                  </div>
                </div>
                <dl className="space-y-1.5 text-[11px] text-gray-700">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-gray-500 flex items-center gap-0.5">
                      <UserCircle2 className="w-3.5 h-3.5" aria-hidden />
                      가이드
                    </dt>
                    <dd className="min-w-0">{displayStaffName(tour.guide ?? null, tour.tour_guide_id)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-gray-500">{secondLabel}</dt>
                    <dd className="min-w-0">{displayStaffName(tour.assistant ?? null, tour.assistant_id)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-gray-500 flex items-center gap-0.5">
                      <Bus className="w-3.5 h-3.5" aria-hidden />
                      배차
                    </dt>
                    <dd className="min-w-0">{vehicleLine ?? '차량 미정'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-gray-500">확정 인원</dt>
                    <dd className="min-w-0">{confirmed}명</dd>
                  </div>
                </dl>
              </>
            )

            if (!showTourPicker) {
              return (
                <li
                  key={tour.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm"
                >
                  {cardInner}
                </li>
              )
            }

            return (
              <li key={tour.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectedTourIdChange?.(isSelected ? null : tour.id)}
                  className={`w-full rounded-lg border p-3 text-xs shadow-sm text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'
                  }`}
                >
                  {cardInner}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
