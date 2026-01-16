'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Settings, RefreshCw, Search, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface StandardCategory {
  id: string
  name: string
  name_ko: string | null
  description: string | null
  tax_deductible: boolean
  display_order: number
  is_active: boolean
  parent_id?: string | null
  irs_schedule_c_line?: string | null
  deduction_limit_percent?: number
}

interface CategoryMapping {
  id: string
  original_value: string
  standard_category_id: string | null
  sub_category_id?: string | null
  source_table: string
  match_count: number
}

interface UnmappedExpense {
  paid_for: string // 정규화된 대표 값
  original_values: string[] // 실제 DB에 있는 모든 원본 값들
  source_table: string
  count: number
  total_amount: number
}

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

interface NormalizeRowProps {
  item: { original: string, normalized: string, count: number }
  onUpdate: (newValue: string) => void
  saving: boolean
}

function NormalizeRow({ item, onUpdate, saving }: NormalizeRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.normalized)

  const handleSave = () => {
    onUpdate(editValue.trim())
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(item.normalized)
    setIsEditing(false)
  }

  const isNormalized = item.original !== item.normalized

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium">{item.original}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
            autoFocus
            placeholder="정규화된 값을 입력하세요"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isNormalized ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
              {item.normalized}
            </span>
            {isNormalized && (
              <span className="text-xs text-gray-400">(매핑됨)</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{item.count}건</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              저장
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            {isNormalized ? '수정' : '정규화'}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function CategoryManagerModal({ isOpen, onClose, onSave }: CategoryManagerModalProps) {
  const [standardCategories, setStandardCategories] = useState<StandardCategory[]>([])
  const [mappings, setMappings] = useState<CategoryMapping[]>([])
  const [unmappedExpenses, setUnmappedExpenses] = useState<UnmappedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'mappings' | 'categories' | 'normalize'>('mappings')
  const [normalizeTable, setNormalizeTable] = useState<'tour_expenses' | 'reservation_expenses' | 'company_expenses'>('tour_expenses')
  const [normalizeData, setNormalizeData] = useState<Array<{original: string, normalized: string, count: number}>>([])
  const [normalizeLoading, setNormalizeLoading] = useState(false)
  const [normalizationMappings, setNormalizationMappings] = useState<Map<string, string>>(new Map()) // original_value|source_table -> normalized_value
  const [companyExpenseField, setCompanyExpenseField] = useState<'category' | 'paid_for'>('paid_for') // company_expenses에서 사용할 필드
  const [searchTerm, setSearchTerm] = useState('')
  
  // 새 카테고리 추가
  const [newCategory, setNewCategory] = useState({ name: '', name_ko: '', description: '', parent_id: '' })
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [selectedMainCategories, setSelectedMainCategories] = useState<Map<number, string>>(new Map())
  const [selectedSubCategories, setSelectedSubCategories] = useState<Map<number, string>>(new Map())
  const [categorySelectModalOpen, setCategorySelectModalOpen] = useState<number | null>(null) // 현재 카테고리 선택 모달이 열린 행의 인덱스
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null) // 수정 중인 매핑 ID
  const [editMainCat, setEditMainCat] = useState<string>('')
  const [editSubCat, setEditSubCat] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  // 매핑 수정 모달이 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (editingMappingId) {
      const mapping = mappings.find(m => m.id === editingMappingId)
      if (mapping) {
        setEditMainCat(mapping.standard_category_id || '')
        setEditSubCat(mapping.sub_category_id || null)
      }
    } else {
      setEditMainCat('')
      setEditSubCat(null)
    }
  }, [editingMappingId, mappings])

  // 정규화 탭이 활성화되거나 테이블이 변경될 때 데이터 로드
  useEffect(() => {
    if (activeTab === 'normalize') {
      loadNormalizeData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, normalizeTable])

  const loadData = async () => {
    setLoading(true)
    try {
      // 표준 카테고리 로드 (테이블이 없을 수 있으므로 안전하게 처리)
      let categories: StandardCategory[] = []
      let mappingsData: CategoryMapping[] = []

      try {
        const { data, error } = await supabase
          .from('expense_standard_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order')
        
        if (!error) {
          categories = data || []
        }
      } catch (e) {
        console.warn('표준 카테고리 테이블이 없습니다. 마이그레이션을 실행하세요.')
      }
      
      setStandardCategories(categories)

      // 매핑 로드 (테이블이 없을 수 있으므로 안전하게 처리)
      try {
        const { data, error } = await supabase
          .from('expense_category_mappings')
          .select('*')
          .order('original_value')
        
        if (!error) {
          mappingsData = data || []
        }
      } catch (e) {
        console.warn('매핑 테이블이 없습니다. 마이그레이션을 실행하세요.')
      }
      
      setMappings(mappingsData)

      // 정규화 매핑 로드
      await loadNormalizationMappings()

      // 매핑되지 않은 지출 항목 조회
      await loadUnmappedExpenses(mappingsData)

    } catch (error) {
      console.error('데이터 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 정규화 매핑 로드
  const loadNormalizationMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_normalization_mappings')
        .select('original_value, normalized_value, source_table')

      if (error) {
        // 테이블이 없을 수 있으므로 에러는 무시
        console.warn('정규화 매핑 테이블이 없습니다. 마이그레이션을 실행하세요.')
        return
      }

      const mappingMap = new Map<string, string>()
      data?.forEach(m => {
        const key = `${m.original_value}|${m.source_table}`
        mappingMap.set(key, m.normalized_value)
      })

      setNormalizationMappings(mappingMap)
    } catch (e) {
      console.warn('정규화 매핑 로드 오류:', e)
    }
  }

  // 정규화된 값 가져오기 (매핑이 있으면 매핑된 값, 없으면 원본 값)
  const getNormalizedValue = (originalValue: string, sourceTable: string): string => {
    const key = `${originalValue}|${sourceTable}`
    return normalizationMappings.get(key) || originalValue
  }

  // 배치로 데이터 가져오기
  const fetchAllData = async (tableName: string, selectFields: string) => {
    const allData: any[] = []
    const batchSize = 1000
    let from = 0
    let hasMore = true
    let batchCount = 0

    console.log(`fetchAllData 시작: 테이블=${tableName}, 필드=${selectFields}`)

    while (hasMore) {
      batchCount++
      const { data, error } = await supabase
        .from(tableName)
        .select(selectFields)
        .range(from, from + batchSize - 1)

      if (error) {
        console.error(`${tableName} 조회 오류 (배치 ${batchCount}):`, error)
        break
      }

      if (data && data.length > 0) {
        allData.push(...data)
        console.log(`${tableName} 배치 ${batchCount}: ${data.length}개 로드, 누적 ${allData.length}개`)
        from += batchSize
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }

    console.log(`${tableName} 최종 로드: ${allData.length}개`)
    if (allData.length > 0) {
      console.log(`${tableName} 샘플 데이터:`, allData.slice(0, 5))
    }
    return allData
  }

  const loadUnmappedExpenses = async (currentMappings: CategoryMapping[]) => {
    try {
      // 매핑된 원본 값들을 Set으로 저장 (정규화하지 않고 원본 값 그대로)
      const mappedValues = new Set(
        currentMappings.map(m => `${m.original_value}|${m.source_table}`)
      )

      // 각 테이블에서 배치로 모든 데이터 가져오기
      const [tourExpenses, reservationExpenses, companyExpenses] = await Promise.all([
        fetchAllData('tour_expenses', 'paid_for, amount'),
        fetchAllData('reservation_expenses', 'paid_for, amount'),
        fetchAllData('company_expenses', 'category, amount')
      ])

      console.log(`데이터 로드 완료: tour_expenses=${tourExpenses.length}, reservation_expenses=${reservationExpenses.length}, company_expenses=${companyExpenses.length}`)

      // 각 유니크 값을 개별 항목으로 처리 (정규화하지 않음)
      const expenseMap = new Map<string, UnmappedExpense>()

      // tour_expenses 처리 - 각 유니크 값을 개별 항목으로
      tourExpenses.forEach((e: any) => {
        const originalValue = e.paid_for
        // null이나 빈 값은 제외
        if (!originalValue || originalValue.trim() === '') return
        
        const key = `${originalValue}|tour_expenses`
        
        // 매핑되지 않은 항목만 처리
        if (!mappedValues.has(key)) {
          const existing = expenseMap.get(key)
          if (existing) {
            existing.count++
            existing.total_amount += e.amount || 0
          } else {
            expenseMap.set(key, { 
              paid_for: originalValue,
              original_values: [originalValue], // 각 값을 개별적으로 처리
              source_table: 'tour_expenses', 
              count: 1, 
              total_amount: e.amount || 0 
            })
          }
        }
      })

      // reservation_expenses 처리
      reservationExpenses.forEach((e: any) => {
        const originalValue = e.paid_for
        if (!originalValue || originalValue.trim() === '') return
        
        const key = `${originalValue}|reservation_expenses`
        
        if (!mappedValues.has(key)) {
          const existing = expenseMap.get(key)
          if (existing) {
            existing.count++
            existing.total_amount += e.amount || 0
          } else {
            expenseMap.set(key, { 
              paid_for: originalValue,
              original_values: [originalValue],
              source_table: 'reservation_expenses', 
              count: 1, 
              total_amount: e.amount || 0 
            })
          }
        }
      })

      // company_expenses 처리
      companyExpenses.forEach((e: any) => {
        const originalValue = e.category
        if (!originalValue || originalValue.trim() === '') return
        
        const key = `${originalValue}|company_expenses`
        
        if (!mappedValues.has(key)) {
          const existing = expenseMap.get(key)
          if (existing) {
            existing.count++
            existing.total_amount += e.amount || 0
          } else {
            expenseMap.set(key, { 
              paid_for: originalValue,
              original_values: [originalValue],
              source_table: 'company_expenses', 
              count: 1, 
              total_amount: e.amount || 0 
            })
          }
        }
      })
      
      // 모든 유니크 값을 개별 항목으로 정렬
      const unmappedList = Array.from(expenseMap.values()).sort((a, b) => b.count - a.count)
      console.log(`매핑되지 않은 항목: ${unmappedList.length}개`)
      console.log('샘플 데이터:', unmappedList.slice(0, 10).map(e => e.paid_for))
      setUnmappedExpenses(unmappedList)
    } catch (error) {
      console.error('매핑되지 않은 지출 조회 오류:', error)
      alert('데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.')
    }
  }

  const handleMapCategory = async (originalValue: string, sourceTable: string, categoryId: string) => {
    if (standardCategories.length === 0) {
      alert('표준 카테고리 테이블이 없습니다. 마이그레이션을 먼저 실행하세요.')
      return
    }

    try {
      const { error } = await supabase
        .from('expense_category_mappings')
        .upsert({
          original_value: originalValue,
          source_table: sourceTable,
          standard_category_id: categoryId || null,
          match_count: 1,
          last_matched_at: new Date().toISOString()
        }, {
          onConflict: 'original_value,source_table'
        })

      if (error) throw error

      // 데이터 다시 로드
      await loadData()
    } catch (error) {
      console.error('매핑 저장 오류:', error)
      alert('매핑 저장 중 오류가 발생했습니다. 마이그레이션이 실행되었는지 확인하세요.')
    }
  }

  const handleUpdateMapping = async (mappingId: string, mainCategoryId: string, subCategoryId?: string | null) => {
    if (standardCategories.length === 0) {
      alert('표준 카테고리 테이블이 없습니다. 마이그레이션을 먼저 실행하세요.')
      return
    }

    try {
      const { error } = await supabase
        .from('expense_category_mappings')
        .update({
          standard_category_id: mainCategoryId || null,
          sub_category_id: subCategoryId === '__none__' ? null : (subCategoryId || null),
          updated_at: new Date().toISOString()
        })
        .eq('id', mappingId)

      if (error) throw error

      // 데이터 다시 로드
      await loadData()
      setEditingMappingId(null)
    } catch (error) {
      console.error('매핑 수정 오류:', error)
      alert('매핑 수정 중 오류가 발생했습니다.')
    }
  }

  // 일괄 매핑: 정규화된 그룹의 모든 원본 값들을 한 번에 매핑
  const handleBulkMapCategory = async (expense: UnmappedExpense, categoryId: string) => {
    if (standardCategories.length === 0) {
      alert('표준 카테고리 테이블이 없습니다. 마이그레이션을 먼저 실행하세요.')
      return
    }

    if (!categoryId) {
      alert('표준 카테고리를 선택하세요.')
      return
    }

    const categoryName = standardCategories.find(c => c.id === categoryId)?.name_ko || 
                        standardCategories.find(c => c.id === categoryId)?.name || 
                        categoryId

    if (!confirm(`"${expense.original_values.join(', ')}" (${expense.original_values.length}개 변형)의 모든 항목을 "${categoryName}"로 매핑하시겠습니까?`)) {
      return
    }

    setSaving(true)
    try {
      // 모든 원본 값들을 매핑
      const mappings = expense.original_values.map(originalValue => ({
        original_value: originalValue,
        source_table: expense.source_table,
        standard_category_id: categoryId,
        match_count: 1,
        last_matched_at: new Date().toISOString()
      }))

      // upsert를 병렬로 실행
      const promises = mappings.map(mapping =>
        supabase
          .from('expense_category_mappings')
          .upsert(mapping, {
            onConflict: 'original_value,source_table'
          })
      )

      const results = await Promise.all(promises)
      
      // 에러 체크
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        console.error('일부 매핑 저장 오류:', errors)
        alert(`${errors.length}개의 매핑 저장 중 오류가 발생했습니다.`)
      } else {
        alert(`${mappings.length}개의 매핑이 완료되었습니다.`)
      }

      // 데이터 다시 로드
      await loadData()
    } catch (error) {
      console.error('일괄 매핑 오류:', error)
      alert('일괄 매핑 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('이 매핑을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('expense_category_mappings')
        .delete()
        .eq('id', mappingId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('매핑 삭제 오류:', error)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      alert('카테고리 이름을 입력하세요.')
      return
    }

    try {
      const id = `CAT${Date.now()}`
      const { error } = await supabase
        .from('expense_standard_categories')
        .insert({
          id,
          name: newCategory.name,
          name_ko: newCategory.name_ko || null,
          description: newCategory.description || null,
          parent_id: newCategory.parent_id || null,
          display_order: standardCategories.length + 1
        })

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          alert('테이블이 없습니다. 마이그레이션을 먼저 실행하세요.')
          return
        }
        throw error
      }

      setNewCategory({ name: '', name_ko: '', description: '', parent_id: '' })
      setShowAddCategory(false)
      await loadData()
    } catch (error) {
      console.error('카테고리 추가 오류:', error)
      alert('카테고리 추가 중 오류가 발생했습니다.')
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'tour_expenses': return '투어 지출'
      case 'reservation_expenses': return '예약 지출'
      case 'company_expenses': return '회사 지출'
      case 'ticket_bookings': return '입장권'
      default: return source
    }
  }

  const loadNormalizeData = async (table?: 'tour_expenses' | 'reservation_expenses' | 'company_expenses') => {
    setNormalizeLoading(true)
    try {
      const targetTable = table || normalizeTable
      
      // 필드 선택
      let fieldName = 'paid_for'
      if (targetTable === 'company_expenses') {
        fieldName = companyExpenseField
      }

      console.log(`정규화 데이터 로드: 테이블=${targetTable}, 필드=${fieldName}`)

      // 배치로 모든 데이터 가져오기
      const data = await fetchAllData(targetTable, fieldName)
      
      console.log(`로드된 데이터 개수: ${data.length}`)

      // 원본 값들을 그룹화하고 카운트 (변환 없이 원본 그대로)
      const valueMap = new Map<string, number>()
      let nullCount = 0
      let emptyCount = 0
      let validCount = 0
      
      data?.forEach((item: any) => {
        const value = item[fieldName]
        
        if (value === null || value === undefined) {
          nullCount++
        } else if (typeof value === 'string' && value.trim() === '') {
          emptyCount++
        } else {
          validCount++
          const valueStr = String(value) // 숫자나 다른 타입도 문자열로 변환
          valueMap.set(valueStr, (valueMap.get(valueStr) || 0) + 1)
        }
      })

      console.log(`데이터 분석: 전체=${data.length}, null=${nullCount}, 빈값=${emptyCount}, 유효값=${validCount}, 유니크값=${valueMap.size}`)
      console.log('유니크 값 목록:', Array.from(valueMap.keys()).slice(0, 20))

      // 정규화 매핑 로드
      await loadNormalizationMappings()

      // 배열로 변환 및 정렬 (원본 값 그대로, 정규화된 값은 매핑에서 가져오기)
      const result = Array.from(valueMap.entries())
        .map(([original, count]) => ({
          original,
          normalized: getNormalizedValue(original, targetTable),
          count
        }))
        .sort((a, b) => b.count - a.count)
      
      console.log(`정규화 데이터 결과: ${result.length}개 항목`)
      console.log('샘플:', result.slice(0, 10).map(r => ({ original: r.original, normalized: r.normalized, count: r.count })))

      setNormalizeData(result)
    } catch (error) {
      console.error('정규화 데이터 로드 오류:', error)
      alert('정규화 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setNormalizeLoading(false)
    }
  }

  const handleNormalizeUpdate = async (originalValue: string, normalizedValue: string) => {
    if (!normalizedValue || normalizedValue.trim() === '') {
      alert('정규화된 값을 입력하세요.')
      return
    }

    if (originalValue === normalizedValue.trim()) {
      // 원본과 같으면 매핑 삭제
      try {
        const { error } = await supabase
          .from('expense_normalization_mappings')
          .delete()
          .eq('original_value', originalValue)
          .eq('source_table', normalizeTable)

        if (error) throw error
        await loadNormalizationMappings()
        await loadNormalizeData()
        return
      } catch (error) {
        console.error('정규화 매핑 삭제 오류:', error)
        alert('정규화 매핑 삭제 중 오류가 발생했습니다.')
        return
      }
    }

    if (!confirm(`"${originalValue}"를 정규화된 값 "${normalizedValue}"로 매핑하시겠습니까?\n\n이 매핑은 카테고리 매핑 시 사용됩니다.`)) {
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('expense_normalization_mappings')
        .upsert({
          original_value: originalValue,
          normalized_value: normalizedValue.trim(),
          source_table: normalizeTable
        }, {
          onConflict: 'original_value,source_table'
        })

      if (error) throw error

      alert('정규화 매핑이 저장되었습니다.')
      await loadNormalizationMappings()
      await loadNormalizeData()
    } catch (error) {
      console.error('정규화 매핑 저장 오류:', error)
      alert('정규화 매핑 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 메인 카테고리와 서브카테고리 분리
  const mainCategories = standardCategories.filter(c => !c.parent_id)
  const subCategoriesByParent = new Map<string, StandardCategory[]>()
  
  standardCategories.forEach(cat => {
    if (cat.parent_id) {
      const subs = subCategoriesByParent.get(cat.parent_id) || []
      subs.push(cat)
      subCategoriesByParent.set(cat.parent_id, subs)
    }
  })

  // 카테고리 선택 핸들러 (메인 + 서브카테고리)
  const handleCategorySelect = async (expense: UnmappedExpense, categoryId: string, subCategoryId?: string) => {
    if (standardCategories.length === 0) {
      alert('표준 카테고리 테이블이 없습니다. 마이그레이션을 먼저 실행하세요.')
      return
    }

    if (!categoryId) {
      alert('표준 카테고리를 선택하세요.')
      return
    }

    // "__none__"은 서브카테고리 없음을 의미
    const finalSubCategoryId = subCategoryId === '__none__' ? null : (subCategoryId || null)
    
    const mainCategory = standardCategories.find(c => c.id === categoryId)
    const subCategory = finalSubCategoryId ? standardCategories.find(c => c.id === finalSubCategoryId) : null
    
    const categoryName = subCategory 
      ? `${mainCategory?.name_ko || mainCategory?.name} > ${subCategory.name_ko || subCategory.name}`
      : (mainCategory?.name_ko || mainCategory?.name || categoryId)

    // 정규화된 값 표시
    const normalizedValue = getNormalizedValue(expense.paid_for, expense.source_table)
    const displayValue = normalizedValue !== expense.paid_for 
      ? `${expense.paid_for} (정규화: ${normalizedValue})`
      : expense.paid_for

    if (!confirm(`"${displayValue}"를 "${categoryName}"로 매핑하시겠습니까?`)) {
      return
    }

    setSaving(true)
    try {
      // 원본 값 그대로 매핑 (정규화된 값이 아닌 원본 값 사용)
      const mapping = {
        original_value: expense.paid_for, // 원본 값 그대로 저장
        source_table: expense.source_table,
        standard_category_id: categoryId, // 메인 카테고리
        sub_category_id: finalSubCategoryId, // 서브카테고리 (있는 경우)
        match_count: 1,
        last_matched_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('expense_category_mappings')
        .upsert(mapping, {
          onConflict: 'original_value,source_table'
        })

      if (error) throw error

      alert('매핑이 완료되었습니다.')
      await loadData()
    } catch (error) {
      console.error('매핑 저장 오류:', error)
      alert('매핑 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredUnmapped = unmappedExpenses.filter(e => {
    const searchLower = searchTerm.toLowerCase()
    return e.paid_for.toLowerCase().includes(searchLower) ||
           e.original_values.some(v => v.toLowerCase().includes(searchLower))
  })

  const filteredMappings = mappings.filter(m =>
    m.original_value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">카테고리 매니저</h2>
              <p className="text-sm text-gray-600">지출 카테고리를 세금 보고용 표준 카테고리로 매핑합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('mappings')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'mappings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              카테고리 매핑 ({unmappedExpenses.length} 미매핑)
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              표준 카테고리 관리
            </button>
            <button
              onClick={() => setActiveTab('normalize')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'normalize'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              값 정규화
            </button>
          </nav>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <RefreshCw size={16} />
              새로고침
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : standardCategories.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">마이그레이션 필요</h3>
              <p className="text-gray-600 mb-4">
                카테고리 매핑 기능을 사용하려면 먼저 데이터베이스 마이그레이션을 실행해야 합니다.
              </p>
              <div className="bg-gray-100 rounded-lg p-4 text-left max-w-lg mx-auto">
                <p className="text-sm text-gray-700 font-mono">
                  파일: supabase/migrations/20250116000001_create_expense_category_mappings.sql
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supabase 대시보드의 SQL Editor에서 위 파일의 내용을 실행하세요.
                </p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'mappings' && (
            <div className="space-y-6">
              {/* 미매핑 항목 */}
              {filteredUnmapped.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="text-orange-500" size={20} />
                    매핑되지 않은 항목 ({filteredUnmapped.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-orange-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">원본 값</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소스</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">건수</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">표준 카테고리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredUnmapped.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium">{item.paid_for}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{getSourceLabel(item.source_table)}</td>
                            <td className="px-4 py-3 text-sm">{item.count}건</td>
                            <td className="px-4 py-3 text-sm">${item.total_amount.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setCategorySelectModalOpen(idx)}
                                disabled={saving}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                              >
                                카테고리 선택
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 기존 매핑 */}
              {filteredMappings.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    매핑된 항목 ({filteredMappings.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">원본 값</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소스</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">표준 카테고리</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredMappings.map((mapping) => (
                          <tr key={mapping.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">{mapping.original_value}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{getSourceLabel(mapping.source_table)}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {(() => {
                                  const mainCat = mapping.standard_category_id 
                                    ? standardCategories.find(c => c.id === mapping.standard_category_id)
                                    : null
                                  const subCat = mapping.sub_category_id
                                    ? standardCategories.find(c => c.id === mapping.sub_category_id)
                                    : null
                                  return (
                                    <>
                                      <div className="text-sm">
                                        {mainCat ? (mainCat.name_ko || mainCat.name) : '미매핑'}
                                        {subCat && (
                                          <span className="text-gray-500 ml-1">
                                            &gt; {subCat.name_ko || subCat.name}
                                          </span>
                                        )}
                                      </div>
                                      {mainCat?.irs_schedule_c_line && (
                                        <div className="text-xs text-gray-400">
                                          {mainCat.irs_schedule_c_line}
                                          {mainCat.deduction_limit_percent !== undefined && mainCat.deduction_limit_percent < 100 && 
                                            ` (${mainCat.deduction_limit_percent}% 공제)`
                                          }
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingMappingId(mapping.id)}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                  title="수정"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMapping(mapping.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="삭제"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {filteredUnmapped.length === 0 && filteredMappings.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '모든 카테고리가 매핑되었습니다.'}
                </div>
              )}
              </div>
              )}
              
              {activeTab === 'categories' && (
            <div className="space-y-4">
              {/* 새 카테고리 추가 */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} />
                  새 카테고리 추가
                </button>
              </div>

              {showAddCategory && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium mb-3">새 표준 카테고리</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <input
                      type="text"
                      placeholder="영문 이름"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="한글 이름"
                      value={newCategory.name_ko}
                      onChange={(e) => setNewCategory({ ...newCategory, name_ko: e.target.value })}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="설명"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                      className="px-3 py-2 border rounded-lg col-span-2"
                    />
                    <select
                      className="px-3 py-2 border rounded-lg"
                      value={newCategory.parent_id}
                      onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}
                    >
                      <option value="">메인 카테고리 (서브카테고리가 아닌 경우)</option>
                      {mainCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name_ko || cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => {
                        setShowAddCategory(false)
                        setNewCategory({ name: '', name_ko: '', description: '', parent_id: '' })
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddCategory}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {/* 표준 카테고리 목록 (계층 구조) */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">영문</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">한글</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IRS Line</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">공제율</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">세금공제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mainCategories.map((cat) => {
                      const subCats = subCategoriesByParent.get(cat.id) || []
                      return (
                        <React.Fragment key={cat.id}>
                          {/* 메인 카테고리 */}
                          <tr className="hover:bg-gray-50 bg-blue-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">{cat.id}</td>
                            <td className="px-4 py-3 text-sm font-semibold">{cat.name}</td>
                            <td className="px-4 py-3 text-sm font-semibold">{cat.name_ko || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{cat.description || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{cat.irs_schedule_c_line || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {cat.deduction_limit_percent !== undefined ? `${cat.deduction_limit_percent}%` : '100%'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {cat.tax_deductible ? (
                                <span className="text-green-600">예</span>
                              ) : (
                                <span className="text-red-600">아니오</span>
                              )}
                            </td>
                          </tr>
                          {/* 서브카테고리들 */}
                          {subCats.map((subCat) => (
                            <tr key={subCat.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-400 pl-8">
                                <span className="text-xs">└</span> {subCat.id}
                              </td>
                              <td className="px-4 py-3 text-sm pl-8">{subCat.name}</td>
                              <td className="px-4 py-3 text-sm pl-8">{subCat.name_ko || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 pl-8">{subCat.description || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-400 pl-8">{subCat.irs_schedule_c_line || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-400 pl-8">
                                {subCat.deduction_limit_percent !== undefined ? `${subCat.deduction_limit_percent}%` : '100%'}
                              </td>
                              <td className="px-4 py-3 text-sm pl-8">
                                {subCat.tax_deductible ? (
                                  <span className="text-green-600">예</span>
                                ) : (
                                  <span className="text-red-600">아니오</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </div>
              )}
              
              {activeTab === 'normalize' && (
            <div className="space-y-4">
              {/* 테이블 선택 */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <label className="text-sm font-medium text-gray-700">지출 테이블:</label>
                <select
                  value={normalizeTable}
                  onChange={async (e) => {
                    const newTable = e.target.value as 'tour_expenses' | 'reservation_expenses' | 'company_expenses'
                    setNormalizeTable(newTable)
                    // 테이블 변경 시 즉시 로드
                    await loadNormalizeData(newTable)
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="tour_expenses">투어 지출 (tour_expenses)</option>
                  <option value="reservation_expenses">예약 지출 (reservation_expenses)</option>
                  <option value="company_expenses">회사 지출 (company_expenses)</option>
                </select>
                
                {/* company_expenses인 경우 필드 선택 */}
                {normalizeTable === 'company_expenses' && (
                  <>
                    <label className="text-sm font-medium text-gray-700">필드:</label>
                    <select
                      value={companyExpenseField}
                      onChange={async (e) => {
                        const newField = e.target.value as 'category' | 'paid_for'
                        setCompanyExpenseField(newField)
                        await loadNormalizeData()
                      }}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="paid_for">paid_for (결제내용)</option>
                      <option value="category">category (카테고리)</option>
                    </select>
                  </>
                )}
                
                <button
                  onClick={() => loadNormalizeData()}
                  disabled={normalizeLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  <RefreshCw size={16} className={normalizeLoading ? 'animate-spin' : ''} />
                  새로고침
                </button>
              </div>

              {/* 정규화 데이터 테이블 */}
              {normalizeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : normalizeData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  데이터가 없습니다.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">원본 값</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">정규화된 값</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">건수</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {normalizeData.map((item, idx) => (
                        <NormalizeRow
                          key={idx}
                          item={item}
                          onUpdate={(newValue) => handleNormalizeUpdate(item.original, newValue)}
                          saving={saving}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 카테고리 선택 모달 */}
      {categorySelectModalOpen !== null && (() => {
        const item = filteredUnmapped[categorySelectModalOpen]
        if (!item) return null
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              {/* 헤더 */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">카테고리 선택</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    원본 값: <span className="font-medium">{item.paid_for}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setCategorySelectModalOpen(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 카테고리 목록 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {mainCategories.map(mainCat => {
                    const subs = subCategoriesByParent.get(mainCat.id) || []
                    const isMainSelected = selectedMainCategories.get(categorySelectModalOpen) === mainCat.id
                    
                    return (
                      <div key={mainCat.id} className="mb-2">
                        {/* 메인 카테고리 */}
                        <button
                          type="button"
                          onClick={() => {
                            const newMainMap = new Map(selectedMainCategories)
                            const newSubMap = new Map(selectedSubCategories)
                            
                            if (isMainSelected) {
                              // 이미 선택된 경우 해제
                              newMainMap.delete(categorySelectModalOpen)
                              newSubMap.delete(categorySelectModalOpen)
                            } else {
                              // 선택
                              newMainMap.set(categorySelectModalOpen, mainCat.id)
                              // 서브카테고리가 없으면 바로 저장
                              if (subs.length === 0) {
                                handleCategorySelect(item, mainCat.id)
                                newMainMap.delete(categorySelectModalOpen)
                                setCategorySelectModalOpen(null)
                              } else {
                                newSubMap.delete(categorySelectModalOpen) // 서브카테고리 초기화
                              }
                            }
                            
                            setSelectedMainCategories(newMainMap)
                            setSelectedSubCategories(newSubMap)
                          }}
                          disabled={saving}
                          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                            isMainSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{mainCat.name_ko || mainCat.name}</span>
                              {mainCat.irs_schedule_c_line && (
                                <span className={`text-xs ${isMainSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {mainCat.irs_schedule_c_line}
                                </span>
                              )}
                            </div>
                            {mainCat.description && (
                              <p className={`text-xs mt-1 ${isMainSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                {mainCat.description}
                              </p>
                            )}
                          </div>
                        </button>
                        
                        {/* 서브카테고리들 */}
                        {isMainSelected && subs.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            {subs.map(subCat => {
                              const isSubSelected = selectedSubCategories.get(categorySelectModalOpen) === subCat.id
                              
                              return (
                                <button
                                  key={subCat.id}
                                  type="button"
                                  onClick={() => {
                                    const mainCatId = selectedMainCategories.get(categorySelectModalOpen)!
                                    // 서브카테고리 선택 및 바로 저장
                                    handleCategorySelect(item, mainCatId, subCat.id)
                                    const newMainMap = new Map(selectedMainCategories)
                                    const newSubMap = new Map(selectedSubCategories)
                                    newMainMap.delete(categorySelectModalOpen)
                                    newSubMap.delete(categorySelectModalOpen)
                                    setSelectedMainCategories(newMainMap)
                                    setSelectedSubCategories(newSubMap)
                                    setCategorySelectModalOpen(null)
                                  }}
                                  disabled={saving}
                                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                                    isSubSelected
                                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                  } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <div className="flex flex-col">
                                    <div>
                                      <span className="text-gray-400 mr-2">└</span>
                                      <span className="font-medium">{subCat.name_ko || subCat.name}</span>
                                    </div>
                                    {subCat.description && (
                                      <p className={`text-xs mt-0.5 ml-5 ${isSubSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {subCat.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                            
                            {/* 서브카테고리 없음 옵션 */}
                            <button
                              type="button"
                              onClick={() => {
                                const mainCatId = selectedMainCategories.get(categorySelectModalOpen)!
                                handleCategorySelect(item, mainCatId, '__none__')
                                
                                const newMainMap = new Map(selectedMainCategories)
                                const newSubMap = new Map(selectedSubCategories)
                                newMainMap.delete(categorySelectModalOpen)
                                newSubMap.delete(categorySelectModalOpen)
                                setSelectedMainCategories(newMainMap)
                                setSelectedSubCategories(newSubMap)
                                setCategorySelectModalOpen(null)
                              }}
                              disabled={saving}
                              className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                                selectedSubCategories.get(categorySelectModalOpen) === '__none__'
                                  ? 'bg-gray-400 text-white hover:bg-gray-500'
                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className="text-gray-400 mr-2">└</span>
                              서브카테고리 없음 (메인만 사용)
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 푸터 */}
              <div className="border-t p-4 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setCategorySelectModalOpen(null)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 매핑 수정 모달 */}
      {editingMappingId && (() => {
        const mapping = mappings.find(m => m.id === editingMappingId)
        if (!mapping) return null
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              {/* 헤더 */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">매핑 수정</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    원본 값: <span className="font-medium">{mapping.original_value}</span>
                    <span className="ml-3 text-gray-400">({getSourceLabel(mapping.source_table)})</span>
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setEditingMappingId(null)
                    setEditMainCat('')
                    setEditSubCat(null)
                  }}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 카테고리 목록 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {mainCategories.map(mainCat => {
                    const subs = subCategoriesByParent.get(mainCat.id) || []
                    const isMainSelected = editMainCat === mainCat.id || (mapping.standard_category_id === mainCat.id && editMainCat === '')
                    
                    return (
                      <div key={mainCat.id} className="mb-2">
                        {/* 메인 카테고리 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isMainSelected) {
                              setEditMainCat('')
                              setEditSubCat(null)
                            } else {
                              setEditMainCat(mainCat.id)
                              // 서브카테고리가 없으면 서브카테고리 초기화
                              if (subs.length === 0) {
                                setEditSubCat(null)
                              }
                            }
                          }}
                          disabled={saving}
                          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                            isMainSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{mainCat.name_ko || mainCat.name}</span>
                              {mainCat.irs_schedule_c_line && (
                                <span className={`text-xs ${isMainSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {mainCat.irs_schedule_c_line}
                                </span>
                              )}
                            </div>
                            {mainCat.description && (
                              <p className={`text-xs mt-1 ${isMainSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                {mainCat.description}
                              </p>
                            )}
                          </div>
                        </button>
                        
                        {/* 서브카테고리들 */}
                        {isMainSelected && subs.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            {subs.map(subCat => {
                              const isSubSelected = editSubCat === subCat.id
                              
                              return (
                                <button
                                  key={subCat.id}
                                  type="button"
                                  onClick={() => {
                                    setEditSubCat(isSubSelected ? null : subCat.id)
                                  }}
                                  disabled={saving}
                                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                                    isSubSelected
                                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                  } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <div className="flex flex-col">
                                    <div>
                                      <span className="text-gray-400 mr-2">└</span>
                                      <span className="font-medium">{subCat.name_ko || subCat.name}</span>
                                    </div>
                                    {subCat.description && (
                                      <p className={`text-xs mt-0.5 ml-5 ${isSubSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {subCat.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                            
                            {/* 서브카테고리 없음 옵션 */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditSubCat(editSubCat === '__none__' ? null : '__none__')
                              }}
                              disabled={saving}
                              className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                                editSubCat === '__none__'
                                  ? 'bg-gray-400 text-white hover:bg-gray-500'
                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className="text-gray-400 mr-2">└</span>
                              서브카테고리 없음 (메인만 사용)
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 푸터 */}
              <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingMappingId(null)
                    setEditMainCat('')
                    setEditSubCat(null)
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (!editMainCat) {
                      alert('메인 카테고리를 선택하세요.')
                      return
                    }
                    handleUpdateMapping(editingMappingId, editMainCat, editSubCat)
                  }}
                  disabled={saving || !editMainCat}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
