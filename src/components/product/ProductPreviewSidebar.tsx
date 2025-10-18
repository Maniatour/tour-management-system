'use client'

import React, { useState } from 'react'
import { X, Eye, Smartphone } from 'lucide-react'

interface ProductPreviewSidebarProps {
  isOpen: boolean
  onClose: () => void
  productData: {
    name: string
    nameEn?: string
    customerNameKo?: string
    customerNameEn?: string
    description: string
    duration: number
    maxParticipants: number
    departureCity: string
    arrivalCity: string
    departureCountry: string
    arrivalCountry: string
    languages: string[]
    groupSize: string[]
    adultAge: number
    childAgeMin: number
    childAgeMax: number
    infantAge: number
    status: 'active' | 'inactive' | 'draft'
    tourDepartureTimes?: string[]
    tags?: string[]
  }
  productDetails: {
    [languageCode: string]: {
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
      notice_info: string
      private_tour_info: string
      cancellation_policy: string
      chat_announcement: string
      tags: string[]
    }
  }
  currentLanguage: string
}

export default function ProductPreviewSidebar({
  isOpen,
  onClose,
  productData,
  productDetails,
  currentLanguage
}: ProductPreviewSidebarProps) {
  const [activeTab, setActiveTab] = useState<'card' | 'detail'>('card')

  if (!isOpen) return null

  const currentDetails = productDetails[currentLanguage] || productDetails['ko'] || {
    slogan1: '',
    slogan2: '',
    slogan3: '',
    description: '',
    included: '',
    not_included: '',
    pickup_drop_info: '',
    luggage_info: '',
    tour_operation_info: '',
    preparation_info: '',
    small_group_info: '',
    notice_info: '',
    private_tour_info: '',
    cancellation_policy: '',
    chat_announcement: '',
    tags: []
  }

  const displayName = productData.customerNameKo || productData.name
  const displayDescription = currentDetails.description || productData.description

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* 사이드바 */}
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">고객 페이지 미리보기</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 핸드폰 화면 */}
        <div className="p-4">
          <div className="mx-auto w-80 rounded-3xl bg-gray-900 p-2 shadow-2xl">
            <div className="h-[600px] overflow-hidden rounded-2xl bg-white">
              {/* 핸드폰 상단바 */}
              <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                </div>
                <Smartphone className="h-4 w-4 text-gray-600" />
                <div className="text-xs text-gray-600">100%</div>
              </div>

              {/* 탭 헤더 */}
              <div className="border-b border-gray-200 bg-white">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('card')}
                    className={`flex-1 py-3 text-sm font-medium ${
                      activeTab === 'card'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    카드뷰
                  </button>
                  <button
                    onClick={() => setActiveTab('detail')}
                    className={`flex-1 py-3 text-sm font-medium ${
                      activeTab === 'detail'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    상세뷰
                  </button>
                </div>
              </div>

              {/* 콘텐츠 영역 */}
              <div className="h-[520px] overflow-y-auto bg-gray-50">
                {activeTab === 'card' ? (
                  <CardViewPreview 
                    productData={productData}
                    currentDetails={currentDetails}
                    displayName={displayName}
                    displayDescription={displayDescription}
                  />
                ) : (
                  <DetailViewPreview 
                    productData={productData}
                    currentDetails={currentDetails}
                    displayName={displayName}
                    displayDescription={displayDescription}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 카드뷰 미리보기 컴포넌트
function CardViewPreview({ 
  productData, 
  currentDetails, 
  displayName, 
  displayDescription 
}: {
  productData: ProductPreviewSidebarProps['productData']
  currentDetails: ProductPreviewSidebarProps['productDetails'][string]
  displayName: string
  displayDescription: string
}) {
  return (
    <div className="p-4">
      {/* 상품 카드 */}
      <div className="rounded-lg bg-white shadow-sm">
        {/* 이미지 영역 */}
        <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 rounded-t-lg flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-2xl mb-2">📸</div>
            <div className="text-sm">상품 이미지</div>
          </div>
        </div>

        {/* 카드 내용 */}
        <div className="p-4">
          {/* 슬로건 */}
          {currentDetails.slogan1 && (
            <div className="text-xs text-blue-600 font-medium mb-1">
              {currentDetails.slogan1}
            </div>
          )}
          
          {/* 상품명 */}
          <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
            {displayName}
          </h3>

          {/* 설명 */}
          <p className="text-sm text-gray-600 mb-3 line-clamp-3">
            {displayDescription}
          </p>

          {/* 태그 */}
          {currentDetails.tags && currentDetails.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {currentDetails.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  #{tag}
                </span>
              ))}
              {currentDetails.tags.length > 3 && (
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{currentDetails.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* 기본 정보 */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="w-16 text-gray-500">소요시간</span>
              <span>{productData.duration}시간</span>
            </div>
            <div className="flex items-center">
              <span className="w-16 text-gray-500">최대인원</span>
              <span>{productData.maxParticipants}명</span>
            </div>
            <div className="flex items-center">
              <span className="w-16 text-gray-500">출발지</span>
              <span>{productData.departureCity}</span>
            </div>
          </div>

          {/* 가격 및 예약 버튼 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-blue-600">
                ₩0부터
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                예약하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 상세뷰 미리보기 컴포넌트
function DetailViewPreview({ 
  productData, 
  currentDetails, 
  displayName, 
  displayDescription 
}: {
  productData: ProductPreviewSidebarProps['productData']
  currentDetails: ProductPreviewSidebarProps['productDetails'][string]
  displayName: string
  displayDescription: string
}) {
  return (
    <div className="p-4">
      {/* 상품 헤더 */}
      <div className="mb-4">
        {/* 슬로건 */}
        {currentDetails.slogan1 && (
          <div className="text-sm text-blue-600 font-medium mb-2">
            {currentDetails.slogan1}
          </div>
        )}
        
        {/* 상품명 */}
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {displayName}
        </h1>

        {/* 태그 */}
        {currentDetails.tags && currentDetails.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {currentDetails.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 상품 설명 */}
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">상품 소개</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {displayDescription}
        </p>
      </div>

      {/* 기본 정보 */}
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">투어 정보</h2>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">소요시간</span>
            <span className="font-medium">{productData.duration}시간</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">최대인원</span>
            <span className="font-medium">{productData.maxParticipants}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">출발지</span>
            <span className="font-medium">{productData.departureCity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">도착지</span>
            <span className="font-medium">{productData.arrivalCity}</span>
          </div>
        </div>
      </div>

      {/* 포함/불포함 */}
      {(currentDetails.included || currentDetails.not_included) && (
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">포함/불포함 사항</h2>
          <div className="space-y-3">
            {currentDetails.included && (
              <div>
                <h3 className="text-sm font-medium text-green-700 mb-1">포함 사항</h3>
                <p className="text-sm text-gray-700">{currentDetails.included}</p>
              </div>
            )}
            {currentDetails.not_included && (
              <div>
                <h3 className="text-sm font-medium text-red-700 mb-1">불포함 사항</h3>
                <p className="text-sm text-gray-700">{currentDetails.not_included}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 예약 버튼 */}
      <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200">
        <button className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
          지금 예약하기
        </button>
      </div>
    </div>
  )
}
