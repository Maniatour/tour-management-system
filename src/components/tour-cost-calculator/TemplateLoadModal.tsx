'use client'

import React from 'react'
import { Settings } from 'lucide-react'

interface Template {
  id?: string
  name: string
  selectedCourses: string[]
  order: any[]
  created_at?: string
  updated_at?: string
}

interface TemplateLoadModalProps {
  isOpen: boolean
  loadingTemplates: boolean
  savedConfigurations: Template[]
  onLoad: (template: Template) => void
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
  onRefresh: () => void
  onClose: () => void
  locale?: string
}

const TemplateLoadModal: React.FC<TemplateLoadModalProps> = ({
  isOpen,
  loadingTemplates,
  savedConfigurations,
  onLoad,
  onEdit,
  onDelete,
  onRefresh,
  onClose,
  locale = 'ko'
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h3 className="text-xl font-semibold mb-4">
          {locale === 'ko' ? '템플릿 관리' : 'Template Management'}
        </h3>
        {loadingTemplates ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-500">
              {locale === 'ko' ? '템플릿을 불러오는 중...' : 'Loading templates...'}
            </p>
          </div>
        ) : savedConfigurations.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {locale === 'ko' ? '저장된 템플릿이 없습니다.' : 'No saved templates.'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {locale === 'ko' 
                ? '템플릿 저장 버튼을 눌러 템플릿을 만들어보세요.'
                : 'Click the save template button to create a template.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
            {savedConfigurations.map((template) => (
              <div
                key={template.id || template.name}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{template.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {locale === 'ko' ? '코스' : 'Courses'} {template.selectedCourses.length}{locale === 'ko' ? '개' : ''} • {locale === 'ko' ? '순서' : 'Order'} {template.order.length}{locale === 'ko' ? '개' : ''}
                  </div>
                  {template.created_at && (
                    <div className="text-xs text-gray-400 mt-1">
                      {locale === 'ko' ? '생성:' : 'Created:'} {new Date(template.created_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {template.updated_at && template.updated_at !== template.created_at && (
                        <span className="ml-2">
                          • {locale === 'ko' ? '수정:' : 'Updated:'} {new Date(template.updated_at).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => onLoad(template)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                    title={locale === 'ko' ? '템플릿 불러오기' : 'Load Template'}
                  >
                    {locale === 'ko' ? '불러오기' : 'Load'}
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
                    title={locale === 'ko' ? '템플릿 수정' : 'Edit Template'}
                  >
                    {locale === 'ko' ? '수정' : 'Edit'}
                  </button>
                  <button
                    onClick={() => onDelete(template)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
                    title={locale === 'ko' ? '템플릿 삭제' : 'Delete Template'}
                  >
                    {locale === 'ko' ? '삭제' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '닫기' : 'Close'}
          </button>
          {!loadingTemplates && savedConfigurations.length > 0 && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
              title={locale === 'ko' ? '템플릿 목록 새로고침' : 'Refresh Template List'}
            >
              {locale === 'ko' ? '새로고침' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TemplateLoadModal
