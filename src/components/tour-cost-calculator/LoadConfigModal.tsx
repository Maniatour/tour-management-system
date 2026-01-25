'use client'

import React from 'react'

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

interface LoadConfigModalProps {
  isOpen: boolean
  savedConfigs: SavedConfig[]
  allCustomers: Customer[]
  onLoad: (configId: string) => void
  onClose: () => void
  locale?: string
}

const LoadConfigModal: React.FC<LoadConfigModalProps> = ({
  isOpen,
  savedConfigs,
  allCustomers,
  onLoad,
  onClose,
  locale = 'ko'
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{locale === 'ko' ? '설정 불러오기' : 'Load Configuration'}</h2>
        {savedConfigs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {locale === 'ko' ? '저장된 설정이 없습니다.' : 'No saved configurations.'}
          </div>
        ) : (
          <div className="space-y-2">
            {savedConfigs.map((config) => {
              const customer = config.customer_id 
                ? allCustomers.find(c => c.id === config.customer_id)
                : null
              return (
                <div
                  key={config.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => onLoad(config.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{config.name}</div>
                      {customer && (
                        <div className="text-sm text-gray-600 mt-1">
                          {locale === 'ko' ? '고객:' : 'Customer:'} {customer.name}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(config.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onLoad(config.id)
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {locale === 'ko' ? '불러오기' : 'Load'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '닫기' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoadConfigModal
