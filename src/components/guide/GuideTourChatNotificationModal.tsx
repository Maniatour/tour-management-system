'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClientSupabase, supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Car, User, Users } from 'lucide-react'

type TourInfo = {
  id: string
  tour_date: string
  product_name: string
  total_people: number
  guide_label: string
  assistant_label: string
  vehicle_number: string
  reservation_customers: Array<{ name: string; total_people: number }>
}

type NotificationItem = {
  messageId: string
  tourId: string
  roomId: string
  tourDate: string
  tourName: string
  tourTotalPeople: number
  guideLabel: string
  assistantLabel: string
  vehicleNumber: string
  customerName: string
  reservationTotalPeople: number | null
  message: string
}

/** DB `YYYY-MM-DD` → 표시용 `YYYY.MM.DD` */
function formatTourDateDot(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  return raw.trim()
}

function formatTourChatStaffField(
  raw: string | null | undefined,
  memberMap: Map<string, string>,
  unassigned: string
): string {
  if (!raw?.trim()) return unassigned
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return unassigned
  return parts.map((email) => memberMap.get(email) || email).join(', ')
}

const normalizeReservationIds = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter((v) => v.length > 0)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed)
          ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
          : []
      } catch {
        return []
      }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
    }
    return [trimmed]
  }
  return []
}

type Props = {
  userEmail?: string
  locale: 'ko' | 'en'
}

