'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, Edit3, Save, X, AlertTriangle, Search, Filter, Download, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { getPickupHotelDisplay, getCustomerName, getProductName, getChannelName } from '@/utils/reservationUtils'
import DataReviewErrorModal from '@/components/DataReviewErrorModal'
import ProductIdMappingTool from '@/components/ProductIdMappingTool'
import FlexibleProductMappingTool from '@/components/FlexibleProductMappingTool'

type Reservation = Database['public']['Tables']['reservations']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Channel = Database['public']['Tables']['channels']['Row']
type PickupHotel = Database['public']['Tables']['pickup_hotels']['Row']

interface ReservationWithDetails extends Reservation {
  customer?: Customer
  product?: Product
  channel?: Channel
  pickupHotel?: PickupHotel
  validationErrors: string[]
  isEdited: boolean
}

interface AdminDataReviewProps {
  params: Promise<{ locale: string }>
}

export default function AdminDataReview({ }: AdminDataReviewProps) {
  const t = useTranslations('reservations')
  
  // 상태 관리
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [pickupHotels, setPickupHotels] = useState<PickupHotel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterErrors, setFilterErrors] = useState<boolean>(false)
  const [filterNoSelectedOptions, setFilterNoSelectedOptions] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<ReservationWithDetails>>({})
  const [saving, setSaving] = useState(false)
  const [showOnlyEdited, setShowOnlyEdited] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const itemsPerPage = 1000

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async (page = 1, append = false) => {
    try {
      setLoading(true)
      
      // 첫 페이지일 때만 참조 데이터 로드
      if (page === 1) {
        const [customersRes, productsRes, channelsRes, pickupHotelsRes] = await Promise.all([
          supabase.from('customers').select('*'),
          supabase.from('products').select('*'),
          supabase.from('channels').select('*'),
          supabase.from('pickup_hotels').select('*')
        ])

        if (customersRes.error) throw customersRes.error
        if (productsRes.error) throw productsRes.error
        if (channelsRes.error) throw channelsRes.error
        if (pickupHotelsRes.error) throw pickupHotelsRes.error

        setCustomers(customersRes.data || [])
        setProducts(productsRes.data || [])
        setChannels(channelsRes.data || [])
        setPickupHotels(pickupHotelsRes.data || [])
      }

      // 예약 데이터 페이지네이션으로 로드
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const reservationsRes = await supabase
        .from('reservations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (reservationsRes.error) throw reservationsRes.error

      // 총 개수 설정
      setTotalCount(reservationsRes.count || 0)
      setHasMore((reservationsRes.data?.length || 0) === itemsPerPage)

      // 예약 데이터에 상세 정보 추가 및 검증
      const reservationsWithDetails = (reservationsRes.data || []).map(reservation => ({
        ...reservation,
        customer: customers.find(c => c.id === reservation.customer_id),
        product: products.find(p => p.id === reservation.product_id),
        channel: channels.find(c => c.id === reservation.channel_id),
        pickupHotel: pickupHotels.find(h => h.id === reservation.pickup_hotel),
        validationErrors: validateReservation(reservation, customers, products, channels),
        isEdited: false
      }))

      if (append) {
        setReservations(prev => [...prev, ...reservationsWithDetails])
      } else {
        setReservations(reservationsWithDetails)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 예약 데이터 검증
  const validateReservation = (reservation: Reservation, customers: Customer[], products: Product[], channels: Channel[]): string[] => {
    const errors: string[] = []

    // 고객 검증
    if (!reservation.customer_id) {
      errors.push('고객 ID가 없습니다')
    } else if (!customers.find(c => c.id === reservation.customer_id)) {
      errors.push('존재하지 않는 고객입니다')
    }

    // 상품 검증
    if (!reservation.product_id) {
      errors.push('상품 ID가 없습니다')
    } else if (!products.find(p => p.id === reservation.product_id)) {
      errors.push('존재하지 않는 상품입니다')
    }

    // 채널 검증
    if (!reservation.channel_id) {
      errors.push('채널 ID가 없습니다')
    } else if (!channels.find(c => c.id === reservation.channel_id)) {
      errors.push('존재하지 않는 채널입니다')
    }

    // 필수 필드 검증
    if (!reservation.tour_date) {
      errors.push('투어 날짜가 없습니다')
    }

    if (!reservation.adults && reservation.adults !== 0) {
      errors.push('성인 인원이 없습니다')
    }

    if (!reservation.channel_rn) {
      errors.push('채널 RN이 없습니다')
    }

    return errors
  }

  // 필터링된 예약 데이터
  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = !searchTerm || 
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.channel_rn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === 'all' || reservation.status === filterStatus
    const matchesErrors = !filterErrors || reservation.validationErrors.length > 0
    const matchesEdited = !showOnlyEdited || reservation.isEdited
    
    // selected_options가 없는 예약만 필터링
    const matchesNoSelectedOptions = !filterNoSelectedOptions || 
      !reservation.selected_options || 
      Object.keys(reservation.selected_options).length === 0

    return matchesSearch && matchesStatus && matchesErrors && matchesEdited && matchesNoSelectedOptions
  })

  // 편집 시작
  const startEdit = (reservation: ReservationWithDetails) => {
    setEditingId(reservation.id)
    setEditedData({ ...reservation })
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingId(null)
    setEditedData({})
  }

  // 편집 저장
  const saveEdit = async () => {
    if (!editingId || !editedData) return

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('reservations')
        .update({
          customer_id: editedData.customer_id,
          product_id: editedData.product_id,
          channel_id: editedData.channel_id,
          tour_date: editedData.tour_date,
          tour_time: editedData.tour_time,
          adults: editedData.adults,
          child: editedData.child,
          infant: editedData.infant,
          pickup_hotel: editedData.pickup_hotel,
          pickup_time: editedData.pickup_time,
          status: editedData.status,
          channel_rn: editedData.channel_rn,
          event_note: editedData.event_note
        })
        .eq('id', editingId)

      if (error) throw error

      // 로컬 상태 업데이트
      setReservations(prev => prev.map(r => 
        r.id === editingId 
          ? { ...r, ...editedData, isEdited: false, validationErrors: validateReservation(editedData as Reservation, customers, products, channels) }
          : r
      ))

      setEditingId(null)
      setEditedData({})
    } catch (error) {
      console.error('Error saving reservation:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 일괄 수정
  const bulkUpdate = async (field: keyof Reservation, value: any) => {
    const selectedReservations = filteredReservations.filter(r => r.validationErrors.length > 0)
    
    try {
      setSaving(true)
      
      const updates = selectedReservations.map(reservation => 
        supabase
          .from('reservations')
          .update({ [field]: value })
          .eq('id', reservation.id)
      )

      await Promise.all(updates)
      
      // 데이터 다시 로드
      await loadData()
    } catch (error) {
      console.error('Error bulk updating:', error)
      alert('일괄 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 통계 계산
  const stats = {
    total: reservations.length,
    withErrors: reservations.filter(r => r.validationErrors.length > 0).length,
    edited: reservations.filter(r => r.isEdited).length,
    valid: reservations.filter(r => r.validationErrors.length === 0).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">예약 데이터 검수</h1>
          <p className="text-gray-600">구글시트에서 가져온 데이터를 검수하고 수정할 수 있습니다.</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">전체 예약</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">오류 있음</p>
                <p className="text-2xl font-bold text-gray-900">{stats.withErrors}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Edit3 className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">수정됨</p>
                <p className="text-2xl font-bold text-gray-900">{stats.edited}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">유효함</p>
                <p className="text-2xl font-bold text-gray-900">{stats.valid}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 유연한 상품 매핑 도구 */}
        <FlexibleProductMappingTool onDataUpdated={loadData} />

        {/* 상품 ID 매핑 도구 (기존) */}
        <ProductIdMappingTool onDataUpdated={loadData} />

        {/* 일괄 수정 도구 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-yellow-900 mb-3">일괄 수정 도구</h3>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">상태 변경:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkUpdate('status', e.target.value)
                    e.target.value = ''
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">상태 선택</option>
                <option value="pending">대기중</option>
                <option value="confirmed">확정</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
                <option value="recruiting">모집중</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">채널 변경:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkUpdate('channel_id', e.target.value)
                    e.target.value = ''
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">채널 선택</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">상품 변경:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkUpdate('product_id', e.target.value)
                    e.target.value = ''
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">상품 선택</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-yellow-700 mt-2">
            * 오류가 있는 예약들에만 적용됩니다.
          </p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="예약 ID, 채널 RN, 고객명, 상품명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
              <option value="recruiting">모집중</option>
            </select>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filterErrors}
                onChange={(e) => setFilterErrors(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">오류만 보기</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showOnlyEdited}
                onChange={(e) => setShowOnlyEdited(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">수정된 것만 보기</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filterNoSelectedOptions}
                onChange={(e) => setFilterNoSelectedOptions(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">selected_options 없는 것만</span>
            </label>
          </div>
        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    예약 ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    채널 RN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    투어 날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    인원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    오류
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className={reservation.validationErrors.length > 0 ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        reservation.validationErrors.length > 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {reservation.validationErrors.length > 0 ? '오류' : '정상'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {reservation.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === reservation.id ? (
                        <input
                          type="text"
                          value={editedData.channel_rn || ''}
                          onChange={(e) => setEditedData(prev => ({ ...prev, channel_rn: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        reservation.channel_rn
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === reservation.id ? (
                        <select
                          value={editedData.customer_id || ''}
                          onChange={(e) => setEditedData(prev => ({ ...prev, customer_id: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">고객 선택</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        reservation.customer?.name || '고객 없음'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === reservation.id ? (
                        <select
                          value={editedData.product_id || ''}
                          onChange={(e) => setEditedData(prev => ({ ...prev, product_id: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">상품 선택</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        reservation.product?.name || '상품 없음'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === reservation.id ? (
                        <input
                          type="date"
                          value={editedData.tour_date || ''}
                          onChange={(e) => setEditedData(prev => ({ ...prev, tour_date: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        reservation.tour_date
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === reservation.id ? (
                        <div className="flex space-x-1">
                          <input
                            type="number"
                            placeholder="성인"
                            value={editedData.adults || ''}
                            onChange={(e) => setEditedData(prev => ({ ...prev, adults: parseInt(e.target.value) || 0 }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="number"
                            placeholder="아동"
                            value={editedData.child || ''}
                            onChange={(e) => setEditedData(prev => ({ ...prev, child: parseInt(e.target.value) || 0 }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="number"
                            placeholder="유아"
                            value={editedData.infant || ''}
                            onChange={(e) => setEditedData(prev => ({ ...prev, infant: parseInt(e.target.value) || 0 }))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ) : (
                        `성인${reservation.adults} 아동${reservation.child} 유아${reservation.infant}`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reservation.validationErrors.length > 0 ? (
                        <button
                          onClick={() => {
                            setSelectedReservation(reservation)
                            setShowErrorModal(true)
                          }}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-800 transition-colors"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>{reservation.validationErrors.length}개</span>
                        </button>
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === reservation.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(reservation)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 더 많은 데이터 로드 버튼 */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                const nextPage = currentPage + 1
                setCurrentPage(nextPage)
                loadData(nextPage, true)
              }}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>로딩 중...</span>
                </>
              ) : (
                <>
                  <span>더 많은 데이터 로드 ({totalCount - reservations.length}개 남음)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 결과 요약 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          {filteredReservations.length}개 예약 중 {reservations.filter(r => r.validationErrors.length > 0).length}개에 오류가 있습니다.
          {totalCount > reservations.length && (
            <span className="ml-2 text-blue-600">
              (전체 {totalCount}개 중 {reservations.length}개 로드됨)
            </span>
          )}
        </div>
      </div>

      {/* 오류 상세 모달 */}
      {selectedReservation && (
        <DataReviewErrorModal
          isOpen={showErrorModal}
          onClose={() => {
            setShowErrorModal(false)
            setSelectedReservation(null)
          }}
          reservation={selectedReservation}
        />
      )}
    </div>
  )
}
