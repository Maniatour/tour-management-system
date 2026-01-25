'use client'

import React, { useState } from 'react'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
}

interface SavedConfig {
  id: string
  name: string
  customer_id: string | null
  created_at: string
}

interface SaveConfigModalProps {
  isOpen: boolean
  configName: string
  onConfigNameChange: (name: string) => void
  selectedCustomer: Customer | null
  savedConfigs: SavedConfig[]
  allCustomers: Customer[]
  onSave: (editingConfigId?: string) => void
  onClose: () => void
  locale?: string
}

const SaveConfigModal: React.FC<SaveConfigModalProps> = ({
  isOpen,
  configName,
  onConfigNameChange,
  selectedCustomer,
  savedConfigs,
  allCustomers,
  onSave,
  onClose,
  locale = 'ko'
}) => {
  const [editingConfig, setEditingConfig] = useState<SavedConfig | null>(null)

  if (!isOpen) return null

  // 현재 고객과 일치하는 설정만 필터링
  const matchingConfigs = savedConfigs.filter(config => 
    config.customer_id === selectedCustomer?.id || (!config.customer_id && !selectedCustomer)
  )

  const handleConfigSelect = (config: SavedConfig | null) => {
    setEditingConfig(config)
    if (config) {
      onConfigNameChange(config.name)
    } else {
      onConfigNameChange('')
    }
  }

  const handleSave = () => {
    onSave(editingConfig?.id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{locale === 'ko' ? '설정 저장' : 'Save Configuration'}</h2>
        
        {/* 기존 설정 목록 */}
        {matchingConfigs.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {locale === 'ko' ? '기존 설정 덮어쓰기 (선택사항)' : 'Overwrite Existing Configuration (Optional)'}
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              <div
                onClick={() => handleConfigSelect(null)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  !editingConfig
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="font-medium text-sm">
                  {locale === 'ko' ? '+ 새 설정으로 저장' : '+ Save as New Configuration'}
                </div>
              </div>
              {matchingConfigs.map((config) => {
                const customer = config.customer_id 
                  ? allCustomers.find(c => c.id === config.customer_id)
                  : null
                return (
                  <div
                    key={config.id}
                    onClick={() => handleConfigSelect(config)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      editingConfig?.id === config.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm">{config.name}</div>
                    {customer && (
                      <div className="text-xs text-gray-600 mt-1">
                        {locale === 'ko' ? '고객:' : 'Customer:'} {customer.name}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(config.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {locale === 'ko' ? '설정 이름' : 'Configuration Name'}
          </label>
          <input
            type="text"
            value={configName}
            onChange={(e) => {
              onConfigNameChange(e.target.value)
              if (editingConfig && e.target.value !== editingConfig.name) {
                setEditingConfig(null)
              }
            }}
            placeholder={locale === 'ko' ? '예: 라스베가스 3일 투어' : 'e.g., Las Vegas 3-Day Tour'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              }
            }}
          />
          {editingConfig && (
            <p className="mt-1 text-xs text-blue-600">
              {locale === 'ko' ? '기존 설정을 덮어씁니다.' : 'Will overwrite existing configuration.'}
            </p>
          )}
        </div>
        {selectedCustomer && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">{locale === 'ko' ? '고객:' : 'Customer:'}</div>
            <div className="font-medium">{selectedCustomer.name}</div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {editingConfig 
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

export default SaveConfigModal
