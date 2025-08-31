'use client'

import { useState, use, useCallback, useEffect, useRef } from 'react'
import { Plus, Search, Edit, Trash2, Calendar, Clock, MapPin, Users, User, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { sanitizeTimeInput } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import CustomerForm from '@/components/CustomerForm'

type Customer = Database['public']['Tables']['customers']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Channel = Database['public']['Tables']['channels']['Row']
type ProductOption = Database['public']['Tables']['product_options']['Row']
type ProductOptionChoice = Database['public']['Tables']['product_option_choices']['Row']
type Option = Database['public']['Tables']['options']['Row']

interface Reservation {
  id: string
  customerId: string
  productId: string
  tourDate: string
  tourTime: string
  eventNote: string
  pickUpHotel: string
  pickUpTime: string
  adults: number
  child: number
  infant: number
  totalPeople: number
  channelId: string
  channelRN: string
  addedBy: string
  addedTime: string
  tourId: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  selectedOptions?: { [optionId: string]: string[] } // 선택된 옵션들
  selectedOptionPrices?: { [key: string]: number } // 선택된 옵션의 사용자 정의 요금
}

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ params }: AdminReservationsProps) {
  const { locale } = use(params)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  
  // 예약 데이터
  const [reservations, setReservations] = useState<Reservation[]>([])
  
  // 고객 데이터
  const [customers, setCustomers] = useState<Customer[]>([])
  
  // 상품 데이터
  const [products, setProducts] = useState<Product[]>([])
  
  // 채널 데이터
  const [channels, setChannels] = useState<Channel[]>([])
  
  // 상품 옵션 데이터
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  
  // 옵션 선택지 데이터
  const [optionChoices, setOptionChoices] = useState<ProductOptionChoice[]>([])
  
  // 기본 옵션 데이터
  const [options, setOptions] = useState<Option[]>([])
  
  const [loading, setLoading] = useState(true)

  // Supabase에서 데이터 가져오기
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching customers:', error)
        return
      }

      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching channels:', error)
        return
      }

      setChannels(data || [])
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  const fetchProductOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching product options:', error)
        return
      }

      setProductOptions(data || [])
    } catch (error) {
      console.error('Error fetching product options:', error)
    }
  }

  const fetchOptionChoices = async () => {
    try {
      const { data, error } = await supabase
        .from('product_option_choices')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching option choices:', error)
        return
      }

      setOptionChoices(data || [])
    } catch (error) {
      console.error('Error fetching option choices:', error)
    }
  }

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching options:', error)
        return
      }

      setOptions(data || [])
    } catch (error) {
      console.error('Error fetching options:', error)
    }
  }

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching reservations:', error)
        return
      }

      // Supabase 데이터를 로컬 Reservation 타입으로 변환
      const mappedReservations: Reservation[] = (data || []).map(item => ({
        id: item.id,
        customerId: item.customer_id || '',
        productId: item.product_id || '',
        tourDate: item.tour_date || '',
        tourTime: item.tour_time || '',
        eventNote: item.event_note || '',
        pickUpHotel: item.pickup_hotel || '',
        pickUpTime: item.pickup_time || '',
        adults: item.adults || 0,
        child: item.child || 0,
        infant: item.infant || 0,
        totalPeople: item.total_people || 0,
        channelId: item.channel_id || '',
        channelRN: item.channel_rn || '',
        addedBy: item.added_by || '',
        addedTime: item.created_at || '',
        tourId: item.id, // 임시로 id 사용
        status: (item.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
        selectedOptions: {}, // 선택된 옵션은 빈 객체로 초기화
        selectedOptionPrices: {} // 선택된 옵션의 사용자 정의 요금은 빈 객체로 초기화
      }))

      setReservations(mappedReservations)
    } catch (error) {
      console.error('Error fetching reservations:', error)
    }
  }

  // 컴포넌트 마운트 시 데이터 불러오기
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchCustomers(),
        fetchProducts(),
        fetchChannels(),
        fetchProductOptions(),
        fetchOptionChoices(),
        fetchOptions(),
        fetchReservations()
      ])
      setLoading(false)
    }
    
    loadData()
  }, [])

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = 
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.channelRN.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customers.find(c => c.id === reservation.customerId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      products.find(p => p.id === reservation.productId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = selectedStatus === 'all' || reservation.status === selectedStatus
    
    return matchesSearch && matchesStatus
  })

  const handleAddReservation = (reservation: Omit<Reservation, 'id'>) => {
    const newReservation: Reservation = {
      ...reservation,
      id: `RES-${Date.now().toString().slice(-6)}`
    }
    setReservations([...reservations, newReservation])
    setShowAddForm(false)
  }

  const handleEditReservation = (reservation: Omit<Reservation, 'id'>) => {
    if (editingReservation) {
      const updatedReservation: Reservation = {
        ...reservation,
        id: editingReservation.id
      }
      setReservations(reservations.map(r => r.id === editingReservation.id ? updatedReservation : r))
      setEditingReservation(null)
    }
  }

  const handleDeleteReservation = (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      setReservations(reservations.filter(r => r.id !== id))
    }
  }

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // Supabase에 저장
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 고객 목록 새로고침
      await fetchCustomers()
      setShowCustomerForm(false)
      alert('고객이 성공적으로 추가되었습니다!')
      
      // 새로 추가된 고객을 자동으로 선택 (예약 폼이 열려있는 경우)
      if (showAddForm && data && data[0]) {
        const newCustomer = data[0]
        alert(`새 고객 "${newCustomer.name}"이 추가되었습니다. 고객을 선택해주세요.`)
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [showAddForm])

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown'
  }

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || 'Unknown'
  }

  const getChannelName = (channelId: string) => {
    return channels.find(c => c.id === channelId)?.name || 'Unknown'
  }

  const getStatusLabel = (status: string) => {
    return t(`status.${status}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateTotalPrice = (reservation: Reservation) => {
    const product = products.find(p => p.id === reservation.productId)
    if (!product || !product.base_price) return 0
    
    // 기본 가격을 성인/아동/유아로 나누어 계산 (간단한 계산)
    let adultPrice = product.base_price
    let childPrice = product.base_price * 0.7 // 아동은 성인의 70%
    let infantPrice = product.base_price * 0.3 // 유아는 성인의 30%
    
    // 선택된 옵션의 가격 조정 적용
    if (reservation.selectedOptions) {
      Object.entries(reservation.selectedOptions).forEach(([optionId, choiceIds]) => {
        if (Array.isArray(choiceIds)) {
          choiceIds.forEach(choiceId => {
            const choice = optionChoices.find(c => c.id === choiceId)
            if (choice) {
              if (choice.adult_price_adjustment !== null) {
                adultPrice += choice.adult_price_adjustment
              }
              if (choice.child_price_adjustment !== null) {
                childPrice += choice.child_price_adjustment
              }
              if (choice.infant_price_adjustment !== null) {
                infantPrice += choice.infant_price_adjustment
              }
            }
          })
        }
      })
    }
    
    // 사용자가 입력한 요금 정보 적용
    if (reservation.selectedOptionPrices) {
      Object.entries(reservation.selectedOptionPrices).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (key.includes('_adult')) {
            adultPrice += value
          } else if (key.includes('_child')) {
            childPrice += value
          } else if (key.includes('_infant')) {
            infantPrice += value
          }
        }
      })
    }
    
    return (
      reservation.adults * adultPrice +
      reservation.child * childPrice +
      reservation.infant * infantPrice
    )
  }

  // 상품의 필수 선택 옵션을 카테고리별로 그룹화하여 가져오기
  const getRequiredOptionsForProduct = (productId: string) => {
    const requiredOptions = productOptions.filter(option => 
      option.product_id === productId && option.is_required === true
    )
    
    // 카테고리별로 그룹화 (options 테이블의 category 사용)
    const groupedOptions = requiredOptions.reduce((groups, option) => {
      // linked_option_id를 통해 options 테이블의 category 가져오기
      const linkedOption = options.find(opt => opt.id === option.linked_option_id)
      const category = linkedOption?.category || '기타'
      
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(option)
      return groups
    }, {} as Record<string, ProductOption[]>)
    
    return groupedOptions
  }

  // 옵션의 선택지 가져오기
  const getChoicesForOption = (optionId: string) => {
    return optionChoices.filter(choice => choice.product_option_id === optionId)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addReservation')}</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{t('filter.allStatus')}</option>
          <option value="pending">{t('status.pending')}</option>
          <option value="confirmed">{t('status.confirmed')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </select>
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      ) : (
      <div className="bg-white rounded-lg shadow-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.id')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.customer')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.product')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.tourInfo')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.participants')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.channel')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('form.price')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{reservation.id}</div>
                    <div className="text-sm text-gray-500">{reservation.channelRN}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{getCustomerName(reservation.customerId)}</div>
                        <div className="text-sm text-gray-500">{customers.find(c => c.id === reservation.customerId)?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId)}</div>
                    <div className="text-sm text-gray-500">{products.find(p => p.id === reservation.productId)?.category}</div>
                    {/* 선택된 옵션 표시 */}
                    {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-600">선택된 옵션:</div>
                        {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                          const option = productOptions.find(opt => opt.id === optionId)
                          const choices = choiceIds.map(choiceId => 
                            optionChoices.find(choice => choice.id === choiceId)?.name
                          ).filter(Boolean)
                          
                          return (
                            <div key={optionId} className="text-xs text-gray-500">
                              <span className="font-medium">{option?.name}:</span> {choices.join(', ')}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-900">{reservation.tourDate}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-900">{reservation.tourTime}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-500">{reservation.pickUpHotel}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">성인:</span>
                        <span className="text-gray-900">{reservation.adults}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">아동:</span>
                        <span className="text-gray-900">{reservation.child}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">유아:</span>
                        <span className="text-gray-900">{reservation.infant}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        총 {reservation.totalPeople}명
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getChannelName(reservation.channelId)}</div>
                    <div className="text-sm text-gray-500">{channels.find(c => c.id === reservation.channelId)?.type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {calculateTotalPrice(reservation).toLocaleString()}원
                    </div>
                    <div className="text-xs text-gray-500">
                      성인: {reservation.adults}명, 아동: {reservation.child}명, 유아: {reservation.infant}명
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                      {getStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingReservation(reservation)}
                        className="text-blue-600 hover:text-blue-900"
                        title={tCommon('edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteReservation(reservation.id)}
                        className="text-red-600 hover:text-red-900"
                        title={tCommon('delete')}
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
        )}

      {/* 예약 추가/편집 모달 */}
      {(showAddForm || editingReservation) && (
        <ReservationForm
          reservation={editingReservation}
          customers={customers}
          products={products}
          channels={channels}
          productOptions={productOptions}
          optionChoices={optionChoices}
          options={options}
          onSubmit={editingReservation ? handleEditReservation : handleAddReservation}
          onCancel={() => {
            setShowAddForm(false)
            setEditingReservation(null)
          }}
          onRefreshCustomers={fetchCustomers}
          getRequiredOptionsForProduct={getRequiredOptionsForProduct}
          getChoicesForOption={getChoicesForOption}
        />
      )}

      {/* 고객 추가 모달 */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}
    </div>
  )
}

interface ReservationFormProps {
  reservation?: Reservation | null
  customers: Customer[]
  products: Product[]
  channels: Channel[]
  productOptions: ProductOption[]
  optionChoices: ProductOptionChoice[]
  options: Option[]
  onSubmit: (reservation: Omit<Reservation, 'id'>) => void
  onCancel: () => void
  onRefreshCustomers: () => Promise<void>
  getRequiredOptionsForProduct: (productId: string) => ProductOption[]
  getChoicesForOption: (optionId: string) => ProductOptionChoice[]
}

function ReservationForm({ reservation, customers, products, channels, productOptions, optionChoices, options, onSubmit, onCancel, onRefreshCustomers, getRequiredOptionsForProduct, getChoicesForOption }: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState<{
    customerId: string
    customerSearch: string
    showCustomerDropdown: boolean
    productId: string
    selectedProductCategory: string
    selectedProductSubCategory: string
    productSearch: string
    tourDate: string
    tourTime: string
    eventNote: string
    pickUpHotel: string
    pickUpTime: string
    adults: number
    child: number
    infant: number
    totalPeople: number
    channelId: string
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    channelRN: string
    addedBy: string
    addedTime: string
    tourId: string
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    selectedOptions: { [optionId: string]: string[] }
    selectedOptionPrices: { [key: string]: number }
  }>({
    customerId: reservation?.customerId || '',
    customerSearch: reservation?.customerId ? 
      customers.find(c => c.id === reservation.customerId)?.name || '' : '',
    showCustomerDropdown: false,
    productId: reservation?.productId || '',
    selectedProductCategory: '',
    selectedProductSubCategory: '',
    productSearch: '',
    tourDate: reservation?.tourDate || '',
    tourTime: reservation?.tourTime || '',
    eventNote: reservation?.eventNote || '',
    pickUpHotel: reservation?.pickUpHotel || '',
    pickUpTime: reservation?.pickUpTime || '',
    adults: reservation?.adults || 1,
    child: reservation?.child || 0,
    infant: reservation?.infant || 0,
    totalPeople: reservation?.totalPeople || 1,
    channelId: reservation?.channelId || '',
    selectedChannelType: 'self',
    channelSearch: '',
    channelRN: reservation?.channelRN || '',
    addedBy: reservation?.addedBy || '',
    addedTime: reservation?.addedTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
    tourId: reservation?.tourId || '',
    status: reservation?.status || 'pending',
    selectedOptions: reservation?.selectedOptions || {},
    selectedOptionPrices: reservation?.selectedOptionPrices || {}
  })

  // 현재 사용자 정보 가져오기
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (user && !error) {
          setCurrentUser({ email: user.email || '' })
          // 새 예약인 경우에만 현재 사용자 이메일로 설정
          if (!reservation) {
            setFormData(prev => ({ ...prev, addedBy: user.email || '' }))
          }
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    
    getCurrentUser()
  }, [reservation])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 옵션이 모두 선택되었는지 확인 (카테고리별로 하나씩)
    const requiredOptions = getRequiredOptionsForProduct(formData.productId)
    const missingCategories = Object.entries(requiredOptions).filter(([category, options]) => {
      // 해당 카테고리에서 선택된 옵션이 있는지 확인
      return !options.some(option => 
        formData.selectedOptions[option.id] && formData.selectedOptions[option.id].length > 0
      )
    })
    
    if (missingCategories.length > 0) {
      alert(`다음 카테고리에서 필수 옵션을 선택해주세요:\n${missingCategories.map(([category]) => category).join('\n')}`)
      return
    }
    
    const totalPeople = formData.adults + formData.child + formData.infant
    onSubmit({
      ...formData,
      totalPeople
    })
  }

  const updateTotalPeople = () => {
    const total = formData.adults + formData.child + formData.infant
    setFormData({ ...formData, totalPeople: total })
  }

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // Supabase에 저장
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 고객 목록 새로고침
      await onRefreshCustomers()
      setShowCustomerForm(false)
      alert('고객이 성공적으로 추가되었습니다!')
      
      // 새로 추가된 고객을 자동으로 선택
      if (data && data[0]) {
        setFormData(prev => ({
          ...prev,
          customerId: data[0].id,
          customerSearch: `${data[0].name}${data[0].email ? ` (${data[0].email})` : ''}`,
          showCustomerDropdown: false
        }))
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
    }, [])

  // 외부 클릭 시 고객 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setFormData(prev => ({ ...prev, showCustomerDropdown: false }))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-7xl max-h-[95vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-bold">
          {reservation ? t('form.editTitle') : t('form.title')}
        </h2>
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
             <select
               value={formData.status}
               onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' })}
               className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
             >
               <option value="pending">{t('status.pending')}</option>
               <option value="confirmed">{t('status.confirmed')}</option>
               <option value="completed">{t('status.completed')}</option>
               <option value="cancelled">{t('status.cancelled')}</option>
             </select>
           </div>
         </div>
        <form onSubmit={handleSubmit} className="space-y-4">
           {/* 4열 그리드 레이아웃 */}
           <div className="grid grid-cols-4 gap-4">
             {/* 1-2열 합친 영역: 고객, 투어 정보, 픽업 정보, 참가자 수, 추가 정보 */}
             <div className="col-span-2 space-y-4">
               {/* 첫 번째 행: 고객, 채널 RN# */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.customer')}</label>
                   <div className="relative" ref={customerSearchRef}>
                     <input
                       type="text"
                       value={formData.customerSearch || ''}
                       onChange={(e) => {
                         setFormData({ ...formData, customerSearch: e.target.value })
                         // 검색어가 변경되면 고객 ID 초기화
                         if (e.target.value === '') {
                           setFormData(prev => ({ ...prev, customerId: '' }))
                         }
                       }}
                       onFocus={() => setFormData(prev => ({ ...prev, showCustomerDropdown: true }))}
                       placeholder="고객 이름, 이메일, 전화번호로 검색..."
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                required
                     />
                     <button
                       type="button"
                       onClick={() => setShowCustomerForm(true)}
                       className="absolute right-1 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                     >
                       + 고객 추가
                     </button>
                     
                     {/* 고객 검색 드롭다운 */}
                     {formData.showCustomerDropdown && formData.customerSearch && (
                       <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                         {customers
                           .filter(customer => 
                             customer.name?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                             customer.email?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                             customer.phone?.toLowerCase().includes(formData.customerSearch.toLowerCase())
                           )
                           .slice(0, 10) // 최대 10개만 표시
                           .map(customer => (
                             <div
                               key={customer.id}
                               onClick={() => {
                                 setFormData(prev => ({
                                   ...prev,
                                   customerId: customer.id,
                                   customerSearch: `${customer.name}${customer.email ? ` (${customer.email})` : ''}`,
                                   showCustomerDropdown: false
                                 }))
                               }}
                               className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                             >
                               <div className="font-medium text-gray-900">{customer.name}</div>
                               {customer.email && (
                                 <div className="text-sm text-gray-500">{customer.email}</div>
                               )}
                               {customer.phone && (
                                 <div className="text-sm text-gray-500">{customer.phone}</div>
                               )}
                             </div>
                           ))}
                         {customers.filter(customer => 
                           customer.name?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                           customer.email?.toLowerCase().includes(formData.customerSearch.toLowerCase()) ||
                           customer.phone?.toLowerCase().includes(formData.customerSearch.toLowerCase())
                         ).length === 0 && (
                           <div className="px-3 py-2 text-gray-500 text-center">
                             검색 결과가 없습니다
                           </div>
                         )}
                       </div>
                     )}
                     
                     {/* 선택된 고객 표시 */}
                     {formData.customerId && !formData.showCustomerDropdown && (
                       <div className="mt-1 text-xs text-gray-600">
                         선택된 고객: {customers.find(c => c.id === formData.customerId)?.name}
                       </div>
                     )}
                   </div>
            </div>
                 
            <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.channelRN')}</label>
                   <input
                     type="text"
                     value={formData.channelRN}
                     onChange={(e) => setFormData({ ...formData, channelRN: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder={t('form.channelRNPlaceholder')}
                   />
            </div>
          </div>

               {/* 두 번째 행: 투어 날짜, 투어 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourDate')}</label>
              <input
                type="date"
                value={formData.tourDate}
                onChange={(e) => setFormData({ ...formData, tourDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
                 
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.tourTime')}</label>
              <input
                type="time"
                value={formData.tourTime}
                onChange={(e) => setFormData({ ...formData, tourTime: sanitizeTimeInput(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

               {/* 세 번째 행: 픽업 호텔, 픽업 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.pickUpHotel')}</label>
              <input
                type="text"
                value={formData.pickUpHotel}
                onChange={(e) => setFormData({ ...formData, pickUpHotel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
                 
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.pickUpTime')}</label>
              <input
                type="time"
                value={formData.pickUpTime}
                onChange={(e) => setFormData({ ...formData, pickUpTime: sanitizeTimeInput(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

               {/* 네 번째 행: 참가자 수 설정 */}
          <div>
            
                 <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">{t('form.adults')}</label>
                <input
                  type="number"
                  value={formData.adults}
                  onChange={(e) => {
                    setFormData({ ...formData, adults: Number(e.target.value) })
                    updateTotalPeople()
                  }}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">{t('form.child')}</label>
                <input
                  type="number"
                  value={formData.child}
                  onChange={(e) => {
                    setFormData({ ...formData, child: Number(e.target.value) })
                    updateTotalPeople()
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">{t('form.infant')}</label>
                <input
                  type="number"
                  value={formData.infant}
                  onChange={(e) => {
                    setFormData({ ...formData, infant: Number(e.target.value) })
                    updateTotalPeople()
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            <div>
                     <label className="block text-xs text-gray-600 mb-1">총 인원</label>
                     <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700">
                       <span className="font-medium">{formData.totalPeople}</span>명
            </div>
          </div>
            </div>
          </div>

                              {/* 다섯 번째 행: 특별 요청 사항 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.eventNote')}</label>
                 <textarea
                   value={formData.eventNote}
                   onChange={(e) => setFormData({ ...formData, eventNote: e.target.value })}
                   rows={3}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder={t('form.eventNotePlaceholder')}
                 />
               </div>
             </div>
              
              {/* 3열: 상품 선택 (카테고리, 서브카테고리별 탭) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.product')}</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* 상품 카테고리별 탭 */}
                  <div className="flex bg-gray-50">
                    {Array.from(new Set(products.map(p => p.category))).filter(Boolean).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          selectedProductCategory: category || '',
                          selectedProductSubCategory: '' // 카테고리 변경 시 서브카테고리 초기화
                        }))}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          (formData.selectedProductCategory || '') === category
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  
                  {/* 서브카테고리 선택 (카테고리가 선택된 경우에만 표시) */}
                  {formData.selectedProductCategory && (
                    <div className="flex bg-gray-100 border-b border-gray-200">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, selectedProductSubCategory: '' }))}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${
                          !formData.selectedProductSubCategory
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {t('form.allCategories')}
                      </button>
                      {Array.from(new Set(
                        products
                          .filter(p => p.category === formData.selectedProductCategory && p.sub_category)
                          .map(p => p.sub_category)
                      )).filter(Boolean).map((subCategory) => (
                        <button
                          key={subCategory}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, selectedProductSubCategory: subCategory || '' }))}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${
                            formData.selectedProductSubCategory === subCategory
                              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {subCategory}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 상품명 검색 */}
                  <div className="p-3 bg-white border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="상품명 검색..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      onChange={(e) => setFormData(prev => ({ ...prev, productSearch: e.target.value }))}
                    />
                  </div>
                  
                  {/* 상품 선택 리스트 */}
                  <div className="max-h-80 overflow-y-auto">
                    {products
                      .filter(product => {
                        const matchesCategory = !formData.selectedProductCategory || product.category === formData.selectedProductCategory
                        const matchesSubCategory = !formData.selectedProductSubCategory || product.sub_category === formData.selectedProductSubCategory
                        const matchesSearch = !formData.productSearch || 
                          product.name?.toLowerCase().includes(formData.productSearch.toLowerCase()) ||
                          product.sub_category?.toLowerCase().includes(formData.productSearch.toLowerCase())
                        return matchesCategory && matchesSubCategory && matchesSearch
                      })
                      .map(product => (
                        <div
                          key={product.id}
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            productId: prev.productId === product.id ? '' : product.id,
                            selectedOptions: {} // 상품 변경 시 선택된 옵션 초기화
                          }))}
                          className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                            formData.productId === product.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="text-sm text-gray-900">{product.name}</div>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* 선택된 상품 정보 표시 */}
                {formData.productId && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">{t('form.selectedProduct')}</h4>
                    {(() => {
                      const selectedProduct = products.find(p => p.id === formData.productId)
                      return selectedProduct ? (
                        <div className="space-y-2">
                          <div className="font-medium text-gray-900">{selectedProduct.name}</div>
                          <div className="flex items-center gap-2 text-sm">
                            {selectedProduct.category && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                {selectedProduct.category}
                              </span>
                            )}
                            {selectedProduct.sub_category && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                {selectedProduct.sub_category}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
                
                {/* 선택된 상품의 필수 옵션 표시 */}
                {formData.productId && (
                  <div className="mt-4">
                    
                                         <div className="space-y-4">
                       {Object.entries(getRequiredOptionsForProduct(formData.productId)).map(([category, options]) => (
                         <div key={category} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                           <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">
                             {category} 카테고리 (하나 선택 필수)
                           </h4>
                           <div className="space-y-3">
                             {options.map((option) => {
                               const choices = getChoicesForOption(option.id)
                               return choices.map((choice) => (
                                 <div key={choice.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50">
                                   <div className="flex items-center space-x-3 mb-2">
                                     <input
                                       type="radio"
                                       name={`category_${category}`}
                                       value={choice.id}
                                       checked={formData.selectedOptions[option.id]?.includes(choice.id) || false}
                                       onChange={(e) => {
                                         if (e.target.checked) {
                                           // 같은 카테고리의 다른 옵션들은 선택 해제
                                           const updatedSelectedOptions = { ...formData.selectedOptions }
                                           options.forEach(opt => {
                                             if (opt.id !== option.id) {
                                               updatedSelectedOptions[opt.id] = []
                                             }
                                           })
                                           
                                           setFormData(prev => ({
                                             ...prev,
                                             selectedOptions: {
                                               ...updatedSelectedOptions,
                                               [option.id]: [choice.id]
                                             }
                                           }))
                                         }
                                       }}
                                       className="text-blue-600 focus:ring-blue-500"
                                     />
                                     <div className="flex-1">
                                                                               <div className="text-sm font-medium text-gray-900">
                                          {choice.name}
                                        </div>
                                     </div>
                                   </div>
                                   
                                   {/* 요금 입력칸 */}
                                   <div className="grid grid-cols-3 gap-2">
                                     <div>
                                       <label className="block text-xs text-gray-600 mb-1">성인</label>
                                       <input
                                         type="number"
                                         placeholder="0"
                                         defaultValue={choice.adult_price_adjustment || 0}
                                         onChange={(e) => {
                                           const value = Number(e.target.value) || 0
                                           setFormData(prev => ({
                                             ...prev,
                                             selectedOptionPrices: {
                                               ...prev.selectedOptionPrices,
                                               [`${option.id}_${choice.id}_adult`]: value
                                             }
                                           }))
                                         }}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                       />
                                     </div>
                                     <div>
                                       <label className="block text-xs text-gray-600 mb-1">아동</label>
                                       <input
                                         type="number"
                                         placeholder="0"
                                         defaultValue={choice.child_price_adjustment || 0}
                                         onChange={(e) => {
                                           const value = Number(e.target.value) || 0
                                           setFormData(prev => ({
                                             ...prev,
                                             selectedOptionPrices: {
                                               ...prev.selectedOptionPrices,
                                               [`${option.id}_${choice.id}_child`]: value
                                             }
                                           }))
                                         }}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                       />
                                     </div>
                                     <div>
                                       <label className="block text-xs text-gray-600 mb-1">유아</label>
                                       <input
                                         type="number"
                                         placeholder="0"
                                         defaultValue={choice.infant_price_adjustment || 0}
                                         onChange={(e) => {
                                           const value = Number(e.target.value) || 0
                                           setFormData(prev => ({
                                             ...prev,
                                             selectedOptionPrices: {
                                               ...prev.selectedOptionPrices,
                                               [`${option.id}_${choice.id}_infant`]: value
                                             }
                                           }))
                                         }}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                       />
                                     </div>
                                   </div>
                                 </div>
                               ))
                             })}
                           </div>
                         </div>
                       ))}
                       
                       {Object.keys(getRequiredOptionsForProduct(formData.productId)).length === 0 && (
                         <div className="text-sm text-gray-500 text-center py-4 border border-gray-200 rounded-lg">
                           {t('form.noRequiredOptions')}
                         </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
              
              {/* 4열: 채널 선택 (타입별 탭) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.channel')}</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* 채널 타입별 탭 */}
                  <div className="flex bg-gray-50">
                    {['self', 'ota', 'partner'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, selectedChannelType: type as 'ota' | 'self' | 'partner' }))}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          formData.selectedChannelType === type
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {type === 'self' ? '자체채널' : type === 'ota' ? 'OTA' : '제휴사'}
                      </button>
                    ))}
                  </div>
                  
                  {/* 채널명 검색 */}
                  <div className="p-3 bg-white border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="채널명 검색..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      onChange={(e) => setFormData(prev => ({ ...prev, channelSearch: e.target.value }))}
                    />
                  </div>
                  
                  {/* 채널 선택 리스트 */}
                  <div className="max-h-80 overflow-y-auto">
                    {channels
                      .filter(channel => {
                        const matchesType = channel.type === formData.selectedChannelType
                        const matchesSearch = !formData.channelSearch || 
                          channel.name?.toLowerCase().includes(formData.channelSearch.toLowerCase())
                        return matchesType && matchesSearch
                      })
                      .map(channel => (
                        <div
                          key={channel.id}
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            channelId: prev.channelId === channel.id ? '' : channel.id 
                          }))}
                          className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                            formData.channelId === channel.id ? 'bg-blue-500 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                                                     <div className="text-sm text-gray-900">{channel.name}</div>
                        </div>
                      ))}
                  </div>
                </div>
                
                
              </div>
           </div>

                                

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {reservation ? tCommon('edit') : tCommon('add')}
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

      {/* 고객 추가 모달 */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}
    </div>
  )
}


