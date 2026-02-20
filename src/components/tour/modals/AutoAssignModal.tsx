'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Users, User, Car, HelpCircle, ArrowRightCircle } from 'lucide-react'
// @ts-expect-error - react-country-flag 타입 정의 없음
import ReactCountryFlag from 'react-country-flag'
import { supabase } from '@/lib/supabase'

type TourRow = {
  id: string
  tour_guide_id: string | null
  assistant_id: string | null
  reservation_ids: string[] | null
  tour_car_id: string | null
}

type TeamRow = { email: string; languages: string[] | null; name_ko?: string | null; nick_name?: string | null }
type VehicleRow = {
  id: string
  capacity: number | null
  nick?: string | null
  vehicle_number?: string | null
  vehicle_type?: string | null
  vehicle_category?: string | null
  rental_company?: string | null
  rental_start_date?: string | null
  rental_end_date?: string | null
}
type PickupHotelRow = { id: string; hotel: string; pick_up_location?: string | null }
type ReservationRow = {
  id: string
  customer_id: string | null
  pickup_hotel: string | null
  adults: number | null
  child?: number | null
  infant?: number | null
}

type Move = { reservationId: string; reservationLabel: string; fromTourId: string; toTourId: string }

const choiceLabelToKey = (
  nameKo: string | null | undefined,
  nameEn: string | null | undefined,
  optionKey: string | null | undefined
): 'L' | 'X' | '_other' => {
  const key = (optionKey && !/^[0-9a-f-]{36}$/i.test(String(optionKey)) ? String(optionKey).trim().toLowerCase() : '') || ''
  if (key === 'antelope_x' || key === 'x') return 'X'
  if (key === 'lower_antelope' || key === 'l') return 'L'
  if (key === 'upper_antelope' || key === 'u') return '_other'
  const labelEn = (nameEn || key || '').toString().trim().toLowerCase()
  const labelKo = (nameKo || '').toString().trim()
  if (labelEn.includes('antelope x canyon') || labelEn.includes('x canyon') || labelEn.includes('antelope x') || labelEn.includes('antelope_x')) return 'X'
  if (labelEn.includes('lower antelope') || labelEn.includes('lower_antelope')) return 'L'
  if (labelEn.includes('upper')) return '_other'
  if (labelEn.includes('antelope') && labelEn.includes('x')) return 'X'
  if (labelEn.includes('lower')) return 'L'
  if (/엑스|antelope\s*x|x\s*canyon/i.test(labelKo) || /앤텔로프\s*x|앤텔롭\s*x/i.test(labelKo)) return 'X'
  if (/로어|lower\s*antelope/i.test(labelKo)) return 'L'
  if (/어퍼|upper/i.test(labelKo)) return '_other'
  return '_other'
}

const isKorean = (lang: string | null | undefined): boolean => {
  if (!lang) return false
  const l = String(lang).toLowerCase().trim()
  return l === 'ko' || l === 'kr' || l === '한국어' || l === 'korean' || l === 'kr'
}

interface AutoAssignModalProps {
  isOpen: boolean
  onClose: () => void
  currentTourId: string
  productId: string
  tourDate: string
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  onSuccess: () => Promise<void>
}

