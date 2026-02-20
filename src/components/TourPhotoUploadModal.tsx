'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { X, Camera, Upload, Calendar, MapPin, Users, User, Car, CheckCircle, AlertCircle } from 'lucide-react'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  product_name_en?: string | null;
  assigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
  vehicle_number?: string | null;
}

interface TourPhotoUploadModalProps {
  isOpen: boolean
  onClose: () => void
  locale: string
}

export default function TourPhotoUploadModal({ isOpen, onClose, locale }: TourPhotoUploadModalProps) {
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tours, setTours] = useState<ExtendedTour[]>([])
  const [selectedTour, setSelectedTour] = useState<ExtendedTour | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTours()
    }
  }, [isOpen, currentUserEmail])

  const loadTours = async () => {
    try {
      setLoading(true)
      
      if (!currentUserEmail) return

      // 최근 30일간의 투어 데이터 가져오기
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: toursData, error } = await supabase
        .from('tours')
        .select('*')
        .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
        .gte('tour_date', thirtyDaysAgoStr)
        .order('tour_date', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading tours:', error)
        return
      }

      // 상품 정보 가져오기
      const productIds = [...new Set((toursData || []).map(tour => tour.product_id).filter(Boolean))]
      let productMap = new Map()
      let productEnMap = new Map()
      
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name_ko, name_en, name')
          .in('id', productIds)
        
        productMap = new Map((productsData || []).map(p => [p.id, p.name_ko || p.name_en || p.name]))
        productEnMap = new Map((productsData || []).map(p => [p.id, p.name_en || p.name_ko || p.name]))
      }

      // 팀원 정보 가져오기
      const guideEmails = [...new Set((toursData || []).map(tour => tour.tour_guide_id).filter(Boolean))]
      const assistantEmails = [...new Set((toursData || []).map(tour => tour.assistant_id).filter(Boolean))]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]
      
      let teamMap = new Map()
      if (allEmails.length > 0) {
        const { data: teamData } = await supabase
          .from('team')
          .select('email, name_ko')
          .in('email', allEmails)
        
        teamMap = new Map((teamData || []).map(member => [member.email, member.name_ko]))
      }

      // 차량 정보 가져오기
      const vehicleIds = [...new Set((toursData || []).map(tour => tour.tour_car_id).filter(Boolean))]
      
      let vehicleMap = new Map()
      if (vehicleIds.length > 0) {
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select('id, vehicle_number, nick')
          .in('id', vehicleIds)
        
        vehicleMap = new Map((vehiclesData || []).map((vehicle: { id: string; vehicle_number: string | null; nick?: string | null }) => [vehicle.id, (vehicle.nick && vehicle.nick.trim()) || vehicle.vehicle_number || null]))
      }

      // 예약 정보로 인원 계산
      const reservationIds = [...new Set((toursData || []).flatMap(tour => {
        if (!tour.reservation_ids) return []
        return Array.isArray(tour.reservation_ids) 
          ? tour.reservation_ids 
          : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
      }))]

      let reservationMap = new Map()
      if (reservationIds.length > 0) {
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('id, total_people')
          .in('id', reservationIds)
        
        reservationMap = new Map((reservationsData || []).map(r => [r.id, r.total_people || 0]))
      }

      // 투어 데이터 확장
      const extendedTours: ExtendedTour[] = (toursData || []).map(tour => {
        let assignedPeople = 0
        if (tour.reservation_ids) {
          const ids = Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
          
          assignedPeople = ids.reduce((sum, id) => sum + (reservationMap.get(id) || 0), 0)
        }

        return {
          ...tour,
          product_name: tour.product_id ? productMap.get(tour.product_id) : null,
          product_name_en: tour.product_id ? productEnMap.get(tour.product_id) : null,
          assigned_people: assignedPeople,
          guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : null,
          assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) : null,
          vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) : null,
        }
      })

      setTours(extendedTours)
    } catch (error) {
      console.error('Error loading tours:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTours = tours.filter(tour => {
    const matchesSearch = !searchTerm || 
      (tour.product_name && tour.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tour.product_name_en && tour.product_name_en.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesDate = !dateFilter || tour.tour_date === dateFilter
    
    return matchesSearch && matchesDate
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
  }

  const handleUpload = async () => {
    if (!selectedTour || selectedFiles.length === 0) return

    try {
      setUploading(true)
      setUploadProgress(0)
      setUploadStatus('idle')

      const uploadPromises = selectedFiles.map(async (file, index) => {
        // 파일명 생성: tour_id_timestamp_originalname
        const timestamp = new Date().getTime()
        const fileExt = file.name.split('.').pop()
        const fileName = `${selectedTour.id}_${timestamp}_${index}.${fileExt}`
        
        // Supabase Storage에 업로드
        const { data, error } = await supabase.storage
          .from('tour-photos')
          .upload(fileName, file)

        if (error) {
          throw error
        }

        // 데이터베이스에 메타데이터 저장
        const { error: dbError } = await supabase
          .from('tour_photos')
          .insert({
            tour_id: selectedTour.id,
            file_name: fileName,
            original_name: file.name,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: currentUserEmail,
            uploaded_at: new Date().toISOString()
          })

        if (dbError) {
          throw dbError
        }

        setUploadProgress(((index + 1) / selectedFiles.length) * 100)
      })

      await Promise.all(uploadPromises)
      setUploadStatus('success')
      
      // 성공 후 상태 초기화
      setTimeout(() => {
        setSelectedTour(null)
        setSelectedFiles([])
        setUploadProgress(0)
        setUploadStatus('idle')
        onClose()
      }, 2000)

    } catch (error) {
      console.error('Error uploading photos:', error)
      setUploadStatus('error')
    } finally {
      setUploading(false)
    }
  }

  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = days[date.getDay()]
    return `${dateString} (${dayName})`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <Camera className="w-6 h-6 mr-2 text-orange-500" />
            투어 사진 업로드
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!selectedTour ? (
            // 투어 선택 단계
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="투어명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">투어 목록을 불러오는 중...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredTours.map((tour) => (
                    <div
                      key={tour.id}
                      onClick={() => setSelectedTour(tour)}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            {locale === 'en' ? (tour.product_name_en || tour.product_name || tour.product_id) : (tour.product_name || tour.product_id)}
                          </h4>
                          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDateWithDay(tour.tour_date)}
                            </span>
                            <span className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {tour.assigned_people || 0}명
                            </span>
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {tour.guide_name || '미배정'}
                            </span>
                            {tour.vehicle_number && (
                              <span className="flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                {tour.vehicle_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tour.tour_status === 'completed' ? 'bg-green-100 text-green-800' :
                            tour.tour_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {tour.tour_status || '상태없음'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredTours.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>선택 가능한 투어가 없습니다</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // 사진 업로드 단계
            <div className="space-y-6">
              {/* 선택된 투어 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">
                  {locale === 'en' ? (selectedTour.product_name_en || selectedTour.product_name || selectedTour.product_id) : (selectedTour.product_name || selectedTour.product_id)}
                </h4>
                <div className="flex flex-wrap gap-4 text-sm text-blue-700">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDateWithDay(selectedTour.tour_date)}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {selectedTour.assigned_people || 0}명
                  </span>
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {selectedTour.guide_name || '미배정'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTour(null)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  다른 투어 선택
                </button>
              </div>

              {/* 파일 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 선택
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  여러 장의 사진을 한 번에 선택할 수 있습니다
                </p>
              </div>

              {/* 선택된 파일 목록 */}
              {selectedFiles.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    선택된 파일 ({selectedFiles.length}개)
                  </h5>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                        <span className="truncate">{file.name}</span>
                        <span className="text-gray-500">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 업로드 진행률 */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>업로드 중...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 업로드 상태 */}
              {uploadStatus === 'success' && (
                <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  사진이 성공적으로 업로드되었습니다!
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  업로드 중 오류가 발생했습니다. 다시 시도해주세요.
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || uploading}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? '업로드 중...' : '사진 업로드'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
