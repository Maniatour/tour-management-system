'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
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
}

function truncateMessage(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
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
            if (r.tour_id) {
              const { data: tourData } = await supabase
                .from('tours')
                .select('product:products(name_ko, name)')
                .eq('id', r.tour_id)
                .maybeSingle()
              const product = (tourData as { product?: { name_ko?: string; name?: string } } | null)?.product
              if (product) tourTitle = String(product.name_ko || product.name || tourTitle)
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
              roomCode: r.room_code ? String(r.room_code) : undefined
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
  }, [enabled, showNotification])

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
              <p className="text-xs text-gray-600 mt-0.5 truncate" title={payload.tourTitle}>
                {payload.tourTitle}
              </p>
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
            <span className="text-gray-500">발신</span>{' '}
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
