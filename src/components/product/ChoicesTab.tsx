'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
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
}

interface ChoicesTabProps {
  productId: string
  isNewProduct: boolean
}

export default function ChoicesTab({ productId, isNewProduct }: ChoicesTabProps) {
  const [choices, setChoices] = useState<Choice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // 상품의 choices 정보 로드
  useEffect(() => {
    if (!productId || isNewProduct) {
      setLoading(false)
      return
    }

    loadProductChoices()
  }, [productId, isNewProduct])

  const loadProductChoices = async () => {
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single()

      if (error) throw error

      if (product?.choices?.required) {
        // choices.required 안의 각 choice의 options를 추출하여 평면화
        const flattenedChoices: Choice[] = []

        product.choices.required.forEach((choice: any) => {
          if (choice.options && Array.isArray(choice.options)) {
            choice.options.forEach((option: any) => {
              flattenedChoices.push({
                id: option.id,
                name: option.name,
                name_ko: option.name_ko,
                description: choice.description,
                adult_price: option.adult_price || 0,
                child_price: option.child_price || 0,
                infant_price: option.infant_price || 0,
                is_default: option.is_default || false
              })
            })
          }
        })

        console.log('ChoicesTab에서 로드된 choices:', flattenedChoices)
        setChoices(flattenedChoices)
      } else {
        setChoices([])
      }
    } catch (error) {
      console.error('Choices 로드 오류:', error)
      setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 새 초이스 추가
  const addChoice = () => {
    const newChoice: Choice = {
      id: `choice_${Date.now()}`,
      name: '',
      name_ko: '',
      description: '',
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      is_default: false
    }
    setChoices([...choices, newChoice])
  }

  // 초이스 삭제
  const removeChoice = (choiceId: string) => {
    setChoices(choices.filter(choice => choice.id !== choiceId))
  }

  // 초이스 업데이트
  const updateChoice = (choiceId: string, updates: Partial<Choice>) => {
    setChoices(choices.map(choice => 
      choice.id === choiceId ? { ...choice, ...updates } : choice
    ))
  }

  // 기본 초이스 설정 (하나만 선택 가능)
  const setDefaultChoice = (choiceId: string) => {
    setChoices(choices.map(choice => ({
      ...choice,
      is_default: choice.id === choiceId
    })))
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
      // choices를 원래 구조로 변환하여 저장
      const choicesStructure = {
        required: [{
          id: 'canyon_choice',
          name: 'Canyon Choice',
          name_ko: '캐년 선택',
          type: 'radio',
          description: 'Lower Antelope Canyon과 Antelope X Canyon 중 선택하세요',
          options: choices.map(choice => ({
            id: choice.id,
            name: choice.name,
            name_ko: choice.name_ko,
            adult_price: choice.adult_price,
            child_price: choice.child_price,
            infant_price: choice.infant_price,
            is_default: choice.is_default
          }))
        }]
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
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">초이스 관리</h3>
          <p className="text-sm text-gray-600">상품의 필수 선택 옵션(초이스)을 관리합니다.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={addChoice}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            초이스 추가
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

      {/* 초이스 목록 */}
      <div className="space-y-4">
        {choices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 초이스가 없습니다.</p>
            <p className="text-sm">위의 "초이스 추가" 버튼을 클릭하여 초이스를 추가하세요.</p>
          </div>
        ) : (
          choices.map((choice) => (
            <div key={choice.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 초이스 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    초이스 이름 *
                  </label>
                  <input
                    type="text"
                    value={choice.name}
                    onChange={(e) => updateChoice(choice.id, { name: e.target.value })}
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
                    onChange={(e) => updateChoice(choice.id, { name_ko: e.target.value })}
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
                    onChange={(e) => updateChoice(choice.id, { adult_price: parseFloat(e.target.value) || 0 })}
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
                    onChange={(e) => updateChoice(choice.id, { child_price: parseFloat(e.target.value) || 0 })}
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
                    onChange={(e) => updateChoice(choice.id, { infant_price: parseFloat(e.target.value) || 0 })}
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
                    onChange={() => setDefaultChoice(choice.id)}
                    className="rounded"
                  />
                  <label className="text-sm text-gray-700">
                    기본 초이스
                  </label>
                </div>

                {/* 삭제 버튼 */}
                <div className="flex justify-end">
                  <button
                    onClick={() => removeChoice(choice.id)}
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
                  onChange={(e) => updateChoice(choice.id, { description: e.target.value })}
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
  )
}
