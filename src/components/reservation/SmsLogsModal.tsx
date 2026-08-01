'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Send,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { resolveAdminSmsCategoryLabel } from '@/lib/adminSmsCategorySettings'
import { useAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import {
  resolveSmsLogDeliveryState,
  smsDeliveryStateBadgeClasses,
  smsDeliveryStateCardClasses,
  smsDeliveryStateLabel,
} from '@/lib/smsLogDeliveryState'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'

interface SmsLog {
  id: string
  reservation_id: string
  category_id: string
  to_phone: string
  message_body: string
  locale: string
  status: string
  created_at: string
  error_message?: string | null
  sent_by?: string | null
  twilio_message_sid?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  twilio_status?: string | null
}

interface TeamMember {
  email: string
  name_ko: string | null
  name_en: string | null
}

interface SmsLogsModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  uiLocale?: 'ko' | 'en'
}

export default function SmsLogsModal({
  isOpen,
  onClose,
  reservationId,
  uiLocale = 'ko',
}: SmsLogsModalProps) {
  const isEn = uiLocale === 'en'
  const { settings } = useAdminSmsCategorySettings({ enabled: isOpen })
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember>>({})
  const [loading, setLoading] = useState(true)

  const syncDeliveryStatus = useCallback(async () => {
    try {
      await fetchApiWithAuth('/api/sms-logs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      })
    } catch (error) {
      console.error('SMS 전달 상태 동기화 오류:', error)
    }
  }, [reservationId])

  const fetchSmsLogs = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true)
        await syncDeliveryStatus()
        const { data, error } = await (supabase as any)
          .from('pre_tour_contact_sms_logs')
          .select('*')
          .eq('reservation_id', reservationId)
          .order('created_at', { ascending: false })

        if (error) throw error
        const logs = (data || []) as SmsLog[]
        setSmsLogs(logs)

        const sentByEmails = [
          ...new Set(
            logs
              .map((log) => log.sent_by)
              .filter((email): email is string => !!email && typeof email === 'string')
          ),
        ]

        if (sentByEmails.length > 0) {
          const { data: teamData } = await supabase
            .from('team')
            .select('email, name_ko, name_en')
            .in('email', sentByEmails)

          if (teamData) {
            const teamMap: Record<string, TeamMember> = {}
            const teamDataTyped = teamData as TeamMember[]
            teamDataTyped.forEach((team) => {
              teamMap[team.email] = team
            })
            setTeamMembers(teamMap)
          }
        }
      } catch (error) {
        console.error('SMS 로그 조회 오류:', error)
        if (!silent) setSmsLogs([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [reservationId, syncDeliveryStatus]
  )

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchSmsLogs()
    }
  }, [isOpen, reservationId, fetchSmsLogs])

  useEffect(() => {
    if (!isOpen) return
    const hasPending = smsLogs.some((log) => {
      const state = resolveSmsLogDeliveryState(log)
      return state === 'pending'
    })
    if (!hasPending) return

    const timer = window.setInterval(() => {
      void fetchSmsLogs(true)
    }, 12000)

    return () => window.clearInterval(timer)
  }, [isOpen, smsLogs, fetchSmsLogs])

  const getCategoryLabel = (categoryId: string) => {
    if (
      categoryId === 'pre_tour_contact' ||
      categoryId === 'pickup_notification' ||
      categoryId === 'cancellation_follow_up' ||
      categoryId === 'cancellation_rebooking' ||
      categoryId === 'pending_alt_tour'
    ) {
      return resolveAdminSmsCategoryLabel(
        categoryId as ReservationOutboundSmsCategoryId,
        settings,
        uiLocale
      )
    }
    return categoryId
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(isEn ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">
                {isEn ? 'SMS send history' : 'SMS 발송 내역'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {isEn
                  ? 'Twilio delivery status is tracked automatically'
                  : 'Twilio 전달·실패 상태를 자동 추적합니다'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : smsLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Smartphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{isEn ? 'No SMS messages sent yet.' : '발송된 SMS가 없습니다.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {smsLogs.map((log) => {
                const deliveryState = resolveSmsLogDeliveryState(log)
                const deliveryLabel = smsDeliveryStateLabel(deliveryState, uiLocale)

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${smsDeliveryStateCardClasses(deliveryState)}`}
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        {deliveryState === 'failed' || log.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        ) : deliveryState === 'delivered' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Send className="w-5 h-5 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">
                            {getCategoryLabel(log.category_id || 'pre_tour_contact')}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 break-all">{log.to_phone}</div>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${smsDeliveryStateBadgeClasses(deliveryState)}`}
                      >
                        {deliveryLabel}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-start space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600">{formatDate(log.created_at)}</span>
                      </div>
                      <div className="rounded-lg bg-white/70 border border-gray-100 p-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {log.message_body}
                      </div>
                      {log.sent_by && (
                        <div className="flex items-start space-x-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <span className="text-gray-600">
                            <strong>{isEn ? 'Sent by:' : '발송자:'}</strong>{' '}
                            {teamMembers[log.sent_by]?.name_ko || log.sent_by}
                          </span>
                        </div>
                      )}
                      {log.delivered_at && (
                        <div className="flex items-start space-x-2 text-sm text-green-700">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>
                            <strong>{isEn ? 'Delivered:' : '전달됨:'}</strong>{' '}
                            {formatDate(log.delivered_at)}
                          </span>
                        </div>
                      )}
                      {(log.failed_at || deliveryState === 'failed') && (
                        <div className="mt-2 p-3 bg-red-100 rounded-lg text-sm text-red-900 border border-red-200">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <strong>{isEn ? 'Delivery failed' : '전달 실패'}</strong>
                            {log.failed_at ? (
                              <span className="text-red-800">({formatDate(log.failed_at)})</span>
                            ) : null}
                          </div>
                          {(log.failure_reason || log.error_message) && (
                            <div className="mt-1 text-xs text-red-800">
                              <strong>{isEn ? 'Reason:' : '사유:'}</strong>{' '}
                              {log.failure_reason || log.error_message}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-red-800">
                            {isEn
                              ? 'The phone number may be invalid or blocked by the carrier. Please verify and resend.'
                              : '전화번호가 잘못되었거나 통신사에서 차단되었을 수 있습니다. 번호를 확인한 뒤 다시 발송해 주세요.'}
                          </p>
                        </div>
                      )}
                      {log.error_message && !log.failed_at && log.status === 'failed' && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                          <strong>{isEn ? 'Error:' : '오류:'}</strong> {log.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50 flex gap-2">
          <button
            type="button"
            onClick={() => void fetchSmsLogs()}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {isEn ? 'Refresh' : '새로고침'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isEn ? 'Close' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
