'use client'

import { useState, useEffect } from 'react'
import { Upload, X, Check, AlertCircle, CreditCard, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { paymentMethodIntegration } from '@/lib/paymentMethodIntegration'

interface PaymentRecordFormProps {
  reservationId: string
  customerName: string
  onSuccess: () => void
  onCancel: () => void
  editingRecord?: PaymentRecord | null
}

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
}

export default function PaymentRecordForm({ reservationId, customerName, onSuccess, onCancel, editingRecord }: PaymentRecordFormProps) {
  const [formData, setFormData] = useState({
    payment_status: 'Deposit Requested',
    amount: '',
    payment_method: '',
    payment_method_id: '', // 새로운 결제 방법 ID
    note: '',
    amount_krw: ''
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<Array<{id: string, method: string, method_type: string, user_email: string | null}>>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [validationError, setValidationError] = useState('')

  // 결제 방법 옵션 로드 및 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    let isMounted = true
    let hasLoaded = false
    
    const loadPaymentMethodOptions = async () => {
      if (hasLoaded) return
      hasLoaded = true
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const userEmail = session?.user?.email
        
        const options = await paymentMethodIntegration.getPaymentMethodOptions(userEmail || undefined)
        
        if (!isMounted) return
        
        setPaymentMethodOptions(options)
        
        // 수정 모드일 때 기존 데이터 로드
        if (editingRecord) {
          // payment_method 문자열을 payment_method_id로 변환
          let paymentMethodId = ''
          if (editingRecord.payment_method) {
            const matchedOption = options.find(opt => opt.method === editingRecord.payment_method)
            if (matchedOption) {
              paymentMethodId = matchedOption.id
            } else {
              // 정확한 매치가 없으면 resolvePaymentMethodId 사용
              const resolvedId = await paymentMethodIntegration.resolvePaymentMethodId(
                editingRecord.payment_method,
                userEmail || undefined
              )
              if (resolvedId) {
                paymentMethodId = resolvedId
              }
            }
          }
          
          if (!isMounted) return
          
          setFormData(prev => {
            // 이미 같은 데이터가 설정되어 있으면 업데이트하지 않음
            if (prev.payment_method_id === paymentMethodId && 
                prev.amount === editingRecord.amount.toString()) {
              return prev
            }
            
            return {
              payment_status: editingRecord.payment_status,
              amount: editingRecord.amount.toString(),
              payment_method: editingRecord.payment_method,
              payment_method_id: paymentMethodId,
              note: editingRecord.note || '',
              amount_krw: editingRecord.amount_krw?.toString() || ''
            }
          })
          
          if (editingRecord.image_file_url) {
            setUploadedFile(editingRecord.image_file_url)
          }
        }
      } catch (error) {
        console.error('결제 방법 옵션 로드 오류:', error)
      } finally {
        if (isMounted) {
          setLoadingOptions(false)
        }
      }
    }

    loadPaymentMethodOptions()
    
    return () => {
      isMounted = false
      hasLoaded = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecord?.id, editingRecord?.payment_method]) // id와 payment_method만 의존성으로 사용

  // 결제 방법 검증 함수
  const validatePaymentMethod = async (methodId: string, amount: string) => {
    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        setValidationError('')
        return
      }

      const validation = await paymentMethodIntegration.validatePaymentMethod(methodId, amountNum)
      
      if (!validation.isValid) {
        setValidationError(validation.reason || '결제 방법 검증에 실패했습니다.')
      } else {
        setValidationError('')
      }
    } catch (error) {
      console.error('결제 방법 검증 오류:', error)
      setValidationError('')
    }
  }

  // 결제 방법 변경 시 검증
  useEffect(() => {
    if (formData.payment_method_id && formData.amount) {
      validatePaymentMethod(formData.payment_method_id, formData.amount)
    } else {
      setValidationError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.payment_method_id, formData.amount])

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

      const isEditMode = !!editingRecord
      const url = isEditMode 
        ? `/api/payment-records/${editingRecord.id}`
        : '/api/payment-records'
      
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
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
        throw new Error(errorData.error || `입금 내역 ${isEditMode ? '수정' : '저장'} 중 오류가 발생했습니다.`)
      }

      // 결제 방법 사용량 업데이트 (수령된 결제만)
      const receivedStatuses = ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !']
      if (receivedStatuses.includes(formData.payment_status) && formData.payment_method_id) {
        try {
          await paymentMethodIntegration.updatePaymentUsage(formData.payment_method_id, parseFloat(formData.amount))
        } catch (usageError) {
          console.error('결제 방법 사용량 업데이트 오류:', usageError)
          // 사용량 업데이트 실패는 전체 프로세스를 중단시키지 않음
        }
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
            <h2 className="text-xl font-semibold text-gray-900">
              {editingRecord ? '입금 내역 수정' : '입금 내역 입력'}
            </h2>
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
                  <option value="Partner Received">파트너 수령</option>
                  <option value="Deposit Requested">보증금 요청</option>
                  <option value="Deposit Received">보증금 수령</option>
                  <option value="Balance Received">잔금 수령</option>
                  <option value="Refunded">환불됨 (우리)</option>
                  <option value="Customer's CC Charged">고객 CC 청구 (대행)</option>
                  <option value="Deleted">삭제됨</option>
                  <option value="Refund Requested">환불 요청</option>
                  <option value="Returned">환불됨 (파트너)</option>
                  <option value="Balance Requested">잔금 요청</option>
                  <option value="Commission Received !">수수료 수령 !</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결제 방법 *
                </label>
                {loadingOptions ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-500">결제 방법을 불러오는 중...</span>
                  </div>
                ) : (
                  <select
                    value={formData.payment_method_id}
                    onChange={(e) => {
                      const selectedOption = paymentMethodOptions.find(option => option.id === e.target.value)
                      handleInputChange('payment_method_id', e.target.value)
                      handleInputChange('payment_method', selectedOption?.method || '')
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">결제 방법을 선택하세요</option>
                    {paymentMethodOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.method} ({option.method_type})
                      </option>
                    ))}
                  </select>
                )}
                {validationError && (
                  <div className="mt-1 flex items-center text-sm text-red-600">
                    <AlertCircle size={14} className="mr-1" />
                    {validationError}
                  </div>
                )}
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
                  editingRecord ? '수정' : '저장'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
