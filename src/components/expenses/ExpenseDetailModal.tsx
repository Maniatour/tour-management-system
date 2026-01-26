'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Save, Edit2, Check, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ExpenseItem {
  id: string
  amount: number | null
  paid_for: string
  paid_to?: string
  description?: string
  submit_on?: string
  source_table: string
}

interface ExpenseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  category: string
  dateRange: { start: string; end: string }
  onUpdate?: () => void
}

export default function ExpenseDetailModal({ 
  isOpen, 
  onClose, 
  category, 
  dateRange,
  onUpdate 
}: ExpenseDetailModalProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [standardCategories, setStandardCategories] = useState<{ id: string; name: string; name_ko: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      loadExpenses()
      loadStandardCategories()
    }
  }, [isOpen, loadExpenses, loadStandardCategories])

  // 카테고리 정규화 함수 (대소문자, 띄어쓰기 무시)
  const normalizeCategory = useCallback((cat: string | null | undefined): string => {
    if (!cat) return '기타'
    return cat.toLowerCase().replace(/\s+/g, '').trim()
  }, [])

  const loadStandardCategories = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('expense_standard_categories')
        .select('id, name, name_ko')
        .eq('is_active', true)
        .order('display_order')
      
      setStandardCategories(data || [])
    } catch (error) {
      console.error('표준 카테고리 로드 오류:', error)
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    try {
      // 날짜 형식 검증 및 ISO 문자열 생성
      const startDate = new Date(dateRange.start + 'T00:00:00')
      const endDate = new Date(dateRange.end + 'T23:59:59.999')
      
      // 유효하지 않은 날짜인 경우 에러 처리
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('유효하지 않은 날짜 범위:', dateRange)
        setExpenses([])
        return
      }

      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      const allExpenses: ExpenseItem[] = []
      
      // 입력 카테고리 정규화
      const normalizedCategory = normalizeCategory(category)

      // 날짜 범위로만 필터링하고, 카테고리는 클라이언트에서 필터링
      const [tourExpensesResult, reservationExpensesResult, companyExpensesResult] = await Promise.all([
        supabase
          .from('tour_expenses')
          .select('id, amount, paid_for, paid_to, description, submit_on')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('reservation_expenses')
          .select('id, amount, paid_for, paid_to, description, submit_on')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO),
        supabase
          .from('company_expenses')
          .select('id, amount, category, paid_to, description, submit_on')
          .gte('submit_on', startISO)
          .lte('submit_on', endISO)
      ])

      // 에러 로깅 및 처리
      if (tourExpensesResult.error) {
        console.error('tour_expenses 조회 오류:', tourExpensesResult.error)
      }
      if (reservationExpensesResult.error) {
        console.error('reservation_expenses 조회 오류:', reservationExpensesResult.error)
      }
      if (companyExpensesResult.error) {
        console.error('company_expenses 조회 오류:', companyExpensesResult.error)
      }

      // 에러가 발생한 경우 빈 배열로 처리
      // tour_expenses 필터링 (대소문자, 띄어쓰기 무시)
      const tourExpenses = (tourExpensesResult.error ? [] : (tourExpensesResult.data || [])).filter(e => {
        const paidFor = normalizeCategory(e.paid_for)
        return paidFor === normalizedCategory
      })

      tourExpenses.forEach(e => {
        allExpenses.push({ ...e, source_table: 'tour_expenses' })
      })

      // reservation_expenses 필터링 (대소문자, 띄어쓰기 무시)
      const reservationExpenses = (reservationExpensesResult.error ? [] : (reservationExpensesResult.data || [])).filter(e => {
        const paidFor = normalizeCategory(e.paid_for)
        return paidFor === normalizedCategory
      })

      reservationExpenses.forEach(e => {
        allExpenses.push({ ...e, source_table: 'reservation_expenses' })
      })

      // company_expenses 필터링 (대소문자, 띄어쓰기 무시)
      const companyExpenses = (companyExpensesResult.error ? [] : (companyExpensesResult.data || [])).filter(e => {
        const cat = normalizeCategory(e.category)
        return cat === normalizedCategory
      })

      companyExpenses.forEach(e => {
        allExpenses.push({ 
          id: e.id, 
          amount: e.amount, 
          paid_for: e.category || '기타', 
          paid_to: (e as any).paid_to,
          description: e.description,
          submit_on: e.submit_on,
          source_table: 'company_expenses' 
        })
      })

      setExpenses(allExpenses.sort((a, b) => 
        new Date(b.submit_on || 0).getTime() - new Date(a.submit_on || 0).getTime()
      ))
    } catch (error) {
      console.error('지출 내역 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange, category, normalizeCategory])

  const handleEdit = (expense: ExpenseItem) => {
    setEditingId(expense.id)
    setEditValue(expense.paid_for || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (expense: ExpenseItem) => {
    if (!editValue.trim()) {
      alert('카테고리를 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const fieldName = expense.source_table === 'company_expenses' ? 'category' : 'paid_for'
      
      const { error } = await supabase
        .from(expense.source_table)
        .update({ [fieldName]: editValue.trim() })
        .eq('id', expense.id)

      if (error) throw error

      // 로컬 상태 업데이트
      setExpenses(prev => prev.map(e => 
        e.id === expense.id ? { ...e, paid_for: editValue.trim() } : e
      ))
      
      setEditingId(null)
      setEditValue('')
      
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('저장 오류:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpdate = async (newCategory: string) => {
    if (!confirm(`선택된 모든 항목(${expenses.length}건)의 카테고리를 "${newCategory}"로 변경하시겠습니까?`)) {
      return
    }

    setSaving(true)
    try {
      // 각 테이블별로 그룹화하여 업데이트
      const tourIds = expenses.filter(e => e.source_table === 'tour_expenses').map(e => e.id)
      const reservationIds = expenses.filter(e => e.source_table === 'reservation_expenses').map(e => e.id)
      const companyIds = expenses.filter(e => e.source_table === 'company_expenses').map(e => e.id)

      const updates = []

      if (tourIds.length > 0) {
        updates.push(
          supabase
            .from('tour_expenses')
            .update({ paid_for: newCategory })
            .in('id', tourIds)
        )
      }

      if (reservationIds.length > 0) {
        updates.push(
          supabase
            .from('reservation_expenses')
            .update({ paid_for: newCategory })
            .in('id', reservationIds)
        )
      }

      if (companyIds.length > 0) {
        updates.push(
          supabase
            .from('company_expenses')
            .update({ category: newCategory })
            .in('id', companyIds)
        )
      }

      await Promise.all(updates)

      alert('일괄 업데이트가 완료되었습니다.')
      if (onUpdate) onUpdate()
      onClose()
    } catch (error) {
      console.error('일괄 업데이트 오류:', error)
      alert('일괄 업데이트 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ko-KR')
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'tour_expenses': return '투어'
      case 'reservation_expenses': return '예약'
      case 'company_expenses': return '회사'
      default: return source
    }
  }

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              "{category}" 지출 내역
            </h2>
            <p className="text-sm text-gray-600">
              {dateRange.start} ~ {dateRange.end} | {expenses.length}건 | 총 ${totalAmount.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* 일괄 변경 */}
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">일괄 카테고리 변경:</span>
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkUpdate(e.target.value)
                  e.target.value = ''
                }
              }}
              disabled={saving || expenses.length === 0}
            >
              <option value="">카테고리 선택...</option>
              {standardCategories.map(cat => (
                <option key={cat.id} value={cat.name_ko || cat.name}>
                  {cat.name_ko || cat.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              모든 항목({expenses.length}건)을 선택한 카테고리로 변경합니다
            </span>
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              해당 카테고리의 지출 내역이 없습니다.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소스</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지급처</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((expense) => (
                  <tr key={`${expense.source_table}-${expense.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(expense.submit_on)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        expense.source_table === 'tour_expenses' ? 'bg-blue-100 text-blue-700' :
                        expense.source_table === 'reservation_expenses' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {getSourceLabel(expense.source_table)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{expense.description || '-'}</td>
                    <td className="px-4 py-3">
                      {editingId === expense.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                          >
                            <option value="">직접 입력...</option>
                            {standardCategories.map(cat => (
                              <option key={cat.id} value={cat.name_ko || cat.name}>
                                {cat.name_ko || cat.name}
                              </option>
                            ))}
                          </select>
                          {editValue === '' && (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="px-2 py-1 border rounded text-sm w-24"
                              placeholder="입력..."
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-sm">{expense.paid_for || '기타'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {expense.paid_to || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      ${(expense.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === expense.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(expense)}
                            disabled={saving}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            총 {expenses.length}건 | ${totalAmount.toLocaleString()}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
