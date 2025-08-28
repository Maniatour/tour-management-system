'use client'

import { useState, use } from 'react'
import { Plus, Search, Edit, Trash2, Calendar, Clock, MapPin, Users, User, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
}

interface Product {
  id: string
  name: string
  category: string
  basePrice: {
    adult: number
    child: number
    infant: number
  }
}

interface Channel {
  id: string
  name: string
  type: string
}

interface AdminReservationsProps {
  params: Promise<{ locale: string }>
}

export default function AdminReservations({ params }: AdminReservationsProps) {
  const { locale } = use(params)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  
  // 예약 데이터
  const [reservations, setReservations] = useState<Reservation[]>([
    {
      id: '1',
      customerId: '1',
      productId: '1',
      tourDate: '2024-02-15',
      tourTime: '09:00',
      eventNote: '특별 요청: 영어 가이드 필요',
      pickUpHotel: '롯데호텔 서울',
      pickUpTime: '08:30',
      adults: 2,
      child: 1,
      infant: 0,
      totalPeople: 3,
      channelId: '2',
      channelRN: 'NAV-2024-001',
      addedBy: '김관리',
      addedTime: '2024-01-20 14:30',
      tourId: 'TOUR-001',
      status: 'confirmed'
    },
    {
      id: '2',
      customerId: '2',
      productId: '2',
      tourDate: '2024-02-18',
      tourTime: '14:00',
      eventNote: '제주 투어 - 렌터카 필요',
      pickUpHotel: '신라호텔 제주',
      pickUpTime: '13:30',
      adults: 1,
      child: 0,
      infant: 0,
      totalPeople: 1,
      channelId: '3',
      channelRN: 'KKO-2024-002',
      addedBy: '이관리',
      addedTime: '2024-01-21 10:15',
      tourId: 'TOUR-002',
      status: 'pending'
    },
    {
      id: '3',
      customerId: '3',
      productId: '1',
      tourDate: '2024-02-20',
      tourTime: '10:00',
      eventNote: '가족 투어 - 아이들 장난감 필요',
      pickUpHotel: '그랜드 하얏트 서울',
      pickUpTime: '09:30',
      adults: 2,
      child: 2,
      infant: 1,
      totalPeople: 5,
      channelId: '1',
      channelRN: 'DIR-2024-003',
      addedBy: '박관리',
      addedTime: '2024-01-22 16:45',
      tourId: 'TOUR-003',
      status: 'confirmed'
    }
  ])

  // 고객 데이터 (실제로는 API에서 가져와야 함)
  const [customers] = useState<Customer[]>([
    { id: '1', name: '김철수', email: 'kim@example.com', phone: '010-1234-5678' },
    { id: '2', name: '이영희', email: 'lee@example.com', phone: '010-2345-6789' },
    { id: '3', name: '박민수', email: 'park@example.com', phone: '010-3456-7890' }
  ])

  // 상품 데이터 (실제로는 API에서 가져와야 함)
  const [products] = useState<Product[]>([
    { id: '1', name: '서울 도시 투어', category: 'city', basePrice: { adult: 50, child: 35, infant: 15 } },
    { id: '2', name: '제주 자연 투어', category: 'nature', basePrice: { adult: 80, child: 50, infant: 20 } },
    { id: '3', name: '경주 문화 투어', category: 'culture', basePrice: { adult: 60, child: 40, infant: 10 } }
  ])

  // 채널 데이터 (실제로는 API에서 가져와야 함)
  const [channels] = useState<Channel[]>([
    { id: '1', name: '직접 방문', type: 'Direct' },
    { id: '2', name: '네이버 여행', type: 'OTA' },
    { id: '3', name: '카카오 여행', type: 'OTA' }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

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
    if (!product) return 0
    
    return (
      reservation.adults * product.basePrice.adult +
      reservation.child * product.basePrice.child +
      reservation.infant * product.basePrice.infant
    )
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

      {/* 예약 추가/편집 모달 */}
      {(showAddForm || editingReservation) && (
        <ReservationForm
          reservation={editingReservation}
          customers={customers}
          products={products}
          channels={channels}
          onSubmit={editingReservation ? handleEditReservation : handleAddReservation}
          onCancel={() => {
            setShowAddForm(false)
            setEditingReservation(null)
          }}
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
  onSubmit: (reservation: Omit<Reservation, 'id'>) => void
  onCancel: () => void
}

function ReservationForm({ reservation, customers, products, channels, onSubmit, onCancel }: ReservationFormProps) {
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    customerId: reservation?.customerId || '',
    productId: reservation?.productId || '',
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
    channelRN: reservation?.channelRN || '',
    addedBy: reservation?.addedBy || '',
    addedTime: reservation?.addedTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
    tourId: reservation?.tourId || '',
    status: reservation?.status || 'pending' as 'pending' | 'confirmed' | 'completed' | 'cancelled'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {reservation ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.customer')}</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{t('form.selectCustomer')}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.product')}</label>
              <select
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{t('form.selectProduct')}</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

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
                onChange={(e) => setFormData({ ...formData, tourTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

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
                onChange={(e) => setFormData({ ...formData, pickUpTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* 참가자 수 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.participants')}</label>
            <div className="grid grid-cols-3 gap-4">
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
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {t('form.totalParticipants')}: <span className="font-medium">{formData.totalPeople}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.channel')}</label>
              <select
                value={formData.channelId}
                onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{t('form.selectChannel')}</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.type})
                  </option>
                ))}
              </select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.addedBy')}</label>
              <input
                type="text"
                value={formData.addedBy}
                onChange={(e) => setFormData({ ...formData, addedBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">{t('status.pending')}</option>
                <option value="confirmed">{t('status.confirmed')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
              </select>
            </div>
          </div>

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
    </div>
  )
}
