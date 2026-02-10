'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, CheckCircle, XCircle, Clock, DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PaymentRecordForm from './PaymentRecordForm'
import { paymentMethodIntegration } from '@/lib/paymentMethodIntegration'

interface PaymentRecord {
  id: string
  reservation_id: string
  payment_status: string
  amount: number
  payment_method: string
  note?: string
  image_file_url?: string
  submit_on: string
  submit_by: string
  confirmed_on?: string
  confirmed_by?: string
  amount_krw?: number
  reservation?: {
    id: string
    customer_id: string
    customer?: {
      name: string
      email: string
    }
  }
}

interface PaymentRecordsListProps {
  reservationId: string
  customerName: string
  hideTitle?: boolean
  title?: string
  itemVariant?: 'card' | 'line'
}

export default function PaymentRecordsList({ reservationId, customerName, hideTitle, title: titleProp, itemVariant = 'card' }: PaymentRecordsListProps) {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null)
  const [error, setError] = useState('')
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})

  // 결제 방법 정보 로드
  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method')
      
      if (error) throw error
      
      const methodMap: Record<string, string> = {}
      data?.forEach(pm => {
        // ID로 조회 시 방법명(method)만 반환
        methodMap[pm.id] = pm.method
        // 방법명으로도 매핑 (payment_records에 방법명이 직접 저장된 경우 대비)
        methodMap[pm.method] = pm.method
      })
      setPaymentMethodMap(methodMap)
    } catch (error) {
      console.error('결제 방법 정보 로드 오류:', error)
    }
  }

  const fetchPaymentRecords = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/payment-records?reservation_id=${reservationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('입금 내역을 불러올 수 없습니다.')
      }

      const data = await response.json()
      setPaymentRecords(data.paymentRecords || [])
    } catch (error) {
      console.error('입금 내역 조회 오류:', error)
      setError(error instanceof Error ? error.message : '입금 내역을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentMethods()
    fetchPaymentRecords()
  }, [reservationId])

  const handleDelete = async (recordId: string) => {
    if (!confirm('이 입금 내역을 삭제하시겠습니까?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/payment-records/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('입금 내역 삭제에 실패했습니다.')
      }

      await fetchPaymentRecords()
    } catch (error) {
      console.error('입금 내역 삭제 오류:', error)
      alert(error instanceof Error ? error.message : '입금 내역 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleStatusUpdate = async (recordId: string, newStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/payment-records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ payment_status: newStatus })
      })

      if (!response.ok) {
        throw new Error('상태 업데이트에 실패했습니다.')
      }

      await fetchPaymentRecords()
    } catch (error) {
      console.error('상태 업데이트 오류:', error)
      alert(error instanceof Error ? error.message : '상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status?.toLowerCase()
    if (normalizedStatus?.includes('received') || normalizedStatus?.includes('charged')) {
      return <CheckCircle size={16} className="text-green-500" />
    }
    if (normalizedStatus?.includes('refund') || normalizedStatus?.includes('returned') || normalizedStatus?.includes('deleted')) {
      return <XCircle size={16} className="text-red-500" />
    }
    if (normalizedStatus?.includes('requested')) {
      return <Clock size={16} className="text-yellow-500" />
    }
    return <Clock size={16} className="text-gray-500" />
  }

  const getStatusText = (status: string) => {
    if (!status) return '알 수 없음'
    
    const statusMap: Record<string, string> = {
      'partner received': '파트너 수령',
      'deposit requested': '보증금 요청',
      'deposit received': '보증금 수령',
      'balance received': '잔금 수령',
      'refunded': '환불됨 (우리)',
      "customer's cc charged": '고객 CC 청구 (대행)',
      'deleted': '삭제됨',
      'refund requested': '환불 요청',
      'returned': '환불됨 (파트너)',
      'balance requested': '잔금 요청',
      'commission received !': '수수료 수령 !',
      // 기존 값들도 유지
      'pending': '대기중',
      'confirmed': '확인됨',
      'rejected': '거부됨'
    }
    
    return statusMap[status.toLowerCase()] || status
  }

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    const normalizedStatus = status.toLowerCase()
    
    // 수령/완료 상태 (녹색)
    if (normalizedStatus.includes('received') || normalizedStatus.includes('charged')) {
      return 'bg-green-100 text-green-800'
    }
    
    // 환불/삭제 상태 (빨간색)
    if (normalizedStatus.includes('refund') || normalizedStatus.includes('returned') || normalizedStatus.includes('deleted')) {
      return 'bg-red-100 text-red-800'
    }
    
    // 요청 상태 (노란색)
    if (normalizedStatus.includes('requested')) {
      return 'bg-yellow-100 text-yellow-800'
    }
    
    // 기존 값들
    if (normalizedStatus === 'confirmed') {
      return 'bg-green-100 text-green-800'
    }
    if (normalizedStatus === 'rejected') {
      return 'bg-red-100 text-red-800'
    }
    if (normalizedStatus === 'pending') {
      return 'bg-yellow-100 text-yellow-800'
    }
    
    return 'bg-gray-100 text-gray-800'
  }

  const getPaymentMethodText = (method: string) => {
    // payment_methods 테이블에서 조회한 방법명이 있으면 사용
    if (paymentMethodMap[method]) {
      return paymentMethodMap[method]
    }
    
    // 기본 결제 방법 매핑
    const methods: Record<string, string> = {
      bank_transfer: '은행 이체',
      cash: '현금',
      card: '카드',
      paypal: 'PayPal',
      other: '기타'
    }
    
    // 매핑에 없으면 원본 값 반환 (이미 방법명이거나 ID일 수 있음)
    return methods[method] || method
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-500">입금 내역을 불러오는 중...</div>
      </div>
    )
  }

  const isLine = itemVariant === 'line'
  const showTitle = !hideTitle || titleProp
  const titleText = titleProp ? `${titleProp} (${paymentRecords.length})` : `입금 내역 (${paymentRecords.length})`
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {showTitle && (
          <h3 className="text-xs font-semibold text-gray-900 flex items-center">
            <DollarSign size={14} className="mr-1" />
            {titleText}
          </h3>
        )}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors flex-shrink-0 ml-auto"
        >
          <Plus size={12} />
          추가
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {paymentRecords.length === 0 ? (
        <div className="text-center py-3 text-gray-500 text-xs">
          <DollarSign size={20} className="mx-auto mb-1 text-gray-300" />
          <p>입금 내역이 없습니다</p>
        </div>
      ) : (
        <div className={isLine ? 'divide-y divide-gray-200' : 'space-y-1.5'}>
          {paymentRecords.map((record) => (
            <div key={record.id} className={isLine ? 'py-2 first:pt-0' : 'bg-gray-50 border border-gray-200 rounded p-2'}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {getStatusIcon(record.payment_status)}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(record.payment_status)}`}>
                      {getStatusText(record.payment_status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getPaymentMethodText(record.payment_method)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(record.amount, 'USD')}
                    </span>
                    {record.amount_krw && (
                      <span className="text-gray-600">
                        ({formatCurrency(record.amount_krw, 'KRW')})
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDate(record.submit_on)}
                    </span>
                  </div>

                  {record.note && (
                    <p className="text-xs text-gray-600 mt-1 truncate">{record.note}</p>
                  )}

                  {record.image_file_url && (
                    <a
                      href={record.image_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      📎 파일
                    </a>
                  )}
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => setEditingRecord(record)}
                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="수정"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PaymentRecordForm
          reservationId={reservationId}
          customerName={customerName}
          onSuccess={() => {
            setShowForm(false)
            fetchPaymentRecords()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingRecord && (
        <PaymentRecordForm
          reservationId={reservationId}
          customerName={customerName}
          editingRecord={editingRecord}
          onSuccess={() => {
            setEditingRecord(null)
            fetchPaymentRecords()
          }}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  )
}
