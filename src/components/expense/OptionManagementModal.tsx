import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface OptionManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onOptionsUpdated: () => void
}

interface OptionItem {
  id: string
  value: string
  label: string
  category: 'paid_to' | 'paid_for'
  isCustom: boolean
}

interface TourExpense {
  id: string
  tour_id: string | null
  paid_to: string | null
  paid_for: string | null
  amount: number | null
  submit_on: string | null
  submitted_by: string | null
  status: string | null
  tour_date?: string | null
  product_id?: string | null
}

const OptionManagementModal: React.FC<OptionManagementModalProps> = ({
  isOpen,
  onClose,
  onOptionsUpdated
}) => {
  const t = useTranslations('tours.tourExpense')
  const [activeTab, setActiveTab] = useState<'paid_to' | 'paid_for'>('paid_to')
  const [options, setOptions] = useState<OptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newValue, setNewValue] = useState('')
  const [selectedPaidTo, setSelectedPaidTo] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  // 탭별 라벨 매핑
  const tabLabels = {
    paid_to: '지급 대상',
    paid_for: '지급 목적'
  }

  // 옵션 로드
  const loadOptions = async () => {
    setLoading(true)
    try {
      const allOptions: OptionItem[] = []

      // paid_to 옵션들 (tour_expenses 테이블에서)
      const { data: paidToData, error: paidToError } = await supabase
        .from('tour_expenses')
        .select('paid_to')
        .not('paid_to', 'is', null)
        .neq('paid_to', '')

      if (!paidToError && paidToData) {
        const uniquePaidTo = Array.from(new Set(paidToData.map(item => item.paid_to)))
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) // 알파벳 순 정렬 (대소문자 구분 없음)
        
        uniquePaidTo.forEach(value => {
          allOptions.push({
            id: `paid_to_${value}`,
            value,
            label: value,
            category: 'paid_to',
            isCustom: true
          })
        })
      }

      // paid_for 옵션들 (expense_categories 테이블에서)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name')

      if (!categoriesError && categoriesData) {
        categoriesData.forEach(category => {
          allOptions.push({
            id: `paid_for_${category.id}`,
            value: category.name,
            label: category.name,
            category: 'paid_for',
            isCustom: false
          })
        })
      }

      setOptions(allOptions)
    } catch (error) {
      console.error('Error loading options:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadOptions()
    }
  }, [isOpen])

  // 현재 탭의 옵션들 필터링
  const currentOptions = options.filter(option => option.category === activeTab)

  // 지급 대상 클릭 시 해당 지출들 로드
  const loadExpensesForPaidTo = async (paidTo: string) => {
    setSelectedPaidTo(paidTo)
    setLoadingExpenses(true)
    
    try {
      const { data, error } = await supabase
        .from('tour_expenses')
        .select(`
          id,
          tour_id,
          paid_to,
          paid_for,
          amount,
          submit_on,
          submitted_by,
          status,
          tour_date,
          product_id
        `)
        .eq('paid_to', paidTo)
        .order('submit_on', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses for paid_to:', error)
      setExpenses([])
    } finally {
      setLoadingExpenses(false)
    }
  }

  // 지급 대상 선택 해제
  const clearSelectedPaidTo = () => {
    setSelectedPaidTo(null)
    setExpenses([])
  }

  // 편집 시작
  const startEdit = (option: OptionItem) => {
    setEditingId(option.id)
    setEditValue(option.value)
  }

  // 편집 저장
  const saveEdit = async () => {
    if (!editingId || !editValue.trim()) return

    try {
      const option = options.find(opt => opt.id === editingId)
      if (!option) return

      if (option.category === 'paid_for') {
        // expense_categories 테이블 업데이트
        const { error } = await supabase
          .from('expense_categories')
          .update({ name: editValue.trim() })
          .eq('id', option.id.replace('paid_for_', ''))

        if (error) throw error
      } else if (option.category === 'paid_to') {
        // 지급 대상 수정 시 기존 tour_expenses 레코드들도 함께 업데이트
        const oldValue = option.value
        const newValue = editValue.trim()
        
        if (oldValue !== newValue) {
          console.log(`지급 대상 수정: "${oldValue}" → "${newValue}"`)
          
          // tour_expenses 테이블의 해당 paid_to 값들을 모두 업데이트
          const { error: updateError } = await supabase
            .from('tour_expenses')
            .update({ paid_to: newValue })
            .eq('paid_to', oldValue)

          if (updateError) {
            console.error('기존 지출 기록 업데이트 오류:', updateError)
            throw updateError
          }
          
          console.log('기존 지출 기록 업데이트 완료')
        }
      }

      // 로컬 상태 업데이트
      setOptions(prev => prev.map(opt => 
        opt.id === editingId 
          ? { ...opt, value: editValue.trim(), label: editValue.trim() }
          : opt
      ))

      setEditingId(null)
      setEditValue('')
      
      // 성공 메시지 표시
      if (option.category === 'paid_to') {
        alert(`지급 대상이 "${editValue.trim()}"로 수정되었습니다.\n기존 모든 지출 기록도 함께 업데이트되었습니다.`)
      }
    } catch (error) {
      console.error('Error updating option:', error)
      alert('옵션 수정 중 오류가 발생했습니다.')
    }
  }

  // 새 옵션 추가
  const addNewOption = async () => {
    if (!newValue.trim()) return

    try {
      if (activeTab === 'paid_for') {
        // expense_categories 테이블에 추가
        const { data, error } = await supabase
          .from('expense_categories')
          .insert({ name: newValue.trim() })
          .select()
          .single()

        if (error) throw error

        setOptions(prev => [...prev, {
          id: `paid_for_${data.id}`,
          value: data.name,
          label: data.name,
          category: 'paid_for',
          isCustom: false
        }])
      } else {
        // 로컬 상태에만 추가 (지급 대상)
        const newOption: OptionItem = {
          id: `${activeTab}_${Date.now()}`,
          value: newValue.trim(),
          label: newValue.trim(),
          category: activeTab,
          isCustom: true
        }
        setOptions(prev => [...prev, newOption])
      }

      setNewValue('')
    } catch (error) {
      console.error('Error adding option:', error)
      alert('옵션 추가 중 오류가 발생했습니다.')
    }
  }

  // 옵션 삭제
  const deleteOption = async (option: OptionItem) => {
    if (option.category === 'paid_to') {
      // 지급 대상 삭제 시 관련 지출 기록 확인
      try {
        const { data: relatedExpenses, error: checkError } = await supabase
          .from('tour_expenses')
          .select('id, paid_for, amount, submit_on')
          .eq('paid_to', option.value)
          .limit(5) // 최대 5개만 확인

        if (checkError) {
          console.error('관련 지출 기록 확인 오류:', checkError)
        }

        if (relatedExpenses && relatedExpenses.length > 0) {
          const expenseCount = relatedExpenses.length
          const message = `"${option.label}" 지급 대상에는 ${expenseCount}건의 지출 기록이 있습니다.\n\n삭제하면 해당 지출 기록들의 지급 대상이 빈 값으로 변경됩니다.\n\n정말 삭제하시겠습니까?`
          
          if (!confirm(message)) return
        } else {
          if (!confirm(`"${option.label}" 옵션을 삭제하시겠습니까?`)) return
        }
      } catch (error) {
        console.error('관련 지출 기록 확인 중 오류:', error)
        if (!confirm(`"${option.label}" 옵션을 삭제하시겠습니까?`)) return
      }
    } else {
      if (!confirm(`"${option.label}" 옵션을 삭제하시겠습니까?`)) return
    }

    try {
      if (option.category === 'paid_for') {
        // expense_categories 테이블에서 삭제
        const { error } = await supabase
          .from('expense_categories')
          .delete()
          .eq('id', option.id.replace('paid_for_', ''))

        if (error) throw error
      } else if (option.category === 'paid_to') {
        // 지급 대상 삭제 시 관련 tour_expenses 레코드들의 paid_to를 null로 설정
        const { error: updateError } = await supabase
          .from('tour_expenses')
          .update({ paid_to: null })
          .eq('paid_to', option.value)

        if (updateError) {
          console.error('관련 지출 기록 업데이트 오류:', updateError)
          throw updateError
        }
        
        console.log('관련 지출 기록의 지급 대상이 null로 설정됨')
      }

      // 로컬 상태에서 삭제
      setOptions(prev => prev.filter(opt => opt.id !== option.id))
      
      // 성공 메시지 표시
      if (option.category === 'paid_to') {
        alert(`지급 대상 "${option.label}"이 삭제되었습니다.\n관련 지출 기록들의 지급 대상이 빈 값으로 변경되었습니다.`)
      }
    } catch (error) {
      console.error('Error deleting option:', error)
      alert('옵션 삭제 중 오류가 발생했습니다.')
    }
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">선택지 관리</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b">
          {Object.entries(tabLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'paid_to' | 'paid_for')}
              className={`px-6 py-3 font-medium ${
                activeTab === key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 컨텐츠 */}
        <div className="flex h-[60vh]">
          {/* 왼쪽: 옵션 목록 */}
          <div className="flex-1 p-6 overflow-y-auto border-r">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">로딩 중...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 새 옵션 추가 */}
                <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`새 ${tabLabels[activeTab]} 추가`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addNewOption()}
                  />
                  <button
                    onClick={addNewOption}
                    disabled={!newValue.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    <Plus size={16} />
                    <span>추가</span>
                  </button>
                </div>

                {/* 옵션 목록 */}
                <div className="space-y-2">
                  {currentOptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      등록된 {tabLabels[activeTab]}가 없습니다.
                    </div>
                  ) : (
                    currentOptions.map((option) => (
                      <div
                        key={option.id}
                        className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                          selectedPaidTo === option.value && activeTab === 'paid_to'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                        onClick={() => {
                          if (activeTab === 'paid_to') {
                            loadExpensesForPaidTo(option.value)
                          }
                        }}
                      >
                        <div className="flex-1">
                          {editingId === option.id ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{option.label}</span>
                              {option.isCustom && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  사용자 추가
                                </span>
                              )}
                              {activeTab === 'paid_to' && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  클릭하여 지출 내역 보기
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          {editingId === option.id ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="저장"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-800"
                                title="취소"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(option)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="편집"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteOption(option)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 지급 대상별 지출 내역 */}
          {activeTab === 'paid_to' && selectedPaidTo && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  "{selectedPaidTo}" 지출 내역
                </h3>
                <button
                  onClick={clearSelectedPaidTo}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              {loadingExpenses ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">지출 내역 로딩 중...</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  "{selectedPaidTo}"에 대한 지출 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 mb-4">
                    총 {expenses.length}건의 지출
                  </div>
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{expense.paid_for}</span>
                          <span className="text-lg font-bold text-green-600">
                            ${(expense.amount || 0).toFixed(2)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                            expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {expense.status === 'approved' ? '승인됨' :
                             expense.status === 'pending' ? '대기중' : '거부됨'}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>투어 ID: {expense.tour_id || 'N/A'}</div>
                        <div>제출자: {expense.submitted_by || 'N/A'}</div>
                        <div>제출일: {expense.submit_on ? new Date(expense.submit_on).toLocaleDateString('ko-KR') : 'N/A'}</div>
                        {expense.tour_date && (
                          <div>투어 날짜: {expense.tour_date}</div>
                        )}
                        {expense.product_id && (
                          <div>상품 ID: {expense.product_id}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 오른쪽 빈 공간 (다른 탭일 때) */}
          {activeTab !== 'paid_to' && (
            <div className="flex-1 p-6 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📋</div>
                <p>지급 대상 탭에서 항목을 클릭하면</p>
                <p>해당 지급 대상의 지출 내역을 확인할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onOptionsUpdated()
              onClose()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default OptionManagementModal
