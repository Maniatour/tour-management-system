'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, CheckCircle, XCircle, Clock, DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PaymentRecordForm from './PaymentRecordForm'
import { paymentMethodIntegration } from '@/lib/paymentMethodIntegration'

interface PaymentRecord {
  id: string
  reservation_id: string
  payment_status: 'pending' | 'confirmed' | 'rejected'
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
}

export default function PaymentRecordsList({ reservationId, customerName }: PaymentRecordsListProps) {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null)
  const [error, setError] = useState('')

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

  const handleStatusUpdate = async (recordId: string, newStatus: 'pending' | 'confirmed' | 'rejected') => {
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
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={16} className="text-green-500" />
      case 'rejected':
        return <XCircle size={16} className="text-red-500" />
      default:
        return <Clock size={16} className="text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '확인됨'
      case 'rejected':
        return '거부됨'
      default:
        return '대기중'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: '은행 이체',
      cash: '현금',
      card: '카드',
      paypal: 'PayPal',
      other: '기타'
    }
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 flex items-center">
          <DollarSign size={16} className="mr-1" />
          입금 내역 ({paymentRecords.length})
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center"
        >
          <Plus size={12} className="mr-1" />
          추가
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {paymentRecords.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          <DollarSign size={24} className="mx-auto mb-2 text-gray-300" />
          <p>입금 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paymentRecords.map((record) => (
            <div key={record.id} className="bg-gray-50 border border-gray-200 rounded p-3">
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
                  {record.payment_status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(record.id, 'confirmed')}
                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                        title="확인"
                      >
                        <CheckCircle size={14} />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(record.id, 'rejected')}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        title="거부"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
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
