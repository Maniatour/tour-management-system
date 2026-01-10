'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Trash2, ArrowDownCircle, ArrowUpCircle, DollarSign, TrendingUp, TrendingDown, History, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface CashTransaction {
  id: string
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal'
  amount: number
  description: string | null
  category: string | null
  reference_type: string | null
  reference_id: string | null
  created_by: string
  notes: string | null
  created_at: string
  updated_at: string
  source?: 'cash_transactions' | 'payment_records' | 'company_expenses' // 데이터 출처
  created_by_name?: string // team 테이블에서 가져온 name_ko
}

interface TransactionHistory {
  id: string
  transaction_id: string
  source_table: string
  modified_by: string
  modified_at: string
  change_type: 'created' | 'updated' | 'deleted'
  old_values: any
  new_values: any
  modified_by_name?: string
}

interface CashTransactionFormData {
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal' | 'bank_deposit'
  amount: string
  description: string
  category: string
  notes: string
}

const categories = [
  '투어 수입',
  '예약 수입',
  '기타 수입',
  '투어 지출',
  '회사 지출',
  '예약 지출',
  '기타 지출'
]

export default function CashManagement() {
  const t = useTranslations('cashManagement')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch (error) {
    console.warn('로케일을 가져올 수 없습니다. 기본값(ko)을 사용합니다.', error)
  }
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'bank_deposit'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [teamMembers, setTeamMembers] = useState<Map<string, string>>(new Map()) // email -> name_ko
  const [showHistory, setShowHistory] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([])
  const [showPaymentRecordModal, setShowPaymentRecordModal] = useState(false)
  const [showCompanyExpenseModal, setShowCompanyExpenseModal] = useState(false)
  const [editingPaymentRecord, setEditingPaymentRecord] = useState<any>(null)
  const [editingCompanyExpense, setEditingCompanyExpense] = useState<any>(null)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  const [formData, setFormData] = useState<CashTransactionFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'deposit',
    amount: '',
    description: '',
    category: '',
    notes: ''
  })

  // team 멤버 로드
  const loadTeamMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')
      
      if (error) throw error
      
      const memberMap = new Map<string, string>()
      if (data) {
        data.forEach(member => {
          memberMap.set(member.email, member.name_ko)
        })
      }
      setTeamMembers(memberMap)
    } catch (error) {
      console.error('팀 멤버 로드 오류:', error)
    }
  }, [])

  // 수정 히스토리 로드
  const loadTransactionHistory = useCallback(async (transactionId: string, sourceTable: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_transaction_history')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('source_table', sourceTable)
        .order('modified_at', { ascending: false })
      
      if (error) throw error
      
      // team 멤버 이름 매핑
      const historyWithNames = (data || []).map(history => ({
        ...history,
        modified_by_name: teamMembers.get(history.modified_by) || history.modified_by
      }))
      
      setTransactionHistory(historyWithNames)
    } catch (error) {
      console.error('수정 히스토리 로드 오류:', error)
      toast.error('수정 히스토리를 불러오는 중 오류가 발생했습니다.')
    }
  }, [teamMembers, toast])

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      
      // 1. cash_transactions 테이블에서 데이터 가져오기
      let cashTransactionsQuery = supabase
        .from('cash_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (searchTerm) {
        cashTransactionsQuery = cashTransactionsQuery.or(`description.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
      }

      if (typeFilter !== 'all' && typeFilter !== 'bank_deposit') {
        // bank_deposit은 클라이언트 측에서 description으로 필터링
        cashTransactionsQuery = cashTransactionsQuery.eq('transaction_type', typeFilter)
      }

      if (categoryFilter !== 'all') {
        cashTransactionsQuery = cashTransactionsQuery.eq('category', categoryFilter)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        cashTransactionsQuery = cashTransactionsQuery.gte('transaction_date', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        cashTransactionsQuery = cashTransactionsQuery.lte('transaction_date', end.toISOString())
      }

      const { data: cashTransactions, error: cashError } = await cashTransactionsQuery
      if (cashError) throw cashError

      // 2. payment_records 테이블에서 PAYM032 (현금) 데이터 가져오기
      let paymentRecordsQuery = supabase
        .from('payment_records')
        .select('id, amount, submit_on, submit_by, note, reservation_id, payment_status')
        .eq('payment_method', 'PAYM032')
        .order('submit_on', { ascending: false })

      if (searchTerm) {
        paymentRecordsQuery = paymentRecordsQuery.or(`note.ilike.%${searchTerm}%`)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        paymentRecordsQuery = paymentRecordsQuery.gte('submit_on', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        paymentRecordsQuery = paymentRecordsQuery.lte('submit_on', end.toISOString())
      }

      const { data: paymentRecords, error: paymentError } = await paymentRecordsQuery
      if (paymentError) {
        console.warn('payment_records 로드 오류:', paymentError)
      }

      // 3. company_expenses 테이블에서 Cash (대소문자 구분 없이) 데이터 가져오기
      let companyExpensesQuery = supabase
        .from('company_expenses')
        .select('id, amount, submit_on, submit_by, description, notes, paid_for, paid_to')
        .ilike('payment_method', 'Cash')
        .order('submit_on', { ascending: false })

      if (searchTerm) {
        companyExpensesQuery = companyExpensesQuery.or(`description.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%,paid_for.ilike.%${searchTerm}%,paid_to.ilike.%${searchTerm}%`)
      }

      if (categoryFilter !== 'all') {
        companyExpensesQuery = companyExpensesQuery.eq('paid_for', categoryFilter)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        companyExpensesQuery = companyExpensesQuery.gte('submit_on', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        companyExpensesQuery = companyExpensesQuery.lte('submit_on', end.toISOString())
      }

      const { data: companyExpenses, error: companyError } = await companyExpensesQuery
      if (companyError) {
        console.warn('company_expenses 로드 오류:', companyError)
      }

      // 4. 데이터 변환 및 통합
      const allTransactions: CashTransaction[] = []

      // cash_transactions 변환
      if (cashTransactions) {
        const converted = cashTransactions.map(t => ({
          ...t,
          source: 'cash_transactions' as const,
          created_by_name: teamMembers.get(t.created_by) || t.created_by
        }))
        allTransactions.push(...converted)
      }

      // payment_records 변환 (입금으로 처리)
      if (paymentRecords) {
        const converted = paymentRecords.map(pr => ({
          id: `pr_${pr.id}`,
          transaction_date: pr.submit_on || new Date().toISOString(),
          transaction_type: 'deposit' as const,
          amount: Number(pr.amount),
          description: pr.note || `예약 결제 (${pr.reservation_id})`,
          category: '예약 수입',
          reference_type: 'reservation',
          reference_id: pr.reservation_id,
          created_by: pr.submit_by || '',
          created_by_name: teamMembers.get(pr.submit_by || '') || pr.submit_by || '',
          notes: pr.note || null,
          created_at: pr.submit_on || new Date().toISOString(),
          updated_at: pr.submit_on || new Date().toISOString(),
          source: 'payment_records' as const
        }))
        allTransactions.push(...converted)
      }

      // company_expenses 변환 (출금으로 처리)
      if (companyExpenses) {
        const converted = companyExpenses.map(ce => ({
          id: `ce_${ce.id}`,
          transaction_date: ce.submit_on || new Date().toISOString(),
          transaction_type: 'withdrawal' as const,
          amount: Number(ce.amount),
          description: ce.description || `${ce.paid_to} - ${ce.paid_for}`,
          category: ce.paid_for || '회사 지출',
          reference_type: 'company_expense',
          reference_id: ce.id,
          created_by: ce.submit_by || '',
          created_by_name: teamMembers.get(ce.submit_by || '') || ce.submit_by || '',
          notes: ce.notes || null,
          created_at: ce.submit_on || new Date().toISOString(),
          updated_at: ce.submit_on || new Date().toISOString(),
          source: 'company_expenses' as const
        }))
        allTransactions.push(...converted)
      }

      // 날짜순 정렬
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.transaction_date).getTime()
        const dateB = new Date(b.transaction_date).getTime()
        if (dateA !== dateB) return dateB - dateA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // 타입 필터 적용
      let filtered = allTransactions
      if (typeFilter !== 'all') {
        if (typeFilter === 'bank_deposit') {
          // 은행 Deposit 필터: description에 "은행 Deposit"이 포함된 거래만
          filtered = filtered.filter(t => 
            t.transaction_type === 'withdrawal' && 
            (t.description?.includes('은행 Deposit') || t.description === '은행 Deposit')
          )
        } else {
          filtered = filtered.filter(t => t.transaction_type === typeFilter)
        }
      }

      setTransactions(filtered)
      
      // 잔액 계산 (모든 거래 포함)
      const calculatedBalance = allTransactions.reduce((sum, transaction) => {
        if (transaction.transaction_type === 'deposit') {
          return sum + transaction.amount
        } else {
          return sum - transaction.amount
        }
      }, 0)
      
      setBalance(calculatedBalance)
    } catch (error) {
      console.error('현금 거래 내역 로드 오류:', error)
      toast.error('현금 거래 내역을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, typeFilter, categoryFilter, startDate, endDate, teamMembers])

  useEffect(() => {
    loadTeamMembers()
  }, [loadTeamMembers])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // 수정 히스토리 저장
  const saveHistory = async (
    transactionId: string,
    sourceTable: string,
    changeType: 'created' | 'updated' | 'deleted',
    oldValues: any,
    newValues: any
  ) => {
    try {
      await supabase
        .from('cash_transaction_history')
        .insert({
          transaction_id: transactionId,
          source_table: sourceTable,
          change_type: changeType,
          old_values: oldValues,
          new_values: newValues,
          modified_by: user?.email || '',
          modified_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('수정 히스토리 저장 오류:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('금액을 입력해주세요.')
      return
    }

    try {
      setSaving(true)

      if (editingTransaction) {
        // 기존 값 저장 (히스토리용)
        const oldValues = {
          transaction_date: editingTransaction.transaction_date,
          transaction_type: editingTransaction.transaction_type,
          amount: editingTransaction.amount,
          description: editingTransaction.description,
          category: editingTransaction.category,
          notes: editingTransaction.notes
        }

        // 새 값 (bank_deposit은 withdrawal로 변환)
        const dbTransactionType = formData.transaction_type === 'bank_deposit' ? 'withdrawal' : formData.transaction_type
        // 날짜 형식 변환: YYYY-MM-DD를 로컬 시간대의 00:00:00으로 설정 후 ISO 형식으로 변환
        // 시간대 문제를 방지하기 위해 로컬 시간대의 날짜를 그대로 유지
        const [year, month, day] = formData.transaction_date.split('-').map(Number)
        const transactionDate = new Date(year, month - 1, day, 0, 0, 0, 0) // 로컬 시간대의 00:00:00
        const newValues = {
          transaction_date: transactionDate.toISOString(),
          transaction_type: dbTransactionType,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          category: formData.category || null,
          notes: formData.notes || null
        }

        // 출처별로 수정
        if (editingTransaction.source === 'cash_transactions') {
          console.log('현금 거래 수정 시작:', { id: editingTransaction.id, newValues })
          const { data: updatedData, error } = await supabase
            .from('cash_transactions')
            .update({
              transaction_date: newValues.transaction_date,
              transaction_type: newValues.transaction_type,
              amount: newValues.amount,
              description: newValues.description,
              category: newValues.category,
              notes: newValues.notes,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingTransaction.id)
            .select()

          if (error) {
            console.error('현금 거래 수정 오류:', error)
            throw error
          }
          
          console.log('현금 거래 수정 완료:', updatedData)
          
          // 히스토리 저장
          await saveHistory(editingTransaction.id, 'cash_transactions', 'updated', oldValues, newValues)
        } else if (editingTransaction.source === 'payment_records') {
          const originalId = editingTransaction.id.replace('pr_', '')
          const { error } = await supabase
            .from('payment_records')
            .update({
              submit_on: newValues.transaction_date,
              amount: newValues.amount,
              note: newValues.description || newValues.notes || null
            })
            .eq('id', originalId)

          if (error) throw error
          
          // 히스토리 저장
          await saveHistory(originalId, 'payment_records', 'updated', oldValues, newValues)
        } else if (editingTransaction.source === 'company_expenses') {
          const originalId = editingTransaction.id.replace('ce_', '')
          const { error } = await supabase
            .from('company_expenses')
            .update({
              submit_on: newValues.transaction_date,
              amount: newValues.amount,
              description: newValues.description,
              notes: newValues.notes,
              paid_for: newValues.category
            })
            .eq('id', originalId)

          if (error) throw error
          
          // 히스토리 저장
          await saveHistory(originalId, 'company_expenses', 'updated', oldValues, newValues)
        }

        toast.success('현금 거래가 수정되었습니다.')
      } else {
        // 추가 (bank_deposit은 withdrawal로 변환)
        const dbTransactionType = formData.transaction_type === 'bank_deposit' ? 'withdrawal' : formData.transaction_type
        // 날짜 형식 변환: YYYY-MM-DD를 로컬 시간대의 00:00:00으로 설정 후 ISO 형식으로 변환
        // 시간대 문제를 방지하기 위해 로컬 시간대의 날짜를 그대로 유지
        const [year, month, day] = formData.transaction_date.split('-').map(Number)
        const transactionDate = new Date(year, month - 1, day, 0, 0, 0, 0) // 로컬 시간대의 00:00:00
        const newValues = {
          transaction_date: transactionDate.toISOString(),
          transaction_type: dbTransactionType,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          category: formData.category || null,
          notes: formData.notes || null
        }

        const { data, error } = await supabase
          .from('cash_transactions')
          .insert({
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            category: newValues.category,
            notes: newValues.notes,
            created_by: user?.email || ''
          })
          .select()
          .single()

        if (error) throw error

        // 히스토리 저장
        if (data) {
          await saveHistory(data.id, 'cash_transactions', 'created', null, newValues)
        }

        toast.success('현금 거래가 추가되었습니다.')
      }

      // 데이터 다시 로드 (DB 업데이트가 완료되도록 약간의 지연 후 로드)
      console.log('데이터 리로드 시작')
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadTransactions()
      console.log('데이터 리로드 완료')
      
      // 모달 닫기 및 상태 초기화 (데이터 로드 완료 후)
      setIsDialogOpen(false)
      setEditingTransaction(null)
      setFormData({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'deposit',
        amount: '',
        description: '',
        category: '',
        notes: ''
      })
    } catch (error) {
      console.error('현금 거래 저장 오류:', error)
      toast.error('현금 거래를 저장하는 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (transaction: CashTransaction) => {
    if (transaction.source === 'payment_records') {
      // payment_records 원본 데이터 가져오기
      const originalId = transaction.id.replace('pr_', '')
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .eq('id', originalId)
        .single()
      
      if (error) {
        toast.error('결제 기록을 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setEditingPaymentRecord(data)
      setShowPaymentRecordModal(true)
    } else if (transaction.source === 'company_expenses') {
      // company_expenses 원본 데이터 가져오기
      const originalId = transaction.id.replace('ce_', '')
      const { data, error } = await supabase
        .from('company_expenses')
        .select('*')
        .eq('id', originalId)
        .single()
      
      if (error) {
        toast.error('회사 지출을 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setEditingCompanyExpense(data)
      setShowCompanyExpenseModal(true)
    } else {
      // cash_transactions는 기존 모달 사용
      setEditingTransaction(transaction)
      // description이 "은행 Deposit"인 경우 bank_deposit으로 설정
      const isBankDeposit = transaction.description?.includes('은행 Deposit') || transaction.description === '은행 Deposit'
      setFormData({
        transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
        transaction_type: isBankDeposit ? 'bank_deposit' : transaction.transaction_type,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        category: transaction.category || '',
        notes: transaction.notes || ''
      })
      setIsDialogOpen(true)
    }
  }

  const handleDelete = async (id: string) => {
    const transaction = transactions.find(t => t.id === id)
    if (!transaction) return

    try {
      const oldValues = {
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        notes: transaction.notes
      }

      // 출처별로 삭제
      if (transaction.source === 'cash_transactions') {
        const { error } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('id', id)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(id, 'cash_transactions', 'deleted', oldValues, null)
      } else if (transaction.source === 'payment_records') {
        const originalId = id.replace('pr_', '')
        const { error } = await supabase
          .from('payment_records')
          .delete()
          .eq('id', originalId)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(originalId, 'payment_records', 'deleted', oldValues, null)
      } else if (transaction.source === 'company_expenses') {
        const originalId = id.replace('ce_', '')
        const { error } = await supabase
          .from('company_expenses')
          .delete()
          .eq('id', originalId)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(originalId, 'company_expenses', 'deleted', oldValues, null)
      }

      toast.success('현금 거래가 삭제되었습니다.')
      loadTransactions()
    } catch (error) {
      console.error('현금 거래 삭제 오류:', error)
      toast.error('현금 거래를 삭제하는 중 오류가 발생했습니다.')
    }
  }

  const handleViewHistory = async (transaction: CashTransaction) => {
    const originalId = transaction.id.replace(/^(pr_|ce_)/, '')
    const sourceTable = transaction.source || 'cash_transactions'
    setSelectedTransactionId(transaction.id)
    setShowHistory(true)
    await loadTransactionHistory(originalId, sourceTable)
  }

  const handleNewTransaction = () => {
    setEditingTransaction(null)
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'deposit',
      amount: '',
      description: '',
      category: '',
      notes: ''
    })
    setIsDialogOpen(true)
  }

  // 전체 통계
  const totalDeposits = transactions
    .filter(t => t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalWithdrawals = transactions
    .filter(t => t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)

  // 기간별 통계 계산
  const periodTransactions = transactions.filter(t => {
    if (!startDate && !endDate) return true
    const transactionDate = new Date(t.transaction_date)
    if (startDate && transactionDate < new Date(startDate)) return false
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (transactionDate > end) return false
    }
    return true
  })

  const periodDeposits = periodTransactions
    .filter(t => t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const periodWithdrawals = periodTransactions
    .filter(t => t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const periodBalance = periodDeposits - periodWithdrawals

  // 페이지네이션 계산
  const totalPages = Math.ceil(transactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = transactions.slice(startIndex, endIndex)

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeFilter, categoryFilter, startDate, endDate])

  return (
    <div className="space-y-6">
      {/* 기간 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>기간 필터</CardTitle>
          <CardDescription>조회할 기간을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="start_date">시작일</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">종료일</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 현금 잔액 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 잔액' : '현재 현금 잔액'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  ${(startDate || endDate ? periodBalance : balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 입금' : '총 입금'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  ${(startDate || endDate ? periodDeposits : totalDeposits).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 출금' : '총 출금'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-8 h-8 text-red-600" />
              <div>
                <div className="text-3xl font-bold text-red-600">
                  ${(startDate || endDate ? periodWithdrawals : totalWithdrawals).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>현금 거래 내역</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNewTransaction}>
                  <Plus className="w-4 h-4 mr-2" />
                  거래 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? '현금 거래 수정' : '현금 거래 추가'}
                  </DialogTitle>
                  <DialogDescription>
                    현금 입금 또는 출금 내역을 기록합니다.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transaction_date">거래일자 *</Label>
                      <Input
                        id="transaction_date"
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction_type">거래 유형 *</Label>
                      <Select
                        value={formData.transaction_type}
                        onValueChange={(value: 'deposit' | 'withdrawal' | 'bank_deposit') => {
                          // 은행 Deposit 선택 시 description에 "은행 Deposit"이 포함되도록 보장
                          let newDescription = formData.description
                          if (value === 'bank_deposit') {
                            // description에 "은행 Deposit"이 없으면 추가
                            if (!formData.description || !formData.description.includes('은행 Deposit')) {
                              newDescription = formData.description 
                                ? `은행 Deposit - ${formData.description}` 
                                : '은행 Deposit'
                            }
                          } else {
                            // 다른 유형 선택 시 description에서 "은행 Deposit - " 제거
                            if (formData.description && formData.description.startsWith('은행 Deposit - ')) {
                              newDescription = formData.description.replace('은행 Deposit - ', '')
                            } else if (formData.description === '은행 Deposit') {
                              newDescription = ''
                            }
                          }
                          setFormData({ 
                            ...formData, 
                            transaction_type: value,
                            description: newDescription
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">입금</SelectItem>
                          <SelectItem value="withdrawal">출금</SelectItem>
                          <SelectItem value="bank_deposit">은행 Deposit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">금액 *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="거래 설명을 입력하세요"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">카테고리</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">메모</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="추가 메모를 입력하세요"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false)
                        setEditingTransaction(null)
                      }}
                    >
                      취소
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? '저장 중...' : editingTransaction ? '수정' : '추가'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 필터 */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={(value: 'all' | 'deposit' | 'withdrawal' | 'bank_deposit') => setTypeFilter(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="거래 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="deposit">입금</SelectItem>
                  <SelectItem value="withdrawal">출금</SelectItem>
                  <SelectItem value="bank_deposit">은행 Deposit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 거래 내역 테이블 */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">거래 내역이 없습니다.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="py-2 w-48">날짜</TableHead>
                      <TableHead className="w-32 py-2">유형</TableHead>
                      <TableHead className="py-2">금액</TableHead>
                      <TableHead className="py-2">설명</TableHead>
                      <TableHead className="w-40 py-2">카테고리</TableHead>
                      <TableHead className="w-32 py-2">출처</TableHead>
                      <TableHead className="py-2">메모</TableHead>
                      <TableHead className="py-2">작성자</TableHead>
                      <TableHead className="text-right w-40 py-2">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((transaction) => {
                      const isEditable = transaction.source === 'cash_transactions'
                      const sourceLabel = 
                        transaction.source === 'payment_records' ? '예약 결제' :
                        transaction.source === 'company_expenses' ? '회사 지출' :
                        '현금 관리'
                      
                      return (
                        <TableRow key={transaction.id} className="h-10">
                          <TableCell className="py-1 w-48">
                            {(() => {
                              // ISO 형식의 날짜를 로컬 시간대로 변환하여 날짜만 표시
                              const date = new Date(transaction.transaction_date)
                              // 로컬 시간대의 날짜 부분만 추출
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              return `${year}. ${month}. ${day}.`
                            })()}
                          </TableCell>
                          <TableCell className="w-32 py-1">
                            {(() => {
                              const isBankDeposit = transaction.description?.includes('은행 Deposit') || transaction.description === '은행 Deposit'
                              const displayType = isBankDeposit ? '은행 Deposit' : (transaction.transaction_type === 'deposit' ? '입금' : '출금')
                              return (
                                <Badge
                                  variant={transaction.transaction_type === 'deposit' ? 'default' : 'destructive'}
                                  className="flex items-center gap-1 w-fit text-xs"
                                >
                                  {transaction.transaction_type === 'deposit' ? (
                                    <ArrowDownCircle className="w-3 h-3" />
                                  ) : (
                                    <ArrowUpCircle className="w-3 h-3" />
                                  )}
                                  {displayType}
                                </Badge>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="font-medium py-1 text-sm">
                            <span className={transaction.transaction_type === 'deposit' ? 'text-blue-600' : 'text-red-600'}>
                              {transaction.transaction_type === 'deposit' ? '+' : '-'}
                              ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="py-1 text-sm">
                            {transaction.source === 'payment_records' && transaction.reference_id ? (
                              <button
                                onClick={() => {
                                  setSelectedReservationId(transaction.reference_id)
                                  setShowReservationModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                title="예약 상세 보기"
                              >
                                {transaction.description || `예약 결제 (${transaction.reference_id})`}
                              </button>
                            ) : (
                              transaction.description || '-'
                            )}
                          </TableCell>
                          <TableCell className="w-40 py-1">
                            {transaction.category ? (
                              <Badge variant="outline" className="text-xs">{transaction.category}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="w-32 py-1">
                            <Badge variant="secondary" className="text-xs">
                              {sourceLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate py-1 text-sm">{transaction.notes || '-'}</TableCell>
                          <TableCell className="text-sm text-gray-500 py-1">
                            {transaction.created_by_name || transaction.created_by}
                          </TableCell>
                          <TableCell className="text-right w-40 py-1">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewHistory(transaction)}
                                title="수정 히스토리"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(transaction)}
                                title="수정"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" title="삭제">
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>거래 삭제 확인</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 거래를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(transaction.id)}>
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 페이지네이션 */}
            {transactions.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">페이지당 항목 수:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">
                    전체 {transactions.length}개 중 {startIndex + 1}-{Math.min(endIndex, transactions.length)}개 표시
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 수정 히스토리 다이얼로그 */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수정 히스토리</DialogTitle>
            <DialogDescription>
              거래의 수정 내역을 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">수정 히스토리가 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {transactionHistory.map((history, index) => (
                  <Card key={history.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            {history.change_type === 'created' ? '생성' : 
                             history.change_type === 'updated' ? '수정' : '삭제'}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {new Date(history.modified_at).toLocaleString('ko-KR')}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {history.modified_by_name || history.modified_by}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {history.change_type === 'updated' && history.old_values && history.new_values && (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="font-semibold text-red-600 mb-2">변경 전</div>
                              <div className="space-y-1">
                                <div>날짜: {new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                                <div>유형: {(() => {
                                  const isBankDeposit = history.old_values.description?.includes('은행 Deposit') || history.old_values.description === '은행 Deposit'
                                  return isBankDeposit ? '은행 Deposit' : (history.old_values.transaction_type === 'deposit' ? '입금' : '출금')
                                })()}</div>
                                <div>금액: ${Number(history.old_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                <div>설명: {history.old_values.description || '-'}</div>
                                <div>카테고리: {history.old_values.category || '-'}</div>
                                <div>메모: {history.old_values.notes || '-'}</div>
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-green-600 mb-2">변경 후</div>
                              <div className="space-y-1">
                                <div>날짜: {new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                                <div>유형: {(() => {
                                  const isBankDeposit = history.new_values.description?.includes('은행 Deposit') || history.new_values.description === '은행 Deposit'
                                  return isBankDeposit ? '은행 Deposit' : (history.new_values.transaction_type === 'deposit' ? '입금' : '출금')
                                })()}</div>
                                <div>금액: ${Number(history.new_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                <div>설명: {history.new_values.description || '-'}</div>
                                <div>카테고리: {history.new_values.category || '-'}</div>
                                <div>메모: {history.new_values.notes || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {history.change_type === 'created' && history.new_values && (
                        <div className="text-sm space-y-1">
                          <div>날짜: {new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                          <div>유형: {(() => {
                            const isBankDeposit = history.new_values.description?.includes('은행 Deposit') || history.new_values.description === '은행 Deposit'
                            return isBankDeposit ? '은행 Deposit' : (history.new_values.transaction_type === 'deposit' ? '입금' : '출금')
                          })()}</div>
                          <div>금액: ${Number(history.new_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div>설명: {history.new_values.description || '-'}</div>
                        </div>
                      )}
                      {history.change_type === 'deleted' && history.old_values && (
                        <div className="text-sm space-y-1 text-red-600">
                          <div>날짜: {new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                          <div>유형: {(() => {
                            const isBankDeposit = history.old_values.description?.includes('은행 Deposit') || history.old_values.description === '은행 Deposit'
                            return isBankDeposit ? '은행 Deposit' : (history.old_values.transaction_type === 'deposit' ? '입금' : '출금')
                          })()}</div>
                          <div>금액: ${Number(history.old_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div>설명: {history.old_values.description || '-'}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Record 수정 모달 */}
      <Dialog open={showPaymentRecordModal} onOpenChange={setShowPaymentRecordModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 결제 수정</DialogTitle>
            <DialogDescription>
              예약 결제 기록을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingPaymentRecord && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const oldValues = {
                  amount: editingPaymentRecord.amount,
                  payment_method: editingPaymentRecord.payment_method,
                  note: editingPaymentRecord.note,
                  submit_on: editingPaymentRecord.submit_on,
                  payment_status: editingPaymentRecord.payment_status
                }

                const { error } = await supabase
                  .from('payment_records')
                  .update({
                    amount: parseFloat(formData.get('amount') as string),
                    note: formData.get('note') as string || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    payment_status: formData.get('payment_status') as string || 'pending',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', editingPaymentRecord.id)

                if (error) throw error

                const newValues = {
                  amount: parseFloat(formData.get('amount') as string),
                  payment_method: editingPaymentRecord.payment_method,
                  note: formData.get('note') as string || null,
                  submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                  payment_status: formData.get('payment_status') as string || 'pending'
                }

                // 히스토리 저장
                await saveHistory(editingPaymentRecord.id, 'payment_records', 'updated', oldValues, newValues)

                toast.success('예약 결제가 수정되었습니다.')
                setShowPaymentRecordModal(false)
                setEditingPaymentRecord(null)
                loadTransactions()
              } catch (error) {
                console.error('예약 결제 수정 오류:', error)
                toast.error('예약 결제를 수정하는 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pr_amount">금액 *</Label>
                  <Input
                    id="pr_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingPaymentRecord.amount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr_submit_on">제출일시 *</Label>
                  <Input
                    id="pr_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(editingPaymentRecord.submit_on).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pr_payment_status">결제 상태</Label>
                <input
                  type="hidden"
                  name="payment_status"
                  id="pr_payment_status_hidden"
                  defaultValue={editingPaymentRecord.payment_status || 'pending'}
                />
                <Select
                  defaultValue={editingPaymentRecord.payment_status || 'pending'}
                  onValueChange={(value) => {
                    const hiddenInput = document.getElementById('pr_payment_status_hidden') as HTMLInputElement
                    if (hiddenInput) hiddenInput.value = value
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="confirmed">확인됨</SelectItem>
                    <SelectItem value="rejected">거부됨</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pr_note">메모</Label>
                <Textarea
                  id="pr_note"
                  name="note"
                  defaultValue={editingPaymentRecord.note || ''}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPaymentRecordModal(false)
                    setEditingPaymentRecord(null)
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Company Expense 수정 모달 */}
      <Dialog open={showCompanyExpenseModal} onOpenChange={setShowCompanyExpenseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>회사 지출 수정</DialogTitle>
            <DialogDescription>
              회사 지출 기록을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingCompanyExpense && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const oldValues = {
                  amount: editingCompanyExpense.amount,
                  paid_to: editingCompanyExpense.paid_to,
                  paid_for: editingCompanyExpense.paid_for,
                  description: editingCompanyExpense.description,
                  notes: editingCompanyExpense.notes,
                  submit_on: editingCompanyExpense.submit_on
                }

                const { error } = await supabase
                  .from('company_expenses')
                  .update({
                    amount: parseFloat(formData.get('amount') as string),
                    paid_to: formData.get('paid_to') as string,
                    paid_for: formData.get('paid_for') as string,
                    description: formData.get('description') as string || null,
                    notes: formData.get('notes') as string || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    updated_at: new Date().toISOString(),
                    updated_by: user?.email || null
                  })
                  .eq('id', editingCompanyExpense.id)

                if (error) throw error

                const newValues = {
                  amount: parseFloat(formData.get('amount') as string),
                  paid_to: formData.get('paid_to') as string,
                  paid_for: formData.get('paid_for') as string,
                  description: formData.get('description') as string || null,
                  notes: formData.get('notes') as string || null,
                  submit_on: new Date(formData.get('submit_on') as string).toISOString()
                }

                // 히스토리 저장
                await saveHistory(editingCompanyExpense.id, 'company_expenses', 'updated', oldValues, newValues)

                toast.success('회사 지출이 수정되었습니다.')
                setShowCompanyExpenseModal(false)
                setEditingCompanyExpense(null)
                loadTransactions()
              } catch (error) {
                console.error('회사 지출 수정 오류:', error)
                toast.error('회사 지출을 수정하는 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ce_amount">금액 *</Label>
                  <Input
                    id="ce_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingCompanyExpense.amount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce_submit_on">제출일시 *</Label>
                  <Input
                    id="ce_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(editingCompanyExpense.submit_on).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ce_paid_to">결제처 *</Label>
                  <Input
                    id="ce_paid_to"
                    name="paid_to"
                    defaultValue={editingCompanyExpense.paid_to}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce_paid_for">결제내용 *</Label>
                  <Input
                    id="ce_paid_for"
                    name="paid_for"
                    defaultValue={editingCompanyExpense.paid_for}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ce_description">상세 설명</Label>
                <Input
                  id="ce_description"
                  name="description"
                  defaultValue={editingCompanyExpense.description || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ce_notes">메모</Label>
                <Textarea
                  id="ce_notes"
                  name="notes"
                  defaultValue={editingCompanyExpense.notes || ''}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCompanyExpenseModal(false)
                    setEditingCompanyExpense(null)
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 예약 상세 모달 */}
      <Dialog open={showReservationModal} onOpenChange={setShowReservationModal}>
        <DialogContent className="max-w-[95vw] w-full p-0" style={{ height: '90vh', maxHeight: '90vh' }}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>예약 상세 정보</DialogTitle>
            <DialogDescription>
              예약 ID: {selectedReservationId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden" style={{ height: 'calc(90vh - 100px)' }}>
            {selectedReservationId && (
              <iframe
                src={`/${locale}/admin/reservations/${selectedReservationId}`}
                className="w-full h-full border-0"
                title="예약 상세 정보"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
