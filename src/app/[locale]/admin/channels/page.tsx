'use client'

import { useState, use } from 'react'
import { Plus, Search, Edit, Trash2, Globe, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

interface Channel {
  id: string
  name: string
  type: 'OTA' | 'Direct' | 'Partner'
  website?: string
  commission: number
  status: 'active' | 'inactive'
  description?: string
  created_at: string
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
  
  const [channels, setChannels] = useState<Channel[]>([
    {
      id: '1',
      name: '직접 방문',
      type: 'Direct',
      commission: 0,
      status: 'active',
      description: '직접 방문 고객',
      created_at: '2024-01-15'
    },
    {
      id: '2',
      name: '네이버 여행',
      type: 'OTA',
      website: 'https://travel.naver.com',
      commission: 15,
      status: 'active',
      description: '네이버 여행 플랫폼',
      created_at: '2024-01-14'
    },
    {
      id: '3',
      name: '카카오 여행',
      type: 'OTA',
      website: 'https://travel.kakao.com',
      commission: 12,
      status: 'active',
      description: '카카오 여행 플랫폼',
      created_at: '2024-01-13'
    }
  ])

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [showProductSelection, setShowProductSelection] = useState(false)
  const [selectedChannelForProducts, setSelectedChannelForProducts] = useState<Channel | null>(null)

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddChannel = (channel: Omit<Channel, 'id' | 'created_at'>) => {
    const newChannel: Channel = {
      ...channel,
      id: `CH-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString().split('T')[0]
    }
    setChannels([...channels, newChannel])
    setShowAddForm(false)
  }

  const handleEditChannel = (channel: Omit<Channel, 'id' | 'created_at'>) => {
    if (editingChannel) {
      const updatedChannel: Channel = {
        ...channel,
        id: editingChannel.id,
        created_at: editingChannel.created_at
      }
      setChannels(channels.map(c => c.id === editingChannel.id ? updatedChannel : c))
      setEditingChannel(null)
    }
  }

  const handleDeleteChannel = (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      setChannels(channels.filter(c => c.id !== id))
      // 관련 가격 정보도 삭제
      setChannelPricing(channelPricing.filter(p => p.channelId !== id))
    }
  }

  const getChannelTypeLabel = (type: string) => {
    return t(`types.${type}`)
  }

  const getStatusLabel = (status: string) => {
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowProductSelection(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Package size={20} />
            <span>상품 선택</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
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

      {/* 채널 목록 */}
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
                      channel.type === 'OTA' ? 'bg-blue-100 text-blue-800' :
                      channel.type === 'Direct' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
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
                    {channel.commission}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      channel.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
    type: channel?.type || 'Direct',
    website: channel?.website || '',
    commission: channel?.commission || 0,
    status: channel?.status || 'active',
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
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'OTA' | 'Direct' | 'Partner' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Direct">{t('types.Direct')}</option>
              <option value="OTA">{t('types.OTA')}</option>
              <option value="Partner">{t('types.Partner')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.website')}</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.commission')} (%)</label>
            <input
              type="number"
              value={formData.commission}
              onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) })}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">{t('status.active')}</option>
              <option value="inactive">{t('status.inactive')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.description')}</label>
            <textarea
              value={formData.description}
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
