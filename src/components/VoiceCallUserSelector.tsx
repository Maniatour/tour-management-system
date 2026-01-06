'use client'

import { Phone, X, User } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'

interface VoiceCallUserSelectorProps {
  isOpen: boolean
  onClose: () => void
  users: Array<{
    id: string
    name: string
    name_ko?: string
    name_en?: string
    type: 'guide' | 'customer'
    email?: string
    position?: string
    language?: string
    languages?: string[]
  }>
  onSelectUser: (userId: string, userName: string) => void
  language?: 'ko' | 'en'
}

export default function VoiceCallUserSelector({
  isOpen,
  onClose,
  users,
  onSelectUser,
  language = 'ko'
}: VoiceCallUserSelectorProps) {
  if (!isOpen) return null

  const texts = {
    ko: {
      title: '통화할 사용자 선택',
      select: '선택',
      cancel: '취소',
      noUsers: '통화할 수 있는 사용자가 없습니다'
    },
    en: {
      title: 'Select User to Call',
      select: 'Select',
      cancel: 'Cancel',
      noUsers: 'No users available to call'
    }
  }

  const t = texts[language]

  // 언어 코드를 국기 코드로 변환하는 함수
  const getLanguageCountryCode = (lang: string): string => {
    const langUpper = lang.toUpperCase()
    if (langUpper === 'KR' || langUpper === 'KO' || langUpper === '한국어') return 'KR'
    if (langUpper === 'EN' || langUpper === 'US' || langUpper === '영어') return 'US'
    if (langUpper === 'JP' || langUpper === 'JA' || langUpper === '일본어') return 'JP'
    if (langUpper === 'CN' || langUpper === 'ZH' || langUpper === '중국어') return 'CN'
    if (langUpper === 'ES' || langUpper === '스페인어') return 'ES'
    if (langUpper === 'FR' || langUpper === '프랑스어') return 'FR'
    if (langUpper === 'DE' || langUpper === '독일어') return 'DE'
    if (langUpper === 'RU' || langUpper === '러시아어') return 'RU'
    return 'US' // 기본값
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 사용자 목록 */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>{t.noUsers}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                // 이름 표시 (언어에 따라)
                const displayName = user.language === 'ko' 
                  ? (user.name_ko || user.name_en || user.name)
                  : (user.name_en || user.name_ko || user.name)
                
                // 직책 표시
                const positionLabel = user.position || (user.type === 'guide' 
                  ? (language === 'ko' ? '가이드' : 'Guide')
                  : (language === 'ko' ? '고객' : 'Customer'))
                
                return (
                  <button
                    key={user.id}
                    onClick={async () => {
                      await onSelectUser(user.id, user.name)
                      // 통화가 성공적으로 시작된 경우에만 모달 닫기
                      // (에러가 발생하면 모달을 열어둬서 에러 메시지를 볼 수 있도록)
                      onClose()
                    }}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">{displayName}</p>
                        {user.languages && user.languages.length > 0 && (
                          <div className="flex gap-1">
                            {user.languages.map((lang, index) => (
                              <ReactCountryFlag
                                key={index}
                                countryCode={getLanguageCountryCode(lang)}
                                svg
                                style={{
                                  width: '16px',
                                  height: '12px',
                                  borderRadius: '2px'
                                }}
                                title={lang}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{positionLabel}</span>
                      </div>
                    </div>
                    <Phone className="w-5 h-5 text-green-600 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

