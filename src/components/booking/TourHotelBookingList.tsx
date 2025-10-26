'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import TourHotelBookingForm from './TourHotelBookingForm';
import BookingHistory from './BookingHistory';
import { Grid, Calendar as CalendarIcon, Plus, Search, Calendar } from 'lucide-react';

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
      name_en?: string;
    };
  } | undefined;
}

export default function TourHotelBookingList() {
  const locale = useLocale();
  const t = useTranslations('booking.calendar');
  const [bookings, setBookings] = useState<TourHotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TourHotelBooking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'card' | 'calendar'>('calendar');

  // 상품 이름을 로케일에 따라 반환하는 함수
  const getProductName = (product: { name?: string; name_en?: string; name_ko?: string } | undefined) => {
    if (!product) return t('tour');
    
    if (locale === 'en') {
      // 영어 로케일인 경우
      if (product.name_en && product.name_en !== product.name) {
        return product.name_en;
      }
      
      // name_en이 없거나 한국어와 동일한 경우, 한국어 이름을 영어로 변환
      const koreanToEnglish: { [key: string]: string } = {
        '야경투어': 'Night Tour',
        '그랜드서클': 'Grand Circle',
        '도깨비 그랜드캐년 일출 투어': 'Goblin Grand Canyon Sunrise Tour',
        '웨스트림': 'West Rim',
        '공항 픽업 서비스': 'Airport Pickup Service',
        '불의 계곡': 'Valley of Fire',
        '그랜드캐년': 'Grand Canyon',
        '자이언 캐니언': 'Zion Canyon',
        '브라이스 캐니언': 'Bryce Canyon',
        '라스베가스': 'Las Vegas',
        '앤텔롭 캐니언': 'Antelope Canyon',
        '후버댐': 'Hoover Dam',
        '데쓰밸리': 'Death Valley',
        '모뉴먼트 밸리': 'Monument Valley',
        '그랜드서클 1박 2일 투어': 'Grand Circle 1 Night 2 Days Tour',
        '그랜드서클 당일 투어': 'Grand Circle Day Tour',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤틸롭캐년': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 엔텔롭캐년': 'Goblin Grand Canyon Sunrise Tour Antelope Canyon',
        '도깨비 그랜드캐년 일출 투어 + 앤텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 그랜드캐년 일출 투어 + 엔텔롭캐년 + 홀슈밴드': 'Goblin Grand Canyon Sunrise Tour + Antelope Canyon + Horseshoe Bend',
        '도깨비 X': 'Goblin Grand Canyon Sunrise Tour + Antelope X Canyon',
        '도깨비 프라이빗': 'Goblin Private Tour',
        '2박3일': '2 Nights 3 Days',
        '엔텔롭캐년': 'Antelope Canyon',
        '앤텔롭캐년': 'Antelope Canyon',
        '앤틸롭캐년': 'Antelope Canyon'
      };
      
      return koreanToEnglish[product.name || ''] || product.name || t('tour');
    } else {
      // 한국어 로케일인 경우
      return product.name_ko || product.name || t('tour');
    }
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<TourHotelBooking[]>([]);

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
        .order('check_in_date', { ascending: false }) as { data: TourHotelBooking[] | null; error: Error | null };

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
            name,
            name_en
          )
        `)
        .in('id', tourIds) as { data: Array<{ id: string; tour_date: string; products: { name: string; name_en?: string } | null }> | null; error: Error | null };

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
        prev.map(b => b.id === booking.id ? { ...booking, tours: b.tours } as TourHotelBooking : b)
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
      case 'pending': return t('pending');
      case 'confirmed': return t('confirmed');
      case 'cancelled': return t('cancelled');
      case 'completed': return t('completed');
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

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleBookingClick = (bookings: TourHotelBooking[]) => {
    setSelectedBookings(bookings);
    setShowBookingModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="flex items-center justify-between px-1 sm:px-6 py-4">
        <h2 className="text-lg sm:text-2xl font-bold">{t('tourHotelBookingManagement')}</h2>
        <div className="flex items-center space-x-2">
          {/* 뷰 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarIcon size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-base flex items-center space-x-1"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{t('addNewBooking')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </button>
        </div>
      </div>

      {/* 필터 - 모바일 최적화 */}
      <div className="px-1 sm:px-6 py-4">
        <div className="flex flex-row sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            >
              <option value="all">{t('allStatus')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="confirmed">{t('confirmed')}</option>
              <option value="cancelled">{t('cancelled')}</option>
              <option value="completed">{t('completed')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('checkInDate')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 표시 영역 */}
      <div className="px-1 sm:px-6">
        {viewMode === 'calendar' ? (
          /* 달력 뷰 - 실제 달력 UI에 라벨로 표시 */
          <div>
            <div>
              {(() => {
                console.log('필터된 호텔 부킹 데이터:', filteredBookings);
                console.log('호텔 부킹 개수:', filteredBookings.length);
                
                // 체크인-체크아웃 날짜 범위로 그룹화 (2박 예약의 경우 오버래핑)
                const groupedByDateRange = filteredBookings.reduce((groups, booking) => {
                  const checkInDate = new Date(booking.check_in_date);
                  const checkOutDate = new Date(booking.check_out_date);
                  
                  // 체크인부터 체크아웃 전날까지 모든 날짜에 추가
                  const currentDate = new Date(checkInDate);
                  while (currentDate < checkOutDate) {
                    const dateString = currentDate.toISOString().split('T')[0];
                    if (!groups[dateString]) {
                      groups[dateString] = [];
                    }
                    groups[dateString].push(booking);
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                  return groups;
                }, {} as Record<string, TourHotelBooking[]>);
                
                console.log('날짜별 그룹화된 호텔 데이터:', groupedByDateRange);
                
                console.log('최종 호텔 그룹화된 데이터:', groupedByDateRange);

                // 선택된 월 기준으로 달력 생성
                const now = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();
                
                // 이번 달의 첫 번째 날
                const firstDay = new Date(currentYear, currentMonth, 1);
                const startDate = new Date(firstDay);
                startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작
                
                // 6주 표시를 위해 42일 생성
                const calendarDays = [];
                for (let i = 0; i < 42; i++) {
                  const date = new Date(startDate);
                  date.setDate(startDate.getDate() + i);
                  calendarDays.push(date);
                }

                const monthNames = t.raw('monthNames');
                const dayNames = t.raw('dayNames');

                return (
                  <div className="space-y-4">
                    {/* 달력 헤더 */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={goToPreviousMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="이전 달"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="text-center">
                        <h4 className="text-xl font-semibold text-gray-900">
                          {currentYear} {monthNames[currentMonth]}
                        </h4>
                        <button
                          onClick={goToToday}
                          className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                        >
                          {t('goToToday')}
                        </button>
                      </div>
                      
                      <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        title="다음 달"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1">
                      {dayNames.map((day: string) => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                          {day}
                        </div>
                      ))}
                        </div>

                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((date, index) => {
                        const dateString = date.toISOString().split('T')[0];
                        const isCurrentMonth = date.getMonth() === currentMonth;
                        const isToday = date.toDateString() === now.toDateString();
                        const dayBookings = groupedByDateRange[dateString] || [];
                        const totalRooms = dayBookings.reduce((sum, booking) => sum + booking.rooms, 0);
                        
                        // 디버깅: 해당 날짜에 호텔 부킹이 있는지 확인
                        if (dayBookings.length > 0) {
                          console.log(`${dateString}에 호텔 부킹 ${dayBookings.length}개:`, dayBookings);
                        }

                        return (
                          <div
                            key={index}
                            className={`min-h-[120px] p-2 border border-gray-200 ${
                              isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                            } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                          >
                            <div className={`text-sm font-medium mb-1 ${
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            } ${isToday ? 'text-blue-600' : ''}`}>
                              {date.getDate()}
                        </div>
                            
                             {/* 호텔 부킹 정보 라벨 */}
                             {dayBookings.length > 0 && (
                               <div className="space-y-0.5">
                                 <div className="text-xs text-blue-600 font-semibold">
                                   {t('totalRooms')} {totalRooms}
                                 </div>
                                {(() => {
                                  // 호텔별로 그룹화하고 체크인 시간순으로 정렬
                                  const hotelGroups = dayBookings.reduce((groups, booking) => {
                                    const hotel = booking.hotel;
                                    if (!groups[hotel]) {
                                      groups[hotel] = [];
                                    }
                                    groups[hotel].push(booking);
                                    return groups;
                                  }, {} as Record<string, TourHotelBooking[]>);

                                  // 각 호텔별로 체크인 시간순 정렬
                                  Object.keys(hotelGroups).forEach(hotel => {
                                    hotelGroups[hotel].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
                                  });

                                  // 호텔별로 정렬 (체크인 시간순)
                                  const sortedHotels = Object.keys(hotelGroups).sort((a, b) => {
                                    const aTime = hotelGroups[a][0].check_in_date;
                                    const bTime = hotelGroups[b][0].check_in_date;
                                    return aTime.localeCompare(bTime);
                                  });

                                  return sortedHotels.map((hotel) => {
                                    const hotelBookings = hotelGroups[hotel];
                                    const firstBooking = hotelBookings[0];
                                    
                                     // 호텔명 단축 및 색상 구분
                                     let displayName = hotel;
                                     let hotelBgColor = '';
                                     if (hotel.length > 10) {
                                       displayName = hotel.substring(0, 10) + '...';
                                     }
                                     
                                     // 호텔별로 다른 색상 적용
                                     const hotelColors = ['bg-purple-200 text-purple-800', 'bg-orange-200 text-orange-800', 'bg-pink-200 text-pink-800', 'bg-indigo-200 text-indigo-800', 'bg-green-200 text-green-800', 'bg-red-200 text-red-800'];
                                     const colorIndex = hotel.length % hotelColors.length;
                                     hotelBgColor = hotelColors[colorIndex];

                                     // 룸타입별로 그룹화
                                     const roomTypeGroups = hotelBookings.reduce((groups, booking) => {
                                       const roomType = booking.room_type || '기본';
                                       if (!groups[roomType]) {
                                         groups[roomType] = 0;
                                       }
                                       groups[roomType] += booking.rooms;
                                       return groups;
                                     }, {} as Record<string, number>);

                                     const roomTypeText = Object.entries(roomTypeGroups)
                                       .map(([type, count]) => `${type}(${count})`)
                                       .join(', ');

                                     // 투어 상품 이름 가져오기
                                     const tourProductName = getProductName(firstBooking.tours?.products);
                                     const tourInfo = tourProductName ? ` [${tourProductName}]` : '';

                                     return (
                                      <div
                                        key={hotel}
                                        className={`px-1 py-0.5 rounded text-[8px] sm:text-[10px] cursor-pointer hover:opacity-80 ${hotelBgColor} truncate`}
                                        title={`${hotel} - ${roomTypeText} - 체크인: ${firstBooking.check_in_date} ~ 체크아웃: ${firstBooking.check_out_date}${tourInfo ? ` - 투어: ${tourProductName}` : ''}`}
                                        onClick={() => handleBookingClick(hotelBookings)}
                                      >
                                        <span className="font-bold">{displayName}</span> <span>{roomTypeText}</span>{tourInfo}
                                      </div>
                                     );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                     {/* 범례 */}
                     <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                       <div className="text-sm font-medium text-gray-700 mb-2">{t('statusLegend')}</div>
                       <div className="flex flex-wrap gap-2">
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                           {t('pending')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                           {t('confirmed')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                           {t('cancelled')}
                         </span>
                         <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                           {t('completed')}
                         </span>
                       </div>
                       <div className="mt-3">
                         <div className="text-sm font-medium text-gray-700 mb-2">{t('hotelCategory')}</div>
                         <div className="flex flex-wrap gap-2">
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                             {t('hotelA')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-200 text-orange-800">
                             {t('hotelB')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-pink-200 text-pink-800">
                             {t('hotelC')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-200 text-indigo-800">
                             {t('hotelD')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">
                             {t('hotelE')}
                           </span>
                           <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800">
                             {t('hotelF')}
                           </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: t('hotelLegendDescription') }} />
                        </div>
                     </div>
                        </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* 카드뷰 - 모바일 최적화 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="p-4 sm:p-6">
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {booking.hotel}
                      </h3>
                      <p className="text-sm text-gray-600">{booking.city}</p>
                      <p className="text-xs text-gray-500 mt-1">{booking.reservation_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </div>

                  {/* 카드 내용 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('checkInDate')}</span>
                      <span className="font-medium">{booking.check_in_date}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('checkOutDate')}</span>
                      <span className="font-medium">{booking.check_out_date}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('rooms')}</span>
                      <span className="font-medium">{booking.rooms}개</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('roomType')}</span>
                      <span className="font-medium truncate ml-2">{booking.room_type || '타입 미지정'}</span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">{t('unitPrice')}</span>
                        <span className="font-medium">${booking.unit_price}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('totalPrice')}</span>
                        <span className="font-medium text-blue-600">${booking.total_price}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-sm">
                        <span className="text-gray-500">{t('paymentMethod')}</span>
                        <div className="mt-1 font-medium">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                          {getCCStatusText(booking.cc)}
                        </span>
                      </div>
                    </div>

                    {booking.tours && (
                      <div className="border-t pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">투어</span>
                          <div className="mt-1">
                            <div className="font-medium">{booking.tours.tour_date}</div>
                            <div className="text-xs text-gray-500">
                              {getProductName(booking.tours?.products)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(booking)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                      >
                        {t('edit')}
                      </button>
                      <button
                        onClick={() => handleViewHistory(booking.id)}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                      >
                        {t('history')}
                      </button>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredBookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg font-medium mb-2">
              {searchTerm || statusFilter !== 'all' || dateFilter 
                ? '검색 조건에 맞는 부킹이 없습니다.' 
                : '등록된 투어 호텔 부킹이 없습니다.'
              }
            </div>
            <p className="text-sm text-gray-400">
              {!searchTerm && statusFilter === 'all' && !dateFilter && '새 부킹을 추가해보세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && editingBooking && (
        <TourHotelBookingForm
          booking={editingBooking}
          onSave={(booking: unknown) => handleSave(booking as TourHotelBooking)}
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

      {/* 부킹 상세 모달 */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">호텔 예약 상세 정보</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedBookings.map((booking) => (
                  <div key={booking.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                          {booking.hotel}
                        </h4>
                        <p className="text-sm text-gray-600">{booking.city}</p>
                        <p className="text-xs text-gray-500 mt-1">{booking.reservation_name}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('checkInDate')}</span>
                        <span className="font-medium">{booking.check_in_date}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('checkOutDate')}</span>
                        <span className="font-medium">{booking.check_out_date}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('rooms')}</span>
                        <span className="font-medium">{booking.rooms}개</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('roomType')}</span>
                        <span className="font-medium truncate ml-2">{booking.room_type || '타입 미지정'}</span>
                      </div>
                      
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500">{t('unitPrice')}</span>
                          <span className="font-medium">${booking.unit_price}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{t('totalPrice')}</span>
                          <span className="font-medium text-blue-600">${booking.total_price}</span>
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <div className="text-sm">
                          <span className="text-gray-500">{t('paymentMethod')}</span>
                          <div className="mt-1 font-medium">{getPaymentMethodText(booking.payment_method) || '-'}</div>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCCStatusColor(booking.cc)}`}>
                            {getCCStatusText(booking.cc)}
                          </span>
                        </div>
                      </div>

                      {booking.tours && (
                        <div className="border-t pt-2">
                          <div className="text-sm">
                            <span className="text-gray-500">투어</span>
                            <div className="mt-1">
                              <div className="font-medium">{booking.tours.tour_date}</div>
                              <div className="text-xs text-gray-500">
                                {getProductName(booking.tours?.products)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingBooking(booking);
                            setShowForm(true);
                            setShowBookingModal(false);
                          }}
                          className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookingId(booking.id);
                            setShowHistory(true);
                            setShowBookingModal(false);
                          }}
                          className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                        >
                          {t('history')}
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(booking.id);
                            setShowBookingModal(false);
                          }}
                          className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


