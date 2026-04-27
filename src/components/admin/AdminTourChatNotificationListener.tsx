'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Car, MessageCircle, User, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/** 채팅 관리 페이지에서 열어둔 방 — 알림 중복 방지 */
export const ADMIN_TOUR_CHAT_ACTIVE_ROOM_KEY = 'admin-tour-chat-active-room'
/** 알림에서 "채팅 관리로 이동" 시 자동으로 열 방 */
export const ADMIN_TOUR_CHAT_PENDING_ROOM_KEY = 'admin-tour-chat-pending-room-id'

type IncomingPayload = {
  roomId: string
  senderName: string
  messagePreview: string
  tourTitle: string
  roomCode?: string
  /** 투어가 없으면 null */
  tourDate: string | null
  guideLabel: string | null
  assistantLabel: string | null
  vehicleLabel: string | null
}

function truncateMessage(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** DB `YYYY-MM-DD` → 표시용 `YYYY.MM.DD` */
function formatTourDateDot(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  return raw.trim()
}

/** 콤마/공백 구분 이메일 목록 → 표시명 (team 맵 기준) */
function formatStaffField(
  raw: string | null | undefined,
  teamByEmail: Map<string, string>,
  unassigned: string
): string {
  if (!raw?.trim()) return unassigned
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return unassigned
  return parts.map((email) => teamByEmail.get(email) || email).join(', ')
}

export default function AdminTourChatNotificationListener({ locale }: { locale: string }) {
  const router = useRouter()
  const { authUser, userRole } = useAuth()
  const enabled = Boolean(authUser?.email && userRole && userRole !== 'customer')

  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<IncomingPayload | null>(null)

  const showNotification = useCallback((next: IncomingPayload) => {
    setPayload(next)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const start = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || !sessionData?.session) return

      channel = supabase
        .channel('admin-tour-chat-incoming-notify')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          async (change) => {
            const row = change.new as {
              id?: string
              room_id?: string
              sender_type?: string
              sender_name?: string
              message?: string
              message_type?: string
            }
            if (!row?.room_id || row.sender_type !== 'customer') return

            try {
              const active = sessionStorage.getItem(ADMIN_TOUR_CHAT_ACTIVE_ROOM_KEY)
              if (active === row.room_id) return
            } catch {
              // ignore
            }

            const { data: roomRow, error: roomErr } = await supabase
              .from('chat_rooms')
              .select('id, room_code, room_name, is_active, tour_id')
              .eq('id', row.room_id)
              .maybeSingle()

            if (cancelled || roomErr || !roomRow) return
            const r = roomRow as {
              is_active?: boolean | null
              room_code?: string | null
              room_name?: string | null
              tour_id?: string | null
            }
            if (r.is_active === false) return

            let tourTitle = String(r.room_name || '투어 채팅')
            let tourDate: string | null = null
            let guideLabel: string | null = null
            let assistantLabel: string | null = null
            let vehicleLabel: string | null = null

            const isKo = locale === 'ko'
            const unassigned = isKo ? '미배정' : 'Unassigned'
            const noVehicle = isKo ? '미배정' : 'Unassigned'

            if (r.tour_id) {
              const { data: tourData } = await supabase
                .from('tours')
                .select(
                  'tour_date, tour_guide_id, assistant_id, tour_car_id, product:products(name_ko, name, name_en)'
                )
                .eq('id', r.tour_id)
                .maybeSingle()

              const tour = tourData as {
                tour_date?: string | null
                tour_guide_id?: string | null
                assistant_id?: string | null
                tour_car_id?: string | null
                product?: { name_ko?: string | null; name?: string | null; name_en?: string | null }
              } | null

              if (tour) {
                tourDate = tour.tour_date ? String(tour.tour_date) : null
                const product = tour.product
                if (product) {
                  tourTitle = String(
                    (isKo ? product.name_ko || product.name : product.name_en || product.name_ko || product.name) ||
                      tourTitle
                  )
                }

                const guideEmails = tour.tour_guide_id
                const assistantEmails = tour.assistant_id
                const vehicleId = tour.tour_car_id
                const staffEmails = [
                  ...new Set(
                    [guideEmails, assistantEmails]
                      .filter(Boolean)
                      .flatMap((s) =>
                        String(s)
                          .split(/[,，]/)
                          .map((x) => x.trim())
                          .filter(Boolean)
                      )
                  ),
                ]

                const [{ data: teamRows }, { data: vehicleRow }] = await Promise.all([
                  staffEmails.length > 0
                    ? supabase
                        .from('team')
                        .select('email, name_ko, name_en, nick_name')
                        .in('email', staffEmails)
                    : Promise.resolve({ data: [] as Array<{ email: string; name_ko: string | null; name_en: string | null; nick_name: string | null }> }),
                  vehicleId
                    ? supabase.from('vehicles').select('vehicle_number').eq('id', vehicleId).maybeSingle()
                    : Promise.resolve({ data: null as { vehicle_number: string | null } | null }),
                ])

                const teamByEmail = new Map(
                  (teamRows || []).map((m) => [
                    m.email,
                    m.nick_name || (isKo ? m.name_ko || m.name_en : m.name_en || m.name_ko) || m.email,
                  ])
                )

                guideLabel = formatStaffField(guideEmails ?? null, teamByEmail, unassigned)
                assistantLabel = formatStaffField(assistantEmails ?? null, teamByEmail, unassigned)
                vehicleLabel = vehicleRow?.vehicle_number?.trim()
                  ? String(vehicleRow.vehicle_number)
                  : vehicleId
                    ? String(vehicleId)
                    : noVehicle
              }
            }

            const preview =
              row.message_type === 'image'
                ? '[이미지]'
                : row.message_type === 'file'
                  ? '[파일]'
                  : truncateMessage(String(row.message || ''))

            showNotification({
              roomId: row.room_id,
              senderName: String(row.sender_name || '고객'),
              messagePreview: preview || '(내용 없음)',
              tourTitle,
              roomCode: r.room_code ? String(r.room_code) : undefined,
              tourDate,
              guideLabel,
              assistantLabel,
              vehicleLabel,
            })
          }
        )
        .subscribe()
    }

    void start()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, locale, showNotification])

  const handleClose = () => {
    setOpen(false)
    setPayload(null)
  }

  const handleGoToChat = () => {
    if (!payload) return
    try {
      sessionStorage.setItem(ADMIN_TOUR_CHAT_PENDING_ROOM_KEY, payload.roomId)
    } catch {
      // ignore
    }
    handleClose()
    router.push(`/${locale}/admin/chat-management`)
  }

  if (!enabled || !open || !payload) return null

  const dateDot = formatTourDateDot(payload.tourDate)
  const isKo = locale === 'ko'

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-chat-notify-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
              <MessageCircle size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2
                id="tour-chat-notify-title"
                className="text-base font-semibold text-gray-900"
              >
                새 투어 채팅 메시지
              </h2>
              <p
                className="text-sm font-semibold text-gray-900 mt-1 leading-snug break-words"
                title={dateDot ? `${dateDot} ${payload.tourTitle}` : payload.tourTitle}
              >
                {dateDot ? <span className="tabular-nums text-gray-800">{`${dateDot} `}</span> : null}
                <span>{payload.tourTitle}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200/80 bg-white/90 px-2 py-0.5 text-xs font-medium text-indigo-900 shadow-sm"
                  title={isKo ? `가이드: ${payload.guideLabel ?? '—'}` : `Guide: ${payload.guideLabel ?? '—'}`}
                  aria-label={isKo ? `가이드: ${payload.guideLabel ?? '—'}` : `Guide: ${payload.guideLabel ?? '—'}`}
                >
                  <User className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                  <span className="min-w-0 truncate">{payload.guideLabel ?? '—'}</span>
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/90 px-2 py-0.5 text-xs font-medium text-violet-900 shadow-sm"
                  title={isKo ? `어시스턴트: ${payload.assistantLabel ?? '—'}` : `Assistant: ${payload.assistantLabel ?? '—'}`}
                  aria-label={isKo ? `어시스턴트: ${payload.assistantLabel ?? '—'}` : `Assistant: ${payload.assistantLabel ?? '—'}`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
                  <span className="min-w-0 truncate">{payload.assistantLabel ?? '—'}</span>
                </span>
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-800 shadow-sm"
                  title={isKo ? `배차: ${payload.vehicleLabel ?? '—'}` : `Vehicle: ${payload.vehicleLabel ?? '—'}`}
                  aria-label={isKo ? `배차: ${payload.vehicleLabel ?? '—'}` : `Vehicle: ${payload.vehicleLabel ?? '—'}`}
                >
                  <Car className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                  <span className="min-w-0 truncate">{payload.vehicleLabel ?? '—'}</span>
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-sm">
            <span className="text-gray-500">{locale === 'ko' ? '발신' : 'From'}</span>{' '}
            <span className="font-medium text-gray-900">{payload.senderName}</span>
            {payload.roomCode ? (
              <span className="block text-xs text-gray-400 font-mono mt-1 truncate" title={payload.roomCode}>
                {payload.roomCode}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words line-clamp-4 border border-gray-100 rounded-lg p-3 bg-gray-50">
            {payload.messagePreview}
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleGoToChat}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              채팅 관리로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
