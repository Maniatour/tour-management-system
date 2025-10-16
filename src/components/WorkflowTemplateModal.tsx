'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  steps: any[]
  icon: React.ReactNode
  color: string
  isPopular?: boolean
}

interface WorkflowTemplateModalProps {
  onSelectTemplate: (template: WorkflowTemplate) => void
  onClose: () => void
}

export default function WorkflowTemplateModal({ onSelectTemplate, onClose }: WorkflowTemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">워크플로우 템플릿</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="템플릿 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">전체</option>
              <option value="고객 서비스">고객 서비스</option>
              <option value="상품 관리">상품 관리</option>
              <option value="예약 관리">예약 관리</option>
              <option value="기술 지원">기술 지원</option>
            </select>
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center py-12">
            <p className="text-gray-500">템플릿 기능이 준비 중입니다.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}