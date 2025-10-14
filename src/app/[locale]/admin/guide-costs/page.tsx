'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Calendar, DollarSign } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface GuideCost {
  id: string
  product_id: string
  team_type: '1_guide' | '2_guides' | 'guide_driver'
  guide_fee: number
  assistant_fee: number
  driver_fee: number
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Product {
  id: string
  name: string
  sub_category: string
  product_guide_costs: GuideCost[]
}

interface GuideCostFormData {
  productId: string
  teamType: '1_guide' | '2_guides' | 'guide_driver'
  guideFee: number
  assistantFee: number
  driverFee: number
  effectiveFrom: string
  effectiveTo: string
}

export default function GuideCostManagementPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCost, setEditingCost] = useState<GuideCost | null>(null)
  const [formData, setFormData] = useState<GuideCostFormData>({
    productId: '',
    teamType: '1_guide',
    guideFee: 0,
    assistantFee: 0,
    driverFee: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: ''
  })
  const [saving, setSaving] = useState(false)

  // 상품 목록 로드
  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/guide-costs')
      const data = await response.json()
      
      if (!response.ok) {
        console.error('API 응답 오류:', response.status, data)
        throw new Error(data.error || `HTTP ${response.status} 오류`)
      }
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setProducts(data.products || [])
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`상품 목록을 불러오는 중 오류가 발생했습니다.\n\n오류 내용: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 가이드비 저장
  const handleSave = async () => {
    try {
      setSaving(true)
      
      const url = editingCost ? '/api/guide-costs' : '/api/guide-costs'
      const method = editingCost ? 'PUT' : 'POST'
      
      const body = editingCost 
        ? {
            id: editingCost.id,
            guideFee: formData.guideFee,
            assistantFee: formData.assistantFee,
            driverFee: formData.driverFee,
            effectiveFrom: formData.effectiveFrom,
            effectiveTo: formData.effectiveTo || null
          }
        : {
            productId: formData.productId,
            teamType: formData.teamType,
            guideFee: formData.guideFee,
            assistantFee: formData.assistantFee,
            driverFee: formData.driverFee,
            effectiveFrom: formData.effectiveFrom,
            effectiveTo: formData.effectiveTo || null
          }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      alert(editingCost ? '가이드비가 수정되었습니다.' : '가이드비가 설정되었습니다.')
      setShowModal(false)
      setEditingCost(null)
      resetForm()
      loadProducts()
    } catch (error) {
      console.error('가이드비 저장 오류:', error)
      alert('가이드비 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 가이드비 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 가이드비 설정을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/guide-costs?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      alert('가이드비가 삭제되었습니다.')
      loadProducts()
    } catch (error) {
      console.error('가이드비 삭제 오류:', error)
      alert('가이드비 삭제 중 오류가 발생했습니다.')
    }
  }

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      productId: '',
      teamType: '1_guide',
      guideFee: 0,
      assistantFee: 0,
      driverFee: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: ''
    })
  }

  // 편집 모드 열기
  const openEditModal = (cost: GuideCost) => {
    setEditingCost(cost)
    setFormData({
      productId: cost.product_id,
      teamType: cost.team_type,
      guideFee: cost.guide_fee,
      assistantFee: cost.assistant_fee,
      driverFee: cost.driver_fee,
      effectiveFrom: cost.effective_from,
      effectiveTo: cost.effective_to || ''
    })
    setShowModal(true)
  }

  // 새 가이드비 모달 열기
  const openNewModal = (productId: string) => {
    resetForm()
    setFormData(prev => ({ ...prev, productId }))
    setEditingCost(null)
    setShowModal(true)
  }

  // 팀 타입별 라벨
  const getTeamTypeLabel = (teamType: string) => {
    switch (teamType) {
      case '1_guide': return '1가이드'
      case '2_guides': return '2가이드'
      case 'guide_driver': return '가이드+드라이버'
      default: return teamType
    }
  }

  // 팀 타입별 색상
  const getTeamTypeColor = (teamType: string) => {
    switch (teamType) {
      case '1_guide': return 'bg-blue-100 text-blue-800'
      case '2_guides': return 'bg-green-100 text-green-800'
      case 'guide_driver': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">가이드비 관리</h1>
        <p className="text-gray-600">Mania Tour/Mania Service 상품의 가이드비를 설정하고 관리합니다.</p>
      </div>

      {/* 상품 목록 */}
      <div className="space-y-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.sub_category}</p>
                </div>
                <button
                  onClick={() => openNewModal(product.id)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} />
                  <span>가이드비 설정</span>
                </button>
              </div>

              {/* 가이드비 목록 */}
              {product.product_guide_costs && product.product_guide_costs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {product.product_guide_costs.map((cost) => (
                    <div key={cost.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTeamTypeColor(cost.team_type)}`}>
                          {getTeamTypeLabel(cost.team_type)}
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditModal(cost)}
                            className="p-1 text-gray-600 hover:text-blue-600"
                            title="수정"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(cost.id)}
                            className="p-1 text-gray-600 hover:text-red-600"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">가이드:</span>
                          <span className="font-medium">${cost.guide_fee}</span>
                        </div>
                        {cost.assistant_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">어시스턴트:</span>
                            <span className="font-medium">${cost.assistant_fee}</span>
                          </div>
                        )}
                        {cost.driver_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">드라이버:</span>
                            <span className="font-medium">${cost.driver_fee}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">총합:</span>
                          <span className="font-bold text-green-600">
                            ${cost.guide_fee + cost.assistant_fee + cost.driver_fee}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar size={12} />
                          <span>{cost.effective_from}</span>
                          {cost.effective_to && <span>~ {cost.effective_to}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>설정된 가이드비가 없습니다.</p>
                  <p className="text-sm">새 가이드비를 설정해주세요.</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 가이드비 설정/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCost ? '가이드비 수정' : '가이드비 설정'}
            </h3>

            <div className="space-y-4">
              {/* 팀 타입 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">팀 타입</label>
                <select
                  value={formData.teamType}
                  onChange={(e) => setFormData(prev => ({ ...prev, teamType: e.target.value as '1_guide' | '2_guides' | 'guide_driver' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!!editingCost}
                >
                  <option value="1_guide">1가이드</option>
                  <option value="2_guides">2가이드</option>
                  <option value="guide_driver">가이드+드라이버</option>
                </select>
              </div>

              {/* 가이드비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가이드비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.guideFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, guideFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 어시스턴트비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">어시스턴트비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.assistantFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, assistantFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 드라이버비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">드라이버비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.driverFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, driverFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 유효 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일 (선택)</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingCost(null)
                  resetForm()
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : (editingCost ? '수정' : '설정')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
