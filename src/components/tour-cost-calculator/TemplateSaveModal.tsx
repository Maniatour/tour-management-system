'use client'

import React from 'react'

interface Template {
  id?: string
  name: string
  selectedCourses: string[]
  order: any[]
  created_at?: string
  updated_at?: string
}

interface TemplateSaveModalProps {
  isOpen: boolean
  editingTemplate: Template | null
  saveConfigName: string
  onSaveConfigNameChange: (name: string) => void
  savedConfigurations: Template[]
  selectedCoursesCount: number
  selectedCoursesOrderCount: number
  onSelectTemplate: (template: Template | null) => void
  onSave: () => void
  onClose: () => void
  locale?: string
}

const TemplateSaveModal: React.FC<TemplateSaveModalProps> = ({
  isOpen,
  editingTemplate,
  saveConfigName,
  onSaveConfigNameChange,
  savedConfigurations,
  selectedCoursesCount,
  selectedCoursesOrderCount,
  onSelectTemplate,
  onSave,
  onClose,
  locale = 'ko'
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-semibold mb-4">
          {editingTemplate 
            ? (locale === 'ko' ? '템플릿 수정' : 'Edit Template')
            : (locale === 'ko' ? '템플릿 저장' : 'Save Template')
          }
        </h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {locale === 'ko' ? '기존 템플릿 덮어쓰기 (선택사항)' : 'Overwrite Existing Template (Optional)'}
          </label>
          <select
            value={editingTemplate?.id || ''}
            onChange={(e) => {
              const selectedId = e.target.value
              if (selectedId) {
                const template = savedConfigurations.find(t => t.id === selectedId)
                if (template) {
                  onSelectTemplate(template)
                }
              } else {
                onSelectTemplate(null)
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
          >
            <option value="">{locale === 'ko' ? '새 템플릿 만들기' : 'Create New Template'}</option>
            {savedConfigurations.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {locale === 'ko' ? '템플릿 제목 *' : 'Template Title *'}
          </label>
          <input
            type="text"
            value={saveConfigName}
            onChange={(e) => onSaveConfigNameChange(e.target.value)}
            placeholder={locale === 'ko' ? '예: 그랜드캐년 투어, 라스베가스 시내 투어' : 'e.g., Grand Canyon Tour, Las Vegas City Tour'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onSave()
              }
            }}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            {editingTemplate 
              ? (locale === 'ko' 
                  ? '기존 템플릿을 덮어씁니다. 현재 선택된 투어 코스와 순서로 업데이트됩니다.'
                  : 'This will overwrite the existing template. It will be updated with the currently selected tour courses and order.')
              : (locale === 'ko'
                  ? '템플릿 제목을 입력하여 현재 선택된 투어 코스와 순서를 저장합니다.'
                  : 'Enter a template title to save the currently selected tour courses and order.')
            }
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm text-blue-900">
            <div className="font-medium mb-1">{locale === 'ko' ? '저장할 내용:' : 'Content to Save:'}</div>
            <div className="text-blue-700">
              • {locale === 'ko' ? '선택된 코스:' : 'Selected Courses:'} <span className="font-semibold">{selectedCoursesCount}{locale === 'ko' ? '개' : ''}</span>
            </div>
            <div className="text-blue-700">
              • {locale === 'ko' ? '순서:' : 'Order:'} <span className="font-semibold">{selectedCoursesOrderCount}{locale === 'ko' ? '개' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {editingTemplate 
              ? (locale === 'ko' ? '덮어쓰기' : 'Overwrite')
              : (locale === 'ko' ? '저장' : 'Save')
            }
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TemplateSaveModal
