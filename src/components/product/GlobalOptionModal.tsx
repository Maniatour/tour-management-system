'use client'

import React, { useState, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import Link from 'next/link'

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
  imageUrl?: string
  imageAlt?: string
  thumbnailUrl?: string
  nameKo?: string
  nameEn?: string
  descriptionKo?: string
  descriptionEn?: string
}

interface GlobalOptionModalProps {
  show: boolean
  onClose: () => void
  globalOptions: GlobalOption[]
  loadingOptions: boolean
  locale: string
  onSelectOption: (option: GlobalOption) => void
}

export default function GlobalOptionModal({
  show,
  onClose,
  globalOptions,
  loadingOptions,
  locale,
  onSelectOption
}: GlobalOptionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // 검색 필터링
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return globalOptions
    }

    const searchLower = searchTerm.toLowerCase()
    return globalOptions.filter(option => {
      const nameMatch = option.name.toLowerCase().includes(searchLower)
      const descriptionMatch = option.description?.toLowerCase().includes(searchLower)
      const categoryMatch = option.category?.toLowerCase().includes(searchLower)
      const tagsMatch = option.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      
      return nameMatch || descriptionMatch || categoryMatch || tagsMatch
    })
  }, [globalOptions, searchTerm])

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">글로벌 옵션에서 상품 옵션 추가</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {loadingOptions ? (
          <div className="text-center py-8">
            <div className="text-gray-500">옵션을 불러오는 중...</div>
          </div>
        ) : globalOptions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">등록된 글로벌 옵션이 없습니다.</div>
            <Link
              href={`/${locale}/admin/options`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              옵션 관리 페이지에서 옵션을 등록해주세요
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 검색 입력 필드 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="옵션명, 설명, 카테고리, 태그로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 검색 결과 개수 */}
            {searchTerm && (
              <div className="text-sm text-gray-600">
                {filteredOptions.length}개의 옵션을 찾았습니다. (전체 {globalOptions.length}개)
              </div>
            )}

            <div className="text-sm text-gray-600 mb-4">
              아래 옵션 중에서 이 상품에 추가할 옵션을 선택하세요.
              선택한 옵션은 자동으로 상품 옵션에 추가되며, 필요에 따라 수정할 수 있습니다.
            </div>
            
            {filteredOptions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">검색 결과가 없습니다.</div>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  검색 초기화
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:border-purple-300 hover:shadow-md transition-all cursor-pointer bg-white"
                  onClick={() => onSelectOption(option)}
                >
                  {/* 이미지 섹션 */}
                  {(option.imageUrl || option.thumbnailUrl) && (
                    <div className="relative w-full bg-gray-100" style={{ aspectRatio: '16/9' }}>
                      <img
                        src={option.thumbnailUrl || option.imageUrl}
                        alt={option.imageAlt || option.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{option.name}</h4>
                        {option.nameKo && (
                          <p className="text-xs text-gray-600 mt-1">{option.nameKo}</p>
                        )}
                        {option.nameEn && (
                          <p className="text-xs text-gray-500 mt-0.5">{option.nameEn}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                        option.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {option.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </div>
                    
                    {(option.description || option.descriptionKo || option.descriptionEn) && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {option.descriptionKo || option.descriptionEn || option.description}
                      </p>
                    )}
                    
                    <div className="space-y-1 text-xs text-gray-500 mb-3">
                      <div className="flex justify-between">
                        <span>카테고리:</span>
                        <span className="font-medium">{option.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>성인 가격:</span>
                        <span className="font-medium">${option.adultPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>아동 가격:</span>
                        <span className="font-medium">${option.childPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>유아 가격:</span>
                        <span className="font-medium">${option.infantPrice.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {option.tags && option.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1 mb-3">
                        {option.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                        {option.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{option.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectOption(option)
                        }}
                        className="w-full bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 text-sm"
                      >
                        이 옵션 추가
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
