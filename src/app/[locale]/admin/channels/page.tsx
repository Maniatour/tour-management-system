'use client'

import { useState, use, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Globe, Package, Grid, List } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Channel = Database['public']['Tables']['channels']['Row']

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

interface ChannelProductPricing {
  id: string
  channelId: string
  productId: string
  price: {
    adult: number
    child: number
    infant: number
  }
  markup: {
    adult: number
    child: number
    infant: number
  }
  finalPrice: {
    adult: number
    child: number
    infant: number
  }
  status: 'active' | 'inactive'
  created_at: string
}

interface AdminChannelsProps {
  params: Promise<{ locale: string }>
}

export default function AdminChannels({ params }: AdminChannelsProps) {
  const { locale } = use(params)
  const t = useTranslations('channels')
  const tCommon = useTranslations('common')
  
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  // 상품 데이터 (실제로는 상품 관리에서 가져와야 함)
  const [products] = useState<Product[]>([
    { id: '1', name: '서울 도시 투어', category: 'city', subCategory: '도시', description: '서울의 주요 관광지를 둘러보는 도시 투어', basePrice: { adult: 50, child: 35, infant: 15 } },
    { id: '2', name: '제주 자연 투어', category: 'nature', subCategory: '자연', description: '제주의 아름다운 자연을 체험하는 투어', basePrice: { adult: 80, child: 50, infant: 20 } },
    { id: '3', name: '경주 문화 투어', category: 'culture', subCategory: '문화', description: '경주의 역사와 문화를 탐방하는 투어', basePrice: { adult: 60, child: 40, infant: 10 } },
    { id: '4', name: '부산 해양 투어', category: 'adventure', subCategory: '해양', description: '부산의 아름다운 해안을 감상하는 투어', basePrice: { adult: 70, child: 45, infant: 15 } }
  ])

  // 채널별 상품 가격 데이터 (상품 연결 정보만 유지)
  const [channelPricing, setChannelPricing] = useState<ChannelProductPricing[]>([
    {
      id: '1',
      channelId: '1',
      productId: '1',
      price: { adult: 50, child: 35, infant: 15 },
      markup: { adult: 0, child: 0, infant: 0 },
      finalPrice: { adult: 50, child: 35, infant: 15 },
      status: 'active',
      created_at: '2024-01-15'
    },
    {
      id: '2',
      channelId: '2',
      productId: '1',
      price: { adult: 50, child: 35, infant: 15 },
      markup: { adult: 20, child: 15, infant: 10 },
      finalPrice: { adult: 60, child: 40, infant: 17 },
      status: 'active',
      created_at: '2024-01-15'
    },
    {
      id: '3',
      channelId: '3',
      productId: '1',
      price: { adult: 50, child: 35, infant: 15 },
      markup: { adult: 18, child: 12, infant: 8 },
      finalPrice: { adult: 59, child: 39, infant: 16 },
      status: 'active',
      created_at: '2024-01-15'
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [showProductSelection, setShowProductSelection] = useState(false)
  const [selectedChannelForProducts, setSelectedChannelForProducts] = useState<Channel | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card')

  // Supabase에서 채널 데이터 가져오기
  useEffect(() => {
    fetchChannels()
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

      setChannels(data || [])
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
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
      const { data, error } = await supabase
        .from('channels')
        .insert([channel])
        .select()

      if (error) {
        console.error('Error adding channel:', error)
        alert('채널 추가 중 오류가 발생했습니다.')
        return
      }

              if (data) {
          setChannels([...channels, data[0]])
          // 새로 추가된 채널의 타입에 맞는 탭으로 이동
          if (data[0].type) {
            setActiveTab(data[0].type)
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
    if (editingChannel) {
      try {
        const { error } = await supabase
          .from('channels')
          .update(channel)
          .eq('id', editingChannel.id)

        if (error) {
          console.error('Error updating channel:', error)
          alert('채널 수정 중 오류가 발생했습니다.')
          return
        }

        setChannels(channels.map(c => c.id === editingChannel.id ? { ...c, ...channel } : c))
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
        // 관련 가격 정보도 삭제
        setChannelPricing(channelPricing.filter(p => p.channelId !== id))
        alert('채널이 성공적으로 삭제되었습니다!')
      } catch (error) {
        console.error('Error deleting channel:', error)
        alert('채널 삭제 중 오류가 발생했습니다.')
      }
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

  const getStatusLabel = (status: string | null) => {
    if (!status) return '미지정'
    return t(`status.${status}`)
  }

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : 'Unknown'
  }

  const getChannelPricing = (channelId: string) => {
    return channelPricing.filter(p => p.channelId === channelId)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex items-center space-x-3">
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowProductSelection(true)}
            className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2 text-sm sm:text-base"
          >
            <Package size={16} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">상품 선택</span>
            <span className="sm:hidden">상품</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm sm:text-base"
          >
            <Plus size={16} className="sm:w-5 sm:h-5" />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.type')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연결된 상품</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.commission')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredChannels.map((channel) => (
                <tr key={channel.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Globe className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{channel.name}</div>
                        {channel.website && (
                          <div className="text-sm text-gray-500">{channel.website}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      channel.type === 'ota' ? 'bg-blue-100 text-blue-800' :
                      channel.type === 'self' ? 'bg-green-100 text-green-800' :
                      channel.type === 'partner' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getChannelTypeLabel(channel.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {getChannelPricing(channel.id).map(pricing => (
                        <div key={pricing.id} className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm">
                            <Package className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-900">{getProductName(pricing.productId)}</span>
                          </div>
                          <div className="ml-5 text-xs space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-600">성인:</span>
                              <span className="text-gray-900">${pricing.finalPrice.adult}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-600">아동:</span>
                              <span className="text-gray-900">${pricing.finalPrice.child}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-600">유아:</span>
                              <span className="text-gray-900">${pricing.finalPrice.infant}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {getChannelPricing(channel.id).length === 0 && (
                        <span className="text-gray-400 text-sm">연결된 상품 없음</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {channel.commission || 0}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      channel.status === 'active' ? 'bg-green-100 text-green-800' : 
                      channel.status === 'inactive' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(channel.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedChannelForProducts(channel)
                          setShowProductSelection(true)
                        }}
                        className="text-purple-600 hover:text-purple-900"
                        title="상품 선택"
                      >
                        <Package size={16} />
                      </button>
                      <button
                        onClick={() => setEditingChannel(channel)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
              <div key={channel.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="p-4 sm:p-6">
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {channel.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {channel.description || '설명 없음'}
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      channel.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : channel.status === 'inactive'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(channel.status)}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">타입</span>
                      <span className="font-medium">{getChannelTypeLabel(channel.type)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">수수료</span>
                      <span className="font-medium text-blue-600">{channel.commission || 0}%</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">연결된 상품</span>
                      <span className="font-medium">{getChannelPricing(channel.id).length}개</span>
                    </div>

                    {/* 연결된 상품 목록 */}
                    {getChannelPricing(channel.id).length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">상품 목록</span>
                          <div className="mt-2 space-y-1">
                            {getChannelPricing(channel.id).slice(0, 3).map((pricing) => (
                              <div key={pricing.id} className="text-xs text-gray-600 truncate">
                                {getProductName(pricing.productId)}
                              </div>
                            ))}
                            {getChannelPricing(channel.id).length > 3 && (
                              <div className="text-xs text-gray-400">
                                +{getChannelPricing(channel.id).length - 3}개 더
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedChannelForProducts(channel)
                          setShowProductSelection(true)
                        }}
                        className="flex-1 bg-purple-600 text-white py-2 px-3 rounded-md hover:bg-purple-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                      >
                        <Package size={14} />
                        <span>상품</span>
                      </button>
                      <button
                        onClick={() => setEditingChannel(channel)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                      >
                        <Edit size={14} />
                        <span>편집</span>
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                      >
                        <Trash2 size={14} />
                        <span>삭제</span>
                      </button>
                    </div>
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
          channel={editingChannel}
          onSubmit={editingChannel ? handleEditChannel : handleAddChannel}
          onCancel={() => {
            setShowAddForm(false)
            setEditingChannel(null)
          }}
        />
      )}

      {/* 채널별 상품 선택 모달 */}
      {showProductSelection && (
        <ChannelProductSelectionForm
          channel={selectedChannelForProducts}
          products={products}
          channelPricing={channelPricing}
          onSave={(selectedProductIds) => {
            // 선택된 상품들에 대해 기본 가격 정보 생성
            selectedProductIds.forEach(productId => {
              const product = products.find(p => p.id === productId)
              if (product && !channelPricing.find(p => p.channelId === selectedChannelForProducts?.id && p.productId === productId)) {
                const newPricing: ChannelProductPricing = {
                  id: Date.now().toString(),
                  channelId: selectedChannelForProducts!.id,
                  productId,
                  price: { ...product.basePrice },
                  markup: { adult: 0, child: 0, infant: 0 },
                  finalPrice: { ...product.basePrice },
                  status: 'active',
                  created_at: new Date().toISOString().split('T')[0]
                }
                setChannelPricing([...channelPricing, newPricing])
              }
            })
            
            // 선택되지 않은 상품들의 가격 정보 제거
            const updatedPricing = channelPricing.filter(p => 
              p.channelId !== selectedChannelForProducts?.id || 
              selectedProductIds.includes(p.productId)
            )
            setChannelPricing(updatedPricing)
            
            setShowProductSelection(false)
            setSelectedChannelForProducts(null)
          }}
          onCancel={() => {
            setShowProductSelection(false)
            setSelectedChannelForProducts(null)
          }}
        />
      )}
    </div>
  )
}

interface ChannelFormProps {
  channel?: Channel | null
  onSubmit: (channel: Omit<Channel, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function ChannelForm({ channel, onSubmit, onCancel }: ChannelFormProps) {
  const t = useTranslations('channels')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    name: channel?.name || '',
    type: channel?.type || '',
    website: channel?.website || '',
    commission: channel?.commission || null,
    status: channel?.status || '',
    description: channel?.description || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {channel ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.website')}</label>
            <input
              type="url"
              value={formData.website || ''}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.commission')} (%)</label>
            <input
              type="number"
              value={formData.commission || ''}
              onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) || null })}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
            <select
              value={formData.status || ''}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t('form.selectStatus')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="inactive">{t('status.inactive')}</option>
            </select>
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
          </div>
        </form>
      </div>
    </div>
  )
}

interface ChannelProductSelectionFormProps {
  channel: Channel | null
  products: Product[]
  channelPricing: ChannelProductPricing[]
  onSave: (selectedProductIds: string[]) => void
  onCancel: () => void
}

function ChannelProductSelectionForm({ channel, products, channelPricing, onSave, onCancel }: ChannelProductSelectionFormProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // 현재 채널에 연결된 상품들 초기화
  React.useEffect(() => {
    if (channel) {
      const connectedProducts = channelPricing
        .filter(p => p.channelId === channel.id)
        .map(p => p.productId)
      setSelectedProducts(connectedProducts)
    }
  }, [channel, channelPricing])

  const handleSave = () => {
    onSave(selectedProducts)
  }

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // 상품을 카테고리와 서브카테고리로 그룹화
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = {}
    }
    if (!acc[product.category][product.subCategory]) {
      acc[product.category][product.subCategory] = []
    }
    acc[product.category][product.subCategory].push(product)
    return acc
  }, {} as Record<string, Record<string, Product[]>>)

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
        
        <div className="space-y-6">
          {Object.entries(groupedProducts).map(([category, subCategories]) => (
            <div key={category} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                {getCategoryLabel(category)}
              </h3>
              
              {Object.entries(subCategories).map(([subCategory, products]) => (
                <div key={subCategory} className="mb-4 last:mb-0">
                  <h4 className="text-md font-medium text-gray-700 mb-3 pl-2 border-l-4 border-blue-200">
                    {subCategory}
                  </h4>
                  
                  <div className="space-y-2 pl-4">
                    {products.map(product => (
                      <label key={product.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.description}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            기본가: 성인 ${product.basePrice.adult}, 아동 ${product.basePrice.child}, 유아 ${product.basePrice.infant}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

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
