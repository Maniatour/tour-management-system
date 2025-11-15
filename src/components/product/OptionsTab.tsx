'use client'

import React, { useState, ChangeEvent } from 'react'
import { Plus, Trash2, Settings, Save, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface ProductOption {
  id: string
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: unknown[]
  linkedOptionId?: string
  adultPrice?: number
  childPrice?: number
  infantPrice?: number
  imageUrl?: string
  imageAlt?: string
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
  const [uploadingImages, setUploadingImages] = useState<{[key: string]: boolean}>({})
  const [dragOverStates, setDragOverStates] = useState<{[key: string]: boolean}>({})
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(false)

  // 이미지 업로드 처리 함수
  const handleImageUpload = async (file: File, optionId: string) => {
    const uploadKey = optionId
    setUploadingImages(prev => ({ ...prev, [uploadKey]: true }))
    
    try {
      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      // 파일 타입 체크
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }

      // 버킷 확인
      const bucketName = 'product-media'
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        console.error('버킷 목록 조회 오류:', listError)
        alert('저장소를 확인할 수 없습니다. 관리자에게 문의하세요.')
        return
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
      if (!bucketExists) {
        alert(`'${bucketName}' 버킷이 존재하지 않습니다. 관리자에게 문의하여 버킷을 생성해주세요.`)
        return
      }

      // Supabase Storage에 업로드
      const fileName = `product-options/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('이미지 업로드 오류:', error)
        alert(`이미지 업로드 중 오류가 발생했습니다: ${error.message}`)
        return
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      // 이미지 URL과 alt 텍스트 업데이트
      updateProductOption(optionId, { 
        imageUrl: urlData.publicUrl,
        imageAlt: file.name
      })
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert(`이미지 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setUploadingImages(prev => ({ ...prev, [uploadKey]: false }))
    }
  }

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
            adult_price_adjustment: option.adultPrice || 0,
            child_price_adjustment: option.childPrice || 0,
            infant_price_adjustment: option.infantPrice || 0,
            is_default: true,
            image_url: option.imageUrl || null,
            image_alt: option.imageAlt || null
          } as never)
          .select()
          .single()

        if (optionError) throw optionError
        console.log('옵션 저장됨:', (optionData as { id: string })?.id)
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
            onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
            className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            {allCardsCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>상세보기</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>접어보기</span>
              </>
            )}
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {formData.productOptions.map((option) => {
            // 디버깅: 옵션 이미지 정보 확인
            if (option.imageUrl) {
              console.log(`OptionsTab: Option ${option.name} has imageUrl:`, option.imageUrl)
            } else {
              console.log(`OptionsTab: Option ${option.name} has no imageUrl`)
            }
            
            return (
            <div key={option.id} className="bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col">
              {/* 이미지 섹션 (상단) */}
              <div className="relative w-full h-48 bg-gray-100">
                {option.imageUrl ? (
                  <div 
                    className="relative w-full h-full"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: true }))
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: false }))
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: false }))
                      
                      const files = Array.from(e.dataTransfer.files)
                      const imageFiles = files.filter(file => file.type.startsWith('image/'))
                      
                      if (imageFiles.length > 0) {
                        await handleImageUpload(imageFiles[0], option.id)
                      }
                    }}
                  >
                    <Image
                      src={option.imageUrl}
                      alt={option.imageAlt || option.name}
                      fill
                      className={`object-cover transition-all ${
                        dragOverStates[option.id]
                          ? 'scale-105 brightness-110'
                          : ''
                      }`}
                    />
                    {dragOverStates[option.id] && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-30 flex items-center justify-center z-10">
                        <p className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg">이미지 놓기</p>
                      </div>
                    )}
                    {/* 이미지 편집 버튼 */}
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImages[option.id]}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            await handleImageUpload(file, option.id)
                            e.target.value = ''
                          }
                        }}
                        className="hidden"
                        id={`file-upload-${option.id}`}
                      />
                      <button
                        onClick={() => {
                          if (!uploadingImages[option.id]) {
                            document.getElementById(`file-upload-${option.id}`)?.click()
                          }
                        }}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        title="이미지 변경"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          updateProductOption(option.id, { imageUrl: '', imageAlt: '' })
                        }}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                        title="이미지 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`w-full h-full border-2 border-dashed transition-all flex items-center justify-center ${
                      dragOverStates[option.id]
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-gray-50'
                    } ${uploadingImages[option.id] ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: true }))
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: false }))
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverStates(prev => ({ ...prev, [option.id]: false }))
                      
                      const files = Array.from(e.dataTransfer.files)
                      const imageFiles = files.filter(file => file.type.startsWith('image/'))
                      
                      if (imageFiles.length > 0) {
                        await handleImageUpload(imageFiles[0], option.id)
                      }
                    }}
                    onClick={() => {
                      if (!uploadingImages[option.id]) {
                        document.getElementById(`file-upload-${option.id}`)?.click()
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImages[option.id]}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          await handleImageUpload(file, option.id)
                          e.target.value = ''
                        }
                      }}
                      className="hidden"
                      id={`file-upload-${option.id}`}
                    />
                    {uploadingImages[option.id] ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-sm text-blue-600 font-medium">업로드 중...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 font-medium">이미지 업로드</p>
                        <p className="text-xs text-gray-400 mt-1">클릭하거나 드래그</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 정보 섹션 (하단) */}
              <div className="p-4 flex-1 flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-gray-800">{option.name}</h4>
                  <button
                    type="button"
                    onClick={() => removeProductOption(option.id)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all"
                    title="옵션 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {!allCardsCollapsed && (
                  <>
                    {/* 옵션 설명 */}
                    {option.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{option.description}</p>
                    )}

                    {/* 가격 정보 */}
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-2">가격 정보</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500 mb-1">성인</div>
                          <div className="font-medium text-gray-900">
                            {option.adultPrice !== undefined ? `$${option.adultPrice.toFixed(2)}` : '미설정'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">아동</div>
                          <div className="font-medium text-gray-900">
                            {option.childPrice !== undefined ? `$${option.childPrice.toFixed(2)}` : '미설정'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">유아</div>
                          <div className="font-medium text-gray-900">
                            {option.infantPrice !== undefined ? `$${option.infantPrice.toFixed(2)}` : '미설정'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 옵션 설정 - 필수/다중 선택 */}
                    <div className="flex items-center space-x-4 text-sm pt-2 border-t border-gray-100">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={option.isRequired}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateProductOption(option.id, { isRequired: e.target.checked })}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="text-gray-700">필수</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={option.isMultiple}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateProductOption(option.id, { isMultiple: e.target.checked })}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="text-gray-700">다중</span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
          })}
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
