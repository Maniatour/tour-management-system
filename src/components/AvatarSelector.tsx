'use client'

import { X, User } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AvatarSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (avatarUrl: string) => void
  currentAvatar?: string
  usedAvatars?: Set<string>
  language?: 'ko' | 'en'
}

// 기본 아바타 옵션들
const defaultAvatars = [
  { id: '1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=happy', name: 'Happy' },
  { id: '2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=smile', name: 'Smile' },
  { id: '3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wink', name: 'Wink' },
  { id: '4', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cool', name: 'Cool' },
  { id: '5', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=excited', name: 'Excited' },
  { id: '6', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=funny', name: 'Funny' },
  { id: '7', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gentle', name: 'Gentle' },
  { id: '8', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=playful', name: 'Playful' },
  { id: '9', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cheerful', name: 'Cheerful' },
  { id: '10', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=joyful', name: 'Joyful' },
  { id: '11', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kind', name: 'Kind' },
  { id: '12', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=friendly', name: 'Friendly' },
]

export default function AvatarSelector({
  isOpen,
  onClose,
  onSelect,
  currentAvatar,
  usedAvatars = new Set(),
  language = 'ko'
}: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar || defaultAvatars[0].url)

  useEffect(() => {
    if (currentAvatar) {
      setSelectedAvatar(currentAvatar)
    }
  }, [currentAvatar])

  if (!isOpen) return null

  const texts = {
    ko: {
      title: '아바타 선택',
      select: '선택',
      cancel: '취소',
      inUse: '사용 중',
      selectThis: '이 아바타 선택'
    },
    en: {
      title: 'Select Avatar',
      select: 'Select',
      cancel: 'Cancel',
      inUse: 'In Use',
      selectThis: 'Select this avatar'
    }
  }

  const t = texts[language]

  const handleSelect = () => {
    onSelect(selectedAvatar)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 아바타 그리드 */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-3">
            {defaultAvatars.map((avatar) => {
              const isUsed = usedAvatars.has(avatar.url) && avatar.url !== currentAvatar
              const isSelected = selectedAvatar === avatar.url
              
              return (
                <button
                  key={avatar.id}
                  onClick={() => {
                    if (!isUsed) {
                      setSelectedAvatar(avatar.url)
                    }
                  }}
                  disabled={isUsed}
                  className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                    isUsed
                      ? 'border-red-300 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  title={isUsed ? t.inUse : t.selectThis}
                >
                  <img
                    src={avatar.url}
                    alt={avatar.name}
                    className={`w-full h-full object-cover ${isUsed ? 'grayscale' : ''}`}
                  />
                  {isUsed && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-30 flex items-center justify-center">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                  {isSelected && !isUsed && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택된 아바타 미리보기 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="text-sm text-gray-600">{language === 'ko' ? '선택된 아바타:' : 'Selected Avatar:'}</div>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500">
              <img
                src={selectedAvatar}
                alt="Selected"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSelect}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t.select}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

