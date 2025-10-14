'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Copy, Download, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Choice {
  id: string
  name: string
  name_ko?: string
  description?: string
  adult_price: number
  child_price: number
  infant_price: number
  is_default?: boolean
  group_id?: string
}

interface ChoiceGroup {
  id: string
  name: string
  name_ko?: string
  description?: string
  choices: Choice[]
}

interface ChoicesTabProps {
  productId: string
  isNewProduct: boolean
}

export default function ChoicesTab({ productId, isNewProduct }: ChoicesTabProps) {
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showCopyToModal, setShowCopyToModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedTargetProductId, setSelectedTargetProductId] = useState('')
  const [importData, setImportData] = useState('')

  // 상품의 choices 정보 로드
  useEffect(() => {
    if (!productId || isNewProduct) {
      setLoading(false)
      return
    }

    loadProductChoices()
  }, [productId, isNewProduct, loadProductChoices])

  // 상품 목록 로드
  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko')
        .neq('id', productId) // 현재 상품 제외
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
    }
  }

  const loadProductChoices = async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single()

      if (error) throw error

      if (product?.choices?.required) {
        // choices.required를 그룹으로 변환
        const groups: ChoiceGroup[] = product.choices.required.map((group: { id: string; name: string; name_ko?: string; description?: string; options?: Array<{ id: string; name: string; name_ko?: string; description?: string; adult_price?: number; child_price?: number; infant_price?: number; is_default?: boolean }> }) => ({
          id: group.id,
          name: group.name,
          name_ko: group.name_ko,
          description: group.description,
          choices: group.options?.map((option: { id: string; name: string; name_ko?: string; description?: string; adult_price?: number; child_price?: number; infant_price?: number; is_default?: boolean }) => ({
            id: option.id,
            name: option.name,
            name_ko: option.name_ko,
            description: option.description,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            is_default: option.is_default || false,
            group_id: group.id
          })) || []
        }))

        console.log('ChoicesTab에서 로드된 choice groups:', groups)
        setChoiceGroups(groups)
      } else {
        setChoiceGroups([])
      }
    } catch (error) {
      console.error('Choices 로드 오류:', error)
      setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 새 그룹 추가
  const addGroup = () => {
    const newGroup: ChoiceGroup = {
      id: `group_${Date.now()}`,
      name: '',
      name_ko: '',
      description: '',
      choices: []
    }
    setChoiceGroups([...choiceGroups, newGroup])
  }

  // 그룹 삭제
  const removeGroup = (groupId: string) => {
    setChoiceGroups(choiceGroups.filter(group => group.id !== groupId))
  }

  // 그룹 업데이트
  const updateGroup = (groupId: string, updates: Partial<ChoiceGroup>) => {
    setChoiceGroups(choiceGroups.map(group => 
      group.id === groupId ? { ...group, ...updates } : group
    ))
  }

  // 그룹에 새 초이스 추가
  const addChoiceToGroup = (groupId: string) => {
    const newChoice: Choice = {
      id: `choice_${Date.now()}`,
      name: '',
      name_ko: '',
      description: '',
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      is_default: false,
      group_id: groupId
    }
    
    setChoiceGroups(choiceGroups.map(group => 
      group.id === groupId 
        ? { ...group, choices: [...group.choices, newChoice] }
        : group
    ))
  }

  // 초이스 삭제
  const removeChoice = (groupId: string, choiceId: string) => {
    setChoiceGroups(choiceGroups.map(group => 
      group.id === groupId 
        ? { ...group, choices: group.choices.filter(choice => choice.id !== choiceId) }
        : group
    ))
  }

  // 초이스 업데이트
  const updateChoice = (groupId: string, choiceId: string, updates: Partial<Choice>) => {
    setChoiceGroups(choiceGroups.map(group => 
      group.id === groupId 
        ? { 
            ...group, 
            choices: group.choices.map(choice => 
              choice.id === choiceId ? { ...choice, ...updates } : choice
            )
          }
        : group
    ))
  }

  // 기본 초이스 설정 (그룹 내에서 하나만 선택 가능)
  const setDefaultChoice = (groupId: string, choiceId: string) => {
    setChoiceGroups(choiceGroups.map(group => 
      group.id === groupId 
        ? { 
            ...group, 
            choices: group.choices.map(choice => ({
              ...choice,
              is_default: choice.id === choiceId
            }))
          }
        : group
    ))
  }

  // 다른 상품에서 초이스 그룹 복사
  const copyFromProduct = async () => {
    if (!selectedProductId) return

    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', selectedProductId)
        .single()

      if (error) throw error

      if (product?.choices?.required) {
        const groups: ChoiceGroup[] = product.choices.required.map((group: { id: string; name: string; name_ko?: string; description?: string; options?: Array<{ id: string; name: string; name_ko?: string; description?: string; adult_price?: number; child_price?: number; infant_price?: number; is_default?: boolean }> }) => ({
          id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: group.name,
          name_ko: group.name_ko,
          description: group.description,
          choices: group.options?.map((option: { id: string; name: string; name_ko?: string; description?: string; adult_price?: number; child_price?: number; infant_price?: number; is_default?: boolean }) => ({
            id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: option.name,
            name_ko: option.name_ko,
            description: option.description,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            is_default: option.is_default || false,
            group_id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          })) || []
        }))

        setChoiceGroups([...choiceGroups, ...groups])
        setShowCopyModal(false)
        setSaveMessage('초이스 그룹이 성공적으로 복사되었습니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage('선택한 상품에 초이스 그룹이 없습니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('초이스 복사 오류:', error)
      setSaveMessage('초이스 복사 중 오류가 발생했습니다.')
    }
  }

  // 초이스 그룹을 JSON으로 내보내기
  const exportChoices = () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      choice_groups: choiceGroups
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `choices_${productId}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // JSON에서 초이스 그룹 가져오기
  const importChoices = () => {
    try {
      const data = JSON.parse(importData)
      
      if (data.choice_groups && Array.isArray(data.choice_groups)) {
        // ID를 새로 생성하여 중복 방지
        const importedGroups = data.choice_groups.map((group: ChoiceGroup) => ({
          ...group,
          id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          choices: group.choices.map(choice => ({
            ...choice,
            id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            group_id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }))
        }))

        setChoiceGroups([...choiceGroups, ...importedGroups])
        setShowImportModal(false)
        setImportData('')
        setSaveMessage('초이스 그룹이 성공적으로 가져왔습니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage('올바른 형식의 JSON 파일이 아닙니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('초이스 가져오기 오류:', error)
      setSaveMessage('JSON 파싱 중 오류가 발생했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  // 현재 상품의 초이스 그룹을 다른 상품으로 복사
  const copyToProduct = async () => {
    if (!selectedTargetProductId || choiceGroups.length === 0) return

    try {
      // choices를 원래 구조로 변환
      const choicesStructure = {
        required: choiceGroups.map(group => ({
          id: group.id,
          name: group.name,
          name_ko: group.name_ko,
          type: 'radio',
          description: group.description,
          options: group.choices.map(choice => ({
            id: choice.id,
            name: choice.name,
            name_ko: choice.name_ko,
            description: choice.description,
            adult_price: choice.adult_price,
            child_price: choice.child_price,
            infant_price: choice.infant_price,
            is_default: choice.is_default
          }))
        }))
      }

      // 대상 상품에 choices 저장
      const { error } = await supabase
        .from('products')
        .update({
          choices: choicesStructure
        })
        .eq('id', selectedTargetProductId)

      if (error) throw error

      setShowCopyToModal(false)
      setSaveMessage(`초이스 그룹이 상품 ${selectedTargetProductId}에 성공적으로 복사되었습니다.`)
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('초이스 복사 오류:', error)
      setSaveMessage('초이스 복사 중 오류가 발생했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  // 저장
  const handleSave = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // choiceGroups를 원래 구조로 변환하여 저장
      const choicesStructure = {
        required: choiceGroups.map(group => ({
          id: group.id,
          name: group.name,
          name_ko: group.name_ko,
          type: 'radio',
          description: group.description,
          options: group.choices.map(choice => ({
            id: choice.id,
            name: choice.name,
            name_ko: choice.name_ko,
            description: choice.description,
            adult_price: choice.adult_price,
            child_price: choice.child_price,
            infant_price: choice.infant_price,
            is_default: choice.is_default
          }))
        }))
      }

      console.log('저장할 choices 구조:', choicesStructure)

      const { error } = await supabase
        .from('products')
        .update({
          choices: choicesStructure
        })
        .eq('id', productId)

      if (error) throw error

      setSaveMessage('Choices가 성공적으로 저장되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Choices 저장 오류:', error)
      setSaveMessage('Choices 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">초이스 관리</h3>
          <p className="text-sm text-gray-600">상품의 필수 선택 옵션(초이스)을 그룹별로 관리합니다.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={addGroup}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            그룹 추가
          </button>
          <button
            onClick={() => {
              loadProducts()
              setShowCopyModal(true)
            }}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <Copy className="w-4 h-4 mr-1" />
            다른 상품에서 복사
          </button>
          <button
            onClick={() => {
              loadProducts()
              setShowCopyToModal(true)
            }}
            disabled={choiceGroups.length === 0}
            className="flex items-center px-3 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-gray-400"
          >
            <Copy className="w-4 h-4 mr-1" />
            다른 상품으로 복사
          </button>
          <button
            onClick={exportChoices}
            disabled={choiceGroups.length === 0}
            className="flex items-center px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
          >
            <Download className="w-4 h-4 mr-1" />
            내보내기
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <Upload className="w-4 h-4 mr-1" />
            가져오기
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isNewProduct}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`p-3 rounded-md ${
          saveMessage.includes('성공') 
            ? 'bg-green-100 text-green-700 border border-green-200' 
            : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 그룹 목록 */}
      <div className="space-y-6">
        {choiceGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 그룹이 없습니다.</p>
            <p className="text-sm">위의 &quot;그룹 추가&quot; 버튼을 클릭하여 그룹을 추가하세요.</p>
          </div>
        ) : (
          choiceGroups.map((group) => (
            <div key={group.id} className="border border-gray-300 rounded-lg p-6 bg-gray-50">
              {/* 그룹 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        그룹 이름 *
                      </label>
                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                        placeholder="예: 앤텔롭 캐년 선택"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        한국어 그룹 이름
                      </label>
                      <input
                        type="text"
                        value={group.name_ko || ''}
                        onChange={(e) => updateGroup(group.id, { name_ko: e.target.value })}
                        placeholder="예: 앤텔롭 캐년 선택"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      그룹 설명
                    </label>
                    <textarea
                      value={group.description || ''}
                      onChange={(e) => updateGroup(group.id, { description: e.target.value })}
                      placeholder="그룹에 대한 설명을 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => addChoiceToGroup(group.id)}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    초이스 추가
                  </button>
                  <button
                    onClick={() => removeGroup(group.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded"
                    title="그룹 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 그룹 내 초이스 목록 */}
              <div className="space-y-3">
                {group.choices.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 bg-white rounded border-2 border-dashed border-gray-300">
                    <p className="text-sm">이 그룹에 초이스가 없습니다.</p>
                    <p className="text-xs">&quot;초이스 추가&quot; 버튼을 클릭하여 초이스를 추가하세요.</p>
                  </div>
                ) : (
                  group.choices.map((choice) => (
                    <div key={choice.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 초이스 이름 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            초이스 이름 *
                          </label>
                          <input
                            type="text"
                            value={choice.name}
                            onChange={(e) => updateChoice(group.id, choice.id, { name: e.target.value })}
                            placeholder="예: Lower Antelope Canyon"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* 한국어 이름 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            한국어 이름
                          </label>
                          <input
                            type="text"
                            value={choice.name_ko || ''}
                            onChange={(e) => updateChoice(group.id, choice.id, { name_ko: e.target.value })}
                            placeholder="예: 로어 앤텔로프 캐니언"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* 성인 가격 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            성인 가격 ($)
                          </label>
                          <input
                            type="number"
                            value={choice.adult_price}
                            onChange={(e) => updateChoice(group.id, choice.id, { adult_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            step="0.01"
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* 아동 가격 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            아동 가격 ($)
                          </label>
                          <input
                            type="number"
                            value={choice.child_price}
                            onChange={(e) => updateChoice(group.id, choice.id, { child_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            step="0.01"
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* 유아 가격 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            유아 가격 ($)
                          </label>
                          <input
                            type="number"
                            value={choice.infant_price}
                            onChange={(e) => updateChoice(group.id, choice.id, { infant_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            step="0.01"
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* 기본 초이스 설정 */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={choice.is_default || false}
                            onChange={() => setDefaultChoice(group.id, choice.id)}
                            className="rounded"
                          />
                          <label className="text-sm text-gray-700">
                            기본 초이스
                          </label>
                        </div>

                        {/* 삭제 버튼 */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => removeChoice(group.id, choice.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded"
                            title="초이스 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 설명 */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          설명
                        </label>
                        <textarea
                          value={choice.description || ''}
                          onChange={(e) => updateChoice(group.id, choice.id, { description: e.target.value })}
                          placeholder="초이스에 대한 설명을 입력하세요"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 다른 상품에서 복사 모달 */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">다른 상품에서 초이스 그룹 복사</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 선택
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name_ko || product.name} ({product.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={copyFromProduct}
                  disabled={!selectedProductId}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                >
                  복사
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 다른 상품으로 복사 모달 */}
      {showCopyToModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">다른 상품으로 초이스 그룹 복사</h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                현재 상품의 {choiceGroups.length}개 그룹을 다른 상품으로 복사합니다.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  대상 상품 선택
                </label>
                <select
                  value={selectedTargetProductId}
                  onChange={(e) => setSelectedTargetProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name_ko || product.name} ({product.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                ⚠️ 대상 상품의 기존 초이스 그룹은 덮어쓰여집니다.
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCopyToModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={copyToProduct}
                  disabled={!selectedTargetProductId}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-gray-400"
                >
                  복사
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 가져오기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">초이스 그룹 가져오기</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  JSON 데이터
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="내보낸 JSON 데이터를 여기에 붙여넣으세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={10}
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>• 내보내기 기능으로 생성된 JSON 파일을 사용하세요</p>
                <p>• 기존 초이스 그룹에 추가됩니다</p>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportData('')
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={importChoices}
                  disabled={!importData.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  가져오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
