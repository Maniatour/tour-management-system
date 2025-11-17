'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

interface Channel {
  id: string
  name: string
  type: string
  website?: string
  website_url?: string
  customer_website?: string
  admin_website?: string
  commission_rate?: number
  commission_percent?: number
  commission?: number
  is_active: boolean
  description?: string
  favicon_url?: string
  manager_name?: string
  manager_contact?: string
  contract_url?: string
    commission_base_price_only?: boolean
    pricing_type?: 'separate' | 'single'
  created_at: string
}

interface ChannelFormProps {
  channel?: Channel | null
  onSubmit: (channel: Omit<Channel, 'id' | 'created_at'>) => void
  onCancel: () => void
  onDelete?: () => void
  onManageProducts?: () => void
}

export function ChannelForm({ channel, onSubmit, onCancel, onDelete, onManageProducts }: ChannelFormProps) {
  const t = useTranslations('channels')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    name: channel?.name || '',
    type: channel?.type || '',
    website: channel?.website || (channel as any)?.website_url || '',
    customer_website: channel?.customer_website || '',
    admin_website: channel?.admin_website || '',
    commission_rate: channel?.commission_rate || (channel as any)?.commission_percent || (channel as any)?.commission || 0,
    is_active: channel?.is_active || false,
    description: channel?.description || '',
    favicon_url: channel?.favicon_url || '',
    manager_name: channel?.manager_name || '',
    manager_contact: channel?.manager_contact || '',
    contract_url: channel?.contract_url || '',
    commission_base_price_only: (channel as any)?.commission_base_price_only || false,
    pricing_type: (channel as any)?.pricing_type || 'separate'
  })

  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [uploadingContract, setUploadingContract] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const contractInputRef = React.useRef<HTMLInputElement | null>(null)

  // 채널 데이터가 변경될 때 formData 업데이트
  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name || '',
        type: channel.type || '',
        website: channel.website || (channel as any)?.website_url || '',
        customer_website: channel.customer_website || '',
        admin_website: channel.admin_website || '',
        commission_rate: channel.commission_rate || (channel as any)?.commission_percent || (channel as any)?.commission || 0,
        is_active: channel.is_active || false,
        description: channel.description || '',
        favicon_url: channel.favicon_url || '',
        manager_name: channel.manager_name || '',
        manager_contact: channel.manager_contact || '',
        contract_url: channel.contract_url || '',
        commission_base_price_only: (channel as any)?.commission_base_price_only || false,
        pricing_type: (channel as any)?.pricing_type || 'separate'
      })
    }
  }, [channel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('ChannelForm submitting:', formData)
    console.log('ChannelForm onSubmit function:', onSubmit)
    console.log('ChannelForm channel prop:', channel)
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {channel ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 첫 번째 줄: 채널명, 타입 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.type')}</label>
              <select
                value={formData.type || ''}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('form.selectType')}</option>
                <option value="self">Self</option>
                <option value="ota">OTA</option>
                <option value="partner">Partner</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.customerWebsite')}</label>
            <input
              type="url"
              value={formData.customer_website || ''}
              onChange={(e) => setFormData({ ...formData, customer_website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.adminWebsite')}</label>
            <input
              type="url"
              value={formData.admin_website || ''}
              onChange={(e) => setFormData({ ...formData, admin_website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://admin.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.favicon')}</label>
            <div className="flex items-center space-x-3">
              {formData.favicon_url ? (
                <Image src={formData.favicon_url} alt="favicon preview" width={32} height={32} className="w-8 h-8 rounded" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">-</div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    setUploadingFavicon(true)
                    const fileExt = file.name.split('.').pop()
                    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
                    const filePath = `channels/${fileName}`
                    const { error: uploadError } = await supabase.storage
                      .from('channel-icons')
                      .upload(filePath, file)
                    if (uploadError) throw uploadError
                    const { data: urlData } = supabase.storage
                      .from('channel-icons')
                      .getPublicUrl(filePath)
                    setFormData({ ...formData, favicon_url: urlData.publicUrl })
                  } catch (err) {
                    console.error('Error uploading favicon:', err)
                    alert('파비콘 업로드 중 오류가 발생했습니다.')
                  } finally {
                    setUploadingFavicon(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }
                }}
                className="flex-1 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">{t('form.faviconHelp')}</p>
            {uploadingFavicon && (
              <div className="mt-1 text-xs text-gray-500">업로드 중...</div>
            )}
          </div>
          {/* 두 번째 줄: 수수료율, 상태 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.commission')} (%)</label>
              <input
                type="number"
                value={formData.commission_rate || ''}
                onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
              <select
                value={formData.is_active ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="true">{t('status.active')}</option>
                <option value="false">{t('status.inactive')}</option>
              </select>
            </div>
          </div>
          {/* 가격 타입 설정 */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">가격 타입 설정</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">가격 판매 방식</label>
              <select
                value={formData.pricing_type}
                onChange={(e) => setFormData({ ...formData, pricing_type: e.target.value as 'separate' | 'single' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="separate">성인/아동/유아 가격 분리 판매</option>
                <option value="single">단일 가격 판매</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.pricing_type === 'separate' 
                  ? '성인, 아동, 유아 가격을 각각 입력하고 계산합니다.'
                  : '모든 인원에 대해 동일한 단일 가격을 사용합니다.'}
              </p>
            </div>
          </div>
          
          {/* 수수료/쿠폰 할인 적용 방식 */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="commission_base_price_only"
                checked={formData.commission_base_price_only || false}
                onChange={(e) => setFormData({ ...formData, commission_base_price_only: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="commission_base_price_only" className="text-sm font-medium text-gray-700">
                판매가격에만 커미션 & 쿠폰 적용
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500 ml-6">
              체크 시: 판매가격(기본 가격)에만 커미션 및 쿠폰 할인 적용, 초이스 가격과 불포함 금액은 커미션/쿠폰에서 제외되어 밸런스로 처리되어 현금 수금
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.description')}</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* 담당자 정보 섹션 */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">담당자 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.managerName')}</label>
                <input
                  type="text"
                  value={formData.manager_name || ''}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="담당자 이름을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.managerContact')}</label>
                <input
                  type="text"
                  value={formData.manager_contact || ''}
                  onChange={(e) => setFormData({ ...formData, manager_contact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="전화번호 또는 이메일을 입력하세요"
                />
              </div>
            </div>
          </div>
          
          {/* 계약서 업로드 섹션 */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">계약서</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.contractUpload')}</label>
              <div className="flex items-center space-x-3">
                {formData.contract_url ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                    <a 
                      href={formData.contract_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      {t('form.contractView')}
                    </a>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">-</div>
                )}
                <input
                  ref={contractInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setUploadingContract(true)
                      const fileExt = file.name.split('.').pop()
                      const fileName = `contract-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
                      const filePath = `contracts/${fileName}`
                      const { error: uploadError } = await supabase.storage
                        .from('channel-contracts')
                        .upload(filePath, file)
                      if (uploadError) throw uploadError
                      const { data: urlData } = supabase.storage
                        .from('channel-contracts')
                        .getPublicUrl(filePath)
                      setFormData({ ...formData, contract_url: urlData.publicUrl })
                    } catch (err) {
                      console.error('Error uploading contract:', err)
                      alert('계약서 업로드 중 오류가 발생했습니다.')
                    } finally {
                      setUploadingContract(false)
                      if (contractInputRef.current) contractInputRef.current.value = ''
                    }
                  }}
                  className="flex-1 text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX, TXT 파일만 업로드 가능합니다</p>
              {uploadingContract && (
                <div className="mt-1 text-xs text-gray-500">업로드 중...</div>
              )}
            </div>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {channel ? tCommon('save') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              {tCommon('cancel')}
            </button>
            {/* 편집 모드일 때만 상품 관리 및 삭제 버튼 표시 */}
            {channel && (
              <>
                {onManageProducts && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      onManageProducts()
                    }}
                    className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span>상품 관리</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      if (confirm('정말 이 채널을 삭제하시겠습니까?')) {
                        onDelete()
                        onCancel()
                      }
                    }}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>삭제</span>
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

