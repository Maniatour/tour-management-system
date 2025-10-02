'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Bell, 
  Mail, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  XCircle,
  Eye,
  Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface DocumentReminder {
  id: string
  document_id: string
  reminder_type: '30_days' | '7_days' | 'expired'
  reminder_date: string
  sent_at?: string
  sent_to_email?: string
  sent_to_user_id?: string
  status: 'pending' | 'sent' | 'failed'
  error_message?: string
  created_at: string
  document?: {
    id: string
    title: string
    expiry_date?: string
    category?: {
      name_ko: string
      color: string
    }
  }
}

interface DocumentReminderDashboardProps {
  onClose?: () => void
}

export default function DocumentReminderDashboard({ onClose }: DocumentReminderDashboardProps) {
  const t = useTranslations('documents')
  const { user, userRole } = useAuth()
  
  const [reminders, setReminders] = useState<DocumentReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all')

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    try {
      setLoading(true)
      
      // 관리자는 모든 알림을 볼 수 있고, 일반 사용자는 자신의 알림만 볼 수 있음
      let query = supabase
        .from('document_reminders')
        .select(`
          *,
          document:documents(
            id,
            title,
            expiry_date,
            category:document_categories(name_ko, color)
          )
        `)
        .order('reminder_date', { ascending: true })

      // 관리자가 아닌 경우 자신의 알림만 조회
      if (userRole !== 'admin') {
        query = query.eq('sent_to_user_id', user?.id)
      }

      const { data, error } = await query

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error('알림 로드 오류:', error)
      toast.error('알림을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const sendReminder = async (reminderId: string) => {
    try {
      setSendingReminder(reminderId)
      
      const reminder = reminders.find(r => r.id === reminderId)
      if (!reminder || !reminder.document) return

      // 이메일 발송 로직 (실제 구현에서는 이메일 서비스 사용)
      const emailContent = generateEmailContent(reminder)
      
      // 여기서는 실제 이메일 발송 대신 로그만 기록
      console.log('이메일 발송:', {
        to: reminder.sent_to_email || user?.email,
        subject: `문서 만료 알림: ${reminder.document.title}`,
        content: emailContent
      })

      // 알림 상태 업데이트
      const { error } = await supabase
        .from('document_reminders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to_email: reminder.sent_to_email || user?.email
        })
        .eq('id', reminderId)

      if (error) throw error

      toast.success('알림이 발송되었습니다.')
      loadReminders()
    } catch (error) {
      console.error('알림 발송 오류:', error)
      
      // 실패 상태로 업데이트
      await supabase
        .from('document_reminders')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : '알 수 없는 오류'
        })
        .eq('id', reminderId)

      toast.error('알림 발송 중 오류가 발생했습니다.')
    } finally {
      setSendingReminder(null)
    }
  }

  const generateEmailContent = (reminder: DocumentReminder) => {
    const document = reminder.document!
    const expiryDate = new Date(document.expiry_date!).toLocaleDateString('ko-KR')
    
    let message = ''
    switch (reminder.reminder_type) {
      case '30_days':
        message = `문서 "${document.title}"의 만료일이 30일 후인 ${expiryDate}입니다. 갱신을 준비해주세요.`
        break
      case '7_days':
        message = `문서 "${document.title}"의 만료일이 7일 후인 ${expiryDate}입니다. 긴급히 갱신해주세요.`
        break
      case 'expired':
        message = `문서 "${document.title}"이 ${expiryDate}에 만료되었습니다. 즉시 갱신해주세요.`
        break
    }

    return `
안녕하세요,

${message}

문서 관리 시스템에서 확인하시기 바랍니다.

감사합니다.
MANIA TOUR
    `.trim()
  }

  const getReminderTypeText = (type: string) => {
    switch (type) {
      case '30_days': return '30일 전'
      case '7_days': return '7일 전'
      case 'expired': return '만료일'
      default: return type
    }
  }

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case '30_days': return 'text-blue-600 bg-blue-100'
      case '7_days': return 'text-yellow-600 bg-yellow-100'
      case 'expired': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const filteredReminders = reminders.filter(reminder => {
    if (filter === 'all') return true
    return reminder.status === filter
  })

  const stats = {
    total: reminders.length,
    pending: reminders.filter(r => r.status === 'pending').length,
    sent: reminders.filter(r => r.status === 'sent').length,
    failed: reminders.filter(r => r.status === 'failed').length
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">문서 만료 알림</h2>
            <p className="text-gray-600">문서 만료일 알림 관리</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Bell className="w-5 h-5 text-gray-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">전체</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">대기중</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">발송완료</p>
                <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">실패</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex items-center space-x-2 mb-6">
          <span className="text-sm font-medium text-gray-700">상태:</span>
          {(['all', 'pending', 'sent', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-sm rounded-full ${
                filter === status
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? '전체' : 
               status === 'pending' ? '대기중' :
               status === 'sent' ? '발송완료' : '실패'}
            </button>
          ))}
        </div>

        {/* 알림 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">알림을 불러오는 중...</span>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">알림이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">문서 만료일 알림이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReminders.map((reminder) => (
              <div key={reminder.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {reminder.document?.title || '문서 정보 없음'}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getReminderTypeColor(reminder.reminder_type)}`}>
                        {getReminderTypeText(reminder.reminder_type)}
                      </span>
                      {reminder.document?.category && (
                        <span 
                          className="px-2 py-1 text-xs font-medium rounded-full text-white"
                          style={{ backgroundColor: reminder.document.category.color }}
                        >
                          {reminder.document.category.name_ko}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>알림일: {new Date(reminder.reminder_date).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {reminder.document?.expiry_date && (
                        <div className="flex items-center space-x-1">
                          <AlertTriangle className="w-4 h-4" />
                          <span>만료일: {new Date(reminder.document.expiry_date).toLocaleDateString('ko-KR')}</span>
                        </div>
                      )}
                    </div>
                    
                    {reminder.sent_at && (
                      <div className="mt-2 text-sm text-gray-500">
                        발송일: {new Date(reminder.sent_at).toLocaleString('ko-KR')}
                        {reminder.sent_to_email && ` (${reminder.sent_to_email})`}
                      </div>
                    )}
                    
                    {reminder.error_message && (
                      <div className="mt-2 text-sm text-red-600">
                        오류: {reminder.error_message}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {getStatusIcon(reminder.status)}
                    <span className="text-sm text-gray-600">
                      {reminder.status === 'pending' ? '대기중' :
                       reminder.status === 'sent' ? '발송완료' : '실패'}
                    </span>
                    
                    {reminder.status === 'pending' && (
                      <button
                        onClick={() => sendReminder(reminder.id)}
                        disabled={sendingReminder === reminder.id}
                        className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <Send className="w-4 h-4" />
                        <span>발송</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
