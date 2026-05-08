'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Upload, X, Check, Eye, DollarSign, Edit, Trash2, Settings, Receipt, Image as ImageIcon, Folder, Search, Calendar, Filter, Download, Wallet } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import GoogleDriveReceiptImporter from './GoogleDriveReceiptImporter'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { parseReimbursedAmount, reimbursementOutstanding } from '@/lib/expenseReimbursement'
import { fetchReconciledSourceIdsBatched } from '@/lib/reconciliation-match-queries'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'

interface TourExpense {
  id: string
  tour_id: string
  submit_on: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  tour_date: string
  product_id: string | null
  submitted_by: string
  image_url: string | null
  file_path: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  reimbursed_amount?: number | null
  reimbursed_on?: string | null
  reimbursement_note?: string | null
  // 조인된 데이터
  tours?: {
    id: string
    tour_date: string
    product_id: string | null
  }
  products?: {
    id: string
    name: string | null
    name_en: string | null
    name_ko: string | null
  }
}

export default function AllTourExpensesManager() {
  const t = useTranslations('tours.tourExpense')
  const tStmt = useTranslations('expenses.statementRecon')
  const locale = useLocale()
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  const { paymentMethodMap, paymentMethodOptions } = usePaymentMethodOptions()

  const employeeLinkedPaymentMethodIds = useMemo(() => {
    const set = new Set<string>()
    paymentMethodOptions.forEach((pm) => {
      if (String(pm.user_email || '').trim()) set.add(pm.id)
    })
    return set
  }, [paymentMethodOptions])

  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [viewingReceipt, setViewingReceipt] = useState<{ imageUrl: string; expenseId: string; paidFor: string } | null>(null)
  const [showDriveImporter, setShowDriveImporter] = useState(false)
  
  // 필터링 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tourIdFilter, setTourIdFilter] = useState('')
  const [reimbursementFilter, setReimbursementFilter] = useState<'all' | 'employee_card' | 'outstanding'>('all')
  const [reimburseModal, setReimburseModal] = useState<TourExpense | null>(null)
  const [reimburseForm, setReimburseForm] = useState({
    reimbursed_amount: '',
    reimbursed_on: '',
    reimbursement_note: ''
  })
  const [reimburseSaving, setReimburseSaving] = useState(false)
  const [reconciledTourExpenseIds, setReconciledTourExpenseIds] = useState<Set<string>>(() => new Set())
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [tourTableSortKey, setTourTableSortKey] = useState<string>('tour_date')
  const [tourTableSortDir, setTourTableSortDir] = useState<SortDir>('desc')

  // 팀 멤버 정보 로드
  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const memberMap: Record<string, string> = {}
      data?.forEach(member => {
        memberMap[member.email] = member.name_ko || member.email
      })
      setTeamMembers(memberMap)
    } catch (error) {
      if (isAbortLikeError(error)) return
      console.error('Error loading team members:', error)
    }
  }

  // 모든 투어 지출 목록 로드
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      
      // tour_expenses 기본 조회
      let query = supabase
        .from('tour_expenses')
        .select('*')
        .order('created_at', { ascending: false })

      // 필터 적용
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (dateFrom) {
        query = query.gte('tour_date', dateFrom)
      }
      if (dateTo) {
        query = query.lte('tour_date', dateTo)
      }
      if (tourIdFilter) {
        query = query.eq('tour_id', tourIdFilter)
      }

      const { data, error } = await query

      if (error) throw error
      
      console.log('🔍 Loaded all tour expenses:', data?.length || 0)
      
      // 투어 및 상품 정보 별도 조회
      const tourIds = [...new Set((data || []).map((e: any) => e.tour_id).filter(Boolean))]
      const productIds = [...new Set((data || []).map((e: any) => e.product_id).filter(Boolean))]
      
      // 투어 정보 조회
      const toursMap = new Map()
      if (tourIds.length > 0) {
        const { data: toursData } = await supabase
          .from('tours')
          .select('id, tour_date, product_id')
          .in('id', tourIds)
        
        toursData?.forEach(tour => {
          toursMap.set(tour.id, tour)
          // 투어의 product_id도 productIds에 추가 (expense.product_id가 없을 때 사용)
          if (tour.product_id) {
            productIds.push(tour.product_id)
          }
        })
      }
      
      // 상품 정보 조회 (중복 제거)
      const uniqueProductIds = [...new Set(productIds.filter(Boolean))]
      const productsMap = new Map()
      if (uniqueProductIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, name_en, name_ko')
          .in('id', uniqueProductIds)
        
        productsData?.forEach(product => {
          productsMap.set(product.id, product)
        })
      }
      
      // file_path가 있지만 image_url이 없는 경우 공개 URL 생성 및 관련 데이터 병합
      const processedExpenses = await Promise.all((data || []).map(async (expense: any) => {
        const tour = toursMap.get(expense.tour_id)
        
        // product_id 우선순위: expense.product_id > tour.product_id
        const finalProductId = expense.product_id || tour?.product_id || null
        const product = finalProductId ? productsMap.get(finalProductId) : null
        
        let finalExpense = {
          ...expense,
          tours: tour || null,
          products: product || null
        }
        
        // image_url이 없고 file_path가 있는 경우
        if ((!expense.image_url || expense.image_url.trim() === '') && expense.file_path) {
          try {
            const { data: urlData } = supabase.storage
              .from('tour-expenses')
              .getPublicUrl(expense.file_path)
            
            finalExpense = {
              ...finalExpense,
              image_url: urlData.publicUrl
            }
          } catch (urlError) {
            console.error('Error generating public URL:', urlError)
          }
        }
        
        return finalExpense
      }))
      
      setExpenses(processedExpenses)
    } catch (error) {
      if (isAbortLikeError(error)) return
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dateFrom, dateTo, tourIdFilter])

  useEffect(() => {
    loadExpenses()
    loadTeamMembers()
  }, [loadExpenses])

  // 검색 필터 적용 (결제방법: 저장 ID + 결제 방법 관리 표시명)
  const searchFilteredExpenses = expenses.filter((expense) => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const pmId = expense.payment_method?.trim() || ''
    const pmLabel = pmId ? paymentMethodMap[pmId] || '' : ''
    return (
      expense.paid_for?.toLowerCase().includes(searchLower) ||
      expense.paid_to?.toLowerCase().includes(searchLower) ||
      expense.tour_id?.toLowerCase().includes(searchLower) ||
      expense.products?.name?.toLowerCase().includes(searchLower) ||
      expense.products?.name_en?.toLowerCase().includes(searchLower) ||
      expense.products?.name_ko?.toLowerCase().includes(searchLower) ||
      expense.note?.toLowerCase().includes(searchLower) ||
      (pmId && pmId.toLowerCase().includes(searchLower)) ||
      (pmLabel && pmLabel.toLowerCase().includes(searchLower))
    )
  })

  const filteredExpenses = searchFilteredExpenses.filter((e) => {
    if (reimbursementFilter === 'employee_card') {
      const pm = e.payment_method?.trim()
      if (!pm || !employeeLinkedPaymentMethodIds.has(pm)) return false
    }
    if (reimbursementFilter === 'outstanding') {
      if ((e.amount || 0) <= 0) return false
      if (reimbursementOutstanding(e.amount, e.reimbursed_amount) <= 0.009) return false
    }
    return true
  })

  const handleTourTableSort = useCallback(
    (key: string) => {
      if (tourTableSortKey === key) {
        setTourTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setTourTableSortKey(key)
        setTourTableSortDir('asc')
      }
    },
    [tourTableSortKey]
  )

  const tourSortLocale = locale === 'en' ? 'en' : 'ko'

  const getProductDisplayName = useCallback(
    (product: TourExpense['products']) => {
      if (!product) return '-'
      if (locale === 'en') {
        const en = (product.name_en || '').trim()
        return en || '-'
      }
      return product.name_ko || product.name || product.name_en || '-'
    },
    [locale]
  )

  const sortedFilteredExpenses = useMemo(() => {
    const rows = [...filteredExpenses]
    rows.sort((a, b) => {
      let va: unknown
      let vb: unknown
      switch (tourTableSortKey) {
        case 'tour_date':
          va = a.tour_date || ''
          vb = b.tour_date || ''
          break
        case 'product':
          va = getProductDisplayName(a.products)
          vb = getProductDisplayName(b.products)
          break
        case 'paid_for':
          va = a.paid_for
          vb = b.paid_for
          break
        case 'paid_to':
          va = a.paid_to
          vb = b.paid_to
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
          va = a.tour_date || ''
          vb = b.tour_date || ''
      }
      return compareSortValues(va, vb, tourTableSortDir, tourSortLocale)
    })
    return rows
  }, [filteredExpenses, tourTableSortKey, tourTableSortDir, tourSortLocale, teamMembers, getProductDisplayName])

  const tourReconIds = useMemo(() => filteredExpenses.map((e) => e.id), [filteredExpenses])
  const tourReconIdKey = useMemo(() => [...tourReconIds].sort().join('|'), [tourReconIds])

  useEffect(() => {
    if (tourReconIds.length === 0) {
      setReconciledTourExpenseIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIdsBatched(supabase, 'tour_expenses', tourReconIds).then((s) => {
      if (!cancelled) setReconciledTourExpenseIds(s)
    })
    return () => {
      cancelled = true
    }
  }, [tourReconIdKey])

  const openTourStmtRecon = (expense: TourExpense) => {
    const raw = expense.submit_on || expense.tour_date
    const ymd = raw ? String(raw).trim().slice(0, 10) : ''
    if (!ymd) return
    setStmtReconCtx({
      sourceTable: 'tour_expenses',
      sourceId: expense.id,
      dateYmd: ymd,
      amount: Math.abs(Number(expense.amount ?? 0)),
      direction: 'outflow'
    })
    setStmtReconOpen(true)
  }

  const persistReimbursement = async () => {
    if (!reimburseModal) return
    const amountNum = reimburseModal.amount
    const reimb = parseFloat(String(reimburseForm.reimbursed_amount ?? '').trim() || '0')
    if (!Number.isFinite(reimb) || reimb < 0) {
      alert(t('reimbursementInvalidNonNegative'))
      return
    }
    if (amountNum > 0 && reimb > amountNum + 0.001) {
      alert(t('reimbursementExceedsAmount'))
      return
    }
    const reimbursedOnVal = reimburseForm.reimbursed_on?.trim() || null
    const payload =
      amountNum > 0
        ? {
            reimbursed_amount: reimb,
            reimbursed_on: reimbursedOnVal,
            reimbursement_note: reimburseForm.reimbursement_note?.trim() || null,
            updated_at: new Date().toISOString()
          }
        : {
            reimbursed_amount: 0,
            reimbursed_on: null,
            reimbursement_note: null,
            updated_at: new Date().toISOString()
          }
    setReimburseSaving(true)
    try {
      const { error } = await supabase.from('tour_expenses').update(payload).eq('id', reimburseModal.id)
      if (error) throw error
      setExpenses((prev) =>
        prev.map((row) => (row.id === reimburseModal.id ? { ...row, ...payload } : row))
      )
      setReimburseModal(null)
    } catch (err) {
      console.error(err)
      alert(t('saveError'))
    } finally {
      setReimburseSaving(false)
    }
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return t('status.approved')
      case 'rejected':
        return t('status.rejected')
      default:
        return t('status.pending')
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // 총계 계산
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const pendingAmount = filteredExpenses
    .filter(e => e.status === 'pending')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const approvedAmount = filteredExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, expense) => sum + expense.amount, 0)

  const reimbursedTotalFiltered = filteredExpenses.reduce(
    (sum, expense) => sum + parseReimbursedAmount(expense.reimbursed_amount),
    0
  )
  const outstandingTotalFiltered = filteredExpenses.reduce((sum, expense) => {
    if ((expense.amount || 0) <= 0) return sum
    return sum + reimbursementOutstanding(expense.amount, expense.reimbursed_amount)
  }, 0)

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 필터 및 액션 바 - 모바일 컴팩트 */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* 검색 및 구글 드라이브 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowDriveImporter(!showDriveImporter)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 sm:gap-2 text-sm"
          >
            <Folder className="w-4 h-4" />
            <span className="hidden sm:inline">{t('googleDriveReceipts')}</span>
            <span className="sm:hidden">{t('receiptShort')}</span>
          </button>
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('statusLabel')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('filterAll')}</option>
              <option value="pending">{t('filterPending')}</option>
              <option value="approved">{t('filterApproved')}</option>
              <option value="rejected">{t('filterRejected')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('startDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('endDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('tourId')}</label>
            <input
              type="text"
              placeholder={t('tourIdPlaceholder')}
              value={tourIdFilter}
              onChange={(e) => setTourIdFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="max-w-md">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">{t('reimbursementFilterLabel')}</label>
          <select
            value={reimbursementFilter}
            onChange={(e) =>
              setReimbursementFilter(e.target.value as 'all' | 'employee_card' | 'outstanding')
            }
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">{t('reimbursementFilterAll')}</option>
            <option value="employee_card">{t('reimbursementFilterEmployeeCard')}</option>
            <option value="outstanding">{t('reimbursementFilterOutstanding')}</option>
          </select>
        </div>

        {/* 통계 - 모바일 컴팩트 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t">
          <div className="bg-white rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('totalExpenseSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('pendingSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">{formatCurrency(pendingAmount)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-600">{t('approvedSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(approvedAmount)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-100">
            <div className="text-xs sm:text-sm text-gray-600">{t('reimbursedTotalLabel')}</div>
            <div className="text-base sm:text-2xl font-bold text-slate-800 truncate">
              {formatCurrency(reimbursedTotalFiltered)}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 sm:p-3 border border-amber-100 col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="text-xs sm:text-sm text-gray-600">{t('outstandingTotalLabel')}</div>
            <div className="text-base sm:text-2xl font-bold text-amber-800 truncate">
              {formatCurrency(outstandingTotalFiltered)}
            </div>
          </div>
        </div>
      </div>

      {/* 구글 드라이브 연동 */}
      {showDriveImporter && (
        <div className="mb-4">
          <GoogleDriveReceiptImporter
            onImportComplete={() => {
              setShowDriveImporter(false)
              loadExpenses()
            }}
          />
        </div>
      )}

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2 text-sm">{t('loading')}</p>
        </div>
      ) : sortedFilteredExpenses.length > 0 ? (
        <>
          {/* 모바일: 카드 리스트 - 라벨/값 구조 */}
          <div className="md:hidden space-y-3">
            {sortedFilteredExpenses.map((expense) => (
              <div key={expense.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50/80 active:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-1 min-w-0 flex-1">
                    <ExpenseStatementReconIcon
                      matched={reconciledTourExpenseIds.has(expense.id)}
                      titleMatched={tStmt('matchedTitle')}
                      titleUnmatched={tStmt('unmatchedTitle')}
                      onClick={() => openTourStmtRecon(expense)}
                    />
                    <p className="font-semibold text-gray-900 text-sm truncate flex-1">{expense.paid_for}</p>
                  </div>
                  <p className="text-lg font-bold text-green-600 whitespace-nowrap">{formatCurrency(expense.amount)}</p>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                  <span className="text-gray-400">투어일</span>
                  <span>{expense.tour_date}</span>
                  <span className="text-gray-400">상품</span>
                  <span className="truncate">{expense.products?.name_ko || expense.products?.name || '-'}</span>
                  <span className="text-gray-400">결제처</span>
                  <span className="truncate">{expense.paid_to}</span>
                  <span className="text-gray-400">상태</span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </span>
                  {expense.amount > 0 && (
                    <>
                      <span className="text-gray-400">{t('reimbursedShort')}</span>
                      <span>{formatCurrency(parseReimbursedAmount(expense.reimbursed_amount))}</span>
                      <span className="text-gray-400">{t('outstandingShort')}</span>
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
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  {expense.amount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReimburseModal(expense)
                        setReimburseForm({
                          reimbursed_amount: String(parseReimbursedAmount(expense.reimbursed_amount)),
                          reimbursed_on: expense.reimbursed_on ? expense.reimbursed_on.slice(0, 10) : '',
                          reimbursement_note: expense.reimbursement_note || ''
                        })
                      }}
                      className="inline-flex items-center gap-1 text-amber-800 text-xs font-medium py-2 px-3 rounded-lg hover:bg-amber-50 min-h-[44px] border border-amber-200"
                    >
                      <Wallet className="w-4 h-4" />
                      {t('editReimbursement')}
                    </button>
                  )}
                  {expense.image_url && expense.image_url.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setViewingReceipt({ imageUrl: expense.image_url!, expenseId: expense.id, paidFor: expense.paid_for })}
                      className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-blue-50 min-h-[44px]"
                    >
                      <Receipt className="w-4 h-4" />
                      영수증
                    </button>
                  )}
                  <a href={`/${locale}/admin/tours/${expense.tour_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-600 text-xs font-medium py-2 px-3 rounded-lg hover:bg-gray-100 min-h-[44px]">
                    <Eye className="w-4 h-4" />
                    투어
                  </a>
                </div>
              </div>
            ))}
          </div>
          {/* 데스크톱: 테이블 */}
          <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12"
                  title={tStmt('unmatchedTitle')}
                >
                  {tStmt('columnHeaderShort')}
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('date')}
                    active={tourTableSortKey === 'tour_date'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('tour_date')}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('tourProduct')}
                    active={tourTableSortKey === 'product'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('product')}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('paymentDetails')}
                    active={tourTableSortKey === 'paid_for'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('paid_for')}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('paidTo')}
                    active={tourTableSortKey === 'paid_to'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('paid_to')}
                  />
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                  <div className="flex justify-end">
                    <TableSortHeaderButton
                      label={t('amount')}
                      active={tourTableSortKey === 'amount'}
                      dir={tourTableSortDir}
                      onClick={() => handleTourTableSort('amount')}
                      className="text-right"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                  <div className="flex justify-end">
                    <TableSortHeaderButton
                      label={t('reimbursedShort')}
                      active={tourTableSortKey === 'reimbursed'}
                      dir={tourTableSortDir}
                      onClick={() => handleTourTableSort('reimbursed')}
                      className="text-right"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider align-bottom">
                  <div className="flex justify-end">
                    <TableSortHeaderButton
                      label={t('outstandingShort')}
                      active={tourTableSortKey === 'outstanding'}
                      dir={tourTableSortDir}
                      onClick={() => handleTourTableSort('outstanding')}
                      className="text-right"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('submitter')}
                    active={tourTableSortKey === 'submitter'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('submitter')}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider align-bottom">
                  <TableSortHeaderButton
                    label={t('statusLabel')}
                    active={tourTableSortKey === 'status'}
                    dir={tourTableSortDir}
                    onClick={() => handleTourTableSort('status')}
                  />
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('receipt')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedFilteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center align-middle">
                    <ExpenseStatementReconIcon
                      matched={reconciledTourExpenseIds.has(expense.id)}
                      titleMatched={tStmt('matchedTitle')}
                      titleUnmatched={tStmt('unmatchedTitle')}
                      onClick={() => openTourStmtRecon(expense)}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {expense.tour_date}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm">
                      {expense.products?.name_ko || expense.products?.name || expense.products?.name_en || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{expense.paid_for}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{expense.paid_to}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
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
                        onClick={() => setViewingReceipt({ 
                          imageUrl: expense.image_url!, 
                          expenseId: expense.id,
                          paidFor: expense.paid_for 
                        })}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Receipt className="w-4 h-4" />
                        보기
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{t('none')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      {expense.amount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setReimburseModal(expense)
                            setReimburseForm({
                              reimbursed_amount: String(parseReimbursedAmount(expense.reimbursed_amount)),
                              reimbursed_on: expense.reimbursed_on ? expense.reimbursed_on.slice(0, 10) : '',
                              reimbursement_note: expense.reimbursement_note || ''
                            })
                          }}
                          className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded"
                          title={t('editReimbursement')}
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                      )}
                      <a
                        href={`/${locale}/admin/tours/${expense.tour_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-600 hover:text-blue-600"
                        title={t('tourDetail')}
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
          <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-gray-300" />
          <p>조건에 맞는 지출이 없습니다.</p>
        </div>
      )}

      {reimburseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('editReimbursement')}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{reimburseModal.paid_for}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('amount')}: {formatCurrency(reimburseModal.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReimburseModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursedAmount')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reimburseForm.reimbursed_amount}
                  onChange={(e) => setReimburseForm((prev) => ({ ...prev, reimbursed_amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursedOn')}</label>
                <input
                  type="date"
                  value={reimburseForm.reimbursed_on}
                  onChange={(e) => setReimburseForm((prev) => ({ ...prev, reimbursed_on: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('reimbursementNote')}</label>
                <input
                  type="text"
                  value={reimburseForm.reimbursement_note}
                  onChange={(e) => setReimburseForm((prev) => ({ ...prev, reimbursement_note: e.target.value }))}
                  placeholder={t('reimbursementNotePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setReimburseModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={reimburseSaving}
                onClick={() => void persistReimbursement()}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {reimburseSaving ? '…' : t('saveReimbursement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 영수증 보기 모달 */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('receiptLabel')}: {viewingReceipt.paidFor}
                </h3>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="flex flex-col items-center">
                <img
                  src={viewingReceipt.imageUrl}
                  alt={`${t('receiptLabel')} ${viewingReceipt.paidFor}`}
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-receipt.png'
                    target.alt = t('receiptImageError')
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
                    {t('openInNewWindow')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

