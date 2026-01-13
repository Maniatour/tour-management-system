'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Mail, CheckCircle, XCircle, Clock, Calendar, Eye, EyeOff, Send, AlertCircle, MousePointerClick } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
}

export default function EmailLogsModal({ isOpen, onClose, reservationId }: EmailLogsModalProps) {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember>>({})
  const [loading, setLoading] = useState(true)

  const fetchEmailLogs = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      const logs = (data || []) as EmailLog[]
      setEmailLogs(logs)

      // 발송한 직원 이메일 수집
      const sentByEmails = [...new Set(
        logs
          .map(log => log.sent_by)
          .filter((email): email is string => !!email && typeof email === 'string')
      )]

      // team 테이블에서 직원 정보 조회
      if (sentByEmails.length > 0) {
        const { data: teamData } = await supabase
          .from('team')
          .select('email, name_ko, name_en')
          .in('email', sentByEmails)

        if (teamData) {
          const teamMap: Record<string, TeamMember> = {}
          const teamDataTyped = teamData as TeamMember[]
          teamDataTyped.forEach(team => {
            teamMap[team.email] = {
              email: team.email,
              name_ko: team.name_ko,
              name_en: team.name_en
            }
          })
          setTeamMembers(teamMap)
        }
      }
    } catch (error) {
      console.error('이메일 로그 조회 오류:', error)
      setEmailLogs([])
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchEmailLogs()
    }
  }, [isOpen, reservationId, fetchEmailLogs])

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'confirmation': '예약 확인',
      'departure': '투어 출발 확정',
      'pickup': '픽업 알림',
      'receipt': '예약 확인',
      'voucher': '투어 출발 확정'
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
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <Mail className="w-6 h-6" />
            <h2 className="text-xl font-bold">이메일 발송 내역</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>발송된 이메일이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emailLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 ${
                    log.status === 'sent'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {log.status === 'sent' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">
                          {getEmailTypeLabel(log.email_type)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{log.email}</div>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      log.status === 'delivered' || log.status === 'sent'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'bounced'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status === 'delivered' ? '전달 완료' : 
                       log.status === 'sent' ? '발송 완료' : 
                       log.status === 'bounced' ? '반송됨' : 
                       '발송 실패'}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-start space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600">
                        {formatDate(log.sent_at)}
                      </span>
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
                    {/* 발송 상태 정보 */}
                    {log.delivered_at && (
                      <div className="flex items-start space-x-2 text-sm text-green-700">
                        <Send className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span>
                          <strong>전달됨:</strong> {formatDate(log.delivered_at)}
                        </span>
                      </div>
                    )}
                    {log.bounced_at && (
                      <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-700">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4" />
                          <strong>반송됨:</strong> {formatDate(log.bounced_at)}
                        </div>
                        {log.bounce_reason && (
                          <div className="mt-1 text-xs">
                            <strong>사유:</strong> {log.bounce_reason}
                          </div>
                        )}
                      </div>
                    )}
                    {log.error_message && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                        <strong>오류:</strong> {log.error_message}
                      </div>
                    )}
                    
                    {/* 읽음 및 클릭 추적 정보 */}
                    {(log.status === 'sent' || log.status === 'delivered') && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          {log.opened_at ? (
                            <div className="flex items-center gap-2 text-green-700">
                              <Eye className="w-4 h-4" />
                              <span>
                                <strong>읽음:</strong> {formatDate(log.opened_at)}
                                {log.opened_count && log.opened_count > 1 && (
                                  <span className="ml-1 text-gray-600">
                                    ({log.opened_count}회)
                                  </span>
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
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <MousePointerClick className="w-4 h-4" />
                            <span>
                              <strong>링크 클릭:</strong> {formatDate(log.clicked_at)}
                              {log.clicked_count && log.clicked_count > 1 && (
                                <span className="ml-1 text-gray-600">
                                  ({log.clicked_count}회)
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

