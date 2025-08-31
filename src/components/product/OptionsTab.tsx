'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Settings, Info, Link, Unlink, Star, Tag, DollarSign, Users, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProductOptionChoice {
  id: string
  name: string
  description: string
  priceAdjustment: {
    adult: number
    child: number
    infant: number
  }
  isDefault?: boolean
}

interface ProductOption {
  id: string
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: ProductOptionChoice[]
  linkedOptionId?: string
  priceAdjustment?: {
    adult: number
    child: number
    infant: number
  }
}

interface GlobalOption {
  id: string
  name: string
  category: string
  description: string
  adultPrice: number
  childPrice: number
  infantPrice: number
  priceType: 'perPerson' | 'perTour' | 'perHour' | 'fixed'
  status: 'active' | 'inactive' | 'seasonal'
  tags: string[]
}

interface OptionsTabProps {
  formData: {
    productOptions: ProductOption[]
  }
  setFormData: (data: any) => void
  globalOptions: GlobalOption[]
  loadingOptions: boolean
  showManualModal: boolean
  setShowManualModal: (show: boolean) => void
  setShowAddOptionModal: (show: boolean) => void
  fetchGlobalOptions: () => void
  addProductOption: () => void
  removeProductOption: (optionId: string) => void
  updateProductOption: (optionId: string, updates: Partial<ProductOption>) => void
  addOptionChoice: (optionId: string) => void
  removeOptionChoice: (optionId: string, choiceId: string) => void
  updateOptionChoice: (optionId: string, choiceId: string, updates: Partial<ProductOptionChoice>) => void
  linkToGlobalOption: (optionId: string, globalOptionId: string) => void
  productId: string
  isNewProduct: boolean
}

export default function OptionsTab({
  formData,
  setFormData,
  globalOptions,
  loadingOptions,
  showManualModal,
  setShowManualModal,
  setShowAddOptionModal,
  fetchGlobalOptions,
  addProductOption,
  removeProductOption,
  updateProductOption,
  addOptionChoice,
  removeOptionChoice,
  updateOptionChoice,
  linkToGlobalOption,
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

      // 새 옵션들 추가
      for (const option of formData.productOptions) {
        // 옵션 기본 정보 저장
        const { data: optionData, error: optionError } = await supabase
          .from('product_options')
          .insert({
            product_id: productId,
            name: option.name,
            description: option.description,
            is_required: option.isRequired,
            is_multiple: option.isMultiple,
            linked_option_id: option.linkedOptionId
          })
          .select()
          .single()

        if (optionError) throw optionError

        // 옵션 선택 항목들 저장
        if (option.choices && option.choices.length > 0) {
          for (const choice of option.choices) {
            const { error: choiceError } = await supabase
              .from('product_option_choices')
              .insert({
                product_option_id: optionData.id,
                name: choice.name,
                description: choice.description,
                adult_price_adjustment: choice.priceAdjustment.adult,
                child_price_adjustment: choice.priceAdjustment.child,
                infant_price_adjustment: choice.priceAdjustment.infant,
                is_default: choice.isDefault || false
              })

            if (choiceError) throw choiceError
          }
        }
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
            <span>글로벌 옵션 추가</span>
          </button>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>수동 옵션 추가</span>
          </button>
        </div>
      </div>

      {/* 옵션 목록 */}
      {formData.productOptions.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">옵션이 없습니다</h3>
          <p className="text-gray-500 mb-4">
            글로벌 옵션을 추가하거나 수동으로 옵션을 만들어보세요.
          </p>
          <div className="flex justify-center space-x-3">
            <button
              type="button"
              onClick={() => setShowAddOptionModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              글로벌 옵션 추가
            </button>
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              수동 옵션 추가
            </button>
          </div>
        </div>
      ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {formData.productOptions.map((option, optionIndex) => (
            <div key={option.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              {/* 옵션 헤더 - 컴팩하게 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-base font-semibold text-gray-900 truncate">{option.name}</h4>
                      {option.linkedOptionId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                          <Link className="h-3 w-3 mr-1" />
                          글로벌
                        </span>
                      )}
                    </div>
                    <textarea
                      value={option.description}
                      onChange={(e) => updateProductOption(option.id, { description: e.target.value })}
                      placeholder="옵션 설명을 입력하세요"
                      rows={1}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProductOption(option.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded ml-2 flex-shrink-0"
                    title="옵션 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 옵션 설정 - 한 줄로 */}
                <div className="flex items-center space-x-4 text-sm">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={option.isRequired}
                      onChange={(e) => updateProductOption(option.id, { isRequired: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">필수</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={option.isMultiple}
                      onChange={(e) => updateProductOption(option.id, { isMultiple: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">다중</span>
                  </label>
                </div>

                {/* 글로벌 옵션 연결 - 컴팩하게 */}
                {option.linkedOptionId && (
                  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Link className="h-3 w-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-900">글로벌 옵션 연결됨</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateProductOption(option.id, { linkedOptionId: undefined })}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        해제
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 선택 항목들 - 컴팩하게 */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-gray-900 flex items-center">
                    <Tag className="h-3 w-3 text-gray-500 mr-2" />
                    선택 항목 ({option.choices.length}개)
                  </h5>
                  <button
                    type="button"
                    onClick={() => addOptionChoice(option.id)}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    추가
                  </button>
                </div>

                {option.choices.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    선택 항목이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {option.choices.map((choice, choiceIndex) => (
                      <div key={choice.id} className="bg-gray-50 rounded border border-gray-200 p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={choice.name}
                              onChange={(e) => updateOptionChoice(option.id, choice.id, { name: e.target.value })}
                              placeholder="선택 항목명"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
                            />
                            <textarea
                              value={choice.description}
                              onChange={(e) => updateOptionChoice(option.id, choice.id, { description: e.target.value })}
                              placeholder="선택 항목 설명"
                              rows={1}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOptionChoice(option.id, choice.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded ml-2 flex-shrink-0"
                            title="선택 항목 삭제"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {/* 가격 설정 - 컴팩하게 */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">성인</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">₩</span>
                              <input
                                type="number"
                                value={choice.priceAdjustment.adult}
                                onChange={(e) => updateOptionChoice(option.id, choice.id, {
                                  priceAdjustment: {
                                    ...choice.priceAdjustment,
                                    adult: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">아동</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">₩</span>
                              <input
                                type="number"
                                value={choice.priceAdjustment.child}
                                onChange={(e) => updateOptionChoice(option.id, choice.id, {
                                  priceAdjustment: {
                                    ...choice.priceAdjustment,
                                    child: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">유아</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">₩</span>
                              <input
                                type="number"
                                value={choice.priceAdjustment.infant}
                                onChange={(e) => updateOptionChoice(option.id, choice.id, {
                                  priceAdjustment: {
                                    ...choice.priceAdjustment,
                                    infant: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 기본값 설정 - 컴팩하게 */}
                        <div className="flex items-center justify-between">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={choice.isDefault || false}
                              onChange={(e) => updateOptionChoice(option.id, choice.id, { isDefault: e.target.checked })}
                              className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <span className="text-xs text-gray-700">기본값</span>
                          </label>
                          {choice.isDefault && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Star className="h-3 w-3 mr-1" />
                              기본
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
