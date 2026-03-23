'use client'

import React, { useState, useEffect } from 'react'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { Plus, Search, Edit, Trash2, Globe, Package, Grid, List, ChevronDown, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { ChannelForm } from '@/components/channels/ChannelForm'

interface Channel {
  id: string
  name: string
  name_ko?: string
  type?: string
  description?: string
  website_url?: string
  website?: string
  contact_email?: string
  contact_phone?: string
  manager_name?: string
  manager_email?: string
  manager_phone?: string
  commission_rate?: number
  is_active: boolean
  favicon_url?: string
  created_at: string
  customer_website?: string
  admin_website?: string
  manager_contact?: string
  contract_url?: string
  commission_base_price_only?: boolean
  pricing_type?: 'separate' | 'single'
}

interface Product {
  id: string
  name: string
  category: string
  subCategory: string
  description: string
  basePrice: {
    adult: number
    child: number
    infant: number
  }
}

const CHANNELS_LIST_UI_DEFAULT = {
  searchTerm: '',
  activeTab: 'all',
  viewMode: 'card' as 'table' | 'card',
}

export default function AdminChannels() {
  const t = useTranslations('channels')
  
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // 채널별 상품 연결 정보 (channel_products 테이블에서 가져옴)
  const [channelProducts, setChannelProducts] = useState<Array<{ 
    id: string; 
    channelId: string; 
    productId: string; 
    is_active: boolean;
    variant_key?: string;
    variant_name_ko?: string;
    variant_name_en?: string;
  }>>([])

  const [listUi, setListUi] = useRoutePersistedState('channels-list', CHANNELS_LIST_UI_DEFAULT)
  const { searchTerm, activeTab, viewMode } = listUi
  const setSearchTerm = (v: string) => setListUi((prev) => ({ ...prev, searchTerm: v }))
  const setActiveTab = (v: string) => setListUi((prev) => ({ ...prev, activeTab: v }))
  const setViewMode = (v: 'table' | 'card') => setListUi((prev) => ({ ...prev, viewMode: v }))
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [showProductSelection, setShowProductSelection] = useState(false)
  const [selectedChannelForProducts, setSelectedChannelForProducts] = useState<Channel | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditData, setBulkEditData] = useState<Record<string, Partial<Channel>>>({})

  // Supabase에서 채널 데이터 가져오기
  useEffect(() => {
    fetchChannels()
    fetchProducts()
    fetchChannelProducts()
  }, [])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching channels:', error)
        return
      }

      // status 필드를 is_active boolean으로 변환, commission_percent를 commission_rate로 매핑
      // 불포함 금액 관련 필드도 포함
      const channelsWithStatus = (data || []).map((channel: any) => ({
        ...channel,
        is_active: channel.status === 'active' || channel.is_active === true,
        commission_rate: channel.commission_percent || channel.commission || channel.commission_rate || 0,
        website: channel.website || channel.website_url || '',
        pricing_type: channel.pricing_type || 'separate'
      }))

      setChannels(channelsWithStatus as Channel[])
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, category, sub_category, description, base_price, status')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        setProducts([])
        return
      }

      // 데이터베이스 구조를 컴포넌트에서 사용하는 Product 인터페이스로 변환
      const transformedProducts: Product[] = (data || []).map((product: any) => {
        // base_price가 JSON 문자열인 경우 파싱
        let basePrice = { adult: 0, child: 0, infant: 0 }
        if (product.base_price) {
          if (typeof product.base_price === 'string') {
            try {
              basePrice = JSON.parse(product.base_price)
            } catch (e) {
              console.warn('Failed to parse base_price for product:', product.id, e)
            }
          } else if (typeof product.base_price === 'object') {
            basePrice = {
              adult: product.base_price.adult || product.base_price.adult_price || 0,
              child: product.base_price.child || product.base_price.child_price || 0,
              infant: product.base_price.infant || product.base_price.infant_price || 0
            }
          }
        }

        return {
          id: product.id,
          name: product.name_ko || product.name || '',
          category: product.category || '',
          subCategory: product.sub_category || '',
          description: product.description || '',
          basePrice
        }
      })

      setProducts(transformedProducts)
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchChannelProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('channel_products')
        .select('id, channel_id, product_id, is_active, variant_key, variant_name_ko, variant_name_en')
        .eq('is_active', true)

      if (error) {
        console.error('Error fetching channel products:', error)
        setChannelProducts([])
        return
      }

      setChannelProducts((data || []).map((item: any) => ({
        id: item.id,
        channelId: item.channel_id,
        productId: item.product_id,
        is_active: item.is_active,
        variant_key: item.variant_key || 'default',
        variant_name_ko: item.variant_name_ko,
        variant_name_en: item.variant_name_en
      })))
    } catch (error) {
      console.error('Error fetching channel products:', error)
      setChannelProducts([])
    }
  }

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = 
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (channel.type?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (channel.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    
    const matchesTab = activeTab === 'all' || channel.type === activeTab
    
    return matchesSearch && matchesTab
  })

  const handleAddChannel = async (channel: Omit<Channel, 'id' | 'created_at'>) => {
    try {
      // commission_rate를 commission_percent로 매핑, is_active를 status로 매핑, website 필드 사용
      const channelData: any = {
        name: channel.name,
        type: channel.type,
        website: channel.website || (channel as any).website_url || '',
        customer_website: channel.customer_website || '',
        admin_website: channel.admin_website || '',
        commission_percent: (channel as any).commission_rate || 0,
        status: channel.is_active ? 'active' : 'inactive',
        description: channel.description || '',
        favicon_url: (channel as any).favicon_url || '',
        manager_name: (channel as any).manager_name || '',
        manager_contact: (channel as any).manager_contact || '',
        contract_url: (channel as any).contract_url || '',
        commission_base_price_only: (channel as any).commission_base_price_only ?? false,
        pricing_type: (channel as any).pricing_type || 'separate'
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('channels')
        .insert([channelData])
        .select()

      if (error) {
        console.error('Error adding channel:', error)
        alert('채널 추가 중 오류가 발생했습니다.')
        return
      }

      // 채널 목록을 다시 불러와서 최신 데이터 반영
      await fetchChannels()
      
      if (data && data.length > 0) {
        const newChannel = data[0] as Channel
        // 새로 추가된 채널의 타입에 맞는 탭으로 이동
        if (newChannel.type) {
          setActiveTab(newChannel.type)
        }
      }
      setShowAddForm(false)
      alert('채널이 성공적으로 추가되었습니다!')
    } catch (error) {
      console.error('Error adding channel:', error)
      alert('채널 추가 중 오류가 발생했습니다.')
    }
  }

  const handleEditChannel = async (channel: Omit<Channel, 'id' | 'created_at'>) => {
    console.log('handleEditChannel called with channel:', channel);
    console.log('editingChannel:', editingChannel);
    if (editingChannel) {
      try {
        // commission_rate를 commission_percent로 매핑, is_active를 status로 매핑, website 필드 사용
        // formData에서 직접 값을 가져오기 위해 channel 객체의 모든 속성 확인
        const channelAny = channel as any;
        const channelData: any = {
          name: channel.name,
          type: channel.type,
          website: channel.website || channelAny.website_url || '',
          customer_website: channel.customer_website || '',
          admin_website: channel.admin_website || '',
          commission_percent: channelAny.commission_rate || 0,
          status: channel.is_active ? 'active' : 'inactive',
          description: channel.description || '',
          favicon_url: channelAny.favicon_url || '',
          manager_name: channelAny.manager_name || '',
          manager_contact: channelAny.manager_contact || '',
          contract_url: channelAny.contract_url || '',
          commission_base_price_only: channelAny.commission_base_price_only ?? false,
          pricing_type: channelAny.pricing_type || 'separate'
        }
        
        console.log('Saving channel data:', channelData);
        console.log('Original channel object:', channel);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updateData, error } = await (supabase as any)
          .from('channels')
          .update(channelData)
          .eq('id', editingChannel.id)
          .select()

        if (error) {
          console.error('Error updating channel:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          alert('채널 수정 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
          return
        }

        console.log('Updated channel data:', updateData);
        
        // 채널 목록을 다시 불러와서 최신 데이터 반영
        await fetchChannels()
        setEditingChannel(null)
        alert('채널이 성공적으로 수정되었습니다!')
      } catch (error) {
        console.error('Error updating channel:', error)
        alert('채널 수정 중 오류가 발생했습니다.')
      }
    }
  }

  const handleDeleteChannel = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('channels')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting channel:', error)
          alert('채널 삭제 중 오류가 발생했습니다.')
          return
        }

        setChannels(channels.filter(c => c.id !== id))
        // 관련 상품 연결 정보도 삭제 (CASCADE로 자동 삭제됨)
        setChannelProducts(channelProducts.filter(cp => cp.channelId !== id))
        alert('채널이 성공적으로 삭제되었습니다!')
      } catch (error) {
        console.error('Error deleting channel:', error)
        alert('채널 삭제 중 오류가 발생했습니다.')
      }
    }
  }

  const handleBulkSave = async () => {
    if (Object.keys(bulkEditData).length === 0) {
      setBulkEditMode(false)
      return
    }

    try {
      for (const [channelId, updates] of Object.entries(bulkEditData)) {
        const updateData: any = {}
        
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.type !== undefined) updateData.type = updates.type
        if (updates.description !== undefined) updateData.description = updates.description
        if (updates.customer_website !== undefined) updateData.customer_website = updates.customer_website
        if (updates.admin_website !== undefined) updateData.admin_website = updates.admin_website
        if (updates.commission_rate !== undefined) updateData.commission_percent = updates.commission_rate
        if (updates.is_active !== undefined) updateData.status = updates.is_active ? 'active' : 'inactive'
        if (updates.manager_name !== undefined) updateData.manager_name = updates.manager_name
        if (updates.manager_contact !== undefined) updateData.manager_contact = updates.manager_contact
        if (updates.commission_base_price_only !== undefined) updateData.commission_base_price_only = updates.commission_base_price_only
        if (updates.pricing_type !== undefined) updateData.pricing_type = updates.pricing_type

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('channels')
            .update(updateData)
            .eq('id', channelId)
        }
      }
      
      await fetchChannels()
      setBulkEditData({})
      setBulkEditMode(false)
      alert('채널이 성공적으로 업데이트되었습니다.')
    } catch (error) {
      console.error('Error updating channels:', error)
      alert('채널 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleBulkFieldChange = (channelId: string, field: keyof Channel, value: any) => {
    setBulkEditData(prev => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        [field]: value
      }
    }))
  }

  const handleToggleChannelStatus = async (channel: Channel, e: React.MouseEvent) => {
    e.stopPropagation() // 이벤트 버블링 방지
    
    try {
      const newStatus = !channel.is_active
      const statusValue = newStatus ? 'active' : 'inactive'
      
      // Supabase에서 status 필드는 'active' 또는 'inactive' 문자열
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('channels')
        .update({ status: statusValue })
        .eq('id', channel.id)

      if (error) {
        console.error('Error toggling channel status:', error)
        alert('채널 상태 변경 중 오류가 발생했습니다.')
        return
      }

      // 로컬 상태 업데이트
      setChannels(channels.map(c => 
        c.id === channel.id 
          ? { ...c, is_active: newStatus } 
          : c
      ))
    } catch (error) {
      console.error('Error toggling channel status:', error)
      alert('채널 상태 변경 중 오류가 발생했습니다.')
    }
  }

  const getChannelTypeLabel = (type: string | null) => {
    if (!type) return '미지정'
    switch (type) {
      case 'self': return 'Self'
      case 'ota': return 'OTA'
      case 'partner': return 'Partner'
      default: return type
    }
  }

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? '활성' : '비활성'
  }

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : 'Unknown'
  }

  const getChannelProducts = (channelId: string) => {
    return channelProducts.filter(cp => cp.channelId === channelId && cp.is_active)
  }

  return (
    <ProtectedRoute requiredPermission="canManageChannels">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          {viewMode === 'table' && (
            <>
              <button
                onClick={() => {
                  setBulkEditMode(!bulkEditMode)
                  if (!bulkEditMode) {
                    setBulkEditData({})
                  } else {
                    // 일괄 편집 종료 시 저장
                    handleBulkSave()
                  }
                }}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium ${
                  bulkEditMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <Edit size={16} />
                <span>{bulkEditMode ? '저장' : '일괄 편집'}</span>
              </button>
              {bulkEditMode && (
                <button
                  onClick={() => {
                    setBulkEditMode(false)
                    setBulkEditData({})
                  }}
                  className="px-3 py-1.5 rounded-md bg-gray-600 text-white hover:bg-gray-700 flex items-center gap-1.5 text-sm font-medium"
                >
                  <X size={16} />
                  <span>취소</span>
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            <span>{t('addChannel')}</span>
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 채널 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">전체</p>
              <p className="text-2xl font-bold text-gray-900">{channels.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Self</p>
              <p className="text-2xl font-bold text-gray-900">{channels.filter(c => c.type === 'self').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">OTA</p>
              <p className="text-2xl font-bold text-gray-900">{channels.filter(c => c.type === 'ota').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Partner</p>
              <p className="text-2xl font-bold text-gray-900">{channels.filter(c => c.type === 'partner').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('all')
              setSearchTerm('')
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            전체 ({channels.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('self')
              setSearchTerm('')
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'self'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Self ({channels.filter(c => c.type === 'self').length})
          </button>
          <button
            onClick={() => {
              setActiveTab('ota')
              setSearchTerm('')
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ota'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            OTA ({channels.filter(c => c.type === 'ota').length})
          </button>
          <button
            onClick={() => {
              setActiveTab('partner')
              setSearchTerm('')
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'partner'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Partner ({channels.filter(c => c.type === 'partner').length})
          </button>
        </nav>
      </div>


      {/* 채널 목록 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md border p-8 text-center">
          <div className="text-gray-500">채널 데이터를 불러오는 중...</div>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border p-8 text-center">
          <div className="text-gray-500">
            {activeTab === 'all' 
              ? '등록된 채널이 없습니다.' 
              : activeTab === 'self' 
                ? 'Self 채널이 없습니다.' 
                : activeTab === 'ota' 
                  ? 'OTA 채널이 없습니다.' 
                  : activeTab === 'partner' 
                    ? 'Partner 채널이 없습니다.' 
                    : '해당 타입의 채널이 없습니다.'}
          </div>
          <div className="mt-2 text-sm text-gray-400">
            {activeTab !== 'all' && '새로운 채널을 추가해보세요!'}
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
          /* 테이블 뷰 - 모바일 최적화 */
          <div className="bg-white rounded-lg shadow-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">{t('columns.name')}</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">타입</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">설명</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객용</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리자용</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수수료</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">커미션</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">담당자</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">계약서</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredChannels.map((channel) => (
                <tr key={channel.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5 whitespace-nowrap sticky left-0 bg-white z-10">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0 h-6 w-6">
                        {channel.favicon_url ? (
                          <Image 
                            src={channel.favicon_url} 
                            alt={`${channel.name} favicon`} 
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                const fallback = document.createElement('div')
                                fallback.className = 'h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center'
                                fallback.innerHTML = '<svg class="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path></svg>'
                                parent.appendChild(fallback)
                              }
                            }}
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-blue-600" />
                          </div>
                        )}
                      </div>
                      {bulkEditMode ? (
                        <input
                          type="text"
                          value={bulkEditData[channel.id]?.name ?? channel.name}
                          onChange={(e) => handleBulkFieldChange(channel.id, 'name', e.target.value)}
                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{channel.name}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {bulkEditMode ? (
                      <select
                        value={bulkEditData[channel.id]?.type ?? channel.type ?? ''}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'type', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">선택</option>
                        <option value="self">Self</option>
                        <option value="ota">OTA</option>
                        <option value="partner">Partner</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        channel.type === 'ota' ? 'bg-blue-100 text-blue-800' :
                        channel.type === 'self' ? 'bg-green-100 text-green-800' :
                        channel.type === 'partner' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getChannelTypeLabel(channel.type || null)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-900 max-w-[150px]">
                    {bulkEditMode ? (
                      <input
                        type="text"
                        value={bulkEditData[channel.id]?.description ?? channel.description ?? ''}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'description', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="truncate" title={channel.description || ''}>
                        {channel.description || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {bulkEditMode ? (
                      <input
                        type="url"
                        value={bulkEditData[channel.id]?.customer_website ?? channel.customer_website ?? ''}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'customer_website', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        placeholder="https://..."
                      />
                    ) : (
                      channel.customer_website ? (
                        <a 
                          href={channel.customer_website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate max-w-[120px] block"
                          onClick={(e) => e.stopPropagation()}
                          title={channel.customer_website}
                        >
                          {channel.customer_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {bulkEditMode ? (
                      <input
                        type="url"
                        value={bulkEditData[channel.id]?.admin_website ?? channel.admin_website ?? ''}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'admin_website', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        placeholder="https://..."
                      />
                    ) : (
                      channel.admin_website ? (
                        <a 
                          href={channel.admin_website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate max-w-[120px] block"
                          onClick={(e) => e.stopPropagation()}
                          title={channel.admin_website}
                        >
                          {channel.admin_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-xs max-w-[150px]">
                    {getChannelProducts(channel.id).length > 0 ? (
                      <div className="flex items-center space-x-1">
                        <Package className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-900 truncate">
                          {getProductName(getChannelProducts(channel.id)[0].productId)}
                          {getChannelProducts(channel.id).length > 1 && (
                            <span className="text-gray-500"> +{getChannelProducts(channel.id).length - 1}</span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">
                    {bulkEditMode ? (
                      <input
                        type="number"
                        value={bulkEditData[channel.id]?.commission_rate ?? channel.commission_rate ?? 0}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'commission_rate', Number(e.target.value) || 0)}
                        className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    ) : (
                      `${channel.commission_rate || 0}%`
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    {bulkEditMode ? (
                      <select
                        value={bulkEditData[channel.id]?.pricing_type ?? channel.pricing_type ?? 'separate'}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'pricing_type', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="separate">분리</option>
                        <option value="single">단일</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-medium ${
                        channel.pricing_type === 'single' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {channel.pricing_type === 'single' ? '단일' : '분리'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                    {bulkEditMode ? (
                      <input
                        type="checkbox"
                        checked={bulkEditData[channel.id]?.commission_base_price_only ?? channel.commission_base_price_only ?? false}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'commission_base_price_only', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      channel.commission_base_price_only ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs max-w-[100px]">
                    {bulkEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={bulkEditData[channel.id]?.manager_name ?? channel.manager_name ?? ''}
                          onChange={(e) => handleBulkFieldChange(channel.id, 'manager_name', e.target.value)}
                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                          placeholder="이름"
                        />
                        <input
                          type="text"
                          value={bulkEditData[channel.id]?.manager_contact ?? channel.manager_contact ?? ''}
                          onChange={(e) => handleBulkFieldChange(channel.id, 'manager_contact', e.target.value)}
                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                          placeholder="연락처"
                        />
                      </div>
                    ) : (
                      channel.manager_name || channel.manager_contact ? (
                        <div>
                          {channel.manager_name && (
                            <div className="text-gray-900 truncate">{channel.manager_name}</div>
                          )}
                          {channel.manager_contact && (
                            <div className="text-gray-500 truncate" title={channel.manager_contact}>{channel.manager_contact}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center">
                    {channel.contract_url ? (
                      <a 
                        href={channel.contract_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ✓
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {bulkEditMode ? (
                      <select
                        value={bulkEditData[channel.id]?.is_active !== undefined ? (bulkEditData[channel.id].is_active ? 'active' : 'inactive') : (channel.is_active ? 'active' : 'inactive')}
                        onChange={(e) => handleBulkFieldChange(channel.id, 'is_active', e.target.value === 'active')}
                        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                      </select>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleChannelStatus(channel, e)
                        }}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                          channel.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 
                          'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                        title={channel.is_active ? '비활성화하려면 클릭' : '활성화하려면 클릭'}
                      >
                        {getStatusLabel(channel.is_active)}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium">
                    {!bulkEditMode && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setSelectedChannelForProducts(channel)
                            setShowProductSelection(true)
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="상품 선택"
                        >
                          <Package size={14} />
                        </button>
                        <button
                          onClick={() => setEditingChannel(channel)}
                          className="text-blue-600 hover:text-blue-900"
                          title="편집"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteChannel(channel.id)}
                          className="text-red-600 hover:text-red-900"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        ) : (
          /* 카드뷰 - 모바일 최적화 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredChannels.map((channel) => (
              <div 
                key={channel.id} 
                className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setEditingChannel(channel)}
              >
                <div className="p-4 sm:p-6">
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        {/* 파비콘 */}
                        {channel.favicon_url ? (
                          <Image 
                            src={channel.favicon_url} 
                            alt={`${channel.name} favicon`} 
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded flex-shrink-0"
                            onError={(e) => {
                              // 파비콘 로드 실패 시 기본 아이콘으로 대체
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                const fallback = document.createElement('div')
                                fallback.className = 'w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                                fallback.innerHTML = '🌐'
                                parent.appendChild(fallback)
                              }
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                            🌐
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {channel.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {channel.description || '설명 없음'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleChannelStatus(channel, e)
                      }}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                        channel.is_active 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                      title={channel.is_active ? '비활성화하려면 클릭' : '활성화하려면 클릭'}
                    >
                      {getStatusLabel(channel.is_active)}
                    </button>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">타입</span>
                      <span className="font-medium">{getChannelTypeLabel(channel.type || null)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">수수료</span>
                      <span className="font-medium text-blue-600">{channel.commission_rate || 0}%</span>
                    </div>
                    
                    {/* 웹사이트 정보 */}
                    {(channel.customer_website || channel.admin_website) && (
                      <div className="space-y-1">
                        {channel.customer_website && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">고객용 웹사이트</span>
                            <a 
                              href={channel.customer_website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:text-blue-800 truncate max-w-32"
                            >
                              {channel.customer_website}
                            </a>
                          </div>
                        )}
                        {channel.admin_website && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">관리자용 웹사이트</span>
                            <a 
                              href={channel.admin_website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:text-blue-800 truncate max-w-32"
                            >
                              {channel.admin_website}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">연결된 상품</span>
                      <span className="font-medium">{getChannelProducts(channel.id).length}개</span>
                    </div>
                    
                    {/* 담당자 정보 */}
                    {(channel.manager_name || channel.manager_contact) && (
                      <div className="space-y-1">
                        {channel.manager_name && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">담당자</span>
                            <span className="font-medium text-gray-900">{channel.manager_name}</span>
                          </div>
                        )}
                        {channel.manager_contact && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">연락처</span>
                            <span className="font-medium text-gray-900 truncate max-w-32">{channel.manager_contact}</span>
                          </div>
                        )}
                        {channel.contract_url && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">계약서</span>
                            <a 
                              href={channel.contract_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:text-blue-800 text-xs"
                            >
                              보기
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 연결된 상품 목록 */}
                    {getChannelProducts(channel.id).length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">상품 목록</span>
                          <div className="mt-2 space-y-1">
                            {getChannelProducts(channel.id).slice(0, 3).map((cp) => (
                              <div key={cp.id} className="text-xs text-gray-600 truncate">
                                {getProductName(cp.productId)}
                              </div>
                            ))}
                            {getChannelProducts(channel.id).length > 3 && (
                              <div className="text-xs text-gray-400">
                                +{getChannelProducts(channel.id).length - 3}개 더
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </>
      )}

      {/* 채널 추가/편집 모달 */}
      {(showAddForm || editingChannel) && (
        <ChannelForm
          channel={editingChannel ?? null}
          onSubmit={(channelData) => {
            console.log('onSubmit called in page.tsx, editingChannel:', editingChannel);
            console.log('onSubmit channelData:', channelData);
            if (editingChannel) {
              console.log('Calling handleEditChannel');
              handleEditChannel(channelData);
            } else {
              console.log('Calling handleAddChannel');
              handleAddChannel(channelData);
            }
          }}
          onCancel={() => {
            setShowAddForm(false)
            setEditingChannel(null)
          }}
          {...(editingChannel
            ? {
                onDelete: () => { void handleDeleteChannel(editingChannel.id) },
                onManageProducts: () => {
                  setSelectedChannelForProducts(editingChannel)
                  setShowProductSelection(true)
                }
              }
            : {})}
        />
      )}

      {/* 채널별 상품 선택 모달 */}
      {showProductSelection && (
        <ChannelProductSelectionForm
          channel={selectedChannelForProducts}
          products={products}
          channelProducts={channelProducts}
          loading={loadingProducts}
          onVariantChange={async () => {
            // Variant 변경 시 channelProducts 데이터 새로고침
            await fetchChannelProducts()
          }}
          onSave={async (selectedProductIds) => {
            if (!selectedChannelForProducts) return

            try {
              // 현재 채널에 연결된 상품들 가져오기
              const currentChannelProducts = channelProducts.filter(
                cp => cp.channelId === selectedChannelForProducts.id
              )
              const currentProductIds = currentChannelProducts.map(cp => cp.productId)

              // 추가할 상품들 (새로 선택된 것들)
              const productsToAdd = selectedProductIds.filter(
                productId => !currentProductIds.includes(productId)
              )

              // 제거할 상품들 (선택 해제된 것들)
              const productsToRemove = currentProductIds.filter(
                productId => !selectedProductIds.includes(productId)
              )

              // 새 상품들 추가
              if (productsToAdd.length > 0) {
                const { error: insertError } = await supabase
                  .from('channel_products')
                  .insert(
                    productsToAdd.map(productId => ({
                      channel_id: selectedChannelForProducts.id,
                      product_id: productId,
                      is_active: true
                    }))
                  )

                if (insertError) {
                  console.error('Error adding channel products:', insertError)
                  alert('상품 연결 중 오류가 발생했습니다.')
                  return
                }
              }

              // 제거할 상품들 비활성화 (또는 삭제)
              if (productsToRemove.length > 0) {
                const { error: deleteError } = await supabase
                  .from('channel_products')
                  .delete()
                  .eq('channel_id', selectedChannelForProducts.id)
                  .in('product_id', productsToRemove)

                if (deleteError) {
                  console.error('Error removing channel products:', deleteError)
                  alert('상품 연결 해제 중 오류가 발생했습니다.')
                  return
                }
              }

              // 데이터 다시 불러오기
              await fetchChannelProducts()
              
              setShowProductSelection(false)
              setSelectedChannelForProducts(null)
              alert('상품 연결이 성공적으로 저장되었습니다!')
            } catch (error) {
              console.error('Error saving channel products:', error)
              alert('상품 연결 저장 중 오류가 발생했습니다.')
            }
          }}
          onCancel={() => {
            setShowProductSelection(false)
            setSelectedChannelForProducts(null)
          }}
        />
      )}

    </div>
    </ProtectedRoute>
  )
}

interface ProductVariant {
  id?: string
  variant_key: string
  variant_name_ko?: string | null
  variant_name_en?: string | null
  variant_description_ko?: string | null
  variant_description_en?: string | null
}

interface ChannelProductSelectionFormProps {
  channel: Channel | null
  products: Product[]
  channelProducts: Array<{ 
    id: string; 
    channelId: string; 
    productId: string; 
    is_active: boolean;
    variant_key?: string;
    variant_name_ko?: string;
    variant_name_en?: string;
  }>
  loading?: boolean
  onSave: (selectedProductIds: string[]) => void
  onCancel: () => void
  onVariantChange?: () => void // Variant 변경 시 부모 컴포넌트에 알림
}

// Variant 편집 폼 컴포넌트
interface VariantEditFormProps {
  variant: ProductVariant
  onSave: (variant: ProductVariant) => void
  onCancel: () => void
}

function VariantEditForm({ variant, onSave, onCancel }: VariantEditFormProps) {
  const [formData, setFormData] = useState<ProductVariant>(variant)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Variant Key
        </label>
        <input
          type="text"
          value={formData.variant_key}
          onChange={(e) => setFormData({ ...formData, variant_key: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          disabled={variant.variant_key === 'default'}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          이름 (한국어)
        </label>
        <input
          type="text"
          value={formData.variant_name_ko || ''}
          onChange={(e) => setFormData({ ...formData, variant_name_ko: e.target.value })}
          placeholder="예: 모든 금액 포함"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          이름 (영어)
        </label>
        <input
          type="text"
          value={formData.variant_name_en || ''}
          onChange={(e) => setFormData({ ...formData, variant_name_en: e.target.value })}
          placeholder="예: All Inclusive"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          설명 (한국어)
        </label>
        <textarea
          value={formData.variant_description_ko || ''}
          onChange={(e) => setFormData({ ...formData, variant_description_ko: e.target.value })}
          placeholder="Variant 설명을 입력하세요"
          rows={2}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          설명 (영어)
        </label>
        <textarea
          value={formData.variant_description_en || ''}
          onChange={(e) => setFormData({ ...formData, variant_description_en: e.target.value })}
          placeholder="Enter variant description"
          rows={2}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>
      <div className="flex space-x-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded hover:bg-gray-400"
        >
          취소
        </button>
      </div>
    </form>
  )
}

function ChannelProductSelectionForm({ channel, products, channelProducts, loading = false, onSave, onCancel, onVariantChange }: ChannelProductSelectionFormProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState<string>('')
  
  // Variant 관리 상태
  const [productVariants, setProductVariants] = useState<Record<string, ProductVariant[]>>({})
  const [editingVariant, setEditingVariant] = useState<{ productId: string; variant?: ProductVariant } | null>(null)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // 현재 채널에 연결된 상품들 초기화
  React.useEffect(() => {
    if (channel) {
      const connectedProducts = channelProducts
        .filter(cp => cp.channelId === channel.id && cp.is_active)
        .map(cp => cp.productId)
      setSelectedProducts(connectedProducts)
      
      // Variant 데이터 로드
      const variantsByProduct: Record<string, ProductVariant[]> = {}
      channelProducts
        .filter(cp => cp.channelId === channel.id && cp.is_active)
        .forEach(cp => {
          if (!variantsByProduct[cp.productId]) {
            variantsByProduct[cp.productId] = []
          }
          variantsByProduct[cp.productId].push({
            id: cp.id,
            variant_key: cp.variant_key || 'default',
            variant_name_ko: cp.variant_name_ko ?? null,
            variant_name_en: cp.variant_name_en ?? null
          })
        })
      setProductVariants(variantsByProduct)
    }
  }, [channel, channelProducts])
  
  // Variant 추가
  const handleAddVariant = async (productId: string) => {
    if (!channel) {
      alert('채널 정보가 없습니다.')
      return
    }
    
    // 상품이 선택되지 않았다면 자동으로 선택
    if (!selectedProducts.includes(productId)) {
      setSelectedProducts(prev => [...prev, productId])
    }
    
    // 상품을 확장하여 variant 목록 표시
    setExpandedProducts(prev => new Set([...prev, productId]))
    
    const newVariantKey = `variant_${Date.now()}`
    
    try {
      console.log('Adding variant:', { channel_id: channel.id, product_id: productId, variant_key: newVariantKey })
      
      const { data, error } = await supabase
        .from('channel_products')
        .insert({
          channel_id: channel.id,
          product_id: productId,
          variant_key: newVariantKey,
          is_active: true
        } as any)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      if (!data) {
        throw new Error('데이터가 반환되지 않았습니다.')
      }
      
      console.log('Variant added successfully:', data)
      
      const savedVariant: ProductVariant = { 
        variant_key: newVariantKey,
        id: data.id,
        variant_name_ko: null,
        variant_name_en: null,
        variant_description_ko: null,
        variant_description_en: null
      }
      
      // 상태 업데이트
      setProductVariants(prev => {
        const currentVariants = prev[productId] || []
        const updated = {
          ...prev,
          [productId]: [...currentVariants, savedVariant]
        }
        console.log('Updated productVariants:', updated)
        return updated
      })
      
      // 편집 모드로 전환
      setEditingVariant({ productId, variant: savedVariant })
      
      console.log('Variant 추가 완료:', savedVariant)
      
    } catch (error: any) {
      console.error('Error adding variant:', error)
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.'
      alert(`Variant 추가 중 오류가 발생했습니다: ${errorMessage}`)
    }
  }
  
  // Variant 삭제
  const handleDeleteVariant = async (productId: string, variantId: string, variantKey: string) => {
    if (!channel) return
    if (variantKey === 'default') {
      alert('기본 variant는 삭제할 수 없습니다.')
      return
    }
    
    if (!confirm('이 variant를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('channel_products')
        .delete()
        .eq('id', variantId)
      
      if (error) throw error
      
      setProductVariants(prev => ({
        ...prev,
        [productId]: (prev[productId] || []).filter(v => v.id !== variantId)
      }))
      
      // 부모 컴포넌트에 알림 (데이터 새로고침)
      if (onVariantChange) {
        onVariantChange()
      }
    } catch (error) {
      console.error('Error deleting variant:', error)
      alert('Variant 삭제 중 오류가 발생했습니다.')
    }
  }
  
  // Variant 저장
  const handleSaveVariant = async (productId: string, variant: ProductVariant) => {
    if (!channel || !variant.id) return
    
    try {
      const { error } = await supabase
        .from('channel_products')
        .update({
          variant_key: variant.variant_key,
          variant_name_ko: variant.variant_name_ko ?? null,
          variant_name_en: variant.variant_name_en ?? null,
          variant_description_ko: variant.variant_description_ko ?? null,
          variant_description_en: variant.variant_description_en ?? null
        } as any)
        .eq('id', variant.id)
      
      if (error) throw error
      
      setProductVariants(prev => ({
        ...prev,
        [productId]: (prev[productId] || []).map(v => 
          v.id === variant.id ? variant : v
        )
      }))
      
      setEditingVariant(null)
    } catch (error) {
      console.error('Error saving variant:', error)
      alert('Variant 저장 중 오류가 발생했습니다.')
    }
  }
  
  // 상품 확장/축소 토글
  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }
  
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // 카테고리 접기/펼치기 토글
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // 서브카테고리 접기/펼치기 토글
  const toggleSubCategory = (category: string, subCategory: string) => {
    const key = `${category}-${subCategory}`
    setExpandedSubCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleSave = () => {
    onSave(selectedProducts)
  }

  // 검색어로 필터링된 상품 목록
  const filteredProducts = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return products
    }
    const term = searchTerm.toLowerCase()
    return products.filter(product => 
      product.name.toLowerCase().includes(term) ||
      product.description.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      product.subCategory.toLowerCase().includes(term)
    )
  }, [products, searchTerm])

  // 상품을 카테고리와 서브카테고리로 그룹화
  const groupedProducts = React.useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = {}
      }
      if (!acc[product.category][product.subCategory]) {
        acc[product.category][product.subCategory] = []
      }
      acc[product.category][product.subCategory].push(product)
      return acc
    }, {} as Record<string, Record<string, Product[]>>)
  }, [filteredProducts])

  // 검색어가 있을 때 관련 카테고리와 서브카테고리 자동 펼치기
  React.useEffect(() => {
    if (searchTerm.trim()) {
      const categoriesToExpand = new Set<string>()
      const subCategoriesToExpand = new Set<string>()
      
      Object.entries(groupedProducts).forEach(([category, subCategories]) => {
        categoriesToExpand.add(category)
        Object.keys(subCategories).forEach(subCategory => {
          subCategoriesToExpand.add(`${category}-${subCategory}`)
        })
      })
      
      setExpandedCategories(categoriesToExpand)
      setExpandedSubCategories(subCategoriesToExpand)
    }
  }, [searchTerm, groupedProducts])

  // 카테고리 라벨 가져오기
  const getCategoryLabel = (category: string) => {
    const categoryLabels: Record<string, string> = {
      'city': '도시',
      'nature': '자연',
      'culture': '문화',
      'adventure': '모험',
      'food': '음식',
      'shopping': '쇼핑',
      'wellness': '웰니스'
    }
    return categoryLabels[category] || category
  }

  if (!channel) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {channel.name} - 판매 상품 선택
        </h2>
        <p className="text-gray-600 mb-4">
          이 채널에서 판매할 상품을 선택하세요. 가격 설정은 상품 관리의 동적 가격 탭에서 할 수 있습니다.
        </p>
        
        {/* 검색 입력 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="상품명, 설명, 카테고리로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-500">
              검색 결과: {filteredProducts.length}개 상품
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">상품 목록을 불러오는 중...</div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-500 mb-2">등록된 상품이 없습니다.</div>
            <div className="text-sm text-gray-400">상품 관리에서 먼저 상품을 등록해주세요.</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-500 mb-2">검색 결과가 없습니다.</div>
            <div className="text-sm text-gray-400">다른 검색어를 시도해보세요.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedProducts).map(([category, subCategories]) => {
              const isCategoryExpanded = expandedCategories.has(category)
              return (
                <div key={category} className="border rounded-lg overflow-hidden">
                  {/* 카테고리 헤더 */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {isCategoryExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getCategoryLabel(category)}
                      </h3>
                      <span className="text-sm text-gray-500">
                        ({Object.values(subCategories).flat().length}개)
                      </span>
                    </div>
                  </button>
                  
                  {/* 서브카테고리 목록 */}
                  {isCategoryExpanded && (
                    <div className="p-4 space-y-3">
                      {Object.entries(subCategories).map(([subCategory, products]) => {
                        const subCategoryKey = `${category}-${subCategory}`
                        const isSubCategoryExpanded = expandedSubCategories.has(subCategoryKey)
                        return (
                          <div key={subCategory} className="border rounded-lg overflow-hidden">
                            {/* 서브카테고리 헤더 */}
                            <button
                              onClick={() => toggleSubCategory(category, subCategory)}
                              className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                {isSubCategoryExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )}
                                <h4 className="text-md font-medium text-gray-700">
                                  {subCategory}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  ({products.length}개)
                                </span>
                              </div>
                            </button>
                            
                            {/* 상품 목록 */}
                            {isSubCategoryExpanded && (
                              <div className="p-3 space-y-2">
                                {products.map(product => {
                                  const isProductExpanded = expandedProducts.has(product.id)
                                  const variants = productVariants[product.id] || []
                                  const isSelected = selectedProducts.includes(product.id)
                                  
                                  return (
                                    <div key={product.id} className="border rounded-lg overflow-hidden">
                                      {/* 상품 헤더 */}
                                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleProductSelection(product.id)}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <div 
                                          className="flex-1 font-medium text-gray-900 cursor-pointer"
                                          onClick={() => {
                                            // 상품이 선택되지 않았다면 자동 선택
                                            if (!isSelected) {
                                              toggleProductSelection(product.id)
                                            }
                                            toggleProduct(product.id)
                                          }}
                                        >
                                          {product.name}
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            // 상품이 선택되지 않았다면 자동 선택
                                            if (!isSelected) {
                                              toggleProductSelection(product.id)
                                            }
                                            toggleProduct(product.id)
                                          }}
                                          className="p-1 hover:bg-gray-200 rounded"
                                          title="Variant 목록 보기/숨기기"
                                        >
                                          {isProductExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-gray-600" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-gray-600" />
                                          )}
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            // 상품이 선택되지 않았다면 자동 선택
                                            if (!isSelected) {
                                              toggleProductSelection(product.id)
                                            }
                                            // 상품이 확장되지 않았다면 자동 확장
                                            if (!isProductExpanded) {
                                              setExpandedProducts(prev => new Set([...prev, product.id]))
                                            }
                                            await handleAddVariant(product.id)
                                          }}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                          title="Variant 추가"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>
                                      </div>
                                      
                                      {/* Variant 목록 */}
                                      {isProductExpanded && (
                                        <div className="p-3 bg-gray-50 space-y-2">
                                          {variants.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-2">
                                              Variant가 없습니다. + 버튼을 클릭하여 추가하세요.
                                            </div>
                                          ) : (
                                            variants.map((variant, idx) => {
                                              const isEditing = editingVariant?.productId === product.id && editingVariant?.variant?.id === variant.id
                                              
                                              return (
                                                <div key={variant.id || idx} className="bg-white border rounded p-2">
                                                  {isEditing ? (
                                                    <VariantEditForm
                                                      variant={variant}
                                                      onSave={(updatedVariant: ProductVariant) => handleSaveVariant(product.id, updatedVariant)}
                                                      onCancel={() => setEditingVariant(null)}
                                                    />
                                                  ) : (
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex-1">
                                                        <div className="font-medium text-sm">
                                                          {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                          Key: {variant.variant_key}
                                                        </div>
                                                      </div>
                                                      <div className="flex space-x-1">
                                                        <button
                                                          onClick={() => setEditingVariant({ productId: product.id, variant })}
                                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                          title="편집"
                                                        >
                                                          <Edit className="h-3 w-3" />
                                                        </button>
                                                        {variant.variant_key !== 'default' && (
                                                          <button
                                                            onClick={() => handleDeleteVariant(product.id, variant.id!, variant.variant_key)}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                            title="삭제"
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex space-x-3 pt-6">
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            상품 선택 저장
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
