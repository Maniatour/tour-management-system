'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

interface CustomerFormProps {
  customer?: Customer | null
  channels: Array<{id: string, name: string, type: string | null}>
  onSubmit: (customerData: CustomerInsert) => void
  onCancel: () => void
  onDelete?: () => void
}

export default function CustomerForm({ 
  customer, 
  channels, 
  onSubmit, 
  onCancel, 
  onDelete 
}: CustomerFormProps) {
  // 랜덤 ID 생성 함수 (useCallback으로 메모이제이션)
  const generateRandomId = useCallback(() => {
    const timestamp = Date.now().toString(36)
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `CUST_${timestamp}_${randomStr}`.toUpperCase()
  }, [])

  // useMemo로 기본 formData를 customer prop에 따라 계산
  const defaultFormData = useMemo<CustomerInsert>(() => {
    if (customer) {
      // 언어 필드 디버깅 및 수정 (text 타입으로 변경됨)
      let languageValue = '' // 기본값을 빈 문자열로 변경하여 "언어 선택" 옵션에 매핑
      
      if (typeof customer.language === 'string') {
        if (customer.language === 'EN' || customer.language === 'en' || customer.language === '영어') {
          languageValue = 'EN'
        } else if (customer.language === 'KR' || customer.language === 'ko' || customer.language === '한국어') {
          languageValue = 'KR'
        } else {
          languageValue = '' // 알 수 없는 언어는 빈 문자열로
        }
      } else {
        languageValue = '' // null/undefined 등은 빈 문자열로
      }
      
      const newFormData = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        emergency_contact: customer.emergency_contact,
        email: customer.email,
        address: customer.address,
        language: languageValue,
        special_requests: customer.special_requests,
        booking_count: customer.booking_count || 0,
        channel_id: customer.channel_id,
        status: customer.status || 'active'
      }
      return newFormData
    } else {
      // 새 고객 추가 모드일 때 기본값
      const defaultFormData = {
        id: generateRandomId(),
        name: '',
        phone: '',
        emergency_contact: '',
        email: '',
        address: '',
        language: 'KR',
        special_requests: '',
        booking_count: 0,
        channel_id: '',
        status: 'active'
      }
      return defaultFormData
    }
  }, [customer, generateRandomId])

  // useState로 formData 상태 관리
  const [formData, setFormData] = useState<CustomerInsert>(defaultFormData)
  const [selectedChannelType, setSelectedChannelType] = useState<'ota' | 'self' | 'partner'>('ota')

  // defaultFormData가 변경될 때 formData 업데이트
  useEffect(() => {
    setFormData(defaultFormData)
  }, [defaultFormData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 필드 검증
    if (!formData.name) {
      alert('이름은 필수 입력 항목입니다.')
      return
    }

    // 이메일 형식 검증 (이메일이 입력된 경우에만)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        alert('올바른 이메일 형식을 입력해주세요.')
        return
      }
    }

    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold">
              {customer ? '고객 정보 수정' : '새 고객 추가'}
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              ID: {formData.id}
            </span>
          </div>
          
          {/* 상태 온오프 스위치 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">상태</span>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData, 
                status: formData.status === 'active' ? 'inactive' : 'active'
              })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                formData.status === 'active' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${
              formData.status === 'active' ? 'text-blue-600' : 'text-gray-500'
            }`}>
              {formData.status === 'active' ? '활성' : '비활성'}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 첫 번째와 두 번째 줄: 3열 그리드로 구성 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 왼쪽 열: 이름, 전화번호 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="고객 이름"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="전화번호 (선택사항)"
                />
              </div>
            </div>
            
            {/* 중간 열: 언어, 비상연락처 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  언어
                </label>
                <select
                  value={(() => {
                    // 언어 필드 처리 (배열 형태 방지)
                    if (Array.isArray(formData.language)) {
                      // 배열인 경우 첫 번째 값만 사용하고 문자열로 변환
                      const firstLang = formData.language[0]
                      if (firstLang === 'KR' || firstLang === 'ko' || firstLang === '한국어') {
                        return 'KR'
                      }
                      if (firstLang === 'EN' || firstLang === 'en' || firstLang === '영어') {
                        return 'EN'
                      }
                      return ''
                    }
                    if (typeof formData.language === 'string') {
                      if (formData.language === 'KR' || formData.language === 'ko' || formData.language === '한국어') {
                        return 'KR'
                      }
                      if (formData.language === 'EN' || formData.language === 'en' || formData.language === '영어') {
                        return 'EN'
                      }
                      return ''
                    }
                    return ''
                  })()}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">🌐 언어 선택</option>
                  <option value="KR">🇰🇷 한국어</option>
                  <option value="EN">🇺🇸 English</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비상연락처
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact || ''}
                  onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="비상연락처 (선택사항)"
                />
              </div>
            </div>
            
            {/* 오른쪽 열: 채널 (2줄 차지) */}
            <div className="row-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                채널
              </label>
              {/* 채널 타입별 탭과 선택 드롭다운을 하나의 박스로 통합 */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* 탭 헤더 */}
                <div className="flex bg-gray-50">
                  {['ota', 'self', 'partner'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedChannelType(type as 'ota' | 'self' | 'partner')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        selectedChannelType === type
                          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      {type === 'ota' ? 'OTA' : type === 'self' ? '직접' : '파트너'}
                    </button>
                  ))}
                </div>
                
                {/* 탭 내용 - 채널 선택 드롭다운 */}
                <div className="p-3 bg-white">
                  <select
                    value={formData.channel_id || ''}
                    onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">채널 선택</option>
                    {channels
                      .filter(channel => channel.type === selectedChannelType)
                      .map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 세 번째 줄: 이메일 | 주소 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이메일 (선택사항)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="주소 (선택사항)"
              />
            </div>
          </div>

          {/* 특별요청 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              특별요청
            </label>
            <textarea
              value={formData.special_requests || ''}
              onChange={(e) => setFormData({...formData, special_requests: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="특별한 요청사항이 있다면 입력해주세요"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-between pt-4 border-t">
            {/* 삭제 버튼 (수정 모드일 때만) */}
            {customer && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말로 이 고객을 삭제하시겠습니까?')) {
                    onDelete()
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <span>삭제</span>
              </button>
            )}
            
            {/* 취소/저장 버튼 */}
            <div className="flex space-x-3 ml-auto">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {customer ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