export default function GuideTourChatNotificationModal({ userEmail, locale }: Props) {
  const router = useRouter()
  const supabaseClient = useMemo(() => createClientSupabase(), [])
  const [queue, setQueue] = useState<NotificationItem[]>([])
  const seenMessageIdsRef = useRef<Set<string>>(new Set())
  const roomToTourInfoRef = useRef<Map<string, TourInfo>>(new Map())

  const currentItem = queue[0] || null

  const closeCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1))
  }, [])

  const openTourChat = useCallback(() => {
    if (!currentItem) return
    router.push(`/${locale}/guide/tours/${currentItem.tourId}`)
    closeCurrent()
  }, [closeCurrent, currentItem, locale, router])

  useEffect(() => {
    let isActive = true

    const setup = async () => {
      if (!userEmail) return

      const unassigned = locale === 'ko' ? '미배정' : 'Unassigned'

      const { data: toursData, error: toursError } = await supabaseClient
        .from('tours')
        .select('id, tour_date, product_id, reservation_ids, tour_guide_id, assistant_id, tour_car_id')
        .or(`tour_guide_id.eq.${userEmail},assistant_id.eq.${userEmail}`)
        .gte('tour_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .lte('tour_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))

      if (toursError || !toursData || !isActive) return
      if (toursData.length === 0) return

      const tourIds = toursData.map((tour) => tour.id)
      const productIds = [...new Set(toursData.map((tour) => tour.product_id).filter(Boolean))]
      const memberEmails = [
        ...new Set(
          toursData.flatMap((tour) =>
            [tour.tour_guide_id, tour.assistant_id]
              .filter(Boolean)
              .flatMap((s) =>
                String(s)
                  .split(/[,，]/)
                  .map((x) => x.trim())
                  .filter(Boolean)
              )
          )
        ),
      ]
      const vehicleIds = [...new Set(toursData.map((tour) => tour.tour_car_id).filter(Boolean))]
      const allReservationIds = [
        ...new Set(toursData.flatMap((tour) => normalizeReservationIds(tour.reservation_ids))),
      ]

      const [{ data: roomsData }, { data: productsData }, { data: membersData }, { data: vehiclesData }, { data: reservationsData }] =
        await Promise.all([
          supabaseClient.from('chat_rooms').select('id, tour_id').in('tour_id', tourIds),
          productIds.length > 0
            ? supabaseClient.from('products').select('id, name, name_ko, name_en').in('id', productIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; name_ko: string | null; name_en: string | null }> }),
          memberEmails.length > 0
            ? supabaseClient.from('team').select('email, name_ko, name_en, nick_name').in('email', memberEmails)
            : Promise.resolve({ data: [] as Array<{ email: string; name_ko: string | null; name_en: string | null; nick_name: string | null }> }),
          vehicleIds.length > 0
            ? supabaseClient.from('vehicles').select('id, vehicle_number').in('id', vehicleIds)
            : Promise.resolve({ data: [] as Array<{ id: string; vehicle_number: string | null }> }),
          allReservationIds.length > 0
            ? supabaseClient.from('reservations').select('id, customer_id, total_people').in('id', allReservationIds)
            : Promise.resolve({ data: [] as Array<{ id: string; customer_id: string | null; total_people: number | null }> }),
        ])

      if (!isActive || !roomsData || roomsData.length === 0) return

      const productMap = new Map(
        (productsData || []).map((product) => [
          product.id,
          locale === 'en'
            ? product.name_en || product.name_ko || product.name || product.id
            : product.name_ko || product.name || product.name_en || product.id,
        ])
      )
      const memberMap = new Map(
        (membersData || []).map((member) => [
          member.email,
          member.nick_name || (locale === 'en' ? member.name_en || member.name_ko : member.name_ko || member.name_en) || member.email,
        ])
      )
      const vehicleMap = new Map(
        (vehiclesData || []).map((vehicle) => [vehicle.id, vehicle.vehicle_number || '-'])
      )
      const reservationMap = new Map((reservationsData || []).map((r) => [r.id, r]))
      const customerIds = [
        ...new Set((reservationsData || []).map((r) => r.customer_id).filter((id): id is string => Boolean(id))),
      ]
      const { data: customersData } =
        customerIds.length > 0
          ? await supabaseClient.from('customers').select('id, name').in('id', customerIds)
          : { data: [] as Array<{ id: string; name: string | null }> }
      const customerMap = new Map((customersData || []).map((customer) => [customer.id, customer.name || '']))

      const tourInfoById = new Map<string, TourInfo>()
      toursData.forEach((tour) => {
        const reservationIds = normalizeReservationIds(tour.reservation_ids)
        let totalPeople = 0
        const reservationCustomers: Array<{ name: string; total_people: number }> = []
        reservationIds.forEach((id) => {
          const row = reservationMap.get(id)
          if (!row) return
          const people = row.total_people || 0
          totalPeople += people
          if (row.customer_id && customerMap.get(row.customer_id)) {
            reservationCustomers.push({
              name: String(customerMap.get(row.customer_id) || ''),
              total_people: people,
            })
          }
        })

        tourInfoById.set(tour.id, {
          id: tour.id,
          tour_date: tour.tour_date,
          product_name:
            productMap.get(tour.product_id || '') ||
            (locale === 'ko' ? `투어 ${tour.id}` : `Tour ${tour.id}`),
          total_people: totalPeople,
          guide_label: formatTourChatStaffField(tour.tour_guide_id, memberMap, unassigned),
          assistant_label: formatTourChatStaffField(tour.assistant_id, memberMap, unassigned),
          vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) || '-' : '-',
          reservation_customers: reservationCustomers,
        })
      })

      const roomMap = new Map<string, TourInfo>()
      roomsData.forEach((room) => {
        const tourInfo = tourInfoById.get(room.tour_id)
        if (tourInfo) roomMap.set(room.id, tourInfo)
      })
      roomToTourInfoRef.current = roomMap
    }

    setup()
    return () => {
      isActive = false
    }
  }, [locale, supabaseClient, userEmail])

  useEffect(() => {
    if (!userEmail) return

    const channel = supabase
      .channel(`guide_tour_chat_notification_${userEmail}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: { new: any }) => {
          const message = payload.new as {
            id: string
            room_id: string
            sender_type: string
            sender_email?: string | null
            sender_name?: string | null
            message?: string | null
          }
          if (!message?.id || !message.room_id) return
          if (seenMessageIdsRef.current.has(message.id)) return
          seenMessageIdsRef.current.add(message.id)
          if (message.sender_type !== 'customer') return
          if (message.sender_email && message.sender_email.toLowerCase() === userEmail.toLowerCase()) return

          const tourInfo = roomToTourInfoRef.current.get(message.room_id)
          if (!tourInfo) return

          const customerName = message.sender_name || (locale === 'ko' ? '고객' : 'Customer')
          const reservationMatch = tourInfo.reservation_customers.find((c) => c.name.trim() === customerName.trim())

          const item: NotificationItem = {
            messageId: message.id,
            roomId: message.room_id,
            tourId: tourInfo.id,
            tourDate: tourInfo.tour_date,
            tourName: tourInfo.product_name,
            tourTotalPeople: tourInfo.total_people,
            guideLabel: tourInfo.guide_label,
            assistantLabel: tourInfo.assistant_label,
            vehicleNumber: tourInfo.vehicle_number,
            customerName,
            reservationTotalPeople: reservationMatch ? reservationMatch.total_people : null,
            message: message.message || '',
          }

          setQueue((prev) => [...prev, item])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locale, userEmail])

  if (!currentItem) return null

  const dateDot = formatTourDateDot(currentItem.tourDate)

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {locale === 'ko' ? '새 투어 채팅 메시지' : 'New Tour Chat Message'}
          </h3>
        </div>

        <div className="space-y-2 px-4 py-4 text-sm text-gray-800">
          <div>
            <p
              className="font-semibold text-gray-900 leading-snug break-words"
              title={dateDot ? `${dateDot} ${currentItem.tourName}` : currentItem.tourName}
            >
              {dateDot ? <span className="tabular-nums text-gray-800">{`${dateDot} `}</span> : null}
              <span>{currentItem.tourName}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-2 py-0.5 text-xs font-medium text-indigo-900"
                title={
                  locale === 'ko'
                    ? `가이드: ${currentItem.guideLabel}`
                    : `Guide: ${currentItem.guideLabel}`
                }
                aria-label={
                  locale === 'ko'
                    ? `가이드: ${currentItem.guideLabel}`
                    : `Guide: ${currentItem.guideLabel}`
                }
              >
                <User className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                <span className="min-w-0 truncate">{currentItem.guideLabel}</span>
              </span>
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-2 py-0.5 text-xs font-medium text-violet-900"
                title={
                  locale === 'ko'
                    ? `어시스턴트: ${currentItem.assistantLabel}`
                    : `Assistant: ${currentItem.assistantLabel}`
                }
                aria-label={
                  locale === 'ko'
                    ? `어시스턴트: ${currentItem.assistantLabel}`
                    : `Assistant: ${currentItem.assistantLabel}`
                }
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
                <span className="min-w-0 truncate">{currentItem.assistantLabel}</span>
              </span>
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 px-2 py-0.5 text-xs font-medium text-slate-800"
                title={
                  locale === 'ko' ? `배차: ${currentItem.vehicleNumber}` : `Vehicle: ${currentItem.vehicleNumber}`
                }
                aria-label={
                  locale === 'ko' ? `배차: ${currentItem.vehicleNumber}` : `Vehicle: ${currentItem.vehicleNumber}`
                }
              >
                <Car className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                <span className="min-w-0 truncate">{currentItem.vehicleNumber}</span>
              </span>
            </div>
          </div>
          <div><span className="font-semibold">{locale === 'ko' ? '투어 총인원' : 'Tour Total'}:</span> {currentItem.tourTotalPeople}</div>
          <div><span className="font-semibold">{locale === 'ko' ? '고객명' : 'Customer'}:</span> {currentItem.customerName}</div>
          <div>
            <span className="font-semibold">{locale === 'ko' ? '예약 총인원' : 'Reservation Total'}:</span>{' '}
            {currentItem.reservationTotalPeople == null ? '-' : currentItem.reservationTotalPeople}
          </div>
          <div className="rounded border bg-gray-50 p-2">
            <div className="mb-1 text-xs font-semibold text-gray-600">{locale === 'ko' ? '메시지' : 'Message'}</div>
            <div className="whitespace-pre-wrap break-words">{currentItem.message || '-'}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={closeCurrent}
            className="rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {locale === 'ko' ? '닫기' : 'Close'}
          </button>
          <button
            type="button"
            onClick={openTourChat}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            {locale === 'ko' ? '투어 채팅 열기' : 'Open Tour Chat'}
          </button>
        </div>
      </div>
    </div>
  )
}
