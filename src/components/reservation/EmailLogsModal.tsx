'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  MousePointerClick,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { emailLogCanResend, emailLogDeliveryStatusLabel } from '@/lib/emailLogResend'
import {
  emailDeliveryStateBadgeClasses,
  emailDeliveryStateCardClasses,
  resolveEmailLogDeliveryState,
} from '@/lib/emailLogDeliveryState'

interface EmailLog {
  id: string
  reservation_id: string
  email: string
  email_type: string
  subject: string
  status: 'sent' | 'failed' | 'delivered' | 'bounced'
  sent_at: string
  error_message?: string | null
  sent_by?: string | null
  resend_email_id?: string | null
  opened_at?: string | null
  opened_count?: number | null
  delivered_at?: string | null
  bounced_at?: string | null
  bounce_reason?: string | null
  clicked_at?: string | null
  clicked_count?: number | null
}

interface TeamMember {
  email: string
  name_ko: string | null
  name_en: string | null
}

interface EmailLogsModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  onDeliveryStatusSynced?: () => void
}

export default function EmailLogsModal({
  isOpen,
  onClose,
  reservationId,
  onDeliveryStatusSynced,
}: EmailLogsModalProps) {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember>>({})
  const [loading, setLoading] = useState(true)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendEmailDraft, setResendEmailDraft] = useState<Record<string, string>>({})
  const [resendExpandedId, setResendExpandedId] = useState<string | null>(null)

  const syncDeliveryStatus = useCallback(async () => {
    try {
      const response = await fetchApiWithAuth('/api/email-logs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      })
      const data = (await response.json().catch(() => ({}))) as { synced?: number }
      if (typeof data.synced === 'number' && data.synced > 0) {
        onDeliveryStatusSynced?.()
      }
    } catch (error) {
      console.error('이메일 전달 상태 동기화 오류:', error)
    }
  }, [reservationId, onDeliveryStatusSynced])

  const fetchEmailLogs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      await syncDeliveryStatus()
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      const logs = (data || []) as EmailLog[]
      setEmailLogs(logs)

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
            teamMap[team.email] = {
              email: team.email,
              name_ko: team.name_ko,
              name_en: team.name_en,
            }
          })
          setTeamMembers(teamMap)
        }
      }
    } catch (error) {
      console.error('이메일 로그 조회 오류:', error)
      if (!silent) setEmailLogs([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [reservationId, syncDeliveryStatus])

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchEmailLogs()
    }
  }, [isOpen, reservationId, fetchEmailLogs])

  // 전달 확인 중(sent) 로그가 있으면 주기적으로 상태 갱신
  useEffect(() => {
    if (!isOpen) return
    const hasPending = emailLogs.some(
      (log) =>
        log.status === 'sent' &&
        !log.delivered_at &&
        !log.bounced_at
    )
    if (!hasPending) return

    const timer = window.setInterval(() => {
      void fetchEmailLogs(true)
    }, 12000)

    return () => window.clearInterval(timer)
  }, [isOpen, emailLogs, fetchEmailLogs])

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      confirmation: '예약 접수',
      departure: '투어 확정',
      pickup: '픽업 안내',
      receipt: '예약 접수',
      voucher: '투어 확정',
      resident_inquiry: '거주 확인 안내',
    }
    return labels[type] || type
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleResend = async (log: EmailLog) => {
    const draftEmail = (resendEmailDraft[log.id] ?? log.email).trim()
    if (!draftEmail) {
      alert('수신 이메일 주소를 입력해 주세요.')
      return
    }

    setResendingId(log.id)
    try {
      const response = await fetchApiWithAuth(`/api/email-logs/${encodeURIComponent(log.id)}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: draftEmail }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : '이메일 재발송에 실패했습니다.')
      }
      alert('이메일이 재발송되었습니다.')
      setResendExpandedId(null)
      await fetchEmailLogs(true)
    } catch (error) {
      console.error('이메일 재발송 오류:', error)
      alert(error instanceof Error ? error.message : '이메일 재발송에 실패했습니다.')
    } finally {
      setResendingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <Mail className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">이메일 발송 내역</h2>
              <p className="text-xs text-white/80 mt-0.5">
                Resend 전달·반송 상태를 자동 추적합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>발송된 이메일이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emailLogs.map((log) => {
                const delivery = emailLogDeliveryStatusLabel(log, 'ko')
                const deliveryState = resolveEmailLogDeliveryState(log)
                const canResend = emailLogCanResend(log.status) || !!log.bounced_at
                const showResendPanel = resendExpandedId === log.id

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${emailDeliveryStateCardClasses(deliveryState)}`}
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        {log.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        ) : log.bounced_at || log.status === 'bounced' ? (
                          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                        ) : log.delivered_at || log.status === 'delivered' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Send className="w-5 h-5 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">
                            {getEmailTypeLabel(log.email_type)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 break-all">{log.email}</div>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${emailDeliveryStateBadgeClasses(deliveryState)}`}
                      >
                        {delivery.label}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-start space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600">{formatDate(log.sent_at)}</span>
                      </div>
                      <div className="flex items-start space-x-2 text-sm">
                        <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600 break-all">{log.subject}</span>
                      </div>
                      {log.sent_by && (
                        <div className="flex items-start space-x-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                          <span className="text-gray-600">
                            <strong>발송자:</strong>{' '}
                            {teamMembers[log.sent_by]?.name_ko || log.sent_by}
                          </span>
                        </div>
                      )}
                      {log.delivered_at && (
                        <div className="flex items-start space-x-2 text-sm text-green-700">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>
                            <strong>전달됨:</strong> {formatDate(log.delivered_at)}
                          </span>
                        </div>
                      )}
                      {(log.bounced_at || log.status === 'bounced') && (
                        <div className="mt-2 p-3 bg-red-100 rounded-lg text-sm text-red-900 border border-red-200">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <strong>반송됨</strong>
                            {log.bounced_at ? (
                              <span className="text-red-800">({formatDate(log.bounced_at)})</span>
                            ) : null}
                          </div>
                          {log.bounce_reason && (
                            <div className="mt-1 text-xs text-red-800">
                              <strong>사유:</strong> {log.bounce_reason}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-red-800">
                            이메일 주소가 잘못되었거나 수신 서버에서 거부되었을 수 있습니다. 주소를 확인한 뒤
                            재발송해 주세요.
                          </p>
                        </div>
                      )}
                      {log.error_message && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                          <strong>오류:</strong> {log.error_message}
                        </div>
                      )}

                      {(log.status === 'sent' || log.status === 'delivered') && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-4 text-sm">
                            {log.opened_at ? (
                              <div className="flex items-center gap-2 text-green-700">
                                <Eye className="w-4 h-4" />
                                <span>
                                  <strong>읽음:</strong> {formatDate(log.opened_at)}
                                  {log.opened_count && log.opened_count > 1 && (
                                    <span className="ml-1 text-gray-600">({log.opened_count}회)</span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500">
                                <EyeOff className="w-4 h-4" />
                                <span>읽지 않음</span>
                              </div>
                            )}
                          </div>
                          {log.clicked_at && (
                            <div className="flex items-center gap-2 text-sm text-primary">
                              <MousePointerClick className="w-4 h-4" />
                              <span>
                                <strong>링크 클릭:</strong> {formatDate(log.clicked_at)}
                                {log.clicked_count && log.clicked_count > 1 && (
                                  <span className="ml-1 text-gray-600">({log.clicked_count}회)</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {canResend && (
                        <div className="mt-3 pt-3 border-t border-red-200/80">
                          {!showResendPanel ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResendExpandedId(log.id)
                                setResendEmailDraft((prev) => ({
                                  ...prev,
                                  [log.id]: prev[log.id] ?? log.email,
                                }))
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                              다시 보내기
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700">
                                수신 이메일 (수정 가능)
                              </label>
                              <input
                                type="email"
                                value={resendEmailDraft[log.id] ?? log.email}
                                onChange={(e) =>
                                  setResendEmailDraft((prev) => ({
                                    ...prev,
                                    [log.id]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-red-400"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleResend(log)}
                                  disabled={resendingId === log.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {resendingId === log.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                  재발송
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResendExpandedId(null)}
                                  disabled={resendingId === log.id}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          )}
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
            onClick={() => void fetchEmailLogs()}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
