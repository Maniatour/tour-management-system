'use client'

import React, { useState, ChangeEvent } from 'react'
import { Plus, Trash2, Settings, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProductOption {
  id: string
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: unknown[]
  linkedOptionId?: string
}

interface OptionsTabProps {
  formData: {
    productOptions: ProductOption[]
  }
  setShowAddOptionModal: (show: boolean) => void
  removeProductOption: (optionId: string) => void
  updateProductOption: (optionId: string, updates: Record<string, unknown>) => void
  productId: string
  isNewProduct: boolean
}

export default function OptionsTab({
  formData,
  setShowAddOptionModal,
  removeProductOption,
  updateProductOption,
  productId,
  isNewProduct
}: OptionsTabProps) {
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSaveOptions = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 기존 옵션들 삭제
      const { error: deleteError } = await supabase
        .from('product_options')
        .delete()
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // 새 옵션들 추가 - 간단한 구조
      for (const option of formData.productOptions) {
        const { data: optionData, error: optionError } = await supabase
          .from('product_options')
          .insert({
            product_id: productId,
            name: option.name,
            description: option.description,
            is_required: option.isRequired,
            is_multiple: option.isMultiple,
            linked_option_id: option.linkedOptionId || null,
            choice_name: null,
            choice_description: null,
            adult_price_adjustment: 0,
            child_price_adjustment: 0,
            infant_price_adjustment: 0,
            is_default: true
          })
          .select()
          .single()

        if (optionError) throw optionError
        console.log('옵션 저장됨:', optionData.id)
      }

      setSaveMessage('옵션 정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      console.error('옵션 저장 오류:', errorMessage)
      setSaveMessage(`옵션 저장에 실패했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Settings className="h-5 w-5 text-purple-600 mr-2" />
            옵션 관리
          </h3>
          <span className="text-sm text-gray-500">
            {formData.productOptions.length}개 옵션
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowAddOptionModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>옵션 추가</span>
          </button>
        </div>
      </div>

      {/* 옵션 목록 */}
      {formData.productOptions.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">옵션이 없습니다</h3>
          <p className="text-gray-500 mb-4">
            옵션을 추가해보세요.
          </p>
          <button
            type="button"
            onClick={() => setShowAddOptionModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            옵션 추가
          </button>
        </div>
      ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {formData.productOptions.map((option) => (
            <div key={option.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              {/* 간단한 옵션 카드 */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-gray-900">{option.name}</h4>
                  <button
                    type="button"
                    onClick={() => removeProductOption(option.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="옵션 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 옵션 설정 - 필수/다중 선택만 */}
                <div className="flex items-center space-x-4 text-sm">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={option.isRequired}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateProductOption(option.id, { isRequired: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">필수</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={option.isMultiple}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateProductOption(option.id, { isMultiple: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">다중</span>
                  </label>
                </div>
              </div>



            </div>
          ))}
        </div>
      )}

      {/* 옵션 관리 저장 버튼 */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-medium text-gray-900">옵션 관리</h3>
          </div>
          <button
            type="button"
            onClick={handleSaveOptions}
            disabled={saving || isNewProduct}
            className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
              saving || isNewProduct
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <Save className="h-4 w-4" />
            <span>{saving ? '저장 중...' : '옵션 관리 저장'}</span>
          </button>
        </div>
        {saveMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            saveMessage.includes('성공') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage}
          </div>
        )}
        {isNewProduct && (
          <p className="mt-2 text-sm text-gray-500">
            새 상품은 전체 저장을 사용해주세요.
          </p>
        )}
      </div>
    </>
  )
}
