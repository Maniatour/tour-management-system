'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
import { Plus, Search, Edit, Trash2, ArrowDownCircle, ArrowUpCircle, DollarSign, TrendingUp, TrendingDown, CreditCard, Calendar, Upload, X, History, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface PartnerFundTransaction {
  id: string
  transaction_date: string
  partner: 'partner1' | 'partner2' | 'erica'
  transaction_type: 'deposit' | 'withdrawal'
  amount: number
  description: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface TransactionFormData {
  transaction_date: string
  partner: 'partner1' | 'partner2' | 'erica' | ''
  transaction_type: 'deposit' | 'withdrawal' | ''
  amount: string
  description: string
}

const PARTNER_NAMES = {
  partner1: 'Joey',
  partner2: 'Chad',
  erica: 'Erica'
}

export default function PartnerFundsManagement() {
  const { user } = useAuth()
  
  // 거래 관련 상태
  const [transactions, setTransactions] = useState<PartnerFundTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PartnerFundTransaction | null>(null)
  const [bulkTransactions, setBulkTransactions] = useState<TransactionFormData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [partnerFilter, setPartnerFilter] = useState<'all' | 'partner1' | 'partner2' | 'erica'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [transactionHistory, setTransactionHistory] = useState<any[]>([])
  
  // 폼 데이터
  const [transactionForm, setTransactionForm] = useState<TransactionFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    partner: '',
    transaction_type: '',
    amount: '',
    description: ''
  })
  

  // 밸런스 계산
  const calculateBalance = useCallback(() => {
    const partner1Deposits = transactions
      .filter(t => t.partner === 'partner1' && t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const partner1Withdrawals = transactions
      .filter(t => t.partner === 'partner1' && t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const partner2Deposits = transactions
      .filter(t => t.partner === 'partner2' && t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const partner2Withdrawals = transactions
      .filter(t => t.partner === 'partner2' && t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const ericaDeposits = transactions
      .filter(t => t.partner === 'erica' && t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const ericaWithdrawals = transactions
      .filter(t => t.partner === 'erica' && t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const partner1Net = partner1Deposits - partner1Withdrawals
    const partner2Net = partner2Deposits - partner2Withdrawals
    const ericaNet = ericaDeposits - ericaWithdrawals
    
    // 50:50 분배 기준으로 차이 계산 (Joey와 Chad만)
    const difference = partner1Net - partner2Net
    const partner1Owed = difference > 0 ? 0 : Math.abs(difference) / 2
    const partner2Owed = difference > 0 ? difference / 2 : 0
    
    return {
      partner1Net,
      partner2Net,
      ericaNet,
      difference,
      partner1Owed,
      partner2Owed
    }
  }, [transactions])

  // 대출 총액 계산 (Erica 파트너의 거래로 계산)
  const calculateLoanTotals = useCallback(() => {
    // Erica 입금 = Joey/Chad가 Erica로부터 대출 받은 금액
    // Erica 출금 = Joey/Chad가 Erica에게 상환한 금액
    // Erica 밸런스 = Erica 입금 - Erica 출금 (Erica가 받아야 할 대출 잔액)
    const ericaDeposits = transactions
      .filter(t => t.partner === 'erica' && t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const ericaWithdrawals = transactions
      .filter(t => t.partner === 'erica' && t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
    
    // Joey와 Chad가 Erica로부터 받은 대출 금액 계산
    // Erica 입금 = Joey/Chad가 대출 받은 금액
    // Erica 출금 = Joey/Chad가 상환한 금액
    const totalLoanReceived = ericaDeposits
    const totalLoanPaid = ericaWithdrawals
    const totalLoanBalance = totalLoanReceived - totalLoanPaid
    
    // Joey와 Chad 각각의 Erica 대출 계산 (설명에 파트너 정보가 있다면, 아니면 50:50 분배)
    // 일단 전체로만 계산
    return {
      partner1Total: 0, // Erica 파트너로 직접 관리하므로 0
      partner2Total: 0, // Erica 파트너로 직접 관리하므로 0
      total: totalLoanBalance
    }
  }, [transactions])

  // 거래 내역 로드
  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('partner_fund_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error('거래 내역 로드 오류:', error)
      toast.error('거래 내역을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // 벌크 거래 행 추가
  const handleAddBulkRow = () => {
    setBulkTransactions([...bulkTransactions, {
      transaction_date: new Date().toISOString().split('T')[0],
      partner: '',
      transaction_type: '',
      amount: '',
      description: ''
    }])
  }

  // 벌크 거래 행 삭제
  const handleRemoveBulkRow = (index: number) => {
    setBulkTransactions(bulkTransactions.filter((_, i) => i !== index))
  }

  // 벌크 거래 행 업데이트
  const handleUpdateBulkRow = (index: number, field: keyof TransactionFormData, value: string) => {
    const updated = [...bulkTransactions]
    updated[index] = { ...updated[index], [field]: value }
    setBulkTransactions(updated)
  }

  // 벌크 거래 저장
  const handleSaveBulkTransactions = async () => {
    if (bulkTransactions.length === 0) {
      toast.error('추가할 거래가 없습니다.')
      return
    }

    // 유효성 검사
    const invalidRows = bulkTransactions.filter(
      (t, index) => !t.partner || !t.transaction_type || !t.amount || !t.transaction_date
    )

    if (invalidRows.length > 0) {
      toast.error(`${invalidRows.length}개의 거래에 필수 항목이 누락되었습니다.`)
      return
    }

    if (!user?.email) {
      toast.error('로그인이 필요합니다.')
      return
    }

    try {
      setSaving(true)
      
      // 모든 거래를 배열로 변환
      const transactionsToInsert = bulkTransactions.map(t => ({
        transaction_date: new Date(t.transaction_date + 'T00:00:00').toISOString(),
        partner: t.partner as 'partner1' | 'partner2' | 'erica',
        transaction_type: t.transaction_type as 'deposit' | 'withdrawal',
        amount: parseFloat(t.amount),
        description: t.description || '',
        notes: null,
        created_by: user.email,
        updated_by: user.email
      }))

      const { error } = await supabase
        .from('partner_fund_transactions')
        .insert(transactionsToInsert)
      
      if (error) throw error
      
      toast.success(`${bulkTransactions.length}개의 거래가 추가되었습니다.`)
      setIsBulkAddDialogOpen(false)
      setBulkTransactions([])
      loadTransactions()
    } catch (error: any) {
      console.error('벌크 거래 저장 오류:', error)
      toast.error('벌크 거래 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 거래 저장
  const handleSaveTransaction = async () => {
    if (!transactionForm.partner || !transactionForm.transaction_type || !transactionForm.amount) {
      toast.error('모든 필수 항목을 입력해주세요.')
      return
    }

    if (!user?.email) {
      toast.error('로그인이 필요합니다.')
      return
    }

    try {
      setSaving(true)
      // 날짜를 ISO 형식으로 변환 (시간은 00:00:00으로 설정)
      const transactionDate = transactionForm.transaction_date 
        ? new Date(transactionForm.transaction_date + 'T00:00:00').toISOString()
        : new Date().toISOString()
      
      const transactionData = {
        transaction_date: transactionDate,
        partner: transactionForm.partner as 'partner1' | 'partner2' | 'erica',
        transaction_type: transactionForm.transaction_type,
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description || '',
        notes: null,
        created_by: user.email,
        updated_by: user.email
      }

      if (editingTransaction) {
        const { error } = await supabase
          .from('partner_fund_transactions')
          .update({
            ...transactionData,
            updated_by: user.email
          })
          .eq('id', editingTransaction.id)
        
        if (error) throw error
        toast.success('거래 내역이 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('partner_fund_transactions')
          .insert(transactionData)
        
        if (error) throw error
        toast.success('거래 내역이 추가되었습니다.')
      }

      setIsTransactionDialogOpen(false)
      setEditingTransaction(null)
      setTransactionForm({
        transaction_date: new Date().toISOString().split('T')[0],
        partner: '',
        transaction_type: '',
        amount: '',
        description: ''
      })
      loadTransactions()
    } catch (error: any) {
      console.error('거래 저장 오류:', error)
      toast.error('거래 내역 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 거래 삭제
  const handleDeleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('partner_fund_transactions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      toast.success('거래 내역이 삭제되었습니다.')
      loadTransactions()
    } catch (error: any) {
      console.error('거래 삭제 오류:', error)
      toast.error('거래 내역 삭제 중 오류가 발생했습니다.')
    }
  }

  // 거래 편집 시작
  const handleEditTransaction = (transaction: PartnerFundTransaction) => {
    setEditingTransaction(transaction)
      setTransactionForm({
        transaction_date: transaction.transaction_date.split('T')[0],
        partner: transaction.partner,
        transaction_type: transaction.transaction_type,
        amount: transaction.amount.toString(),
        description: transaction.description || ''
      })
    setIsTransactionDialogOpen(true)
  }

  // 히스토리 로드
  const loadTransactionHistory = async (transactionId: string) => {
    try {
      const { data, error } = await supabase
        .from('partner_fund_transaction_history')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('changed_at', { ascending: false })
      
      if (error) throw error
      setTransactionHistory(data || [])
    } catch (error: any) {
      console.error('히스토리 로드 오류:', error)
      toast.error('히스토리를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 히스토리 다이얼로그 열기
  const handleOpenHistoryDialog = async (transactionId: string) => {
    setSelectedTransactionId(transactionId)
    await loadTransactionHistory(transactionId)
    setIsHistoryDialogOpen(true)
  }


  // 해당 날짜까지의 밸런스 계산 함수
  const calculateBalanceAtDate = useCallback((targetDate: string, partner: 'partner1' | 'partner2' | 'erica') => {
    const target = new Date(targetDate)
    const relevantTransactions = transactions.filter(t => {
      const tDate = new Date(t.transaction_date)
      return tDate <= target && t.partner === partner
    })
    
    const deposits = relevantTransactions
      .filter(t => t.transaction_type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const withdrawals = relevantTransactions
      .filter(t => t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0)
    
    return deposits - withdrawals
  }, [transactions])

  // 필터링된 거래 목록
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = !searchTerm || 
      t.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPartner = partnerFilter === 'all' || t.partner === partnerFilter
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter
    const matchesStartDate = !startDate || t.transaction_date >= startDate
    const matchesEndDate = !endDate || t.transaction_date <= endDate
    
    return matchesSearch && matchesPartner && matchesType && matchesStartDate && matchesEndDate
  })

  const balance = calculateBalance()
  const loanTotals = calculateLoanTotals()

  return (
    <div className="space-y-6">
      {/* 밸런스 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Joey 밸런스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${balance.partner1Net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">입금:</span>
                <span className="text-green-600 font-medium">
                  ${transactions.filter(t => t.partner === 'partner1' && t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">출금:</span>
                <span className="text-red-600 font-medium">
                  ${transactions.filter(t => t.partner === 'partner1' && t.transaction_type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            {balance.partner1Owed > 0 && (
              <p className="text-sm text-red-600 mt-2 font-medium">
                추가 입금 필요: ${balance.partner1Owed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Chad 밸런스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${balance.partner2Net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">입금:</span>
                <span className="text-green-600 font-medium">
                  ${transactions.filter(t => t.partner === 'partner2' && t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">출금:</span>
                <span className="text-red-600 font-medium">
                  ${transactions.filter(t => t.partner === 'partner2' && t.transaction_type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            {balance.partner2Owed > 0 && (
              <p className="text-sm text-red-600 mt-2 font-medium">
                추가 입금 필요: ${balance.partner2Owed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">차이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(balance.difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {balance.difference >= 0 ? 'Joey가 더 많이 입금' : 'Chad가 더 많이 입금'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Erica 밸런스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${balance.ericaNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">입금:</span>
                <span className="text-green-600 font-medium">
                  ${transactions.filter(t => t.partner === 'erica' && t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">출금:</span>
                <span className="text-red-600 font-medium">
                  ${transactions.filter(t => t.partner === 'erica' && t.transaction_type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              * 입금 = 대출 받은 금액, 출금 = 상환한 금액
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 입출금 기록 */}
      <div className="space-y-4">
          <Card className="border rounded-lg">
            <CardHeader className="p-3 sm:p-4 lg:p-6 pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">입출금 기록</CardTitle>
                  <CardDescription className="text-xs sm:text-sm hidden sm:block">파트너 간 자금 입출금 내역을 관리합니다.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Dialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setBulkTransactions([{
                            transaction_date: new Date().toISOString().split('T')[0],
                            partner: '',
                            transaction_type: '',
                            amount: '',
                            description: '',
                            notes: ''
                          }])
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        벌크 추가
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>벌크 거래 추가</DialogTitle>
                        <DialogDescription>여러 개의 거래를 한 번에 추가할 수 있습니다.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            총 {bulkTransactions.length}개의 거래
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddBulkRow}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              행 추가
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setBulkTransactions([])}
                              disabled={bulkTransactions.length === 0}
                            >
                              전체 삭제
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-32">날짜 *</TableHead>
                                  <TableHead className="w-32">파트너 *</TableHead>
                                  <TableHead className="w-32">유형 *</TableHead>
                                  <TableHead className="w-32">금액 *</TableHead>
                                  <TableHead>설명</TableHead>
                                  <TableHead className="w-16">작업</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {bulkTransactions.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                      거래를 추가하려면 "행 추가" 버튼을 클릭하세요.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  bulkTransactions.map((row, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        <Input
                                          type="date"
                                          value={row.transaction_date}
                                          onChange={(e) => handleUpdateBulkRow(index, 'transaction_date', e.target.value)}
                                          className="w-full"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant={row.partner === 'partner1' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`flex-1 text-xs px-2 ${row.partner === 'partner1' ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : ''}`}
                                            onClick={() => handleUpdateBulkRow(index, 'partner', 'partner1')}
                                          >
                                            Joey
                                          </Button>
                                          <Button
                                            type="button"
                                            variant={row.partner === 'partner2' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`flex-1 text-xs px-2 ${row.partner === 'partner2' ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' : ''}`}
                                            onClick={() => handleUpdateBulkRow(index, 'partner', 'partner2')}
                                          >
                                            Chad
                                          </Button>
                                          <Button
                                            type="button"
                                            variant={row.partner === 'erica' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`flex-1 text-xs px-2 ${row.partner === 'erica' ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' : ''}`}
                                            onClick={() => handleUpdateBulkRow(index, 'partner', 'erica')}
                                          >
                                            Erica
                                          </Button>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant={row.transaction_type === 'deposit' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`flex-1 text-xs px-2 ${row.transaction_type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                            onClick={() => handleUpdateBulkRow(index, 'transaction_type', 'deposit')}
                                          >
                                            입금
                                          </Button>
                                          <Button
                                            type="button"
                                            variant={row.transaction_type === 'withdrawal' ? 'default' : 'outline'}
                                            size="sm"
                                            className={`flex-1 text-xs px-2 ${row.transaction_type === 'withdrawal' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                            onClick={() => handleUpdateBulkRow(index, 'transaction_type', 'withdrawal')}
                                          >
                                            출금
                                          </Button>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={row.amount}
                                          onChange={(e) => handleUpdateBulkRow(index, 'amount', e.target.value)}
                                          placeholder="0.00"
                                          className="w-full"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={row.description}
                                          onChange={(e) => handleUpdateBulkRow(index, 'description', e.target.value)}
                                          placeholder="설명 (예: Erica 대출, Erica 대출 상환)"
                                          className="w-full"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveBulkRow(index)}
                                        >
                                          <X className="w-4 h-4 text-red-600" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => {
                            setIsBulkAddDialogOpen(false)
                            setBulkTransactions([])
                          }}>
                            취소
                          </Button>
                          <Button 
                            onClick={handleSaveBulkTransactions} 
                            disabled={saving || bulkTransactions.length === 0}
                          >
                            {saving ? '저장 중...' : `${bulkTransactions.length}개 저장`}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingTransaction(null)
                        setTransactionForm({
                          transaction_date: new Date().toISOString().split('T')[0],
                          partner: '',
                          transaction_type: '',
                          amount: '',
                          description: ''
                        })
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      거래 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingTransaction ? '거래 수정' : '거래 추가'}</DialogTitle>
                      <DialogDescription>파트너 간 자금 거래를 기록합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>거래일자 *</Label>
                          <Input
                            type="date"
                            value={transactionForm.transaction_date}
                            onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>금액 *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={transactionForm.amount}
                            onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                        <div>
                          <Label>파트너 *</Label>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant={transactionForm.partner === 'partner1' ? 'default' : 'outline'}
                              className={`flex-1 ${transactionForm.partner === 'partner1' ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' : ''}`}
                              onClick={() => setTransactionForm({ ...transactionForm, partner: 'partner1' })}
                            >
                              Joey
                            </Button>
                            <Button
                              type="button"
                              variant={transactionForm.partner === 'partner2' ? 'default' : 'outline'}
                              className={`flex-1 ${transactionForm.partner === 'partner2' ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' : ''}`}
                              onClick={() => setTransactionForm({ ...transactionForm, partner: 'partner2' })}
                            >
                              Chad
                            </Button>
                            <Button
                              type="button"
                              variant={transactionForm.partner === 'erica' ? 'default' : 'outline'}
                              className={`flex-1 ${transactionForm.partner === 'erica' ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' : ''}`}
                              onClick={() => setTransactionForm({ ...transactionForm, partner: 'erica' })}
                            >
                              Erica
                            </Button>
                          </div>
                        </div>
                      <div>
                        <Label>거래 유형 *</Label>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant={transactionForm.transaction_type === 'deposit' ? 'default' : 'outline'}
                            className={`flex-1 ${transactionForm.transaction_type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'deposit' })}
                          >
                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                            입금
                          </Button>
                          <Button
                            type="button"
                            variant={transactionForm.transaction_type === 'withdrawal' ? 'default' : 'outline'}
                            className={`flex-1 ${transactionForm.transaction_type === 'withdrawal' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                            onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'withdrawal' })}
                          >
                            <ArrowDownCircle className="w-4 h-4 mr-2" />
                            출금
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>설명</Label>
                        <Textarea
                          value={transactionForm.description}
                          onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                          placeholder="거래 설명을 입력하세요 (선택사항). 예: Erica 대출, Erica 대출 상환 등"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          * Erica 대출 관련 거래는 설명에 "Erica"를 포함해주세요
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={handleSaveTransaction} disabled={saving}>
                          {saving ? '저장 중...' : '저장'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {/* 필터 - 모바일 컴팩트 */}
              <div className="mb-3 sm:mb-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-0 sm:max-w-xs h-9 sm:h-10 text-sm"
                  />
                  <Select value={partnerFilter} onValueChange={(v) => setPartnerFilter(v as any)}>
                    <SelectTrigger className="w-full sm:w-32 h-9 sm:h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 파트너</SelectItem>
                      <SelectItem value="partner1">Joey</SelectItem>
                      <SelectItem value="partner2">Chad</SelectItem>
                      <SelectItem value="erica">Erica</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                    <SelectTrigger className="w-full sm:w-32 h-9 sm:h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 유형</SelectItem>
                      <SelectItem value="deposit">입금</SelectItem>
                      <SelectItem value="withdrawal">출금</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    placeholder="시작일"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-40 h-9 sm:h-10 text-sm"
                  />
                  <Input
                    type="date"
                    placeholder="종료일"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-40 h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* 거래 목록 */}
              {loading ? (
                <div className="text-center py-6 sm:py-8 text-sm text-gray-500">로딩 중...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">거래 내역이 없습니다.</div>
              ) : (
                <>
                  {/* 모바일: 카드 리스트 */}
                  <div className="md:hidden space-y-3">
                    {filteredTransactions.map((transaction) => {
                      const displayDate = transaction.transaction_date
                        ? new Date(transaction.transaction_date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        : '-'
                      const balanceAtDate = calculateBalanceAtDate(transaction.transaction_date, transaction.partner)
                      return (
                        <div
                          key={transaction.id}
                          className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50/80 active:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">{displayDate}</p>
                              <Badge variant="outline" className="text-xs mt-1">{PARTNER_NAMES[transaction.partner]}</Badge>
                            </div>
                            <div className="text-right">
                              {transaction.transaction_type === 'deposit' ? (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <ArrowUpCircle className="w-3 h-3 mr-1 inline" />
                                  입금
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  <ArrowDownCircle className="w-3 h-3 mr-1 inline" />
                                  출금
                                </Badge>
                              )}
                              <p className={`text-lg font-bold mt-1 ${transaction.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.transaction_type === 'deposit' ? '+' : '-'}
                                ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                            <span className="text-gray-400">설명</span>
                            <span className="truncate">{transaction.description || '-'}</span>
                            <span className="text-gray-400">밸런스</span>
                            <span className="font-medium text-gray-900">
                              ${balanceAtDate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 min-h-[44px]"
                              onClick={() => handleOpenHistoryDialog(transaction.id)}
                              title="수정 히스토리"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 min-h-[44px]"
                              onClick={() => handleEditTransaction(transaction)}
                              title="수정"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-red-600 min-h-[44px]" title="삭제">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>거래 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>이 거래 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTransaction(transaction.id)}>삭제</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* 데스크톱: 테이블 */}
                  <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-10">
                        <TableHead className="py-2">날짜</TableHead>
                        <TableHead className="py-2">파트너</TableHead>
                        <TableHead className="py-2">유형</TableHead>
                        <TableHead className="py-2">금액</TableHead>
                        <TableHead className="py-2">설명</TableHead>
                        <TableHead className="py-2">밸런스</TableHead>
                        <TableHead className="text-right py-2">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction) => {
                        // 날짜를 YYYY-MM-DD 형식으로 표시
                        const displayDate = transaction.transaction_date 
                          ? new Date(transaction.transaction_date).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })
                          : '-'
                        
                        return (
                        <TableRow key={transaction.id} className="h-10">
                          <TableCell className="py-1 text-sm">{displayDate}</TableCell>
                          <TableCell className="py-1">
                            <Badge variant="outline" className="text-xs">{PARTNER_NAMES[transaction.partner]}</Badge>
                          </TableCell>
                          <TableCell className="py-1">
                            {transaction.transaction_type === 'deposit' ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                                입금
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                                출금
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium py-1 text-sm">
                            ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="py-1 text-sm">{transaction.description || '-'}</TableCell>
                          <TableCell className="font-medium py-1 text-sm">
                            ${calculateBalanceAtDate(transaction.transaction_date, transaction.partner).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right py-1">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleOpenHistoryDialog(transaction.id)}
                                title="수정 히스토리"
                              >
                                <History className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>거래 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 거래 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteTransaction(transaction.id)}>
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

      {/* 수정 히스토리 다이얼로그 */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수정 히스토리</DialogTitle>
            <DialogDescription>거래 내역의 변경 이력을 확인할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                히스토리가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>변경일시</TableHead>
                      <TableHead>액션</TableHead>
                      <TableHead>변경자</TableHead>
                      <TableHead>변경 내용</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionHistory.map((history) => {
                      const actionLabels = {
                        created: '생성',
                        updated: '수정',
                        deleted: '삭제'
                      }
                      const actionColors = {
                        created: 'bg-green-100 text-green-800',
                        updated: 'bg-blue-100 text-blue-800',
                        deleted: 'bg-red-100 text-red-800'
                      }
                      
                      return (
                        <TableRow key={history.id}>
                          <TableCell>
                            {new Date(history.changed_at).toLocaleString('ko-KR')}
                          </TableCell>
                          <TableCell>
                            <Badge className={actionColors[history.action_type as keyof typeof actionColors]}>
                              {actionLabels[history.action_type as keyof typeof actionLabels]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {history.changed_by}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2 text-sm">
                              {history.action_type === 'created' && history.new_values && (
                                <div className="space-y-1">
                                  <div><span className="font-medium">날짜:</span> {history.new_values.transaction_date ? new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR') : '-'}</div>
                                  <div><span className="font-medium">파트너:</span> {PARTNER_NAMES[history.new_values.partner as 'partner1' | 'partner2' | 'erica']}</div>
                                  <div><span className="font-medium">유형:</span> {history.new_values.transaction_type === 'deposit' ? '입금' : '출금'}</div>
                                  <div><span className="font-medium">금액:</span> ${history.new_values.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  <div><span className="font-medium">설명:</span> {history.new_values.description || '-'}</div>
                                </div>
                              )}
                              {history.action_type === 'updated' && (
                                <div className="space-y-2">
                                  {history.old_values && history.new_values && (
                                    <>
                                      {history.old_values.transaction_date !== history.new_values.transaction_date && (
                                        <div>
                                          <span className="font-medium">날짜:</span>{' '}
                                          <span className="text-red-600 line-through">{history.old_values.transaction_date ? new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR') : '-'}</span>
                                          {' → '}
                                          <span className="text-green-600">{history.new_values.transaction_date ? new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR') : '-'}</span>
                                        </div>
                                      )}
                                      {history.old_values.partner !== history.new_values.partner && (
                                        <div>
                                          <span className="font-medium">파트너:</span>{' '}
                                          <span className="text-red-600 line-through">{PARTNER_NAMES[history.old_values.partner as 'partner1' | 'partner2' | 'erica']}</span>
                                          {' → '}
                                          <span className="text-green-600">{PARTNER_NAMES[history.new_values.partner as 'partner1' | 'partner2' | 'erica']}</span>
                                        </div>
                                      )}
                                      {history.old_values.transaction_type !== history.new_values.transaction_type && (
                                        <div>
                                          <span className="font-medium">유형:</span>{' '}
                                          <span className="text-red-600 line-through">{history.old_values.transaction_type === 'deposit' ? '입금' : '출금'}</span>
                                          {' → '}
                                          <span className="text-green-600">{history.new_values.transaction_type === 'deposit' ? '입금' : '출금'}</span>
                                        </div>
                                      )}
                                      {history.old_values.amount !== history.new_values.amount && (
                                        <div>
                                          <span className="font-medium">금액:</span>{' '}
                                          <span className="text-red-600 line-through">${history.old_values.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                          {' → '}
                                          <span className="text-green-600">${history.new_values.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      {history.old_values.description !== history.new_values.description && (
                                        <div>
                                          <span className="font-medium">설명:</span>{' '}
                                          <span className="text-red-600 line-through">{history.old_values.description || '-'}</span>
                                          {' → '}
                                          <span className="text-green-600">{history.new_values.description || '-'}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                              {history.action_type === 'deleted' && history.old_values && (
                                <div className="space-y-1 text-red-600">
                                  <div><span className="font-medium">날짜:</span> {history.old_values.transaction_date ? new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR') : '-'}</div>
                                  <div><span className="font-medium">파트너:</span> {PARTNER_NAMES[history.old_values.partner as 'partner1' | 'partner2' | 'erica']}</div>
                                  <div><span className="font-medium">유형:</span> {history.old_values.transaction_type === 'deposit' ? '입금' : '출금'}</div>
                                  <div><span className="font-medium">금액:</span> ${history.old_values.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                  <div><span className="font-medium">설명:</span> {history.old_values.description || '-'}</div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
