'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Upload, X, Eye, DollarSign, Edit, Trash2, Search, Receipt, Image as ImageIcon } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { useTranslations, useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { parseReimbursedAmount, reimbursementOutstanding } from '@/lib/expenseReimbursement'
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'

/** Radix Dialog가 body에 pointer-events:none을 둘 때도 영수증 오버레이가 동작하도록 body 포털 + 명시적 hit-target */
const RESERVATION_RECEIPT_VIEW_PORTAL_CLASS =
  'fixed inset-0 z-[12000] pointer-events-auto overscroll-contain bg-black bg-opacity-75 flex items-center justify-center p-4'

interface ReservationExpense {
  id: string
  submit_on: string
  submitted_by: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  image_url: string | null
  file_path: string | null
  status: 'pending' | 'approved' | 'rejected'
  reservation_id: string | null
  event_id: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  created_at: string
  updated_at: string
  reimbursed_amount?: number | null
  reimbursed_on?: string | null
  reimbursement_note?: string | null
  /** GET /api/reservation-expenses: 해당 예약 payment_records 금액 합계 */
  reservation_payments_total?: number | null
  reservations?: {
    id: string
    customer_name?: string
    customer_email?: string
    product_id: string
    customers?: { name?: string; email?: string }
  } | null
}

interface ExpenseVendor {
  id: string
  name: string
}

interface Reservation {
  id: string
  customer_id: string
  product_id: string
  customers: {
    name: string
    email: string
  }
}

interface ReservationExpenseManagerProps {
  reservationId?: string
  submittedBy?: string
  userRole?: 'admin' | 'team_member'
  onExpenseUpdated?: () => void
  hideTitle?: boolean
  title?: string
  itemVariant?: 'card' | 'line'
  /** false: no reservation row yet (FK). New modal uses ensure-draft then true */
  isPersisted?: boolean
  /** Shown when !isPersisted (loading/error). Default copy if omitted */
  persistHint?: string
}

