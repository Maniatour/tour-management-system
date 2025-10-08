'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Car, Users, X, Check, Upload, Image } from 'lucide-react'

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
  photos?: VehicleTypePhoto[]
  created_at: string
  updated_at: string
}

interface VehicleTypePhoto {
  id: string
  vehicle_type_id: string
  photo_url: string
  photo_name?: string
  description?: string
  is_primary: boolean
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

interface VehicleTypeManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onVehicleTypeSelect?: (vehicleType: VehicleType) => void
}

export default function VehicleTypeManagementModal({ 
  isOpen, 
  onClose, 
  onVehicleTypeSelect 
}: VehicleTypeManagementModalProps) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [vehicleTypePhotos, setVehicleTypePhotos] = useState<VehicleTypePhoto[]>([])
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(null)

  // 차종 목록 가져오기
  const fetchVehicleTypes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicle_types')
        .select(`
          *,
          photos:vehicle_type_photos(*)
        `)
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
    if (isOpen) {
      fetchVehicleTypes()
    }
  }, [isOpen])

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
    setImageFiles([])
    setImagePreviews([])
    setVehicleTypePhotos([])
    setPrimaryPhotoId(null)
  }

  // 편집 모달 열기
  const openEditModal = (type?: VehicleType) => {
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
      setVehicleTypePhotos(type.photos || [])
      setPrimaryPhotoId(type.photos?.find(p => p.is_primary)?.id || null)
    } else {
      resetForm()
    }
    setIsEditModalOpen(true)
  }

  // 편집 모달 닫기
  const closeEditModal = () => {
    setIsEditModalOpen(false)
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

  // 이미지 업로드
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newFiles = [...imageFiles, ...files]
      setImageFiles(newFiles)
      
      // 미리보기 생성
      const newPreviews: string[] = []
      files.forEach(file => {
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string)
          if (newPreviews.length === files.length) {
            setImagePreviews(prev => [...prev, ...newPreviews])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  // 새로 추가된 이미지 삭제
  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 기존 사진 삭제
  const removeVehicleTypePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_type_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error

      setVehicleTypePhotos(prev => prev.filter(p => p.id !== photoId))
      if (primaryPhotoId === photoId) {
        setPrimaryPhotoId(null)
      }
    } catch (error) {
      console.error('사진 삭제 오류:', error)
      alert('사진 삭제에 실패했습니다.')
    }
  }

  // 대표 사진 설정
  const setPrimaryPhoto = async (photoId: string) => {
    if (!editingType) return

    try {
      // 기존 대표 사진 해제
      if (primaryPhotoId) {
        await supabase
          .from('vehicle_type_photos')
          .update({ is_primary: false })
          .eq('id', primaryPhotoId)
      }

      // 새 대표 사진 설정
      const { error } = await supabase
        .from('vehicle_type_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) throw error

      setPrimaryPhotoId(photoId)
      setVehicleTypePhotos(prev => 
        prev.map(p => ({
          ...p,
          is_primary: p.id === photoId
        }))
      )
    } catch (error) {
      console.error('대표 사진 설정 오류:', error)
      alert('대표 사진 설정에 실패했습니다.')
    }
  }

  // 차종 저장
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let vehicleTypeId: string

      if (editingType) {
        // 수정
        const { error } = await supabase
          .from('vehicle_types')
          .update(formData)
          .eq('id', editingType.id)

        if (error) throw error
        vehicleTypeId = editingType.id
      } else {
        // 추가
        const { data, error } = await supabase
          .from('vehicle_types')
          .insert([formData])
          .select()
          .single()

        if (error) throw error
        vehicleTypeId = data.id
      }

      // 새로 추가된 사진들 저장
      if (imageFiles.length > 0) {
        const photoData = imageFiles.map((file, index) => ({
          vehicle_type_id: vehicleTypeId,
          photo_url: imagePreviews[index],
          photo_name: file.name,
          is_primary: vehicleTypePhotos.length === 0 && index === 0, // 첫 번째 사진이면 대표 사진으로 설정
          display_order: vehicleTypePhotos.length + index
        }))

        const { error: photoError } = await supabase
          .from('vehicle_type_photos')
          .insert(photoData)

        if (photoError) throw photoError
      }

      alert(editingType ? '차종이 수정되었습니다.' : '차종이 추가되었습니다.')
      closeEditModal()
      fetchVehicleTypes()
    } catch (error) {
      console.error('차종 저장 오류:', error)
      alert('차종 저장에 실패했습니다.')
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

  // 차종 선택
  const handleSelectVehicleType = (vehicleType: VehicleType) => {
    if (onVehicleTypeSelect) {
      onVehicleTypeSelect(vehicleType)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-2 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white max-h-[95vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">차종 관리</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-lg">로딩 중...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 차종 목록 */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md max-h-[60vh] overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {vehicleTypes.map((type) => (
                  <li key={type.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {type.photos && type.photos.length > 0 ? (
                            <img
                              src={type.photos.find(p => p.is_primary)?.photo_url || type.photos[0].photo_url}
                              alt={type.name}
                              className="w-16 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Car className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
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
                        {onVehicleTypeSelect && (
                          <button
                            onClick={() => handleSelectVehicleType(type)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200"
                          >
                            <Check className="w-4 h-4 mr-1 inline" />
                            선택
                          </button>
                        )}
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
                          onClick={() => openEditModal(type)}
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

            {/* 차종 추가 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => openEditModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                차종 추가
              </button>
            </div>
          </div>
        )}

        {/* 차종 편집 모달 */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingType ? '차종 수정' : '차종 추가'}
                  </h3>
                  <button
                    onClick={closeEditModal}
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

                  {/* 차종 사진 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      차종 사진
                    </label>
                    
                    {/* 기존 사진들 */}
                    {vehicleTypePhotos.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-2">기존 사진</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {vehicleTypePhotos.map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.photo_url}
                                alt={photo.photo_name || '차종 사진'}
                                className="w-20 h-16 object-cover rounded-lg"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setPrimaryPhoto(photo.id)}
                                  className={`p-1 rounded ${
                                    photo.is_primary 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-white text-gray-700 hover:bg-gray-100'
                                  }`}
                                  title={photo.is_primary ? '대표 사진' : '대표 사진으로 설정'}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeVehicleTypePhoto(photo.id)}
                                  className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                                  title="삭제"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              {photo.is_primary && (
                                <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-1 rounded">
                                  대표
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 새로 추가할 사진들 */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">새 사진 추가</h4>
                      {imagePreviews.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                          {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`새 사진 ${index + 1}`}
                                className="w-20 h-16 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeNewImage(index)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="삭제"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <Image className="mx-auto h-8 w-8 text-gray-400" />
                        <div className="mt-2">
                          <label className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                            <Upload className="w-4 h-4 mr-1" />
                            사진 추가
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">여러 사진을 선택할 수 있습니다</p>
                      </div>
                    </div>
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
                      onClick={closeEditModal}
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
    </div>
  )
}
