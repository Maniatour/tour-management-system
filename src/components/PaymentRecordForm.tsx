'use client'

import { useState } from 'react'
import { Upload, X, Check, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PaymentRecordFormProps {
  reservationId: string
  customerName: string
  onSuccess: () => void
  onCancel: () => void
}

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
}

export default function PaymentRecordForm({ reservationId, customerName, onSuccess, onCancel }: PaymentRecordFormProps) {
  const [formData, setFormData] = useState({
    payment_status: 'pending' as 'pending' | 'confirmed' | 'rejected',
    amount: '',
    payment_method: 'bank_transfer',
    note: '',
    amount_krw: ''
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [error, setError] = useState('')

  const paymentMethods = [
    { value: 'bank_transfer', label: '은행 이체' },
    { value: 'cash', label: '현금' },
    { value: 'card', label: '카드' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'other', label: '기타' }
  ]

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `payment-records/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath)

      setUploadedFile(publicUrl)
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      setError('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    
    if (!formData.amount || !formData.payment_method) {
      setError('금액과 결제 방법을 입력해주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/payment-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          payment_status: formData.payment_status,
          amount: formData.amount,
          payment_method: formData.payment_method,
          note: formData.note || null,
          image_file_url: uploadedFile || null,
          amount_krw: formData.amount_krw || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '입금 내역 저장 중 오류가 발생했습니다.')
      }

      onSuccess()
    } catch (error) {
      console.error('입금 내역 저장 오류:', error)
      setError(error instanceof Error ? error.message : '입금 내역 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">입금 내역 입력</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>고객:</strong> {customerName}
            </p>
            <p className="text-sm text-blue-800">
              <strong>예약 ID:</strong> {reservationId}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle size={16} className="text-red-500 mr-2" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결제 상태 *
                </label>
                <select
                  value={formData.payment_status}
                  onChange={(e) => handleInputChange('payment_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">대기중</option>
                  <option value="confirmed">확인됨</option>
                  <option value="rejected">거부됨</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결제 방법 *
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {paymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  금액 (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  금액 (KRW)
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.amount_krw}
                  onChange={(e) => handleInputChange('amount_krw', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => handleInputChange('note', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="입금 관련 메모를 입력하세요..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                첨부 파일
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {uploadedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Check size={16} className="text-green-500 mr-2" />
                      <span className="text-sm text-green-700">파일이 업로드되었습니다</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                    <label className="cursor-pointer">
                      <span className="text-sm text-blue-600 hover:text-blue-800">
                        파일을 선택하거나 드래그하여 업로드
                      </span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        disabled={uploading}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      이미지, PDF, 문서 파일 (최대 10MB)
                    </p>
                  </div>
                )}
                {uploading && (
                  <div className="text-center mt-2">
                    <span className="text-sm text-gray-500">업로드 중...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    저장 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
