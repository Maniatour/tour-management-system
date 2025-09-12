'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProductDetailsData {
  id?: string
  product_id: string
  slogan1: string
  slogan2: string
  slogan3: string
  description: string
  included: string
  not_included: string
  pickup_drop_info: string
  luggage_info: string
  tour_operation_info: string
  preparation_info: string
  small_group_info: string
  companion_info: string
  exclusive_booking_info: string
  cancellation_policy: string
  chat_announcement: string
}

interface ProductDetailsTabProps {
  productId: string
  isNewProduct: boolean
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function ProductDetailsTab({
  productId,
  isNewProduct,
  formData,
  setFormData
}: ProductDetailsTabProps) {
  // formData는 props로 받아서 사용

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)

  // 로딩 상태는 부모 컴포넌트에서 관리
  useEffect(() => {
    setLoading(false)
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      productDetails: {
        ...prev.productDetails,
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 기존 데이터가 있는지 확인
      const { data: existingData } = await supabase
        .from('product_details')
        .select('id')
        .eq('product_id', productId)
        .single()

      if (existingData) {
        // 업데이트
      const { error } = await supabase
        .from('product_details')
        .update({
          product_id: productId,
          ...formData.productDetails,
          updated_at: new Date().toISOString()
        })
        .eq('product_id', productId)

        if (error) throw error
      } else {
        // 새로 생성
        const { error } = await supabase
          .from('product_details')
          .insert([{
            product_id: productId,
            ...formData.productDetails
          }])

        if (error) throw error
      }

      setSaveMessage('상품 세부정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      console.error('상품 세부정보 저장 오류:', errorMessage)
      setSaveMessage(`저장에 실패했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 저장 버튼 및 메시지 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          상품 세부정보
        </h3>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isNewProduct}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {isNewProduct && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800">
              새 상품의 경우 전체 저장을 사용해주세요. 개별 저장은 상품 생성 후에 가능합니다.
            </p>
          </div>
        </div>
      )}

      {/* 슬로건 섹션 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">슬로건</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              슬로건 1
            </label>
            <input
              type="text"
              value={formData.productDetails.slogan1}
              onChange={(e) => handleInputChange('slogan1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 최고의 투어 경험"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              슬로건 2
            </label>
            <input
              type="text"
              value={formData.productDetails.slogan2}
              onChange={(e) => handleInputChange('slogan2', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 전문 가이드와 함께"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              슬로건 3
            </label>
            <input
              type="text"
              value={formData.productDetails.slogan3}
              onChange={(e) => handleInputChange('slogan3', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 잊지 못할 추억"
            />
          </div>
        </div>
      </div>

      {/* 상품 설명 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">상품 설명</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상세 설명
          </label>
          <textarea
            value={formData.productDetails.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="상품에 대한 자세한 설명을 입력해주세요"
          />
        </div>
      </div>

      {/* 포함/불포함 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">포함/불포함 정보</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              포함 사항
            </label>
            <textarea
              value={formData.productDetails.included}
              onChange={(e) => handleInputChange('included', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="포함되는 사항들을 입력해주세요"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              불포함 사항
            </label>
            <textarea
              value={formData.productDetails.not_included}
              onChange={(e) => handleInputChange('not_included', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="불포함되는 사항들을 입력해주세요"
            />
          </div>
        </div>
      </div>

      {/* 픽업/드롭 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">픽업/드롭 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            픽업 및 드롭 정보
          </label>
          <textarea
            value={formData.productDetails.pickup_drop_info}
            onChange={(e) => handleInputChange('pickup_drop_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="픽업 및 드롭에 대한 정보를 입력해주세요"
          />
        </div>
      </div>

      {/* 수하물 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">수하물 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            수하물 관련 정보
          </label>
          <textarea
            value={formData.productDetails.luggage_info}
            onChange={(e) => handleInputChange('luggage_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="수하물 관련 규정 및 정보를 입력해주세요"
          />
        </div>
      </div>

      {/* 투어 운영 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">투어 운영 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            투어 운영 관련 정보
          </label>
          <textarea
            value={formData.productDetails.tour_operation_info}
            onChange={(e) => handleInputChange('tour_operation_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="투어 운영 방식 및 특별 사항을 입력해주세요"
          />
        </div>
      </div>

      {/* 준비 사항 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">준비 사항</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            준비해야 할 사항들
          </label>
          <textarea
            value={formData.productDetails.preparation_info}
            onChange={(e) => handleInputChange('preparation_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="투어 전 준비해야 할 사항들을 입력해주세요"
          />
        </div>
      </div>

      {/* 소그룹 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">소그룹 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            소그룹 투어 관련 정보
          </label>
          <textarea
            value={formData.productDetails.small_group_info}
            onChange={(e) => handleInputChange('small_group_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="소그룹 투어의 특징 및 장점을 입력해주세요"
          />
        </div>
      </div>

      {/* 동반자 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">동반자 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            동반자 관련 정보
          </label>
          <textarea
            value={formData.productDetails.companion_info}
            onChange={(e) => handleInputChange('companion_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="동반자 관련 규정 및 정보를 입력해주세요"
          />
        </div>
      </div>

      {/* 독점 예약 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">독점 예약 정보</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            독점 예약 관련 정보
          </label>
          <textarea
            value={formData.productDetails.exclusive_booking_info}
            onChange={(e) => handleInputChange('exclusive_booking_info', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="독점 예약 관련 특별 사항을 입력해주세요"
          />
        </div>
      </div>

      {/* 취소 정책 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">취소 정책</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            취소 및 환불 정책
          </label>
          <textarea
            value={formData.productDetails.cancellation_policy}
            onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="취소 및 환불 정책을 자세히 입력해주세요"
          />
        </div>
      </div>

      {/* 채팅 공지 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">채팅 공지</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            채팅방 공지사항
          </label>
          <textarea
            value={formData.productDetails.chat_announcement}
            onChange={(e) => handleInputChange('chat_announcement', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="채팅방에 표시될 공지사항을 입력해주세요"
          />
        </div>
      </div>
    </div>
  )
}
