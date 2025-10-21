'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Channel {
  id: string
  name: string
  type: 'ota' | 'self' | 'partner'
}

interface ChannelSectionProps {
  formData: {
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    channelId: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  channels: Channel[]
  t: (key: string) => string
  layout?: 'modal' | 'page'
  onAccordionToggle?: (isExpanded: boolean) => void
}

export default function ChannelSection({
  formData,
  setFormData,
  channels,
  t,
  layout = 'modal',
  onAccordionToggle
}: ChannelSectionProps) {
  const [isExpanded, setIsExpanded] = useState(layout === 'modal')
  
  const handleToggle = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    if (onAccordionToggle) {
      onAccordionToggle(newExpanded)
    }
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-base font-semibold text-gray-900">{t('form.channel')}</label>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* 채널명 검색 - 아코디언이 펼쳐졌을 때만 표시 */}
      {isExpanded && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="채널명 검색..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            onChange={(e) => setFormData((prev: any) => ({ ...prev, channelSearch: e.target.value }))} // eslint-disable-line @typescript-eslint/no-explicit-any
          />
        </div>
      )}
      
      {/* 채널 선택 리스트 - 아코디언이 펼쳐졌을 때만 표시 */}
      {isExpanded && (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* 채널 타입별 탭 */}
        <div className="flex bg-gray-50">
          {['self', 'ota', 'partner'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData((prev: any) => ({ ...prev, selectedChannelType: type as 'ota' | 'self' | 'partner' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                formData.selectedChannelType === type
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {type === 'self' ? '자체채널' : type === 'ota' ? 'OTA' : '제휴사'}
            </button>
          ))}
        </div>
        
        {/* 채널 선택 리스트 */}
        <div className="h-[770px] overflow-y-auto">
          {channels
            .filter(channel => {
              const matchesType = channel.type === formData.selectedChannelType
              const matchesSearch = !formData.channelSearch || 
                channel.name?.toLowerCase().includes(formData.channelSearch.toLowerCase())
              return matchesType && matchesSearch
            })
            .map(channel => (
              <div
                key={channel.id}
                onClick={() => setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                  ...prev, 
                  channelId: prev.channelId === channel.id ? '' : channel.id 
                }))}
                className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  formData.channelId === channel.id ? 'bg-blue-500 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  {(channel as { favicon_url?: string }).favicon_url ? (
                    <img 
                      src={(channel as { favicon_url: string }).favicon_url} 
                      alt={`${channel.name} favicon`} 
                      className="h-4 w-4 rounded flex-shrink-0"
                      onError={(e) => {
                        // 파비콘 로드 실패 시 기본 아이콘으로 대체
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                          fallback.innerHTML = '🌐'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                      🌐
                    </div>
                  )}
                  <div className="text-sm text-gray-900">{channel.name}</div>
                </div>
              </div>
            ))}
        </div>
        </div>
      )}
      
      {/* 선택된 채널 정보 표시 */}
      {formData.channelId && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">선택된 채널</h4>
          {(() => {
            const selectedChannel = channels.find(c => c.id === formData.channelId)
            return selectedChannel ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {(selectedChannel as any).favicon_url ? (
                    <img 
                      src={(selectedChannel as any).favicon_url} 
                      alt={`${selectedChannel.name} favicon`} 
                      className="h-4 w-4 rounded flex-shrink-0"
                      onError={(e) => {
                        // 파비콘 로드 실패 시 기본 아이콘으로 대체
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                          fallback.innerHTML = '🌐'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                      🌐
                    </div>
                  )}
                  <div className="font-medium text-gray-900">{selectedChannel.name}</div>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedChannel.type === 'self' ? '자체채널' : 
                   selectedChannel.type === 'ota' ? 'OTA' : '제휴사'}
                </div>
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}