export default function AutoAssignModal({
  isOpen,
  onClose,
  currentTourId,
  productId,
  tourDate,
  getCustomerName,
  getCustomerLanguage,
  onSuccess
}: AutoAssignModalProps) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamRow[]>([])
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [customerLanguages, setCustomerLanguages] = useState<Map<string, string>>(new Map())
  const [reservationChoiceMap, setReservationChoiceMap] = useState<Map<string, 'L' | 'X' | '_other'>>(new Map())
  const [showPriorityHelp, setShowPriorityHelp] = useState(false)
  const [initialTours, setInitialTours] = useState<TourRow[]>([])
  const [pickupHotels, setPickupHotels] = useState<PickupHotelRow[]>([])
  const [manualOverrides, setManualOverrides] = useState<Map<string, string>>(new Map())
  const [openMoveDropdownRid, setOpenMoveDropdownRid] = useState<string | null>(null)
  const initialToursSetRef = useRef(false)

  useEffect(() => {
    if (!openMoveDropdownRid) return
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('[data-move-dropdown]') == null) setOpenMoveDropdownRid(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMoveDropdownRid])

  const tourIds = initialTours.map(t => t.id)
  const vehicleById = useCallback((id: string) => vehicles.find(v => v.id === id), [vehicles])
  const tourById = useCallback((id: string) => initialTours.find(t => t.id === id), [initialTours])
  const teamByEmail = useCallback((email: string) => teamMembers.find(m => m.email === email), [teamMembers])
  const pickupHotelById = useCallback((id: string | null) => (id ? pickupHotels.find(h => h.id === id) : null), [pickupHotels])

  const getTeamDisplayName = useCallback((email: string | null) => {
    if (!email) return '미배정'
    const m = teamByEmail(email)
    return m ? (m.nick_name || m.name_ko || email) : email
  }, [teamByEmail])

  const getVehicleDisplayName = useCallback((vehicleId: string | null) => {
    if (!vehicleId) return '미배정'
    const v = vehicleById(vehicleId)
    if (!v) return vehicleId.slice(0, 8)
    const displayNumber = (v.nick && String(v.nick).trim()) || v.vehicle_number || ''
    if (v.vehicle_category === 'company') {
      return `${displayNumber} - ${v.vehicle_type || ''} (${v.capacity ?? 0}인승)`
    }
    return `${v.rental_company || ''} - ${v.vehicle_type || ''} (${v.capacity ?? 0}인승)`
  }, [vehicleById])

  const getChoiceLabel = useCallback((key: 'L' | 'X' | '_other') => {
    const ANTLOPE_EMOJI = '🏜️'
    if (key === 'L') return `${ANTLOPE_EMOJI} L`
    if (key === 'X') return `${ANTLOPE_EMOJI} X`
    return '기타'
  }, [])

  const getChoiceBadgeClass = useCallback((key: 'L' | 'X' | '_other') => {
    if (key === 'L') return 'bg-emerald-100 text-emerald-800 border border-emerald-300'
    if (key === 'X') return 'bg-violet-100 text-violet-800 border border-violet-300'
    return 'bg-amber-100 text-amber-800 border border-amber-200'
  }, [])

  const getFlagCode = useCallback((language: string | null | undefined): string => {
    if (!language) return 'US'
    const lang = String(language).toLowerCase().trim()
    if (lang === 'kr' || lang === 'ko' || lang === '한국어' || lang === 'korean') return 'KR'
    if (lang === 'jp' || lang === 'ja' || lang === '일본어') return 'JP'
    if (lang === 'cn' || lang === 'zh' || lang === '중국어') return 'CN'
    return 'US'
  }, [])

  const hasKorean = useCallback((tour: TourRow) => {
    const guide = tour.tour_guide_id ? teamByEmail(tour.tour_guide_id) : null
    const asst = tour.assistant_id ? teamByEmail(tour.assistant_id) : null
    const langArr = (v: TeamRow | undefined) => (v?.languages && Array.isArray(v.languages) ? v.languages : [])
    const guideLangs = langArr(guide).map((l: string) => String(l).toLowerCase())
    const asstLangs = langArr(asst).map((l: string) => String(l).toLowerCase())
    return guideLangs.includes('ko') || asstLangs.includes('ko')
  }, [teamByEmail])

  const peopleCount = useCallback((res: ReservationRow) => {
    return (res.adults || 0) + (res.child || 0) + (res.infant || 0)
  }, [])

  const tourPeopleCount = useCallback((tour: TourRow) => {
    const ids = tour.reservation_ids || []
    return reservations.filter(r => ids.includes(r.id)).reduce((sum, r) => sum + peopleCount(r), 0)
  }, [reservations, peopleCount])

  const maxCapacity = useCallback((tour: TourRow) => {
    if (!tour.tour_car_id) return null
    const v = vehicleById(tour.tour_car_id)
    if (!v || v.capacity == null) return null
    return Math.max(0, v.capacity - 2)
  }, [vehicleById])

  const applyMovesToTours = useCallback((tourList: TourRow[], moveList: Move[]): TourRow[] => {
    if (moveList.length === 0) return tourList.map(t => ({ ...t, reservation_ids: t.reservation_ids ? [...t.reservation_ids] : null }))
    const updates = new Map<string, Set<string>>()
    tourList.forEach(t => updates.set(t.id, new Set(t.reservation_ids || [])))
    moveList.forEach(m => {
      updates.get(m.fromTourId)?.delete(m.reservationId)
      updates.get(m.toTourId)?.add(m.reservationId)
    })
    return tourList.map(t => ({ ...t, reservation_ids: Array.from(updates.get(t.id) || []) }))
  }, [])

  const getMovesForStep = useCallback((stepNum: number, currentTours: TourRow[]): Move[] => {
    const next: Move[] = []
    if (stepNum === 1) {
      currentTours.forEach(tour => {
        const ids = tour.reservation_ids || []
        const hasKo = hasKorean(tour)
        ids.forEach(rid => {
          const res = reservations.find(r => r.id === rid)
          if (!res?.customer_id) return
          const lang = customerLanguages.get(res.customer_id) ?? getCustomerLanguage(res.customer_id)
          if (!isKorean(lang)) return
          if (hasKo) return
          const name = getCustomerName(res.customer_id)
          const other = currentTours.find(t => t.id !== tour.id && hasKorean(t))
          if (other) next.push({ reservationId: rid, reservationLabel: name, fromTourId: tour.id, toTourId: other.id })
        })
      })
      return next
    }
    if (stepNum === 2) {
      type ChoiceKey = 'L' | 'X' | '_other'
      const choiceOrder: ChoiceKey[] = ['L', 'X', '_other']
      const tourOrder = [...currentTours].sort((a, b) => a.id.localeCompare(b.id))
      const choiceToTourId = new Map<ChoiceKey, string>()
      choiceOrder.forEach((choice, i) => {
        const tourIndex = Math.min(i, tourOrder.length - 1)
        choiceToTourId.set(choice, tourOrder[tourIndex].id)
      })
      currentTours.forEach(tour => {
        (tour.reservation_ids || []).forEach(rid => {
          const key = (reservationChoiceMap.get(rid) || '_other') as ChoiceKey
          const targetId = choiceToTourId.get(key)
          if (!targetId || targetId === tour.id) return
          const res = reservations.find(r => r.id === rid)
          const name = res?.customer_id ? getCustomerName(res.customer_id) : rid.slice(0, 8)
          next.push({ reservationId: rid, reservationLabel: name, fromTourId: tour.id, toTourId: targetId })
        })
      })
      return next
    }
    if (stepNum === 3) {
      const countByTourAndHotel = new Map<string, Map<string, number>>()
      currentTours.forEach(tour => {
        const m = new Map<string, number>()
        ;(tour.reservation_ids || []).forEach(rid => {
          const hotel = reservations.find(r => r.id === rid)?.pickup_hotel ?? ''
          m.set(hotel, (m.get(hotel) || 0) + 1)
        })
        countByTourAndHotel.set(tour.id, m)
      })
      const hotelToTours = new Map<string, { tourId: string; count: number }[]>()
      currentTours.forEach(tour => {
        const m = countByTourAndHotel.get(tour.id)
        m?.forEach((count, hotel) => {
          if (!hotelToTours.has(hotel)) hotelToTours.set(hotel, [])
          hotelToTours.get(hotel)!.push({ tourId: tour.id, count })
        })
      })
      const primaryTourForHotel = new Map<string, string>()
      hotelToTours.forEach((arr, hotel) => {
        const best = arr.reduce((a, b) => (a.count >= b.count ? a : b), { tourId: '', count: 0 })
        primaryTourForHotel.set(hotel, best.tourId)
      })
      currentTours.forEach(tour => {
        (tour.reservation_ids || []).forEach(rid => {
          const res = reservations.find(r => r.id === rid)
          const hotel = res?.pickup_hotel ?? ''
          const targetId = primaryTourForHotel.get(hotel)
          if (!targetId || targetId === tour.id) return
          const name = res?.customer_id ? getCustomerName(res.customer_id) : rid.slice(0, 8)
          next.push({ reservationId: rid, reservationLabel: name, fromTourId: tour.id, toTourId: targetId })
        })
      })
      return next
    }
    if (stepNum === 4) {
      const tourPeople = (t: TourRow) =>
        reservations.filter(r => (t.reservation_ids || []).includes(r.id)).reduce((sum, r) => sum + peopleCount(r), 0)
      currentTours.forEach(tour => {
        const max = maxCapacity(tour)
        if (max == null) return
        const current = tourPeople(tour)
        if (current <= max) return
        let toMove = current - max
        const ids = [...(tour.reservation_ids || [])]
        ids.sort((a, b) => {
          const ra = reservations.find(r => r.id === a)
          const rb = reservations.find(r => r.id === b)
          return peopleCount(rb || {}) - peopleCount(ra || {})
        })
        const targetTour = currentTours.find(
          t => t.id !== tour.id && (maxCapacity(t) == null || tourPeople(t) < (maxCapacity(t) ?? 0))
        )
        if (!targetTour) return
        for (const rid of ids) {
          if (toMove <= 0) break
          const res = reservations.find(r => r.id === rid)
          const name = res?.customer_id ? getCustomerName(res.customer_id) : rid.slice(0, 8)
          next.push({ reservationId: rid, reservationLabel: name, fromTourId: tour.id, toTourId: targetTour.id })
          toMove -= peopleCount(res || {})
        }
      })
      return next
    }
    return []
  }, [reservations, customerLanguages, reservationChoiceMap, hasKorean, maxCapacity, peopleCount, getCustomerName, getCustomerLanguage])

  const proposedTours = useMemo(() => {
    if (initialTours.length === 0) return []
    let current = initialTours.map(t => ({ ...t, reservation_ids: t.reservation_ids ? [...t.reservation_ids] : null }))
    for (let stepNum = 1; stepNum <= 4; stepNum++) {
      const moves = getMovesForStep(stepNum, current)
      current = applyMovesToTours(current, moves)
    }
    return current
  }, [initialTours, getMovesForStep, applyMovesToTours])

  const displayTours = useMemo(() => {
    if (proposedTours.length === 0) return []
    const result = proposedTours.map(t => ({ ...t, reservation_ids: t.reservation_ids ? [...t.reservation_ids] : null }))
    manualOverrides.forEach((toTourId, rid) => {
      const fromIdx = result.findIndex(t => t.reservation_ids?.includes(rid))
      if (fromIdx >= 0 && result[fromIdx].id !== toTourId) {
        result[fromIdx].reservation_ids = result[fromIdx].reservation_ids!.filter(id => id !== rid)
        const toIdx = result.findIndex(t => t.id === toTourId)
        if (toIdx >= 0) result[toIdx].reservation_ids = [...(result[toIdx].reservation_ids || []), rid]
      }
    })
    return result
  }, [proposedTours, manualOverrides])

  const setReservationToTour = useCallback((reservationId: string, toTourId: string) => {
    setManualOverrides(prev => new Map(prev).set(reservationId, toTourId))
    setOpenMoveDropdownRid(null)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      initialToursSetRef.current = false
      setShowPriorityHelp(false)
      setManualOverrides(new Map())
      setOpenMoveDropdownRid(null)
    }
  }, [isOpen])

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen || !productId || !tourDate) return

    const load = async () => {
      setLoading(true)
      try {
        const [toursRes, teamRes, vehiclesRes, reservRes, pickupHotelsRes] = await Promise.all([
          supabase.from('tours').select('id, tour_guide_id, assistant_id, reservation_ids, tour_car_id').eq('product_id', productId).eq('tour_date', tourDate),
          supabase.from('team').select('email, languages, name_ko, nick_name'),
          supabase.from('vehicles').select('id, capacity, nick, vehicle_number, vehicle_type, vehicle_category, rental_company, rental_start_date, rental_end_date'),
          supabase.from('reservations').select('id, customer_id, pickup_hotel, adults, child, infant').eq('product_id', productId).eq('tour_date', tourDate),
          supabase.from('pickup_hotels').select('id, hotel, pick_up_location')
        ])

        // Tours
        const toursData = (toursRes.data || []) as TourRow[]
        if (!initialToursSetRef.current) {
          initialToursSetRef.current = true
          setInitialTours(toursData.map(t => ({ ...t, reservation_ids: t.reservation_ids ? [...t.reservation_ids] : null })))
        }

        // Team
        setTeamMembers((teamRes.data || []) as TeamRow[])

        // Vehicles
        setVehicles((vehiclesRes.data || []) as VehicleRow[])
        setPickupHotels((pickupHotelsRes.data || []) as PickupHotelRow[])

        // Reservations
        const reservData = (reservRes.data || []) as ReservationRow[]
        setReservations(reservData)

        const customerIds = [...new Set(reservData.map(r => r.customer_id).filter(Boolean))] as string[]
        if (customerIds.length > 0) {
          const { data: custData } = await supabase.from('customers').select('id, language').in('id', customerIds)
          const map = new Map<string, string>()
          ;(custData || []).forEach((c: { id: string; language: string | null }) => { map.set(c.id, c.language || '') })
          setCustomerLanguages(map)
        }

        // Reservation choices - 1) 조인 조회 시도, 2) 실패 시 option_id로 choice_options 별도 조회
        const resIds = reservData.map(r => r.id)
        const choiceMap = new Map<string, 'L' | 'X' | '_other'>()
        if (resIds.length > 0) {
          const batch = 100
          for (let i = 0; i < resIds.length; i += batch) {
            const batchIds = resIds.slice(i, i + batch)
            const { data: rcData, error: rcErr } = await supabase
              .from('reservation_choices')
              .select(`
                reservation_id,
                option_key,
                choice_options!inner (
                  option_key,
                  option_name,
                  option_name_ko
                )
              `)
              .in('reservation_id', batchIds)
            type RcRow = {
              reservation_id: string
              option_key?: string | null
              choice_options?: { option_key?: string | null; option_name?: string | null; option_name_ko?: string | null } | { option_key?: string | null; option_name?: string | null; option_name_ko?: string | null }[] | null
            }
            if (!rcErr && rcData && rcData.length > 0) {
              rcData.forEach((row: RcRow) => {
                const raw = row.choice_options
                const opt = Array.isArray(raw) ? raw[0] : raw
                const optionKey = (row.option_key ?? opt?.option_key ?? '') || null
                const nameKo = opt?.option_name_ko ?? null
                const nameEn = opt?.option_name ?? null
                const key = choiceLabelToKey(nameKo, nameEn, optionKey)
                const existing = choiceMap.get(row.reservation_id)
                const value = (key === 'L' || key === 'X') ? key : (existing ?? key)
                if (existing === undefined || key === 'L' || key === 'X') choiceMap.set(row.reservation_id, value)
              })
            }
            const missingIds = batchIds.filter(id => !choiceMap.has(id))
            if (missingIds.length > 0) {
              const { data: rcFallback } = await supabase
                .from('reservation_choices')
                .select('reservation_id, option_id, option_key')
                .in('reservation_id', missingIds)
              const optionIds = [...new Set((rcFallback || []).map((r: { option_id?: string | null }) => r.option_id).filter(Boolean))] as string[]
              let optionInfoById = new Map<string, { option_key?: string | null; option_name_ko?: string | null; option_name?: string | null }>()
              if (optionIds.length > 0) {
                const { data: optData } = await supabase
                  .from('choice_options')
                  .select('id, option_key, option_name_ko, option_name')
                  .in('id', optionIds)
                ;(optData || []).forEach((o: { id: string; option_key?: string | null; option_name_ko?: string | null; option_name?: string | null }) => {
                  optionInfoById.set(o.id, { option_key: o.option_key, option_name_ko: o.option_name_ko, option_name: o.option_name })
                })
              }
              ;(rcFallback || []).forEach((row: { reservation_id: string; option_id?: string | null; option_key?: string | null }) => {
                const info = row.option_id ? optionInfoById.get(row.option_id) : null
                const optionKey = row.option_key ?? info?.option_key ?? null
                const key = choiceLabelToKey(info?.option_name_ko ?? null, info?.option_name ?? null, optionKey)
                const existing = choiceMap.get(row.reservation_id)
                const value = (key === 'L' || key === 'X') ? key : (existing ?? key)
                if (existing === undefined || key === 'L' || key === 'X') choiceMap.set(row.reservation_id, value)
              })
            }
          }
          setReservationChoiceMap(choiceMap)
        }
      } catch (e) {
        console.error('AutoAssign load error:', e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isOpen, productId, tourDate])

  const saveProposedTours = useCallback(async () => {
    setApplying(true)
    try {
      for (const tour of displayTours) {
        const arr = tour.reservation_ids || []
        const { error } = await supabase.from('tours').update({ reservation_ids: arr }).eq('id', tour.id)
        if (error) throw error
      }
      setInitialTours(displayTours.map(t => ({ ...t, reservation_ids: t.reservation_ids ? [...t.reservation_ids] : null })))
      setManualOverrides(new Map())
      initialToursSetRef.current = true
      await onSuccess()
      onClose()
    } catch (e) {
      console.error('Apply error:', e)
      alert('배정 적용 중 오류가 발생했습니다.')
    } finally {
      setApplying(false)
    }
  }, [displayTours, onSuccess, onClose])

  if (!isOpen) return null

  const hasChanges = useMemo(() => {
    if (initialTours.length !== displayTours.length) return true
    for (const init of initialTours) {
      const disp = displayTours.find(t => t.id === init.id)
      if (!disp) return true
      const a = init.reservation_ids || []
      const b = disp.reservation_ids || []
      if (a.length !== b.length) return true
      const setB = new Set(b)
      if (a.some((id: string) => !setB.has(id))) return true
    }
    return false
  }, [initialTours, displayTours])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">자동 배정 (언어→초이스→호텔→인원 우선순위 적용 결과)</h2>
              <button
                type="button"
                onClick={() => setShowPriorityHelp(v => !v)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                title="우선순위 설명 보기"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          {showPriorityHelp && (
            <div className="px-4 pb-4 pt-0">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-2">
                <p className="font-medium text-slate-800">자동 배정 시 적용되는 언어→초이스→호텔→인원 우선순위</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    <span className="font-medium">언어</span>: 같은 투어 안에서 고객 언어가 통일되도록 합니다. 한국어 고객은 한국어 가능 가이드/어시스턴트가 있는 투어로 모읍니다. 이미 모든 언어가 같으면 변경 없이 다음 조건으로 넘어갑니다.
                  </li>
                  <li>
                    <span className="font-medium">초이스</span>: 초이스(🏜️ L / 🏜️ X 등)가 섞이지 않도록, 같은 초이스끼리 한 투어로 모읍니다. 다른 초이스는 다른 투어와 분리됩니다.
                  </li>
                  <li>
                    <span className="font-medium">픽업 호텔</span>: 같은 픽업 호텔 고객끼리 한 투어로 모을 수 있도록 이동합니다.
                  </li>
                  <li>
                    <span className="font-medium">인원/차량 정원</span>: 투어별 인원이 차량 정원을 초과하면, 초과분을 다른 투어로 나누어 배정합니다.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* 현재 배정 vs 자동 배정 비교 + 예약 카드뷰 */}
            <div className="px-4 py-4 flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">배정 비교</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* 현재 배정 */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500 uppercase">현재 배정</p>
                  {initialTours.map(tour => {
                    const ids = tour.reservation_ids || []
                    const tourPeople = ids.reduce((sum, rid) => sum + peopleCount(reservations.find(r => r.id === rid) || {}), 0)
                    const guideName = getTeamDisplayName(tour.tour_guide_id)
                    const assistantName = getTeamDisplayName(tour.assistant_id)
                    const vehicleName = getVehicleDisplayName(tour.tour_car_id)
                    return (
                      <div key={tour.id} className="rounded-lg border bg-gray-50/80 p-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mb-2">
                          <span className="font-mono">{tour.id.slice(0, 8)}</span>
                          <span className="flex items-center gap-0.5 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-medium">
                            <Users size={10} />
                            {tourPeople}명
                          </span>
                        </div>
                        <div className="space-y-1 text-xs mb-2">
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> 가이드: {guideName}</div>
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> 어시스턴트: {assistantName}</div>
                          <div className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> 차량: {vehicleName}</div>
                        </div>
                        <div className="space-y-1.5">
                          {ids.map(rid => {
                            const res = reservations.find(r => r.id === rid)
                            const lang = res?.customer_id ? (customerLanguages.get(res.customer_id) ?? getCustomerLanguage(res.customer_id)) : ''
                            const name = res?.customer_id ? getCustomerName(res.customer_id) : rid.slice(0, 8)
                            const people = res ? peopleCount(res) : 0
                            const choice = reservationChoiceMap.get(rid) || '_other'
                            const hotel = res?.pickup_hotel ? pickupHotelById(res.pickup_hotel) : null
                            const pickupText = hotel ? (hotel.pick_up_location ? `${hotel.hotel} (${hotel.pick_up_location})` : hotel.hotel) : (res?.pickup_hotel || '-')
                            return (
                              <div key={rid} className="rounded border bg-white p-2 text-xs">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <ReactCountryFlag countryCode={getFlagCode(lang)} svg style={{ width: '16px', height: '12px' }} />
                                  <span className="font-medium text-gray-900">{name}</span>
                                  <span className="flex items-center gap-0.5 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                                    <Users size={10} />
                                    <span>{people}</span>
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getChoiceBadgeClass(choice)}`}>
                                    {getChoiceLabel(choice)}
                                  </span>
                                </div>
                                <div className="mt-1 text-gray-500">{pickupText}</div>
                              </div>
                            )
                          })}
                          {ids.length === 0 && <div className="text-xs text-gray-400 py-1">예약 없음</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* 자동 배정 (언어→초이스→호텔→인원 적용 결과) */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500 uppercase">자동 배정</p>
                  {displayTours.map(tour => {
                    const ids = tour.reservation_ids || []
                    const tourPeople = ids.reduce((sum, rid) => sum + peopleCount(reservations.find(r => r.id === rid) || {}), 0)
                    const guideName = getTeamDisplayName(tour.tour_guide_id)
                    const assistantName = getTeamDisplayName(tour.assistant_id)
                    const vehicleName = getVehicleDisplayName(tour.tour_car_id)
                    const otherTours = displayTours.filter(t => t.id !== tour.id)
                    return (
                      <div key={tour.id} className="rounded-lg border bg-blue-50/50 p-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mb-2">
                          <span className="font-mono">{tour.id.slice(0, 8)}</span>
                          <span className="flex items-center gap-0.5 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-medium">
                            <Users size={10} />
                            {tourPeople}명
                          </span>
                        </div>
                        <div className="space-y-1 text-xs mb-2">
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> 가이드: {guideName}</div>
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> 어시스턴트: {assistantName}</div>
                          <div className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> 차량: {vehicleName}</div>
                        </div>
                        <div className="space-y-1.5">
                          {ids.map(rid => {
                            const res = reservations.find(r => r.id === rid)
                            const lang = res?.customer_id ? (customerLanguages.get(res.customer_id) ?? getCustomerLanguage(res.customer_id)) : ''
                            const name = res?.customer_id ? getCustomerName(res.customer_id) : rid.slice(0, 8)
                            const people = res ? peopleCount(res) : 0
                            const choice = reservationChoiceMap.get(rid) || '_other'
                            const hotel = res?.pickup_hotel ? pickupHotelById(res.pickup_hotel) : null
                            const pickupText = hotel ? (hotel.pick_up_location ? `${hotel.hotel} (${hotel.pick_up_location})` : hotel.hotel) : (res?.pickup_hotel || '-')
                            const isDropdownOpen = openMoveDropdownRid === rid
                            return (
                              <div key={rid} className="rounded border bg-white p-2 text-xs relative">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <ReactCountryFlag countryCode={getFlagCode(lang)} svg style={{ width: '16px', height: '12px' }} />
                                  <span className="font-medium text-gray-900">{name}</span>
                                  <span className="flex items-center gap-0.5 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                                    <Users size={10} />
                                    <span>{people}</span>
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getChoiceBadgeClass(choice)}`}>
                                    {getChoiceLabel(choice)}
                                  </span>
                                  {otherTours.length > 0 && (
                                    <div className="ml-auto relative" data-move-dropdown>
                                      <button
                                        type="button"
                                        onClick={() => setOpenMoveDropdownRid(isDropdownOpen ? null : rid)}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-blue-600 hover:bg-blue-50 text-xs"
                                        title="다른 투어로 이동"
                                      >
                                        <ArrowRightCircle className="w-3.5 h-3.5" />
                                        <span>이동</span>
                                      </button>
                                      {isDropdownOpen && (
                                        <div className="absolute top-full right-0 mt-0.5 z-10 min-w-[120px] py-1 bg-white border border-gray-200 rounded shadow-lg">
                                          <p className="px-2 py-0.5 text-gray-500 text-[10px]">다른 투어로 이동</p>
                                          {otherTours.map(t => (
                                            <button
                                              key={t.id}
                                              type="button"
                                              onClick={() => setReservationToTour(rid, t.id)}
                                              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 flex items-center gap-1"
                                            >
                                              <span className="font-mono">{t.id.slice(0, 8)}</span>
                                              <span className="text-gray-500">
                                                ({getTeamDisplayName(t.tour_guide_id)})
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="mt-1 text-gray-500">{pickupText}</div>
                              </div>
                            )
                          })}
                          {ids.length === 0 && <div className="text-xs text-gray-400 py-1">예약 없음</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between p-4 border-t bg-gray-50">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded">
                닫기
              </button>
              <button
                type="button"
                onClick={saveProposedTours}
                disabled={applying || !hasChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? '적용 중...' : hasChanges ? '자동 배정 적용' : '변경 없음'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
