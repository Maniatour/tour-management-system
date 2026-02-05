'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, Filter, Grid, List, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
// 새로운 쿠폰 스키마에 맞는 타입 정의
type Coupon = {
  id: string
  coupon_code: string | null
  discount_type: string | null
  percentage_value: number | null
  fixed_value: number | null
  status: string | null
  description: string | null
  start_date: string | null
  end_date: string | null
  channel_id: string | null
  product_id: string | null
  created_at: string | null
  updated_at: string | null
}

export default function CouponsPage() {

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [products, setProducts] = useState<{id: string, name: string}[]>([])
  const [channels, setChannels] = useState<{id: string, name: string}[]>([])
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card')

  // 쿠폰 목록 조회
  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoupons(data || [])
    } catch (error) {
      console.error('쿠폰 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 상품 목록 조회
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 목록 조회 오류:', error)
    }
  }

  // 채널 목록 조회
  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      setChannels(data || [])
    } catch (error) {
      console.error('채널 목록 조회 오류:', error)
    }
  }

  // 상품 ID를 상품 이름으로 변환
  const getProductNames = (productIds: string | null) => {
    if (!productIds) return '전체 상품'
    
    const ids = productIds.split(',').map(id => id.trim()).filter(id => id)
    if (ids.length === 0) return '전체 상품'
    
    const names = ids.map(id => {
      const product = products.find(p => p.id === id)
      return product ? product.name : id
    })
    
    if (names.length === 1) return names[0]
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}개`
  }

  // 채널 ID를 채널 이름으로 변환
  const getChannelName = (channelId: string | null) => {
    if (!channelId) return '전체 채널'
    const channel = channels.find(c => c.id === channelId)
    return channel ? channel.name : channelId
  }

  useEffect(() => {
    fetchCoupons()
    fetchProducts()
    fetchChannels()
  }, [])

  // 쿠폰 추가
  const handleAddCoupon = async (couponData: Omit<Coupon, 'id' | 'created_at'>) => {
    try {
      // product_id를 그대로 저장 (다중 상품 ID 지원)
      const productId = couponData.product_id || null

      // null 값들을 undefined로 변환하여 데이터베이스 스키마와 일치시킴
      const cleanData = {
        coupon_code: couponData.coupon_code || null,
        discount_type: couponData.discount_type || null,
        percentage_value: couponData.percentage_value || null,
        fixed_value: couponData.fixed_value || null,
        status: couponData.status || 'active',
        description: couponData.description || null,
        start_date: couponData.start_date || null,
        end_date: couponData.end_date || null,
        channel_id: couponData.channel_id || null,
        product_id: productId
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('coupons')
        .insert([cleanData])

      if (error) throw error
      
      setShowAddModal(false)
      fetchCoupons()
    } catch (error) {
      console.error('쿠폰 추가 오류:', error)
    }
  }

  // 쿠폰 수정
  const handleEditCoupon = async (id: string, couponData: Partial<Omit<Coupon, 'id' | 'created_at'>>) => {
    try {
      // product_id를 그대로 저장 (다중 상품 ID 지원)
      const productId = couponData.product_id || null

      // null 값들을 적절히 처리하여 데이터베이스 스키마와 일치시킴
      const cleanData = {
        coupon_code: couponData.coupon_code || null,
        discount_type: couponData.discount_type || null,
        percentage_value: couponData.percentage_value || null,
        fixed_value: couponData.fixed_value || null,
        status: couponData.status || 'active',
        description: couponData.description || null,
        start_date: couponData.start_date || null,
        end_date: couponData.end_date || null,
        channel_id: couponData.channel_id || null,
        product_id: productId
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('coupons')
        .update(cleanData)
        .eq('id', id)

      if (error) throw error
      
      setEditingCoupon(null)
      fetchCoupons()
    } catch (error) {
      console.error('쿠폰 수정 오류:', error)
    }
  }

  // 쿠폰 삭제
  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('정말로 이 쿠폰을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      fetchCoupons()
    } catch (error) {
      console.error('쿠폰 삭제 오류:', error)
    }
  }

  // 필터링된 쿠폰 목록
  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = (coupon.coupon_code && coupon.coupon_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (coupon.description && coupon.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || coupon.status === statusFilter
    let matchesChannel = true
    if (selectedChannelFilter === 'none') {
      matchesChannel = coupon.channel_id === null
    } else if (selectedChannelFilter !== null) {
      matchesChannel = coupon.channel_id === selectedChannelFilter
    }
    
    return matchesSearch && matchesStatus && matchesChannel
  })

  // 채널별 쿠폰 개수 계산
  const getCouponCountByChannel = (channelId: string | null) => {
    return coupons.filter(coupon => {
      const matchesSearch = (coupon.coupon_code && coupon.coupon_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (coupon.description && coupon.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesStatus = statusFilter === 'all' || coupon.status === statusFilter
      const matchesChannel = channelId === null ? coupon.channel_id === null : coupon.channel_id === channelId
      
      return matchesSearch && matchesStatus && matchesChannel
    }).length
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 - 모바일 최적화 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="mt-1 text-sm text-gray-600">쿠폰을 생성하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            <span>쿠폰 추가</span>
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="쿠폰 코드 또는 설명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
        </div>
      </div>

      {/* 채널별 탭 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedChannelFilter(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedChannelFilter === null
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체 ({getCouponCountByChannel(null)})
          </button>
          {channels
            .filter(channel => getCouponCountByChannel(channel.id) > 0)
            .map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannelFilter(channel.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedChannelFilter === channel.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {channel.name} ({getCouponCountByChannel(channel.id)})
              </button>
            ))}
          {(() => {
            const noChannelCount = coupons.filter(coupon => {
              const matchesSearch = (coupon.coupon_code && coupon.coupon_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                   (coupon.description && coupon.description.toLowerCase().includes(searchTerm.toLowerCase()))
              const matchesStatus = statusFilter === 'all' || coupon.status === statusFilter
              const matchesChannel = coupon.channel_id === null
              
              return matchesSearch && matchesStatus && matchesChannel
            }).length
            
            if (noChannelCount === 0) return null
            
            return (
              <button
                onClick={() => setSelectedChannelFilter('none')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedChannelFilter === 'none'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                채널 미지정 ({noChannelCount})
              </button>
            )
          })()}
        </div>
      </div>

      {/* 쿠폰 목록 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Loading...</div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {searchTerm || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 쿠폰이 없습니다.'}
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
            /* 테이블 뷰 - 모바일 최적화 */
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    쿠폰 코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    할인 유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    할인 값
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    적용 상품
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유효 기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    생성일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {coupon.coupon_code || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {coupon.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {coupon.discount_type === 'percentage' ? '퍼센트 할인' : 
                       coupon.discount_type === 'fixed' ? '고정 할인' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {coupon.discount_type === 'percentage' && coupon.percentage_value ? 
                        `${coupon.percentage_value}%` :
                        coupon.discount_type === 'fixed' && coupon.fixed_value ? 
                        `$${coupon.fixed_value}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {getProductNames(coupon.product_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {coupon.start_date && coupon.end_date ? 
                        `${new Date(coupon.start_date).toLocaleDateString('ko-KR')} ~ ${new Date(coupon.end_date).toLocaleDateString('ko-KR')}` :
                        coupon.start_date ? 
                        `${new Date(coupon.start_date).toLocaleDateString('ko-KR')} ~` :
                        coupon.end_date ?
                        `~ ${new Date(coupon.end_date).toLocaleDateString('ko-KR')}` :
                        '무제한'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        coupon.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {coupon.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {coupon.created_at ? new Date(coupon.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingCoupon(coupon)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
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
              {filteredCoupons.map((coupon) => (
                <div key={coupon.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="p-4 sm:p-6">
                    {/* 카드 헤더 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Ticket size={24} className="text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {coupon.coupon_code || '코드 없음'}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">
                            {coupon.description || '설명 없음'}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        coupon.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {coupon.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </div>

                    {/* 카드 내용 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">할인 유형</span>
                        <span className="font-medium">
                          {coupon.discount_type === 'percentage' ? '퍼센트 할인' : 
                           coupon.discount_type === 'fixed' ? '고정 할인' : '미지정'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">할인 값</span>
                        <span className="font-medium text-blue-600">
                          {coupon.discount_type === 'percentage' && coupon.percentage_value ? 
                            `${coupon.percentage_value}%` :
                            coupon.discount_type === 'fixed' && coupon.fixed_value ? 
                            `$${coupon.fixed_value}` : '-'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">적용 상품</span>
                        <span className="font-medium text-purple-600">{getProductNames(coupon.product_id)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">적용 채널</span>
                        <span className="font-medium text-orange-600">{getChannelName(coupon.channel_id)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">유효 기간</span>
                        <span className="font-medium text-sm">
                          {coupon.start_date && coupon.end_date ? 
                            `${new Date(coupon.start_date).toLocaleDateString('ko-KR')} ~ ${new Date(coupon.end_date).toLocaleDateString('ko-KR')}` :
                            coupon.start_date ? 
                            `${new Date(coupon.start_date).toLocaleDateString('ko-KR')} ~` :
                            coupon.end_date ?
                            `~ ${new Date(coupon.end_date).toLocaleDateString('ko-KR')}` :
                            '무제한'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">생성일</span>
                        <span className="font-medium text-gray-600">
                          {coupon.created_at ? new Date(coupon.created_at).toLocaleDateString('ko-KR') : '-'}
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingCoupon(coupon)}
                          className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                        >
                          <Edit size={14} />
                          <span>편집</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
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

             {/* 쿠폰 추가/편집 모달 */}
       {(showAddModal || editingCoupon) && (
         <CouponModal
           coupon={editingCoupon}
           onClose={() => {
             setShowAddModal(false)
             setEditingCoupon(null)
           }}
            onSave={editingCoupon ?
              (id: string, data: Omit<Coupon, 'id' | 'created_at'>) => handleEditCoupon(id, data) :
              (_id: string, data: Omit<Coupon, 'id' | 'created_at'>) => handleAddCoupon(data)
            }
         />
       )}
    </div>
  )
}

// 쿠폰 추가/편집 모달 컴포넌트
interface CouponModalProps {
  coupon: Coupon | null
  onClose: () => void
  onSave: (id: string, couponData: Omit<Coupon, 'id' | 'created_at'>) => void
}

function CouponModal({ coupon, onClose, onSave }: CouponModalProps) {
  const [formData, setFormData] = useState({
    coupon_code: coupon?.coupon_code || '',
    description: coupon?.description || '',
    discount_type: coupon?.discount_type || 'percentage',
    percentage_value: coupon?.percentage_value || 0,
    fixed_value: coupon?.fixed_value || 0,
    status: coupon?.status || 'active',
    start_date: coupon?.start_date || '',
    end_date: coupon?.end_date || '',
    channel_id: coupon?.channel_id || '',
    product_id: coupon?.product_id || ''
  })

  // 선택기 관련 상태
  const [showChannelSelector, setShowChannelSelector] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [channels, setChannels] = useState<{id: string, name: string, type: string, category: string, status: string}[]>([])
  const [products, setProducts] = useState<{id: string, name: string, category: string, sub_category: string, status: string}[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedChannelType, setSelectedChannelType] = useState<'self' | 'partner' | 'ota'>('self')
  const [selectedProductSubCategory, setSelectedProductSubCategory] = useState<string>('all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // 채널 데이터 로드
  const loadChannels = async (type?: 'self' | 'partner' | 'ota') => {
    try {
      setLoadingChannels(true)
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type, category, status')
        .eq('status', 'active')
        .eq('type', type || selectedChannelType)
        .order('name')

      if (error) throw error
      setChannels(data || [])
    } catch (error) {
      console.error('채널 로드 오류:', error)
    } finally {
      setLoadingChannels(false)
    }
  }

  // 상품 데이터 로드
  const loadProducts = async (subCategory?: string) => {
    try {
      setLoadingProducts(true)
      let query = supabase
        .from('products')
        .select('id, name, category, sub_category, status')
        .eq('status', 'active')
        .order('name')

      if (subCategory && subCategory !== 'all') {
        query = query.eq('sub_category', subCategory)
      }

      const { data, error } = await query

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 로드 오류:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // 채널 선택기 열기
  const openChannelSelector = () => {
    setShowChannelSelector(true)
    loadChannels()
  }

  // 상품 선택기 열기
  const openProductSelector = () => {
    setShowProductSelector(true)
    loadProducts()
  }

  // 상품 선택/해제
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // 선택된 상품들 적용
  const applySelectedProducts = () => {
    setFormData(prev => ({ ...prev, product_id: selectedProducts.join(',') }))
    setShowProductSelector(false)
  }

  // 상품 선택 초기화
  const clearProductSelection = () => {
    setSelectedProducts([])
    setFormData(prev => ({ ...prev, product_id: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 빈 문자열을 null로 변환
    const processedData = {
      ...formData,
      coupon_code: formData.coupon_code || null,
      description: formData.description || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      channel_id: formData.channel_id || null,
      product_id: formData.product_id || null,
      updated_at: new Date().toISOString()
    }
    
    if (coupon) {
      // 편집 모드: id와 함께 전체 데이터 전달
      onSave(coupon.id, processedData)
    } else {
      // 추가 모드: id 없이 데이터만 전달
      onSave('', processedData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">
          {coupon ? '쿠폰 편집' : '쿠폰 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              쿠폰 코드 *
            </label>
            <input
              type="text"
              required
              value={formData.coupon_code}
              onChange={(e) => setFormData(prev => ({ ...prev, coupon_code: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: WELCOME20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="쿠폰에 대한 설명을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              할인 유형 *
            </label>
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="percentage">퍼센트 할인</option>
              <option value="fixed">고정 할인</option>
            </select>
          </div>

          {/* 할인 유형에 따른 동적 입력칸 표시 */}
          {formData.discount_type === 'fixed' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고정 할인 금액 ($) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.fixed_value}
                onChange={(e) => setFormData(prev => ({ ...prev, fixed_value: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="20.00"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                퍼센트 할인 (%) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                step="0.01"
                value={formData.percentage_value}
                onChange={(e) => setFormData(prev => ({ ...prev, percentage_value: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5.00"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              채널 선택
            </label>
            <div className="flex space-x-2">
            <input
              type="text"
              value={formData.channel_id}
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                placeholder="채널을 선택하세요"
              />
              <button
                type="button"
                onClick={openChannelSelector}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                선택
              </button>
              {formData.channel_id && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, channel_id: '' }))}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품 선택 (다중 선택 가능)
            </label>
            <div className="flex space-x-2">
            <input
              type="text"
                value={formData.product_id ? `${formData.product_id.split(',').length}개 상품 선택됨` : ''}
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                placeholder="상품을 선택하세요"
              />
              <button
                type="button"
                onClick={openProductSelector}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                선택
              </button>
              {formData.product_id && (
                <button
                  type="button"
                  onClick={clearProductSelection}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  초기화
                </button>
              )}
            </div>
            {formData.product_id && formData.product_id.includes(',') && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ 여러 상품이 선택되었습니다. 모든 선택된 상품에 쿠폰이 적용됩니다.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {coupon ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>

      {/* 채널 선택기 모달 */}
      {showChannelSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">채널 선택</h3>
              <button
                onClick={() => setShowChannelSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

                         {/* 채널 타입 탭 */}
             <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1 overflow-x-auto">
               {['self', 'partner', 'ota'].map((type) => (
                 <button
                   key={type}
                   onClick={() => {
                     setSelectedChannelType(type as 'self' | 'partner' | 'ota')
                     loadChannels(type as 'self' | 'partner' | 'ota')
                   }}
                   className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                     selectedChannelType === type
                       ? 'bg-white text-blue-600 shadow-sm'
                       : 'text-gray-600 hover:text-gray-900'
                   }`}
                 >
                   {type === 'self' ? '자체' : 
                    type === 'partner' ? '제휴' : 
                    type === 'ota' ? 'OTA' : type}
                 </button>
               ))}
             </div>

            {/* 채널 목록 */}
            <div className="max-h-96 overflow-y-auto">
              {loadingChannels ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : channels.length === 0 ? (
                <div className="text-center py-8 text-gray-500">해당 타입의 채널이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, channel_id: channel.id }))
                        setShowChannelSelector(false)
                      }}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-gray-900">{channel.name}</div>
                      <div className="text-sm text-gray-500">ID: {channel.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상품 선택기 모달 */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">상품 선택</h3>
              <button
                onClick={() => setShowProductSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* 상품 서브카테고리 탭 */}
            <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1 overflow-x-auto">
              <button
                onClick={() => {
                  setSelectedProductSubCategory('all')
                  loadProducts('all')
                }}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedProductSubCategory === 'all'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                전체
              </button>
              {['Mania Tour', 'Attraction', 'Scenic'].map((subCategory) => (
                <button
                  key={subCategory}
                  onClick={() => {
                    setSelectedProductSubCategory(subCategory)
                    loadProducts(subCategory)
                  }}
                  className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedProductSubCategory === subCategory
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {subCategory === 'Mania Tour' ? '매니아 투어' : 
                   subCategory === 'Attraction' ? '관광명소' : 
                   subCategory === 'Scenic' ? '경관' : subCategory}
                </button>
              ))}
            </div>

                         {/* 상품 목록 */}
             <div className="max-h-96 overflow-y-auto">
               {loadingProducts ? (
                 <div className="text-center py-8 text-gray-500">Loading...</div>
               ) : products.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">해당 카테고리의 상품이 없습니다.</div>
               ) : (
                 <div className="space-y-2">
                   {products.map((product) => (
                     <div
                       key={product.id}
                       onClick={() => toggleProductSelection(product.id)}
                       className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                         selectedProducts.includes(product.id)
                           ? 'border-green-500 bg-green-50'
                           : 'border-gray-200 hover:bg-green-50 hover:border-green-300'
                       }`}
                     >
                       <div className="flex items-center space-x-3">
                         <input
                           type="checkbox"
                           checked={selectedProducts.includes(product.id)}
                           onChange={() => toggleProductSelection(product.id)}
                           className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                         />
                         <div className="flex-1">
                           <div className="font-medium text-gray-900">{product.name}</div>
                           <div className="text-sm text-gray-500">
                             카테고리: {product.category} | 서브카테고리: {product.sub_category} | ID: {product.id}
                           </div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             {/* 선택된 상품들 적용 버튼 */}
             <div className="mt-4 pt-4 border-t border-gray-200">
               <div className="flex items-center justify-between">
                 <div className="text-sm text-gray-600">
                   {selectedProducts.length}개 상품 선택됨
                 </div>
                 <div className="flex space-x-2">
                   <button
                     type="button"
                     onClick={() => setShowProductSelector(false)}
                     className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                   >
                     취소
                   </button>
                   <button
                     type="button"
                     onClick={applySelectedProducts}
                     className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                   >
                     적용
                   </button>
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
