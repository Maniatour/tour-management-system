'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { Database } from '@/lib/supabase'
import { generateCustomerId } from '@/lib/entityIds'
import { stripSpacesFromContactInput } from '@/lib/contactInputUtils'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

interface CustomerFormProps {
  customer?: Customer | null
  channels: Array<{ id: string; name: string; type: string | null }>
  onSubmit: (customerData: CustomerInsert) => void
  onCancel: () => void
  onDelete?: () => void
  /** 분할 모달 등 외부 레이아웃에 삽입할 때 오버레이 없이 본문만 렌더 */
  embedded?: boolean
}

const INPUT_CLASS =
  'w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15'
const LABEL_CLASS = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500'
const SECTION_TITLE_CLASS = 'text-xs font-semibold text-gray-900'

function normalizeLanguageValue(raw: CustomerInsert['language']): string {
  if (Array.isArray(raw)) {
    const firstLang = raw[0]
    if (firstLang === 'KR' || firstLang === 'ko' || firstLang === '한국어') return 'KR'
    if (firstLang === 'EN' || firstLang === 'en' || firstLang === '영어') return 'EN'
    return firstLang || ''
  }
  if (typeof raw === 'string') {
    if (raw === 'KR' || raw === 'ko' || raw === '한국어') return 'KR'
    if (raw === 'EN' || raw === 'en' || raw === '영어') return 'EN'
    return raw
  }
  return ''
}

function resolveChannelType(
  channelId: string | null | undefined,
  channels: CustomerFormProps['channels']
): 'ota' | 'self' | 'partner' {
  const ch = channels.find((c) => c.id === channelId)
  const t = ch?.type
  if (t === 'self' || t === 'partner' || t === 'ota') return t
  return 'ota'
}

export default function CustomerForm({
  customer,
  channels,
  onSubmit,
  onCancel,
  onDelete,
  embedded = false,
}: CustomerFormProps) {
  const defaultFormData = useMemo<CustomerInsert>(() => {
    if (customer) {
      let languageValue = ''
      if (typeof customer.language === 'string') {
        if (customer.language === 'EN' || customer.language === 'en' || customer.language === '영어') {
          languageValue = 'EN'
        } else if (customer.language === 'KR' || customer.language === 'ko' || customer.language === '한국어') {
          languageValue = 'KR'
        } else {
          languageValue = customer.language
        }
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: stripSpacesFromContactInput(customer.phone || ''),
        emergency_contact: customer.emergency_contact,
        email: stripSpacesFromContactInput(customer.email || ''),
        address: customer.address,
        language: languageValue,
        special_requests: customer.special_requests,
        booking_count: customer.booking_count || 0,
        channel_id: customer.channel_id,
        status: customer.status || 'active',
      }
    }

    return {
      id: generateCustomerId(),
      name: '',
      phone: '',
      emergency_contact: '',
      email: '',
      address: '',
      language: 'KR',
      special_requests: '',
      booking_count: 0,
      channel_id: '',
      status: 'active',
    }
  }, [customer])

  const [formData, setFormData] = useState<CustomerInsert>(defaultFormData)
  const [selectedChannelType, setSelectedChannelType] = useState<'ota' | 'self' | 'partner'>(() =>
    resolveChannelType(defaultFormData.channel_id, channels)
  )

  useEffect(() => {
    setFormData(defaultFormData)
    setSelectedChannelType(resolveChannelType(defaultFormData.channel_id, channels))
  }, [defaultFormData, channels])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      alert('이름은 필수 입력 항목입니다.')
      return
    }

    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        alert('올바른 이메일 형식을 입력해주세요.')
        return
      }
    }

    onSubmit(formData)
  }

  const languageValue = normalizeLanguageValue(formData.language)
  const filteredChannels = channels.filter((ch) => ch.type === selectedChannelType)

  const header = (
    <div className={embedded ? 'space-y-2' : 'mb-5 space-y-3'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-gray-900">
            {customer ? '고객 정보 수정' : '새 고객 추가'}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">{formData.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
          <span className="text-[11px] font-medium text-gray-600">상태</span>
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                status: formData.status === 'active' ? 'inactive' : 'active',
              })
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              formData.status === 'active' ? 'bg-primary' : 'bg-gray-300'
            }`}
            aria-label={formData.status === 'active' ? '활성' : '비활성'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                formData.status === 'active' ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span
            className={`text-[11px] font-medium ${
              formData.status === 'active' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            {formData.status === 'active' ? '활성' : '비활성'}
          </span>
        </div>
      </div>
    </div>
  )

  const fields = (
    <div className={embedded ? 'space-y-4' : 'space-y-5'}>
      <section className="space-y-2.5">
        <h3 className={SECTION_TITLE_CLASS}>기본 정보</h3>
        <div className={embedded ? 'space-y-2.5' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
          <div className={embedded ? '' : 'sm:col-span-2'}>
            <label className={LABEL_CLASS}>이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={INPUT_CLASS}
              placeholder="고객 이름"
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>언어</label>
            <select
              value={languageValue}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">언어 선택</option>
              <option value="KR">한국어</option>
              <option value="EN">English</option>
              <option value="JA">日本語</option>
              <option value="ZH">中文</option>
              <option value="ES">Español</option>
              <option value="FR">Français</option>
              <option value="DE">Deutsch</option>
              <option value="IT">Italiano</option>
              <option value="PT">Português</option>
              <option value="RU">Русский</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>채널</label>
            <div className="space-y-1.5">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {(['ota', 'self', 'partner'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedChannelType(type)}
                    className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      selectedChannelType === type
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {type === 'ota' ? 'OTA' : type === 'self' ? '직접' : '파트너'}
                  </button>
                ))}
              </div>
              <select
                value={formData.channel_id || ''}
                onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">채널 선택</option>
                {filteredChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h3 className={SECTION_TITLE_CLASS}>연락처</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS}>전화번호</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) =>
                setFormData({ ...formData, phone: stripSpacesFromContactInput(e.target.value) })
              }
              className={INPUT_CLASS}
              placeholder="전화번호"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>비상연락처</label>
            <input
              type="tel"
              value={formData.emergency_contact || ''}
              onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
              className={INPUT_CLASS}
              placeholder="비상연락처"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>이메일</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) =>
                setFormData({ ...formData, email: stripSpacesFromContactInput(e.target.value) })
              }
              className={INPUT_CLASS}
              placeholder="email@example.com"
            />
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h3 className={SECTION_TITLE_CLASS}>추가 정보</h3>
        <div className="space-y-2.5">
          <div>
            <label className={LABEL_CLASS}>주소</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={INPUT_CLASS}
              placeholder="주소"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>특별요청</label>
            <textarea
              value={formData.special_requests || ''}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={embedded ? 2 : 3}
              className={`${INPUT_CLASS} min-h-0 resize-y py-2`}
              placeholder="특별 요청사항"
            />
          </div>
        </div>
      </section>
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {customer && onDelete ? (
        <button
          type="button"
          onClick={() => {
            if (confirm('정말로 이 고객을 삭제하시겠습니까?')) {
              onDelete()
            }
          }}
          className="h-9 rounded-lg px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          삭제
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {customer ? '저장' : '추가'}
        </button>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 max-h-[45vh] flex-col bg-white lg:max-h-[90vh]">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3 sm:px-5">{header}</div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">{fields}</div>
          <div className="shrink-0 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">{footer}</div>
        </form>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
        {header}
        <form onSubmit={handleSubmit} className="space-y-5">
          {fields}
          <div className="border-t border-gray-100 pt-4">{footer}</div>
        </form>
      </div>
    </div>
  )
}