function PaidForAutocomplete({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = (query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/reservation-expenses/suggestions?q=${encodeURIComponent(query)}`)
        const d = await r.json()
        if (d.success && Array.isArray(d.values)) setSuggestions(d.values)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          fetchSuggestions(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          fetchSuggestions(value)
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-1.5 text-gray-500">…</li>
          )}
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-gray-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ReservationExpenseManager({ 
  reservationId, 
  submittedBy, 
  onExpenseUpdated,
  hideTitle,
  title: titleProp,
  itemVariant = 'card',
  isPersisted = true,
  persistHint,
}: ReservationExpenseManagerProps) {
  
  const t = useTranslations('reservationExpense')
  const tTour = useTranslations('tours.tourExpense')
  const locale = useLocale()
  const adminList = !reservationId
  const [expenses, setExpenses] = useState<ReservationExpense[]>([])
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<Reservation[]>([])
  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()
  const employeeLinkedPaymentMethodIds = useMemo(() => {
    const set = new Set<string>()
    paymentMethodOptions.forEach((pm) => {
      if (String(pm.user_email || '').trim()) set.add(pm.id)
    })
    return set
  }, [paymentMethodOptions])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ReservationExpense | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reimbursementFilter, setReimbursementFilter] = useState<'all' | 'employee_card' | 'outstanding'>('all')
  /** 수정 모달: 환급 입력란 표시 */
  const [reimbursementSectionOpen, setReimbursementSectionOpen] = useState(false)
  /** 예약 상세 목록: 환급 요약(카드) 표시 — 토글 ON일 때만 */
  const [showReimbursementInList, setShowReimbursementInList] = useState(false)
  /** 관리자 목록: 명세 대조 미연결만 API에서 조회 */
  const [statementMatchFilter, setStatementMatchFilter] = useState<'all' | 'unmatched'>('all')
  const [viewingReceipt, setViewingReceipt] = useState<{ imageUrl: string; paidFor: string } | null>(null)
  const [receiptViewPortalReady, setReceiptViewPortalReady] = useState(false)
  useEffect(() => {
    setReceiptViewPortalReady(true)
  }, [])
  const tStmtRecon = useTranslations('expenses.statementRecon')
  const [reconciledReservationIds, setReconciledReservationIds] = useState<Set<string>>(() => new Set())
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [tableSortKey, setTableSortKey] = useState<string>('submit_on')
  const [tableSortDir, setTableSortDir] = useState<SortDir>('desc')

  // 폼 데이터
  const [formData, setFormData] = useState({
    paid_to: '',
    paid_for: '',
    amount: '',
    payment_method: '',
    note: '',
    image_url: '',
    file_path: '',
    custom_paid_to: '',
    reservation_id: reservationId || '',
    uploaded_files: [] as File[],
    reimbursed_amount: '',
    reimbursed_on: '',
    reimbursement_note: ''
  })

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (reservationId) {
        params.append('reservation_id', reservationId)
        params.append('limit', '500')
      }
      // 예약 상세에서는 PricingSection·매출 산식과 동일하게 이 예약에 연결된 지출 전체를 불러온다.
      // submittedBy는 신규 등록 시 submitted_by 기본값에만 쓰고, 목록 GET에는 넣지 않는다.
      if (submittedBy && !reservationId) params.append('submitted_by', submittedBy)
      if (statementMatchFilter === 'unmatched') params.append('statement_match', 'unmatched')

      const response = await fetch(`/api/reservation-expenses?${params}`)
      const result = await response.json()

      if (result.success) {
        setExpenses(result.data)
      }
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('Error loading expenses:', error)
      }
    } finally {
      setLoading(false)
    }
  }, [reservationId, submittedBy, statementMatchFilter])

  // 데이터 로드
  useEffect(() => {
    void loadExpenses()
  }, [loadExpenses])

  useEffect(() => {
    loadVendors()
    loadTeamMembers()
    if (!reservationId) loadReservations()
  }, [reservationId])

  /** Keep form reservation_id in sync when opening the reservation edit modal (prop loads after mount). */
  useEffect(() => {
    if (reservationId) {
      setFormData((prev) => ({ ...prev, reservation_id: reservationId }))
    }
  }, [reservationId])

  const getEmptyFormData = () => ({
    paid_to: '',
    paid_for: '',
    amount: '',
    payment_method: '',
    note: '',
    image_url: '',
    file_path: '',
    custom_paid_to: '',
    reservation_id: reservationId || '',
    uploaded_files: [] as File[],
    reimbursed_amount: '',
    reimbursed_on: '',
    reimbursement_note: ''
  })

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingExpense(null)
    setFormData(getEmptyFormData())
    setShowCustomPaidTo(false)
    setReimbursementSectionOpen(false)
  }

  const closeAddModal = () => {
    setShowAddForm(false)
    setEditingExpense(null)
    setFormData(getEmptyFormData())
    setShowCustomPaidTo(false)
  }

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_vendors')
        .select('*')
        .order('name')

      if (error) throw error
      setPaidToOptions(data?.map((v: ExpenseVendor) => v.name) || [])
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('Error loading vendors:', error)
      }
    }
  }

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      data?.forEach((member: { email: string; name_ko: string }) => {
        membersMap[member.email] = member.name_ko
      })
      setTeamMembers(membersMap)
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('Error loading team members:', error)
      }
    }
  }

  const loadReservations = async () => {
    try {
      // 예약 정보 가져오기
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, customer_id, product_id')
        .order('created_at', { ascending: false })
        .limit(100)

      if (reservationsError) throw reservationsError

      if (!reservationsData || reservationsData.length === 0) {
        setReservations([])
        return
      }

      // 고객 ID 목록 추출
      const customerIds = [...new Set(reservationsData.map((r: any) => r.customer_id).filter(Boolean))]
      
      // 고객 정보 가져오기
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email')
        .in('id', customerIds)

      if (customersError) throw customersError

      // 고객 정보를 Map으로 변환
      const customerMap = new Map((customersData || []).map((c: any) => [c.id, c]))

      // 예약과 고객 정보 결합
      const reservationsWithCustomers = reservationsData.map((reservation: any) => ({
        id: reservation.id,
        customer_id: reservation.customer_id,
        product_id: reservation.product_id,
        customers: customerMap.get(reservation.customer_id) || { name: 'Unknown', email: '' }
      }))

      setReservations(reservationsWithCustomers)
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('Error loading reservations:', error)
      }
    }
  }

  // 지출 추가
  const handleAddExpense = async () => {
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingExpense) {
      await handleUpdateExpense()
      return
    }

    if (!isPersisted) {
      alert(
        persistHint ||
          '예약이 아직 저장되지 않았습니다. 먼저 예약을 저장한 후 예약 지출을 등록해 주세요.'
      )
      return
    }

    let finalPaidTo = formData.paid_to
    if (formData.custom_paid_to) {
      finalPaidTo = formData.custom_paid_to
    }

    const amountNum = parseFloat(formData.amount)
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      alert(t('invalidAmountNonZero'))
      return
    }
    const paidForVal = (formData.paid_for || '').trim()
    if (!paidForVal) {
      alert('결제 내용을 입력하세요.')
      return
    }
    if (!String(finalPaidTo || '').trim()) {
      alert('결제처를 선택하거나 입력하세요.')
      return
    }
    
    try {
      setUploading(true)
      
      // 고유 ID 생성 (구글 시트 ID 형식)
      const id = `RE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      
      if (formData.custom_paid_to) {
        try {
          const { data: newVendor } = await supabase
            .from('expense_vendors')
            .insert({ name: formData.custom_paid_to } as any)
            .select()
            .single()
          
          if (newVendor) {
            setPaidToOptions(prev => [...prev, (newVendor as ExpenseVendor).name])
          }
        } catch (error) {
          console.error('Error adding new vendor:', error)
        }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const resLinkReservation = (reservationId || formData.reservation_id || '').trim() || null

      const res = await fetch('/api/reservation-expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id,
          submitted_by: submittedBy || sessionData?.session?.user?.email || 'unknown',
          paid_to: finalPaidTo,
          paid_for: paidForVal,
          amount: amountNum,
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          reservation_id: resLinkReservation,
          event_id: null,
          status: 'pending',
          reimbursed_amount: 0,
          reimbursed_on: null,
          reimbursement_note: null,
        }),
      })

      const result = await res.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to create expense')
      }
      closeAddModal()
      onExpenseUpdated?.()
      void loadExpenses()
      alert('예약 지출이 등록되었습니다.')
    } catch (error) {
      console.error('Error adding expense:', error)
      const msg = error instanceof Error ? error.message : ''
      alert(msg ? `예약 지출 등록에 실패했습니다.\n${msg}` : '예약 지출 등록에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 지출 수정
  const handleUpdateExpense = async () => {
    
    if (!editingExpense) return

    const amountNum = parseFloat(formData.amount)
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      alert(t('invalidAmountNonZero'))
      return
    }
    const reimb = reimbursementSectionOpen
      ? parseFloat(String(formData.reimbursed_amount ?? '').trim() || '0')
      : 0
    if (!Number.isFinite(reimb) || reimb < 0) {
      alert(tTour('reimbursementInvalidNonNegative'))
      return
    }
    if (amountNum > 0 && reimb > amountNum + 0.001) {
      alert(tTour('reimbursementExceedsAmount'))
      return
    }

    const reimbPayload =
      amountNum > 0 && reimbursementSectionOpen
        ? {
            reimbursed_amount: reimb,
            reimbursed_on: formData.reimbursed_on?.trim() || null,
            reimbursement_note: formData.reimbursement_note?.trim() || null
          }
        : {
            reimbursed_amount: 0,
            reimbursed_on: null,
            reimbursement_note: null
          }
    
    try {
      setUploading(true)
      
      const response = await fetch(`/api/reservation-expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paid_to: formData.custom_paid_to || formData.paid_to,
          paid_for: (formData.paid_for || '').trim(),
          amount: amountNum,
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          reservation_id: (reservationId || formData.reservation_id || '').trim() || null,
          event_id: null,
          ...reimbPayload
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      closeEditModal()
      onExpenseUpdated?.()
      void loadExpenses()
      alert('예약 지출이 수정되었습니다.')
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('예약 지출 수정에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 지출 삭제
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('정말로 이 예약 지출을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/reservation-expenses/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setExpenses(prev => prev.filter(expense => expense.id !== id))
      onExpenseUpdated?.()
      alert('예약 지출이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('예약 지출 삭제에 실패했습니다.')
    }
  }

  // 지출 수정 모드로 전환 (모달로 열기)
  const handleEditExpense = (expense: ReservationExpense) => {
    setEditingExpense(expense)
    setFormData({
      paid_to: expense.paid_to,
      paid_for: expense.paid_for,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      note: expense.note || '',
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: '',
      reservation_id: expense.reservation_id || '',
      uploaded_files: [],
      reimbursed_amount:
        expense.amount > 0 ? String(parseReimbursedAmount(expense.reimbursed_amount)) : '',
      reimbursed_on: expense.reimbursed_on ? expense.reimbursed_on.slice(0, 10) : '',
      reimbursement_note: expense.reimbursement_note || ''
    })
    setReimbursementSectionOpen(
      parseReimbursedAmount(expense.reimbursed_amount) > 0.009 ||
        Boolean(String(expense.reimbursed_on ?? '').trim()) ||
        Boolean(String(expense.reimbursement_note ?? '').trim())
    )
    setShowEditModal(true)
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      alert('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
    }
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('status.approved')
      case 'rejected': return t('status.rejected')
      case 'pending': return t('status.pending')
      default: return status
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const amountDisplayClass = (amount: number) =>
    amount < 0 ? 'text-red-600' : 'text-green-600'

  // 총 금액 계산 (예약 폼에 임베드될 때 헤더용 — 전체 목록)
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const isLine = itemVariant === 'line'

  const filteredExpenses = useMemo(() => {
    if (!adminList) return expenses
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      const subYmd = e.submit_on ? e.submit_on.slice(0, 10) : ''
      if (dateFrom && subYmd && subYmd < dateFrom) return false
      if (dateTo && subYmd && subYmd > dateTo) return false
      if (reimbursementFilter === 'employee_card') {
        const pm = e.payment_method?.trim()
        if (!pm || !employeeLinkedPaymentMethodIds.has(pm)) return false
      }
      if (reimbursementFilter === 'outstanding') {
        if ((e.amount || 0) <= 0) return false
        if (reimbursementOutstanding(e.amount, e.reimbursed_amount) <= 0.009) return false
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const pmId = e.payment_method?.trim() || ''
        const pmLabel = pmId ? paymentMethodMap[pmId] || '' : ''
        const blob = [
          e.paid_for,
          e.paid_to,
          e.note,
          e.reservation_id,
          e.submitted_by,
          pmId,
          pmLabel,
          e.reservations?.customer_name ?? e.reservations?.customers?.name,
          e.reservations?.customer_email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [
    adminList,
    expenses,
    searchTerm,
    statusFilter,
    dateFrom,
    dateTo,
    paymentMethodMap,
    reimbursementFilter,
    employeeLinkedPaymentMethodIds,
  ])

  const totalFiltered = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  )
  const pendingFiltered = useMemo(
    () =>
      filteredExpenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  )
  const approvedFiltered = useMemo(
    () =>
      filteredExpenses.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  )

  const reimbursedTotalFiltered = useMemo(
    () =>
      adminList
        ? filteredExpenses.reduce((s, e) => s + parseReimbursedAmount(e.reimbursed_amount), 0)
        : 0,
    [adminList, filteredExpenses]
  )
  const outstandingTotalFiltered = useMemo(
    () =>
      adminList
        ? filteredExpenses.reduce((s, e) => {
            if ((e.amount || 0) <= 0) return s
            return s + reimbursementOutstanding(e.amount, e.reimbursed_amount)
          }, 0)
        : 0,
    [adminList, filteredExpenses]
  )

  const displayExpenses = adminList ? filteredExpenses : expenses

  const reservationCustomerLabel = useCallback((expense: ReservationExpense) => {
    const r = expense.reservations
    if (!r) return null
    const name = r.customer_name ?? r.customers?.name ?? null
    return name ? `${name} · ${r.product_id}` : r.product_id ?? null
  }, [])

  const handleReservationTableSort = useCallback(
    (key: string) => {
      if (tableSortKey === key) {
        setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setTableSortKey(key)
        setTableSortDir('asc')
      }
    },
    [tableSortKey]
  )

  const sortLocale = locale === 'en' ? 'en' : 'ko'

  const sortedDisplayExpenses = useMemo(() => {
    const rows = [...displayExpenses]
    rows.sort((a, b) => {
      let va: unknown
      let vb: unknown
      switch (tableSortKey) {
        case 'submit_on':
          va = a.submit_on || ''
          vb = b.submit_on || ''
          break
        case 'paid_for':
          va = a.paid_for
          vb = b.paid_for
          break
        case 'paid_to':
          va = a.paid_to
          vb = b.paid_to
          break
        case 'reservation':
          va = reservationCustomerLabel(a) ?? ''
          vb = reservationCustomerLabel(b) ?? ''
          break
        case 'deposit':
          va = a.reservation_payments_total ?? null
          vb = b.reservation_payments_total ?? null
          break
        case 'amount':
          va = a.amount
          vb = b.amount
          break
        case 'reimbursed':
          va = parseReimbursedAmount(a.reimbursed_amount)
          vb = parseReimbursedAmount(b.reimbursed_amount)
          break
        case 'outstanding':
          va = reimbursementOutstanding(a.amount, a.reimbursed_amount)
          vb = reimbursementOutstanding(b.amount, b.reimbursed_amount)
          break
        case 'submitter':
          va = teamMembers[a.submitted_by] || a.submitted_by
          vb = teamMembers[b.submitted_by] || b.submitted_by
          break
        case 'status':
          va = a.status
          vb = b.status
          break
        default:
          va = a.submit_on || ''
          vb = b.submit_on || ''
      }
      return compareSortValues(va, vb, tableSortDir, sortLocale)
    })
    return rows
  }, [displayExpenses, tableSortKey, tableSortDir, sortLocale, teamMembers, reservationCustomerLabel])

  const reconcilableReservationIds = useMemo(
    () => (adminList ? filteredExpenses : expenses).map((e) => e.id).filter(Boolean),
    [adminList, filteredExpenses, expenses]
  )
  const reconciledReservationIdKey = useMemo(() => [...reconcilableReservationIds].sort().join('|'), [reconcilableReservationIds])

  useEffect(() => {
    if (reconcilableReservationIds.length === 0) {
      setReconciledReservationIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIdsBatched(supabase, 'reservation_expenses', reconcilableReservationIds).then((s) => {
      if (!cancelled) setReconciledReservationIds(s)
    })
    return () => {
      cancelled = true
    }
  }, [reconciledReservationIdKey])

  const openReservationStmtRecon = useCallback((expense: ReservationExpense) => {
    const ymd = expense.submit_on ? expense.submit_on.slice(0, 10) : ''
    if (!ymd) return
    setStmtReconCtx({
      sourceTable: 'reservation_expenses',
      sourceId: expense.id,
      dateYmd: ymd,
      amount: Math.abs(Number(expense.amount ?? 0)),
      direction: 'outflow'
    })
    setStmtReconOpen(true)
  }, [])

  const formatDepositCell = (v: number | null | undefined) => {
    if (v == null) return '—'
    return formatCurrency(v)
  }

  const resetAdminFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setReimbursementFilter('all')
    setStatementMatchFilter('all')
  }

  const showTitle = !hideTitle || titleProp
  const titleText = titleProp ?? t('expenseManagement')
  return (
    <div className={adminList ? 'space-y-3 sm:space-y-4' : 'space-y-2 sm:space-y-3'}>
      {!isPersisted && (
        <p className="text-[11px] sm:text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          {persistHint || '예약을 저장한 후에 예약 지출을 등록할 수 있습니다.'}
        </p>
      )}

      {adminList && (
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder={tTour('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            <button
              type="button"
              disabled={!isPersisted}
              title={!isPersisted ? persistHint || '예약 저장 후 이용' : undefined}
              onClick={() => {
                setShowAddForm(true)
                setEditingExpense(null)
                setFormData({
                  paid_to: '',
                  paid_for: '',
                  amount: '',
                  payment_method: '',
                  note: '',
                  image_url: '',
                  file_path: '',
                  custom_paid_to: '',
                  reservation_id: reservationId || '',
                  uploaded_files: [],
                  reimbursed_amount: '',
                  reimbursed_on: '',
                  reimbursement_note: ''
                })
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 sm:gap-2 text-sm w-full sm:w-auto shrink-0 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addExpense')}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{tTour('statusLabel')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">{tTour('filterAll')}</option>
                <option value="pending">{tTour('filterPending')}</option>
                <option value="approved">{tTour('filterApproved')}</option>
                <option value="rejected">{tTour('filterRejected')}</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1"
                htmlFor="re-filter-statement-match"
              >
                {t('statementMatchLabel')}
              </label>
              <select
                id="re-filter-statement-match"
                value={statementMatchFilter}
                onChange={(e) => setStatementMatchFilter(e.target.value as 'all' | 'unmatched')}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">{t('statementMatchAll')}</option>
                <option value="unmatched">{t('statementMatchUnmatched')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{tTour('startDate')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{tTour('endDate')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 lg:col-span-1 flex items-end">
              <button
                type="button"
                onClick={resetAdminFilters}
                className="w-full px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-gray-700"
              >
                {t('filterReset')}
              </button>
            </div>
          </div>
          <div className="max-w-md">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
              {tTour('reimbursementFilterLabel')}
            </label>
            <select
              value={reimbursementFilter}
              onChange={(e) =>
                setReimbursementFilter(e.target.value as 'all' | 'employee_card' | 'outstanding')
              }
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{tTour('reimbursementFilterAll')}</option>
              <option value="employee_card">{tTour('reimbursementFilterEmployeeCard')}</option>
              <option value="outstanding">{tTour('reimbursementFilterOutstanding')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200/80">
            <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-100/80">
              <div className="text-xs sm:text-sm text-gray-600">{tTour('totalExpenseSum')}</div>
              <div className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalFiltered)}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 border border-yellow-100/80">
              <div className="text-xs sm:text-sm text-gray-600">{tTour('pendingSum')}</div>
              <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">{formatCurrency(pendingFiltered)}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100/80">
              <div className="text-xs sm:text-sm text-gray-600">{tTour('approvedSum')}</div>
              <div className="text-base sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(approvedFiltered)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-100">
              <div className="text-xs sm:text-sm text-gray-600">{tTour('reimbursedTotalLabel')}</div>
              <div className="text-base sm:text-2xl font-bold text-slate-800 truncate">
                {formatCurrency(reimbursedTotalFiltered)}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 sm:p-3 border border-amber-100 col-span-2 sm:col-span-1 lg:col-span-1">
              <div className="text-xs sm:text-sm text-gray-600">{tTour('outstandingTotalLabel')}</div>
              <div className="text-base sm:text-2xl font-bold text-amber-800 truncate">
                {formatCurrency(outstandingTotalFiltered)}
              </div>
            </div>
          </div>
        </div>
      )}

      {!adminList && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
          {showTitle && (
            <>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
              <h3 className="text-xs font-semibold text-gray-900 truncate">
                {titleText}
                {reservationId ? (
                  <span className="ml-1 font-normal text-gray-500">
                    ({sortedDisplayExpenses.length}건)
                  </span>
                ) : null}
              </h3>
            </>
          )}
          {reservationId && (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={showReimbursementInList}
                aria-label={t('showReimbursementDetails')}
                onClick={() => setShowReimbursementInList((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
                  showReimbursementInList ? 'bg-amber-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                    showReimbursementInList ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-[10px] sm:text-xs text-gray-600 whitespace-nowrap">
                {t('showReimbursementDetails')}
              </span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className="text-[10px] sm:text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {t('totalAmountLabel')}:{' '}
              <span className="font-semibold text-green-600">{formatCurrency(totalAmount)}</span>
            </span>
          </div>
          <button
            type="button"
            disabled={!isPersisted}
            title={!isPersisted ? persistHint || '예약 저장 후 이용' : undefined}
            onClick={() => {
              setShowAddForm(true)
              setEditingExpense(null)
              setFormData({
                paid_to: '',
                paid_for: '',
                amount: '',
                payment_method: '',
                note: '',
                image_url: '',
                file_path: '',
                custom_paid_to: '',
                reservation_id: reservationId || '',
                uploaded_files: [],
                reimbursed_amount: '',
                reimbursed_on: '',
                reimbursement_note: ''
              })
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors flex-shrink-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:bg-blue-600"
          >
            <Plus size={12} />
            <span>{t('addExpense')}</span>
          </button>
        </div>
      </div>
      )}

      {/* 지출 추가 — 모달 (수정도 별도 모달) */}
      <Dialog
        open={showAddForm && !editingExpense}
        onOpenChange={(open) => {
          if (!open) closeAddModal()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addExpense')}</DialogTitle>
            <DialogDescription>{t('amountRefundHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* 결제처 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('paidTo')} <span className="text-red-500">*</span>
                </label>
                {!showCustomPaidTo ? (
                  <div className="space-y-2">
                    <select
                      value={formData.paid_to || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, paid_to: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {paidToOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidTo(true)}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                    >
                      {t('directInput')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.custom_paid_to ?? ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_to: e.target.value }))}
                      placeholder={t('newPaidToPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomPaidTo(false)
                        setFormData(prev => ({ ...prev, custom_paid_to: '' }))
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      {t('backToList')}
                    </button>
                  </div>
                )}
              </div>

              {/* 결제내용: DB paid_for 제안 + 직접 입력 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('paidFor')} <span className="text-red-500">*</span>
                </label>
                <PaidForAutocomplete
                  value={formData.paid_for}
                  onChange={(v) => setFormData((prev) => ({ ...prev, paid_for: v }))}
                  disabled={uploading}
                />
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                  기존 예약 지출에서 검색해 선택하거나, 새 결제 내용을 입력할 수 있습니다.
                </p>
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('amount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.amount ?? ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={t('amountInputPlaceholder')}
                  step="0.01"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 결제방법 — typing으로 필터 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('form.paymentMethod')}
                </label>
                <PaymentMethodAutocomplete
                  options={paymentMethodOptions}
                  valueId={formData.payment_method || ''}
                  onChange={(id) => setFormData((prev) => ({ ...prev, payment_method: id }))}
                  disabled={uploading}
                  pleaseSelectLabel={t('selectOptions.pleaseSelect')}
                />
              </div>

              {reservationId ? (
                <div className="md:col-span-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2 text-[11px] text-gray-600">
                  이 지출은 현재 예약에만 연결되어 저장됩니다.
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                    {t('form.reservationId')}
                  </label>
                  <select
                    value={formData.reservation_id || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reservation_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    {reservations.map((reservation: Reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.customers.name} ({reservation.product_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                {t('memo')}
              </label>
              <textarea
                value={formData.note ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder={t('memoPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 영수증 이미지 업로드 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                {t('form.image')}
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  uploading 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                    : dragOver 
                      ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                }`}
                onDragOver={!uploading ? handleDragOver : undefined}
                onDragLeave={!uploading ? handleDragLeave : undefined}
                onDrop={!uploading ? handleDrop : undefined}
                onPaste={!uploading ? handlePaste : undefined}
                tabIndex={!uploading ? 0 : -1}
                onClick={!uploading ? () => fileInputRef.current?.click() : undefined}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files)
                      setFormData(prev => ({
                        ...prev,
                        uploaded_files: [...prev.uploaded_files, ...files]
                      }))
                    }
                  }}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    uploading 
                      ? 'bg-blue-100' 
                      : dragOver 
                        ? 'bg-blue-200' 
                        : 'bg-gray-100'
                  }`}>
                    {uploading ? (
                      <div className="animate-spin">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                    ) : dragOver ? (
                      <Upload className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium transition-colors ${
                      dragOver ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {uploading 
                        ? t('uploadingFiles')
                        : dragOver 
                          ? t('dropFilesHere')
                          : t('dragOrClickFiles')
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('pasteFromClipboard')}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {t('supportedFormats')}
                  </div>
                </div>
                
                {/* 업로드된 파일 목록 */}
                {formData.uploaded_files && formData.uploaded_files.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-3 text-gray-900">{t('uploadedFiles')} ({formData.uploaded_files?.length || 0}{t('files')})</h4>
                    <div className="space-y-2">
                      {formData.uploaded_files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                              {file.type.startsWith('image/') ? (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(index)
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => closeAddModal()}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? t('processing') : t('buttons.register')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-2 text-sm">{t('loading')}</p>
        </div>
      ) : sortedDisplayExpenses.length > 0 ? (
        adminList ? (
          <>
            <div className="md:hidden space-y-3">
              {sortedDisplayExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-1 min-w-0 flex-1">
                      <ExpenseStatementReconIcon
                        matched={reconciledReservationIds.has(expense.id)}
                        titleMatched={tStmtRecon('matchedTitle')}
                        titleUnmatched={tStmtRecon('unmatchedTitle')}
                        onClick={() => openReservationStmtRecon(expense)}
                      />
                      <p className="font-semibold text-gray-900 text-sm truncate flex-1">{expense.paid_for}</p>
                    </div>
                    <p className={`text-lg font-bold whitespace-nowrap ${amountDisplayClass(expense.amount)}`}>{formatCurrency(expense.amount)}</p>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                    <span className="text-gray-400">{tTour('date')}</span>
                    <span>{expense.submit_on ? expense.submit_on.slice(0, 10) : '—'}</span>
                    <span className="text-gray-400">{t('paidTo')}</span>
                    <span className="truncate">{expense.paid_to}</span>
                    <span className="text-gray-400">{tTour('submitter')}</span>
                    <span className="truncate">{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                    <span className="text-gray-400">{tTour('statusLabel')}</span>
                    <span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                        {getStatusText(expense.status)}
                      </span>
                    </span>
                    {expense.reservations && reservationCustomerLabel(expense) && (
                      <>
                        <span className="text-gray-400">{t('form.reservationId')}</span>
                        <span className="truncate">{reservationCustomerLabel(expense)}</span>
                      </>
                    )}
                    <span className="text-gray-400">{t('depositPaymentsTotal')}</span>
                    <span className="font-medium text-blue-800">{formatDepositCell(expense.reservation_payments_total)}</span>
                    {expense.amount > 0 && (
                      <>
                        <span className="text-gray-400">{tTour('reimbursedShort')}</span>
                        <span>{formatCurrency(parseReimbursedAmount(expense.reimbursed_amount))}</span>
                        <span className="text-gray-400">{tTour('outstandingShort')}</span>
                        <span
                          className={
                            reimbursementOutstanding(expense.amount, expense.reimbursed_amount) > 0.009
                              ? 'font-semibold text-amber-800'
                              : 'text-green-700'
                          }
                        >
                          {formatCurrency(reimbursementOutstanding(expense.amount, expense.reimbursed_amount))}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    {expense.image_url && expense.image_url.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingReceipt({ imageUrl: expense.image_url!, paidFor: expense.paid_for })
                        }
                        className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-blue-50 min-h-[44px]"
                      >
                        <Receipt className="w-4 h-4" />
                        {t('viewReceipt')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditExpense(expense)}
                      className="inline-flex items-center gap-1 text-gray-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-gray-100 min-h-[44px]"
                    >
                      <Edit className="w-4 h-4" />
                      {t('buttons.edit')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12"
                      title={tStmtRecon('unmatchedTitle')}
                    >
                      {tStmtRecon('columnHeaderShort')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={tTour('date')}
                        active={tableSortKey === 'submit_on'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('submit_on')}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={t('paidFor')}
                        active={tableSortKey === 'paid_for'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('paid_for')}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={t('paidTo')}
                        active={tableSortKey === 'paid_to'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('paid_to')}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={t('form.reservationId')}
                        active={tableSortKey === 'reservation'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('reservation')}
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom"
                      title={t('depositPaymentsTotalHint')}
                    >
                      <div className="flex justify-end">
                        <TableSortHeaderButton
                          label={t('depositPaymentsTotal')}
                          active={tableSortKey === 'deposit'}
                          dir={tableSortDir}
                          onClick={() => handleReservationTableSort('deposit')}
                          className="text-right"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                      <div className="flex justify-end">
                        <TableSortHeaderButton
                          label={tTour('amount')}
                          active={tableSortKey === 'amount'}
                          dir={tableSortDir}
                          onClick={() => handleReservationTableSort('amount')}
                          className="text-right"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                      <div className="flex justify-end">
                        <TableSortHeaderButton
                          label={tTour('reimbursedShort')}
                          active={tableSortKey === 'reimbursed'}
                          dir={tableSortDir}
                          onClick={() => handleReservationTableSort('reimbursed')}
                          className="text-right"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                      <div className="flex justify-end">
                        <TableSortHeaderButton
                          label={tTour('outstandingShort')}
                          active={tableSortKey === 'outstanding'}
                          dir={tableSortDir}
                          onClick={() => handleReservationTableSort('outstanding')}
                          className="text-right"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={tTour('submitter')}
                        active={tableSortKey === 'submitter'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('submitter')}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                      <TableSortHeaderButton
                        label={tTour('statusLabel')}
                        active={tableSortKey === 'status'}
                        dir={tableSortDir}
                        onClick={() => handleReservationTableSort('status')}
                      />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{tTour('receipt')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{tTour('action')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDisplayExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <ExpenseStatementReconIcon
                          matched={reconciledReservationIds.has(expense.id)}
                          titleMatched={tStmtRecon('matchedTitle')}
                          titleUnmatched={tStmtRecon('unmatchedTitle')}
                          onClick={() => openReservationStmtRecon(expense)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {expense.submit_on ? expense.submit_on.slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{expense.paid_for}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{expense.paid_to}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">
                        {reservationCustomerLabel(expense) ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right text-blue-800">
                        {formatDepositCell(expense.reservation_payments_total)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${amountDisplayClass(expense.amount)}`}>
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                        {expense.amount > 0 ? formatCurrency(parseReimbursedAmount(expense.reimbursed_amount)) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {expense.amount > 0 ? (
                          <span
                            className={
                              reimbursementOutstanding(expense.amount, expense.reimbursed_amount) > 0.009
                                ? 'font-semibold text-amber-700'
                                : 'text-green-700'
                            }
                          >
                            {formatCurrency(reimbursementOutstanding(expense.amount, expense.reimbursed_amount))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {teamMembers[expense.submitted_by] || expense.submitted_by}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                          {getStatusText(expense.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {expense.image_url && expense.image_url.trim() !== '' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingReceipt({ imageUrl: expense.image_url!, paidFor: expense.paid_for })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Receipt className="w-4 h-4" />
                            {tTour('view')}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">{tTour('none')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditExpense(expense)}
                            className="p-1 text-gray-600 hover:text-blue-600"
                            title={t('buttons.edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1 text-gray-600 hover:text-red-600"
                            title={t('buttons.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
        <div
          className={
            isLine
              ? 'divide-y divide-gray-200'
              : reservationId
                ? 'space-y-2 max-h-[min(480px,55vh)] overflow-y-auto pr-0.5'
                : 'space-y-1.5'
          }
        >
                  {sortedDisplayExpenses.map((expense) => (
            <div
              key={expense.id}
              className={
                isLine
                  ? 'py-2 first:pt-0'
                  : `border border-gray-200 rounded-xl bg-white hover:bg-gray-50/80 shadow-sm transition-colors ${reservationId ? 'px-3 py-3' : 'px-2.5 py-2'}`
              }
            >
              {/* 1행: 결제내용 + 금액 + 상태 + 액션 */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-1 flex-wrap">
                  <ExpenseStatementReconIcon
                    matched={reconciledReservationIds.has(expense.id)}
                    titleMatched={tStmtRecon('matchedTitle')}
                    titleUnmatched={tStmtRecon('unmatchedTitle')}
                    onClick={() => openReservationStmtRecon(expense)}
                  />
                  <span className="font-medium text-gray-900 text-xs truncate">{expense.paid_for}</span>
                  <span className={`text-sm font-semibold flex-shrink-0 ${amountDisplayClass(expense.amount)}`}>{formatCurrency(expense.amount)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getStatusColor(expense.status)}`}>{getStatusText(expense.status)}</span>
                  {expense.payment_method && (
                    <span className="text-[10px] text-gray-500 flex-shrink-0">
                      {paymentMethodMap[expense.payment_method] || expense.payment_method}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditExpense(expense); }}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    title={t('buttons.edit')}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteExpense(expense.id); }}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title={t('buttons.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* 2행: 결제처 · 제출일 · 제출자 (한 줄) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-500">
                <span className="truncate">{expense.paid_to}</span>
                <span>{new Date(expense.submit_on).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}</span>
                <span className="truncate">{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                {expense.image_url && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(expense.image_url!, '_blank'); }}
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <Eye size={10} />
                    {t('viewReceipt')}
                  </button>
                )}
              </div>
              {!reservationId && expense.reservations && reservationCustomerLabel(expense) && (
                <p className="mt-0.5 text-[10px] text-gray-400 truncate">{reservationCustomerLabel(expense)}</p>
              )}
              {expense.note && (
                <p className="mt-0.5 text-[10px] text-gray-500 truncate max-w-full" title={expense.note}>{expense.note}</p>
              )}
              {reservationId &&
                showReimbursementInList &&
                expense.amount > 0 &&
                (parseReimbursedAmount(expense.reimbursed_amount) > 0 ||
                  reimbursementOutstanding(expense.amount, expense.reimbursed_amount) > 0.009) && (
                  <p className="mt-0.5 text-[10px] text-amber-900/90 truncate max-w-full">
                    {tTour('reimbursedShort')}: {formatCurrency(parseReimbursedAmount(expense.reimbursed_amount))}
                    <span className="text-gray-400 mx-1">·</span>
                    {tTour('outstandingShort')}:{' '}
                    {formatCurrency(reimbursementOutstanding(expense.amount, expense.reimbursed_amount))}
                  </p>
                )}
            </div>
          ))}
        </div>
        )
      ) : (
        <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
          <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-gray-300" />
          <p>{adminList ? tTour('noExpensesMatch') : t('noExpensesMessage')}</p>
        </div>
      )}

      {receiptViewPortalReady &&
        viewingReceipt &&
        createPortal(
          <div className={RESERVATION_RECEIPT_VIEW_PORTAL_CLASS}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {tTour('receiptLabel')}: {viewingReceipt.paidFor}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)] overscroll-contain">
                <div className="flex flex-col items-center">
                  <img
                    src={viewingReceipt.imageUrl}
                    alt=""
                    className="max-w-full h-auto rounded-lg shadow-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  <div className="mt-4 flex gap-2">
                    <a
                      href={viewingReceipt.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      {tTour('openInNewWindow')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 예약 지출 수정 모달 */}
      <Dialog open={showEditModal} onOpenChange={(open) => { if (!open) closeEditModal(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editExpense')}</DialogTitle>
            <DialogDescription>{t('amountRefundHint')}</DialogDescription>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paidTo')} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.custom_paid_to || formData.paid_to || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, paid_to: e.target.value, custom_paid_to: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paidFor')} <span className="text-red-500">*</span></label>
                  <PaidForAutocomplete
                    value={formData.paid_for}
                    onChange={(v) => setFormData((prev) => ({ ...prev, paid_for: v }))}
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('amount')} <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.amount ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    step="0.01"
                    placeholder={t('amountInputPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.paymentMethod')}</label>
                  <PaymentMethodAutocomplete
                    options={paymentMethodOptions}
                    valueId={formData.payment_method || ''}
                    onChange={(id) => setFormData((prev) => ({ ...prev, payment_method: id }))}
                    disabled={uploading}
                    pleaseSelectLabel={t('selectOptions.pleaseSelect')}
                  />
                </div>
              </div>
              {reservationId ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2 text-[11px] text-gray-600">
                  이 지출은 현재 예약에만 연결되어 저장됩니다.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.reservationId')}</label>
                  <select
                    value={formData.reservation_id || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reservation_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    {reservations.map((reservation: Reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.customers.name} ({reservation.product_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {parseFloat(formData.amount || '0') > 0 && (
                <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-3 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-700 focus:ring-amber-500"
                      checked={reimbursementSectionOpen}
                      onChange={(e) => {
                        const on = e.target.checked
                        setReimbursementSectionOpen(on)
                        if (!on) {
                          setFormData((prev) => ({
                            ...prev,
                            reimbursed_amount: '',
                            reimbursed_on: '',
                            reimbursement_note: '',
                          }))
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-amber-950">{tTour('reimbursementToggleLabel')}</span>
                  </label>
                  {reimbursementSectionOpen && (
                    <>
                      <p className="text-xs font-medium text-amber-900">{tTour('reimbursementSectionTitle')}</p>
                      <p className="text-[11px] text-amber-800/90">{tTour('reimbursementSectionHint')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{tTour('reimbursedAmount')}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.reimbursed_amount}
                            onChange={(e) => setFormData((prev) => ({ ...prev, reimbursed_amount: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{tTour('reimbursedOn')}</label>
                          <input
                            type="date"
                            value={formData.reimbursed_on}
                            onChange={(e) => setFormData((prev) => ({ ...prev, reimbursed_on: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{tTour('reimbursementNote')}</label>
                        <input
                          type="text"
                          value={formData.reimbursement_note}
                          onChange={(e) => setFormData((prev) => ({ ...prev, reimbursement_note: e.target.value }))}
                          placeholder={tTour('reimbursementNotePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('memo')}</label>
                <textarea
                  value={formData.note ?? ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder={t('memoPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {formData.image_url && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{t('form.image')}:</span>
                  <button
                    type="button"
                    onClick={() => window.open(formData.image_url!, '_blank')}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    <Eye size={14} className="inline mr-1" />
                    {t('viewReceipt')}
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('buttons.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAddExpense()}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? t('processing') : t('buttons.edit')}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(o) => {
          setStmtReconOpen(o)
          if (!o) setStmtReconCtx(null)
        }}
        context={stmtReconCtx}
        onApplied={() => void loadExpenses()}
      />
    </div>
  )
}
