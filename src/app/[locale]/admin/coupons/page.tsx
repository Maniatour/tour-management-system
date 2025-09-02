'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react'
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
  const t = useTranslations('admin')

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)

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

  useEffect(() => {
    fetchCoupons()
  }, [])

  // 쿠폰 추가
  const handleAddCoupon = async (id: string, couponData: Omit<Coupon, 'id' | 'created_at'>) => {
    try {
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
        product_id: couponData.product_id || null
      }

      const { error } = await supabase
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
        product_id: couponData.product_id || null
      }

      const { error } = await supabase
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
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="text-gray-600">쿠폰을 생성하고 관리하세요</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>쿠폰 추가</span>
        </button>
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

      {/* 쿠폰 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 쿠폰이 없습니다.'}
          </div>
        ) : (
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
        )}
      </div>

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
             (id: string, data: Omit<Coupon, 'id' | 'created_at'>) => handleAddCoupon(id, data)
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
      product_id: formData.product_id || null
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
              채널 ID
            </label>
            <input
              type="text"
              value={formData.channel_id}
              onChange={(e) => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="특정 채널에만 적용 (선택사항)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품 ID
            </label>
            <input
              type="text"
              value={formData.product_id}
              onChange={(e) => setFormData(prev => ({ ...prev, product_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="특정 상품에만 적용 (선택사항)"
            />
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
    </div>
  )
}
