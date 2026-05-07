'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Bus, Loader2, Users, UserCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { getReservationPartySize } from '@/utils/reservationUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeTourDateForDb } from '@/lib/utils'
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
  guide?: TeamRow | null
  assistant?: TeamRow | null
  vehicle?: { vehicle_number: string | null; nick: string | null } | null
}

export interface ImportTourDaySummaryProps {
  tourDate: string
  productId: string
  products: Product[]
  locale: string
}

export default function ImportTourDaySummary({ tourDate, productId, products, locale }: ImportTourDaySummaryProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tours, setTours] = useState<TourRow[]>([])
  const [reservationInfoById, setReservationInfoById] = useState<
    Map<string, { party: number; confirmed: boolean }>
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
          .select('id, tour_date, product_id, tour_status, tour_guide_id, assistant_id, tour_car_id, team_type, reservation_ids, tour_start_datetime')
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

        const nextMap = new Map<string, { party: number; confirmed: boolean }>()
        if (idSet.size > 0) {
          const idList = Array.from(idSet)
          const chunkSize = 200
          for (let i = 0; i < idList.length; i += chunkSize) {
            const chunk = idList.slice(i, i + chunkSize)
            const { data: rows, error: resErr } = await supabase
              .from('reservations')
              .select('id, adults, child, infant, total_people, status')
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
                confirmed: (r.status || '').toLowerCase() === 'confirmed',
              })
            }
          }
        }

        if (cancelled) return
        setReservationInfoById(nextMap)
        setTours(enriched)
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

  const { totalConfirmedOnTours, perTourConfirmed } = useMemo(() => {
    const perTour: { id: string; confirmed: number }[] = []
    let total = 0
    for (const tour of tours) {
      const ids = normalizeTourReservationIds(tour.reservation_ids)
      let sum = 0
      for (const rid of ids) {
        const info = reservationInfoById.get(rid)
        if (info?.confirmed) sum += info.party
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
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" aria-hidden />
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
      </div>

      {tours.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg bg-white/70">
          이 날짜·상품으로 등록된 투어가 없습니다. 예약 저장 후 투어에 배정할 수 있습니다.
        </div>
      ) : (
        <ul className="space-y-2.5 max-h-[min(420px,55vh)] overflow-y-auto pr-0.5">
          {tours.map((tour) => {
            const confirmed = perTourConfirmed.get(tour.id) ?? 0
            const st = (tour.tour_status || '—').toString()
            const secondLabel = secondStaffLabel(tour.team_type)
            const vehicleLine =
              tour.vehicle?.nick || tour.vehicle?.vehicle_number
                ? [tour.vehicle?.nick, tour.vehicle?.vehicle_number].filter(Boolean).join(' · ')
                : null

            return (
              <li
                key={tour.id}
                className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] text-gray-500 truncate max-w-[200px]" title={tour.id}>
                        {tour.id}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">{st}</span>
                    </div>
                    {startFmt(tour.tour_start_datetime) && (
                      <p className="text-[11px] text-gray-500 mt-0.5">시작 {startFmt(tour.tour_start_datetime)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-500">확정 인원</p>
                    <p className="text-sm font-semibold text-teal-800">{confirmed}명</p>
                    <Link
                      href={`/${locale}/admin/tours/${tour.id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline mt-1"
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
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
