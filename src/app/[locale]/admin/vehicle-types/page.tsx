'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Car, Users, Settings } from 'lucide-react'

interface VehicleType {
  id: string
  name: string
  brand: string
  model: string
  passenger_capacity: number
  vehicle_category: string
  description?: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

interface VehicleTypeFormData {
  name: string
  brand: string
  model: string
  passenger_capacity: number
  vehicle_category: string
  description: string
  is_active: boolean
  display_order: number
}

export default function VehicleTypesPage() {
  const t = useTranslations()
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<VehicleType | null>(null)
  const [formData, setFormData] = useState<VehicleTypeFormData>({
    name: '',
    brand: '',
    model: '',
    passenger_capacity: 0,
    vehicle_category: 'rental',
    description: '',
    is_active: true,
    display_order: 0
  })

  // 차종 목록 가져오기
  const fetchVehicleTypes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setVehicleTypes(data || [])
    } catch (error) {
      console.error('차종 목록 조회 오류:', error)
      alert('차종 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicleTypes()
  }, [])

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      model: '',
      passenger_capacity: 0,
      vehicle_category: 'rental',
      description: '',
      is_active: true,
      display_order: 0
    })
    setEditingType(null)
  }

  // 모달 열기
  const openModal = (type?: VehicleType) => {
    if (type) {
      setEditingType(type)
      setFormData({
        name: type.name,
        brand: type.brand,
        model: type.model,
        passenger_capacity: type.passenger_capacity,
        vehicle_category: type.vehicle_category,
        description: type.description || '',
        is_active: type.is_active,
        display_order: type.display_order
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  // 모달 닫기
  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  // 폼 데이터 변경
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? parseInt(value) || 0 : value
    }))
  }

  // 차종 저장
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingType) {
        // 수정
        const { error } = await supabase
          .from('vehicle_types')
          .update(formData)
          .eq('id', editingType.id)

        if (error) throw error
        
        setVehicleTypes(prev => 
          prev.map(type => type.id === editingType.id ? { ...type, ...formData } : type)
        )
      } else {
        // 추가
        const { data, error } = await supabase
          .from('vehicle_types')
          .insert([formData])
          .select()
          .single()

        if (error) throw error
        
        setVehicleTypes(prev => [data, ...prev])
        alert('차종이 성공적으로 추가되었습니다.')
      }
      
      closeModal()
    } catch (error) {
      console.error('차종 저장 오류:', error)
      alert('차종 저장 중 오류가 발생했습니다.')
    }
  }

  // 차종 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 차종을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('vehicle_types')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setVehicleTypes(prev => prev.filter(type => type.id !== id))
      alert('차종이 성공적으로 삭제되었습니다.')
    } catch (error) {
      console.error('차종 삭제 오류:', error)
      alert('차종 삭제 중 오류가 발생했습니다.')
    }
  }

  // 활성/비활성 토글
  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('vehicle_types')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      
      setVehicleTypes(prev => 
        prev.map(type => 
          type.id === id ? { ...type, is_active: !currentStatus } : type
        )
      )
    } catch (error) {
      console.error('상태 변경 오류:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차종 관리</h1>
          <p className="text-gray-600">렌터카 차종을 추가, 수정, 삭제할 수 있습니다.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          차종 추가
        </button>
      </div>

      {/* 차종 목록 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {vehicleTypes.map((type) => (
            <li key={type.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Car className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {type.name}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        type.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {type.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {type.passenger_capacity}인승
                      </span>
                      <span>{type.brand} {type.model}</span>
                      <span className="capitalize">{type.vehicle_category}</span>
                    </div>
                    {type.description && (
                      <p className="mt-1 text-sm text-gray-600">{type.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleActive(type.id, type.is_active)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      type.is_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {type.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    onClick={() => openModal(type)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(type.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 차종 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingType ? '차종 수정' : '차종 추가'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    차종명 *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="예: Ford Transit 12 passenger"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      브랜드 *
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="예: Ford"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      모델 *
                    </label>
                    <input
                      type="text"
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="예: Transit"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      승객 수 *
                    </label>
                    <input
                      type="number"
                      name="passenger_capacity"
                      value={formData.passenger_capacity}
                      onChange={handleInputChange}
                      required
                      min="1"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      카테고리 *
                    </label>
                    <select
                      name="vehicle_category"
                      value={formData.vehicle_category}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="rental">렌탈</option>
                      <option value="company">회사차</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    설명
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="차종에 대한 추가 설명"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      표시 순서
                    </label>
                    <input
                      type="number"
                      name="display_order"
                      value={formData.display_order}
                      onChange={handleInputChange}
                      min="0"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      활성 상태
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    {editingType ? '수정' : '추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
