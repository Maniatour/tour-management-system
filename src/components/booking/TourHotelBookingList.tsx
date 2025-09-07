'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import TourHotelBookingForm from './TourHotelBookingForm';
import BookingHistory from './BookingHistory';

interface TourHotelBooking {
  id: string;
  tour_id: string;
  submit_on: string;
  check_in_date: string;
  check_out_date: string;
  reservation_name: string;
  submitted_by: string;
  cc: string;
  rooms: number;
  city: string;
  hotel: string;
  room_type: string;
  unit_price: number;
  total_price: number;
  payment_method: string;
  website: string;
  rn_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  tours?: {
    tour_date: string;
    products?: {
      name: string;
    };
  };
}

export default function TourHotelBookingList() {
  const [bookings, setBookings] = useState<TourHotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TourHotelBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // 먼저 tour_hotel_bookings만 조회
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .order('check_in_date', { ascending: false });

      if (bookingsError) throw bookingsError;

      console.log('투어 호텔 부킹 데이터:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // tour_id가 있는 부킹들만 필터링
      const bookingsWithTourId = bookingsData.filter(booking => booking.tour_id);
      
      console.log('투어 ID가 있는 호텔 부킹들:', bookingsWithTourId);
      
      if (bookingsWithTourId.length === 0) {
        setBookings(bookingsData);
        return;
      }

      // 모든 tour_id를 한 번에 조회
      const tourIds = [...new Set(bookingsWithTourId.map(booking => booking.tour_id))];
      
      console.log('조회할 투어 ID들:', tourIds);
      
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          products (
            name
          )
        `)
        .in('id', tourIds);

      console.log('투어 데이터:', toursData);
      console.log('투어 조회 오류:', toursError);

      if (toursError) {
        console.warn('투어 정보 조회 오류:', toursError);
        setBookings(bookingsData);
        return;
      }

      // tours 데이터를 Map으로 변환하여 빠른 조회 가능하게 함
      const toursMap = new Map();
      (toursData || []).forEach(tour => {
        toursMap.set(tour.id, tour);
      });

      console.log('투어 맵:', toursMap);

      // 부킹 데이터에 투어 정보 추가
      const bookingsWithTours = bookingsData.map(booking => {
        if (booking.tour_id && toursMap.has(booking.tour_id)) {
          const tour = toursMap.get(booking.tour_id);
          console.log(`호텔 부킹 ${booking.id}의 투어 정보:`, tour);
          return {
            ...booking,
            tours: {
              tour_date: tour.tour_date,
              products: tour.products
            }
          };
        }
        console.log(`호텔 부킹 ${booking.id}에 투어 정보 없음 (tour_id: ${booking.tour_id})`);
        return booking;
      });

      console.log('최종 호텔 부킹 데이터:', bookingsWithTours);
      setBookings(bookingsWithTours);
    } catch (error) {
      console.error('투어 호텔 부킹 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (booking: TourHotelBooking) => {
    setEditingBooking(booking);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 부킹을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('tour_hotel_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setBookings(prev => prev.filter(booking => booking.id !== id));
    } catch (error) {
      console.error('투어 호텔 부킹 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleViewHistory = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowHistory(true);
  };

  const handleSave = (booking: TourHotelBooking) => {
    if (editingBooking) {
      setBookings(prev => 
        prev.map(b => b.id === booking.id ? { ...booking, tours: b.tours } : b)
      );
    } else {
      setBookings(prev => [booking, ...prev]);
    }
    setShowForm(false);
    setEditingBooking(null);
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.hotel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.reservation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.rn_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    const matchesDate = !dateFilter || booking.check_in_date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'confirmed': return '확정';
      case 'cancelled': return '취소';
      case 'completed': return '완료';
      default: return status;
    }
  };

  const getCCStatusText = (cc: string) => {
    switch (cc) {
      case 'sent': return 'CC 발송 완료';
      case 'not_sent': return '미발송';
      case 'not_needed': return '필요없음';
      default: return cc || '-';
    }
  };

  const getCCStatusColor = (cc: string) => {
    switch (cc) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'not_sent': return 'bg-yellow-100 text-yellow-800';
      case 'not_needed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'credit_card': return '신용카드';
      case 'bank_transfer': return '계좌이체';
      case 'cash': return '현금';
      case 'other': return '기타';
      default: return method;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold">투어 호텔 부킹 관리</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          새 부킹 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            검색
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="호텔명, 도시, 예약명, RN# 검색..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태 필터
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">모든 상태</option>
            <option value="pending">대기중</option>
            <option value="confirmed">확정</option>
            <option value="cancelled">취소</option>
            <option value="completed">완료</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            체크인 날짜
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  호텔/도시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  예약자명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  체크인/아웃
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  객실 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가격 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  결제 방법
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  투어
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {booking.hotel}
                    </div>
                    <div className="text-sm text-gray-500">
                      {booking.city}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {booking.reservation_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>체크인: {booking.check_in_date}</div>
                    <div>체크아웃: {booking.check_out_date}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>객실 수: {booking.rooms}</div>
                    <div className="text-xs text-gray-500">
                      {booking.room_type || '타입 미지정'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>단가: ${booking.unit_price}</div>
                    <div className="font-medium">총액: ${booking.total_price}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      <div>결제: {getPaymentMethodText(booking.payment_method) || '-'}</div>
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                          {getCCStatusText(booking.cc)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {booking.tours ? (
                      <div>
                        <div>{booking.tours.tour_date}</div>
                        <div className="text-xs text-gray-500">
                          {booking.tours.products?.name || '상품명 없음'}
                        </div>
                      </div>
                    ) : (
                      '투어 없음'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(booking)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleViewHistory(booking.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        히스토리
                      </button>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBookings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || statusFilter !== 'all' || dateFilter 
              ? '검색 조건에 맞는 부킹이 없습니다.' 
              : '등록된 투어 호텔 부킹이 없습니다.'
            }
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <TourHotelBookingForm
          booking={editingBooking || undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingBooking(null);
          }}
        />
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <BookingHistory
          bookingType="hotel"
          bookingId={selectedBookingId}
          onClose={() => {
            setShowHistory(false);
            setSelectedBookingId('');
          }}
        />
      )}
    </div>
  );
}
