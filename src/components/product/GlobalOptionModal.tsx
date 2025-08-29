'use client'

import React from 'react'
import { X } from 'lucide-react'
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
            <div className="text-sm text-gray-600 mb-4">
              아래 옵션 중에서 이 상품에 추가할 옵션을 선택하세요.
              선택한 옵션은 자동으로 상품 옵션에 추가되며, 필요에 따라 수정할 수 있습니다.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {globalOptions.map((option) => (
                <div
                  key={option.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onSelectOption(option)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{option.name}</h4>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      option.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {option.status === 'active' ? '활성' : '비활성'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{option.description}</p>
                  
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>카테고리:</span>
                      <span className="font-medium">{option.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>성인 가격:</span>
                      <span className="font-medium">${option.adultPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>아동 가격:</span>
                      <span className="font-medium">${option.childPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>유아 가격:</span>
                      <span className="font-medium">${option.infantPrice}</span>
                    </div>
                  </div>
                  
                  {option.tags && option.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {option.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
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
              ))}
            </div>
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
