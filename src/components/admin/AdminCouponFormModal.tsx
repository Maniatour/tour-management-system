"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export type AdminCoupon = {
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

type AdminCouponFormModalProps = {
  coupon: AdminCoupon | null
  onClose: () => void
  onSave: (id: string, couponData: Omit<AdminCoupon, "id" | "created_at">) => void
  stackLevel?: "page" | "nested"
  defaultProductId?: string
}

function overlayClass(stack: "page" | "nested") {
  return stack === "nested" ? "z-[90]" : "z-50"
}

function childOverlayClass(stack: "page" | "nested") {
  return stack === "nested" ? "z-[100]" : "z-[60]"
}

export default function AdminCouponFormModal({
  coupon,
  onClose,
  onSave,
  stackLevel = "page",
  defaultProductId,
}: AdminCouponFormModalProps) {
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
    product_id: coupon?.product_id || defaultProductId || ''
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
      setChannels(
        (data || []).map((c) => ({
          ...c,
          type: c.type ?? '',
          status: c.status ?? '',
        }))
      )
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
      setProducts(
        (data || []).map((p) => ({
          ...p,
          sub_category: p.sub_category ?? '',
          status: p.status ?? '',
        }))
      )
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
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center ${overlayClass(stackLevel)}`}>
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ring focus:border-transparent"
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
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              {coupon ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>

      {/* 채널 선택기 모달 */}
      {showChannelSelector && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center ${childOverlayClass(stackLevel)}`}>
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
                       ? 'bg-white text-primary shadow-sm'
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
                      className="p-3 border border-gray-200 rounded-lg hover:bg-muted/50 hover:border-border cursor-pointer transition-colors"
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
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center ${childOverlayClass(stackLevel)}`}>
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
